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

  // Where users are (ISO code from their sign-in connection).
  const countries = db
    .prepare(
      `SELECT COALESCE(country, '') AS code, COUNT(*) AS n
       FROM users GROUP BY code ORDER BY n DESC, code LIMIT 12`
    )
    .all() as { code: string; n: number }[];

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

  // Aggregate portfolio held across the user base — each user's latest
  // portfolio_snapshot event carries {holdings, grams, invested_usd}.
  const portfolio = db
    .prepare(
      `SELECT COUNT(*) AS holders,
              COALESCE(SUM(CAST(json_extract(props, '$.grams') AS REAL)), 0) AS grams,
              COALESCE(SUM(CAST(json_extract(props, '$.invested_usd') AS REAL)), 0) AS invested
       FROM events e
       WHERE name = 'portfolio_snapshot' AND user_id IS NOT NULL
         AND CAST(json_extract(props, '$.holdings') AS INTEGER) > 0
         AND created_at = (
           SELECT MAX(created_at) FROM events e2
           WHERE e2.user_id = e.user_id AND e2.name = 'portfolio_snapshot'
         )`
    )
    .get() as { holders: number; grams: number; invested: number };

  // Daily history for the last 30 days (UTC days, zero-filled).
  const dayKeys: string[] = [];
  for (let i = 29; i >= 0; i--) {
    dayKeys.push(new Date(now - i * DAY).toISOString().slice(0, 10));
  }
  const byDay = (rows: { day: string; n: number }[]) => {
    const map = new Map(rows.map((r) => [r.day, r.n]));
    return dayKeys.map((day) => ({ day, n: map.get(day) ?? 0 }));
  };

  const dauByDay = byDay(
    db
      .prepare(
        `SELECT date(created_at / 1000, 'unixepoch') AS day,
                COUNT(DISTINCT user_id) AS n
         FROM events WHERE created_at > ? AND user_id IS NOT NULL
         GROUP BY day`
      )
      .all(now - 30 * DAY) as { day: string; n: number }[]
  );
  const eventsByDay = byDay(
    db
      .prepare(
        `SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS n
         FROM events WHERE created_at > ? GROUP BY day`
      )
      .all(now - 30 * DAY) as { day: string; n: number }[]
  );

  // Gold held over time: walk the snapshot log once, keeping each user's
  // latest snapshot as of each day's end. Snapshots are deduped app-side,
  // so this stays tiny even with lots of users.
  const snaps = db
    .prepare(
      `SELECT user_id,
              created_at,
              CAST(json_extract(props, '$.grams') AS REAL) AS grams,
              CAST(json_extract(props, '$.invested_usd') AS REAL) AS invested
       FROM events
       WHERE name = 'portfolio_snapshot' AND user_id IS NOT NULL
       ORDER BY created_at`
    )
    .all() as {
    user_id: string;
    created_at: number;
    grams: number | null;
    invested: number | null;
  }[];
  const latestByUser = new Map<string, { grams: number; invested: number }>();
  let snapIdx = 0;
  const goldByDay = dayKeys.map((day) => {
    const cutoff = Date.parse(`${day}T23:59:59.999Z`);
    while (snapIdx < snaps.length && snaps[snapIdx].created_at <= cutoff) {
      const s = snaps[snapIdx++];
      latestByUser.set(s.user_id, {
        grams: s.grams ?? 0,
        invested: s.invested ?? 0,
      });
    }
    let grams = 0;
    let invested = 0;
    latestByUser.forEach((v) => {
      grams += v.grams;
      invested += v.invested;
    });
    return {
      day,
      grams: Math.round(grams * 100) / 100,
      investedUsd: Math.round(invested * 100) / 100,
    };
  });

  // Notification adoption — each user's latest notification_settings event.
  const notifications = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN json_extract(props,'$.permission')='granted' THEN 1 ELSE 0 END),0) AS granted,
         COALESCE(SUM(CASE WHEN json_extract(props,'$.permission')='denied' THEN 1 ELSE 0 END),0) AS denied,
         COALESCE(SUM(CAST(json_extract(props,'$.daily_brief') AS INTEGER)),0) AS dailyBrief,
         COALESCE(SUM(CAST(json_extract(props,'$.big_moves') AS INTEGER)),0) AS bigMoves,
         COALESCE(SUM(CAST(json_extract(props,'$.price_alerts') AS INTEGER)),0) AS priceAlerts
       FROM events e
       WHERE name = 'notification_settings' AND user_id IS NOT NULL
         AND created_at = (
           SELECT MAX(created_at) FROM events e2
           WHERE e2.user_id = e.user_id AND e2.name = 'notification_settings'
         )`
    )
    .get() as {
    granted: number;
    denied: number;
    dailyBrief: number;
    bigMoves: number;
    priceAlerts: number;
  };

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
    countries,
    topEvents,
    topReferrers,
    subEvents,
    portfolio: {
      holders: portfolio.holders,
      grams: Math.round(portfolio.grams * 100) / 100,
      investedUsd: Math.round(portfolio.invested * 100) / 100,
    },
    history: { dauByDay, eventsByDay, goldByDay },
    notifications,
    kFactorProxy: k30,
  };
}
