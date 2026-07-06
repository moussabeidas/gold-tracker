# Gold Pricer Backend

User management, server-verified referrals, analytics ingestion, App Store
subscription webhooks, and an admin stats dashboard — everything the app
needs server-side, in one small service.

## Stack & why

- **Hono + Node** — tiny, typed, fast; runs anywhere Node runs.
- **SQLite (WAL)** — one file, zero infra, trivially backed up. This
  comfortably serves a single consumer app well past $1M ARR (reads
  dominate; writes are tiny). All queries are plain SQL, so a Postgres
  move later is mechanical.
- **Sign in with Apple verification** — the app sends its `identityToken`;
  the server verifies it against Apple's JWKS (`aud` = bundle id) and
  issues its own long-lived session JWT.
- **App Store Server Notifications V2** — point App Store Connect at
  `/v1/appstore/notifications` and every subscription lifecycle event
  (subscribes, renewals, churn, refunds) lands in the dashboard.

## Run locally

```bash
cd backend
npm install
JWT_SECRET=dev ADMIN_TOKEN=dev npm run dev
# → http://localhost:8787/admin  (token: dev)
```

## Deploy (Fly.io / Railway / Render — any Docker host)

```bash
fly launch --dockerfile Dockerfile   # or connect the repo in Railway/Render
```

Set these secrets:

| Env var | Purpose |
| --- | --- |
| `JWT_SECRET` | Signs session tokens. Use 32+ random bytes. |
| `ADMIN_TOKEN` | Gates `/admin` and `/v1/admin/*`. |
| `APPLE_BUNDLE_ID` | Defaults to `com.mbeidas.goldtracker`. |
| `DATABASE_PATH` | Defaults to `./data/goldpricer.db` (mount a volume). |
| `PORT` | Defaults to `8787`. |

Then set `EXPO_PUBLIC_API_URL=https://your-host` for the app build (or in
`app.json` → `expo.extra`) and the app starts syncing automatically. The
app works fully offline without it — every server feature degrades
gracefully.

### App Store Connect hookups

1. **Server Notifications**: App Store Connect → App → App Information →
   App Store Server Notifications → V2 URL: `https://your-host/v1/appstore/notifications`.
2. Before gating entitlements on webhook data (not needed for stats),
   enable full JWS x5c chain verification against Apple's root CA.

## API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/v1/auth/apple` | — | Verify SIWA identity token → session JWT + invite code |
| GET | `/v1/me` | user | Profile + plan + invite code |
| GET | `/v1/referrals/status` | user | Verified referral count, bonus slots, Pro progress |
| POST | `/v1/referrals/redeem` | user | Redeem a friend's code (requires a `gold_added` event first) |
| POST | `/v1/events` | user | Batch analytics events (max 50) |
| POST | `/v1/appstore/notifications` | — | ASSN V2 webhook |
| GET | `/v1/admin/stats` | admin | Dashboard data (DAU/WAU/MAU, funnel, referrals, subs) |
| GET | `/v1/admin/users?q=` | admin | Search users |
| GET | `/admin` | token in page | Stats dashboard UI |

## Backups

SQLite + WAL: snapshot `data/goldpricer.db` on a cron, or run
[Litestream](https://litestream.io) as a sidecar for continuous S3
replication.
