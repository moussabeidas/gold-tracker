import { db } from "./db.js";

const DAY = 24 * 60 * 60 * 1000;

function count(sql: string, ...params: unknown[]): number {
  const row = db.prepare(sql).get(...params) as { n: number };
  return row.n;
}

/** Everything the admin dashboard renders, in one call. */
export function computeStats() {
  const now = Date.now();

  const totals = {
    users: count("SELECT COUNT(*) AS n FROM users"),
    referrals: count("SELECT COUNT(*) AS n FROM referrals WHERE status='verified'"),
    events: count("SELECT COUNT(*) AS n FROM events"),
    proUsers: count("SELECT COUNT(*) AS n FROM users WHERE plan != 'free'"),
  };

  const active = {
    dau: count("SELECT COUNT(*) AS n FROM users WHERE last_seen_at > ?", now - DAY),
    wau: count("SELECT COUNT(*) AS n FROM users WHERE last_seen_at > ?", now - 7 * DAY),
    mau: count("SELECT COUNT(*) AS n FROM users WHERE last_seen_at > ?", now - 30 * DAY),
  };

  // New users per day, last 30 days.
  const signupsByDay = db
    .prepare(
      `SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS n
       FROM users WHERE created_at > ?
       GROUP BY day ORDER BY day`
    )
    .all(now - 30 * DAY) as { day: string; n: number }[];

  // Core funnel over the last 30 days (unique users per stage).
  const funnelStage = (name: string) =>
    count(
      `SELECT COUNT(DISTINCT user_id) AS n FROM events
       WHERE name = ? AND created_at > ? AND user_id IS NOT NULL`,
      name,
      now - 30 * DAY
    );
  const funnel = {
    appOpen: funnelStage("app_open"),
    goldAdded: funnelStage("gold_added"),
    paywallView: funnelStage("paywall_view"),
    subscribed: funnelStage("subscribe_success"),
  };

  // Top events, last 7 days.
  const topEvents = db
    .prepare(
      `SELECT name, COUNT(*) AS n FROM events
       WHERE created_at > ? GROUP BY name ORDER BY n DESC LIMIT 12`
    )
    .all(now - 7 * DAY) as { name: string; n: number }[];

  // Referral leaderboard.
  const topReferrers = db
    .prepare(
      `SELECT u.invite_code AS code,
              COALESCE(u.first_name, 'User') AS name,
              COUNT(r.id) AS n
       FROM referrals r JOIN users u ON u.id = r.referrer_id
       WHERE r.status = 'verified'
       GROUP BY r.referrer_id ORDER BY n DESC LIMIT 10`
    )
    .all() as { code: string; name: string; n: number }[];

  // Subscription activity from App Store Server Notifications.
  const subEvents = db
    .prepare(
      `SELECT notification_type, COUNT(*) AS n FROM subscription_events
       WHERE created_at > ? GROUP BY notification_type ORDER BY n DESC`
    )
    .all(now - 30 * DAY) as { notification_type: string | null; n: number }[];

  const k30 =
    totals.users > 0
      ? Math.round((totals.referrals / Math.max(active.mau, 1)) * 100) / 100
      : 0;

  return {
    generatedAt: now,
    totals,
    active,
    signupsByDay,
    funnel,
    topEvents,
    topReferrers,
    subEvents,
    kFactorProxy: k30,
  };
}
