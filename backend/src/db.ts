import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

// SQLite in WAL mode comfortably serves this workload well past seven
// figures of ARR for a single-region consumer app (reads dominate, writes
// are tiny). One file, trivial backups (litestream/cron), zero infra.
// If/when multi-region or heavy concurrent writes arrive, the queries
// below are plain SQL — porting to Postgres is mechanical.

const DB_PATH = process.env.DATABASE_PATH ?? "./data/goldpricer.db";

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  apple_sub TEXT UNIQUE NOT NULL,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  referred_by TEXT REFERENCES users(id),
  plan TEXT NOT NULL DEFAULT 'free',
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_invite ON users(invite_code);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL REFERENCES users(id),
  referee_id TEXT UNIQUE NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'verified',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  props TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_name_time ON events(name, created_at);
CREATE INDEX IF NOT EXISTS idx_events_user_time ON events(user_id, created_at);

CREATE TABLE IF NOT EXISTS subscription_events (
  id TEXT PRIMARY KEY,
  notification_type TEXT,
  subtype TEXT,
  product_id TEXT,
  original_transaction_id TEXT,
  raw_payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`);

export interface UserRow {
  id: string;
  apple_sub: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  invite_code: string;
  referred_by: string | null;
  plan: string;
  created_at: number;
  last_seen_at: number;
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function newInviteCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export function upsertUser(input: {
  appleSub: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): UserRow {
  const now = Date.now();
  const existing = db
    .prepare("SELECT * FROM users WHERE apple_sub = ?")
    .get(input.appleSub) as UserRow | undefined;

  if (existing) {
    db.prepare(
      `UPDATE users SET
         last_seen_at = ?,
         email = COALESCE(?, email),
         first_name = COALESCE(?, first_name),
         last_name = COALESCE(?, last_name)
       WHERE id = ?`
    ).run(now, input.email ?? null, input.firstName ?? null, input.lastName ?? null, existing.id);
    return db.prepare("SELECT * FROM users WHERE id = ?").get(existing.id) as UserRow;
  }

  // Retry on the (unlikely) invite-code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const id = randomUUID();
      db.prepare(
        `INSERT INTO users (id, apple_sub, email, first_name, last_name, invite_code, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        input.appleSub,
        input.email ?? null,
        input.firstName ?? null,
        input.lastName ?? null,
        newInviteCode(),
        now,
        now
      );
      return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow;
    } catch (err: any) {
      if (!String(err?.message).includes("UNIQUE") || attempt === 4) throw err;
    }
  }
  throw new Error("unreachable");
}

export function touchUser(userId: string): void {
  db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").run(Date.now(), userId);
}

export function getUser(userId: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as UserRow | undefined;
}

export function findUserByInviteCode(code: string): UserRow | undefined {
  return db
    .prepare("SELECT * FROM users WHERE invite_code = ?")
    .get(code.toUpperCase()) as UserRow | undefined;
}

export function recordEvent(userId: string | null, name: string, props?: unknown): void {
  db.prepare(
    "INSERT INTO events (id, user_id, name, props, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(randomUUID(), userId, name, props ? JSON.stringify(props) : null, Date.now());
}

export function hasEvent(userId: string, name: string): boolean {
  return !!db
    .prepare("SELECT 1 FROM events WHERE user_id = ? AND name = ? LIMIT 1")
    .get(userId, name);
}

export function createReferral(referrerId: string, refereeId: string): boolean {
  try {
    db.prepare(
      "INSERT INTO referrals (id, referrer_id, referee_id, created_at) VALUES (?, ?, ?, ?)"
    ).run(randomUUID(), referrerId, refereeId, Date.now());
    db.prepare("UPDATE users SET referred_by = ? WHERE id = ?").run(referrerId, refereeId);
    return true;
  } catch {
    return false; // referee already redeemed once
  }
}

export function referralCount(referrerId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM referrals WHERE referrer_id = ? AND status = 'verified'")
    .get(referrerId) as { n: number };
  return row.n;
}

/** Erase a user and everything attached to them (GDPR/App Store deletion). */
export function deleteUser(userId: string): void {
  const wipe = db.transaction(() => {
    db.prepare("DELETE FROM events WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM referrals WHERE referrer_id = ? OR referee_id = ?").run(
      userId,
      userId
    );
    db.prepare("UPDATE users SET referred_by = NULL WHERE referred_by = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  });
  wipe();
}
