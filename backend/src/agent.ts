import Anthropic from "@anthropic-ai/sdk";
import Database from "better-sqlite3";

import { db, getUser } from "./db.js";
import { computeStats } from "./stats.js";

// Admin copilot: a Claude agent with typed tools over the dashboard data.
// Reads go through a read-only SQLite connection; the only write surface is
// the explicit set_user_plan tool.

const MODEL = "claude-opus-4-8";
const MAX_ITERATIONS = 10;

const DB_PATH = process.env.DATABASE_PATH ?? "./data/goldpricer.db";
let readonlyDb: Database.Database | null = null;

function getReadonlyDb(): Database.Database {
  if (!readonlyDb) {
    readonlyDb = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  }
  return readonlyDb;
}

const SYSTEM_PROMPT = `You are the operations copilot for Gold Pricer, an iOS app that tracks the live gold price and users' physical gold portfolios. You are talking to the app's owner inside their admin dashboard.

The backend is SQLite with these tables:
- users(id, apple_sub, email, first_name, last_name, invite_code, referred_by, plan, created_at, last_seen_at) — timestamps are epoch milliseconds; plan is 'free' | 'tracker_monthly' | 'tracker_annual' | 'lifetime'
- referrals(id, referrer_id, referee_id, status, created_at)
- events(id, user_id, name, props, created_at) — analytics events; key names: app_open, gold_added, paywall_view, subscribe_success, share_price, referral_share, auth, referral_redeemed
- subscription_events(id, notification_type, subtype, product_id, original_transaction_id, created_at) — from App Store Server Notifications

Use your tools to answer with real data, not guesses. Prefer get_stats for overview questions and query_database for anything specific. When asked to change something, confirm what you changed. Money context: Pro pricing is $4.99/month, $29.99/year, $79.99 lifetime; free tier is 2 portfolio slots; the referral program grants +1 slot per verified referral and 6 months of Pro at 10.

Keep answers short and concrete — this is an ops console, not an essay. Format numbers with thousands separators. When a question is ambiguous, make the reasonable interpretation and state it in one clause rather than asking back.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_stats",
    description:
      "Full dashboard statistics snapshot: total users, DAU/WAU/MAU, signups by day (30d), activation funnel (app_open → gold_added → paywall_view → subscribe_success, unique users 30d), top events (7d), referral leaderboard, subscription events (30d). Call this first for any overview, growth, activity, funnel, or referral question.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "query_database",
    description:
      "Run a read-only SQL SELECT against the SQLite database (tables: users, referrals, events, subscription_events). Call this for any specific question get_stats doesn't answer — cohorts, per-user history, counts with custom filters, time comparisons. Timestamps are epoch ms; use e.g. created_at > (strftime('%s','now') - 7*86400) * 1000 for 'last 7 days'. Results are capped at 200 rows — aggregate rather than dumping raw rows.",
    input_schema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "A single SELECT (or WITH...SELECT) statement" },
      },
      required: ["sql"],
      additionalProperties: false,
    },
  },
  {
    name: "search_users",
    description:
      "Look up users by email, first name, or exact invite code. Returns id, email, name, invite code, plan, created/last-seen timestamps. Call this before any per-user action to get the user id.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Email fragment, name fragment, or invite code" },
        limit: { type: "integer", description: "Max rows, default 20" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "set_user_plan",
    description:
      "Change a user's plan in the backend (e.g. comp someone Pro, or revert to free). This edits the dashboard's record only — it does not create or cancel Apple subscriptions. Call only when the admin explicitly asks to change a user's plan.",
    input_schema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "The user's id from search_users" },
        plan: {
          type: "string",
          enum: ["free", "tracker_monthly", "tracker_annual", "lifetime"],
        },
      },
      required: ["user_id", "plan"],
      additionalProperties: false,
    },
  },
];

function runTool(name: string, input: any): string {
  switch (name) {
    case "get_stats":
      return JSON.stringify(computeStats());

    case "query_database": {
      const sql = String(input?.sql ?? "").trim();
      if (!/^(select|with)\b/i.test(sql)) {
        throw new Error("Only SELECT/WITH queries are allowed.");
      }
      const rows = getReadonlyDb().prepare(sql).all();
      return JSON.stringify({ rowCount: rows.length, rows: rows.slice(0, 200) });
    }

    case "search_users": {
      const q = String(input?.query ?? "").trim();
      const limit = Math.min(Number(input?.limit ?? 20), 100);
      const rows = db
        .prepare(
          `SELECT id, email, first_name, last_name, invite_code, plan, created_at, last_seen_at
           FROM users
           WHERE email LIKE ? OR first_name LIKE ? OR invite_code = ?
           ORDER BY last_seen_at DESC LIMIT ?`
        )
        .all(`%${q}%`, `%${q}%`, q.toUpperCase(), limit);
      return JSON.stringify({ users: rows });
    }

    case "set_user_plan": {
      const userId = String(input?.user_id ?? "");
      const plan = String(input?.plan ?? "");
      if (!["free", "tracker_monthly", "tracker_annual", "lifetime"].includes(plan)) {
        throw new Error("Invalid plan.");
      }
      const user = getUser(userId);
      if (!user) throw new Error(`No user with id ${userId}.`);
      db.prepare("UPDATE users SET plan = ? WHERE id = ?").run(plan, userId);
      return JSON.stringify({
        ok: true,
        user: { id: user.id, email: user.email, previousPlan: user.plan, plan },
      });
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export interface ChatResult {
  reply: string;
  history: Anthropic.MessageParam[];
}

export async function runAgentTurn(
  history: Anthropic.MessageParam[],
  userMessage: string
): Promise<ChatResult> {
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: TOOLS,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "pause_turn") continue;

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        try {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: runTool(block.name, block.input),
          });
        } catch (err: any) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: String(err?.message ?? err),
            is_error: true,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // end_turn, max_tokens, refusal — extract the text and stop.
    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { reply: reply || "(no response)", history: messages };
  }

  return {
    reply: "I hit the tool-call limit for a single question — try narrowing it down.",
    history: messages,
  };
}
