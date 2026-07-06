import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { logger } from "hono/logger";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  db,
  upsertUser,
  touchUser,
  getUser,
  findUserByInviteCode,
  recordEvent,
  hasEvent,
  createReferral,
  referralCount,
} from "./db.js";
import {
  verifyAppleIdentityToken,
  issueSessionToken,
  requireUser,
  requireAdmin,
} from "./auth.js";
import { computeStats } from "./stats.js";
import { runAgentTurn } from "./agent.js";

const REFERRAL_TARGET = 10;

type Vars = { userId: string };
const app = new Hono<{ Variables: Vars }>();
app.use("*", logger());

app.get("/health", (c) => c.json({ ok: true }));

// ---------------------------------------------------------------------------
// Auth — Sign in with Apple
// ---------------------------------------------------------------------------

const authBody = z.object({
  identityToken: z.string().min(10),
  firstName: z.string().max(100).optional().nullable(),
  lastName: z.string().max(100).optional().nullable(),
});

app.post("/v1/auth/apple", async (c) => {
  const parsed = authBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad request" }, 400);

  let identity;
  try {
    identity = await verifyAppleIdentityToken(parsed.data.identityToken);
  } catch {
    return c.json({ error: "invalid identity token" }, 401);
  }

  const user = upsertUser({
    appleSub: identity.sub,
    email: identity.email ?? null,
    firstName: parsed.data.firstName ?? null,
    lastName: parsed.data.lastName ?? null,
  });
  recordEvent(user.id, "auth", { method: "apple" });

  return c.json({
    token: await issueSessionToken(user.id),
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      inviteCode: user.invite_code,
    },
  });
});

app.get("/v1/me", requireUser, (c) => {
  const user = getUser(c.get("userId"));
  if (!user) return c.json({ error: "not found" }, 404);
  touchUser(user.id);
  return c.json({
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    inviteCode: user.invite_code,
    plan: user.plan,
  });
});

// ---------------------------------------------------------------------------
// Referrals — server-verified
// ---------------------------------------------------------------------------

app.get("/v1/referrals/status", requireUser, (c) => {
  const userId = c.get("userId");
  const user = getUser(userId);
  if (!user) return c.json({ error: "not found" }, 404);
  const referred = referralCount(userId);
  return c.json({
    inviteCode: user.invite_code,
    referredCount: referred,
    target: REFERRAL_TARGET,
    redeemedCode: user.referred_by ? true : false,
    bonusSlots: referred + (user.referred_by ? 1 : 0),
    proEarned: referred >= REFERRAL_TARGET,
  });
});

const redeemBody = z.object({ code: z.string().min(4).max(10) });

app.post("/v1/referrals/redeem", requireUser, async (c) => {
  const parsed = redeemBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad request" }, 400);

  const userId = c.get("userId");
  const me = getUser(userId);
  if (!me) return c.json({ error: "not found" }, 404);
  if (me.referred_by) return c.json({ error: "already redeemed" }, 409);

  const referrer = findUserByInviteCode(parsed.data.code);
  if (!referrer) return c.json({ error: "invalid code" }, 404);
  if (referrer.id === userId) return c.json({ error: "self referral" }, 400);

  // The deal requires real activation: the redeemer must have added gold.
  if (!hasEvent(userId, "gold_added")) {
    return c.json({ error: "add gold first" }, 412);
  }

  if (!createReferral(referrer.id, userId)) {
    return c.json({ error: "already redeemed" }, 409);
  }
  recordEvent(userId, "referral_redeemed", { referrer: referrer.id });

  return c.json({
    ok: true,
    referrerCount: referralCount(referrer.id),
  });
});

// ---------------------------------------------------------------------------
// Analytics events
// ---------------------------------------------------------------------------

const eventsBody = z.object({
  events: z
    .array(
      z.object({
        name: z.string().min(1).max(64),
        props: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
        at: z.number().optional(),
      })
    )
    .min(1)
    .max(50),
});

app.post("/v1/events", requireUser, async (c) => {
  const parsed = eventsBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad request" }, 400);
  const userId = c.get("userId");
  touchUser(userId);
  for (const ev of parsed.data.events) {
    recordEvent(userId, ev.name, ev.props);
  }
  return c.json({ ok: true, ingested: parsed.data.events.length });
});

// ---------------------------------------------------------------------------
// App Store Server Notifications V2 (subscription lifecycle → revenue stats)
// ---------------------------------------------------------------------------

app.post("/v1/appstore/notifications", async (c) => {
  const body = await c.req.json().catch(() => null);
  const signedPayload: string | undefined = body?.signedPayload;
  if (!signedPayload) return c.json({ error: "bad request" }, 400);

  // Store the raw signed payload always (auditable), plus a best-effort
  // decode for the dashboard. Full x5c chain verification against Apple's
  // root CA should be enabled before gating entitlements on this data —
  // for stats-only use, decode is sufficient.
  let notificationType: string | null = null;
  let subtype: string | null = null;
  let productId: string | null = null;
  let originalTxId: string | null = null;
  try {
    const payload = JSON.parse(
      Buffer.from(signedPayload.split(".")[1], "base64url").toString("utf8")
    );
    notificationType = payload?.notificationType ?? null;
    subtype = payload?.subtype ?? null;
    const txInfo = payload?.data?.signedTransactionInfo;
    if (typeof txInfo === "string") {
      const tx = JSON.parse(Buffer.from(txInfo.split(".")[1], "base64url").toString("utf8"));
      productId = tx?.productId ?? null;
      originalTxId = tx?.originalTransactionId ?? null;
    }
  } catch {}

  db.prepare(
    `INSERT INTO subscription_events
       (id, notification_type, subtype, product_id, original_transaction_id, raw_payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    notificationType,
    subtype,
    productId,
    originalTxId,
    signedPayload,
    Date.now()
  );

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin — stats API + dashboard
// ---------------------------------------------------------------------------

app.get("/v1/admin/stats", requireAdmin, (c) => c.json(computeStats()));

// AI copilot: chat over the dashboard with tool access to stats, user
// search, read-only SQL, and plan changes. Requires ANTHROPIC_API_KEY.
const chatBody = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(z.any()).max(200).optional(),
});

app.post("/v1/admin/chat", requireAdmin, async (c) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return c.json(
      { error: "Set the ANTHROPIC_API_KEY environment variable to enable the copilot." },
      503
    );
  }
  const parsed = chatBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad request" }, 400);
  try {
    const result = await runAgentTurn(
      (parsed.data.history ?? []) as any,
      parsed.data.message
    );
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: String(err?.message ?? err) }, 502);
  }
});

app.get("/v1/admin/users", requireAdmin, (c) => {
  const q = (c.req.query("q") ?? "").trim();
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const rows = q
    ? db
        .prepare(
          `SELECT id, email, first_name, last_name, invite_code, plan, created_at, last_seen_at
           FROM users
           WHERE email LIKE ? OR first_name LIKE ? OR invite_code = ?
           ORDER BY last_seen_at DESC LIMIT ?`
        )
        .all(`%${q}%`, `%${q}%`, q.toUpperCase(), limit)
    : db
        .prepare(
          `SELECT id, email, first_name, last_name, invite_code, plan, created_at, last_seen_at
           FROM users ORDER BY last_seen_at DESC LIMIT ?`
        )
        .all(limit);
  return c.json({ users: rows });
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardHtml = readFileSync(
  join(__dirname, "..", "public", "admin.html"),
  "utf8"
);
app.get("/admin", (c) => c.html(dashboardHtml));

// ---------------------------------------------------------------------------

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Gold Pricer backend listening on :${info.port}`);
});
