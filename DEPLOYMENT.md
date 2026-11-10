# Deployment record

Where HonshuWheel runs today and how it was set up. Keep this current when
anything below changes. Secrets live only in the Vercel project settings.

## Production

| Item | Value |
| --- | --- |
| Live URL | https://honshuwheel.com (www redirects here, 308) |
| Vercel team / project | Pizza Friday / `honshuwheel` |
| Vercel project id | `prj_mVXq0HxwJKrEmc19hAsI8MFWmjAM` |
| Production branch | `claude/youthful-cerf-u0ky4g` (change in Settings → Git if you merge to `main`) |
| Region | iad1 (Washington, D.C.) |
| Node | 22.x |
| Build command | `npm run vercel-build` (prisma generate → migrate deploy → optional seed → next build) |
| Deployment protection | Standard: `*.vercel.app` URLs require Vercel login; the custom domain is public |
| Database | Neon project `my-first-project` (`restless-hall-15002120`), aws-us-east-1, Postgres 18, database `neondb`, branch `production` |
| Mode | **Demo** (`REAL_MONEY_ENABLED=false`) |
| Cron | `/api/jobs/vault-expiry` daily 09:00 UTC (Hobby plan limit) |
| DNS (Cloudflare, DNS only) | `@` A `76.76.21.21`; `www` CNAME `cname.vercel-dns.com` |

## Environment variables set on Vercel (production + preview)

`DATABASE_URL` (Neon pooled, `pgbouncer=true&connection_limit=1`),
`DIRECT_DATABASE_URL` (Neon direct), `AUTH_SECRET`, `AUTH_TRUST_HOST`,
`REAL_MONEY_ENABLED=false`, `GEO_PROVIDER=header`, `PAYMENT_PROVIDER=test`,
`IDENTITY_PROVIDER=mock`, `MOCK_IDENTITY_DELAY_SECONDS=10`,
`STORAGE_PROVIDER=local`, `MAIL_PROVIDER=console`, `JOBS_SECRET`,
`CRON_SECRET` (= `JOBS_SECRET`), `ADMIN_EMAIL=admin@honshuwheel.local`,
`ADMIN_PASSWORD` (reveal in Vercel → Settings → Environment Variables).

`RUN_SEED` was set for the first build only and has been removed. The
database was seeded on 2026-11-10 (admin account, 28 products, 5 wheels,
blocked states NV/WA/MT, default settings).

## Still to do before real money

See README §9. The deployment-specific items:

- `STORAGE_PROVIDER=s3` with Cloudflare R2 so product photos persist
  (uploads with `local` are lost on the next deploy).
- `MAIL_PROVIDER=resend` with a verified sending domain so password resets
  and shipping emails reach users (today they only appear in Vercel logs).
- `GEO_PROVIDER=maxmind` if you want better accuracy than Vercel's headers.
- Replace the seeded placeholder product names/values with real inventory in
  `/admin`, and review the three wheels flagged for low RTP.
- Upgrade to Vercel Pro if you want hourly vault-expiry runs.

## Rotating secrets

`AUTH_SECRET`: changing it signs everyone out. `JOBS_SECRET`/`CRON_SECRET`:
change both together. Database password: rotate in Neon, then update both
`DATABASE_URL` and `DIRECT_DATABASE_URL`, then redeploy.
