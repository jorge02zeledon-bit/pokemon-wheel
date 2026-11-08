# HonshuWheel

Spin prize wheels to win sealed trading card products. Built with Next.js
(App Router) + TypeScript + Tailwind, PostgreSQL via Prisma, and Auth.js
email/password. Every outcome is decided on the server with a provably fair
commitment scheme, every spin is written to an append-only audit log, and the
whole site runs in **demo mode** until `REAL_MONEY_ENABLED` is switched on
after the pre-launch checklist below is complete.

> HonshuWheel is not affiliated with, endorsed by, or sponsored by The Pokémon
> Company, Nintendo, Creatures, or Game Freak. Product names are used only to
> identify sealed merchandise. Legal pages are drafts pending attorney review.

---

## Contents

1. [Quick start (local)](#1-quick-start-local)
2. [Environment variables](#2-environment-variables)
3. [Scripts and tests](#3-scripts-and-tests)
4. [How it works](#4-how-it-works)
5. [Admin guide](#5-admin-guide)
6. [Providers and how to plug in vendors](#6-providers-and-how-to-plug-in-vendors)
7. [Deploying (Vercel + Neon + Cloudflare R2)](#7-deploying-vercel--neon--cloudflare-r2)
8. [API reference](#8-api-reference)
9. [Pre-launch checklist: before turning on REAL_MONEY_ENABLED](#9-pre-launch-checklist-before-turning-on-real_money_enabled)
10. [Project structure](#10-project-structure)

---

## 1. Quick start (local)

Requirements: Node 22, Docker (for Postgres) or a local PostgreSQL 16.

```bash
cp .env.example .env
```

Edit `.env`: set `AUTH_SECRET` (`openssl rand -base64 32`), `ADMIN_EMAIL`
and `ADMIN_PASSWORD`. Then:

```bash
docker compose up -d
```

```bash
npm install
```

```bash
npm run setup
```

```bash
npm run dev
```

Open http://localhost:3000. Sign up to get demo credits, or log in with the
admin credentials and open `/admin`.

## 2. Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | compose Postgres | Prisma connection string |
| `AUTH_SECRET` | — | Auth.js JWT secret (required) |
| `AUTH_URL` | `http://localhost:3000` | Public site URL (used in emails and callbacks) |
| `AUTH_TRUST_HOST` | `true` | Required behind proxies/Vercel |
| **`REAL_MONEY_ENABLED`** | **`false`** | **Launch switch.** `false` = demo mode. See checklist. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | — | Bootstrap admin created by the seed |
| `PAYMENT_PROVIDER` | `test` | Only `test` ships (deposits succeed, withdrawals pend) |
| `TEST_PAYMENT_FAIL` | — | `true` makes test deposits fail (for testing) |
| `IDENTITY_PROVIDER` | `mock` | Only `mock` ships |
| `MOCK_IDENTITY_DELAY_SECONDS` | `10` | Mock KYC auto-approval delay |
| `MOCK_IDENTITY_OUTCOME` | — | `REJECTED` to test the rejection path |
| `GEO_PROVIDER` | `mock` | `mock`, `header` (Vercel/Cloudflare), `maxmind` |
| `MAXMIND_ACCOUNT_ID`, `MAXMIND_LICENSE_KEY` | — | For `maxmind` |
| `STORAGE_PROVIDER` | `local` | `local` (public/uploads) or `s3` (S3/R2/MinIO) |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` | — | For `s3` |
| `MAIL_PROVIDER` | `console` | `console` or `resend` |
| `RESEND_API_KEY`, `MAIL_FROM` | — | For `resend` |
| `JOBS_SECRET` | — | Bearer token for `/api/jobs/vault-expiry` |

## 3. Scripts and tests

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run setup` | `prisma migrate deploy` + seed |
| `npm run db:migrate` | Create/apply a migration in development |
| `npm run db:seed` | Re-run the seed (idempotent; never rewrites a wheel that has spins) |
| `npm run db:reset` | Drop and recreate the dev database |
| `npm test` | Vitest (needs the test database below) |
| `npm run typecheck` / `npm run lint` | Type and lint checks |

### Test database

Tests use `.env.test` (default database `honshuwheel_test`). Create it once:

```bash
docker compose exec db createdb -U honshu honshuwheel_test
```

```bash
DATABASE_URL="postgresql://honshu:honshu@localhost:5432/honshuwheel_test?schema=public" npx prisma migrate deploy
```

```bash
npm test
```

What the suite covers (100+ tests): money math; provably fair primitives and
verifier; odds selection boundaries; **100,000 simulated spins per wheel**
checked against configured odds (4.5 σ per tier plus chi-square, with a
deliberately biased engine shown to fail); the spin engine against a real
database (charges, stock reservation, shared stock, misconfiguration,
compliance refusals, concurrency and over-allocation); vault buyback,
shipping, expiry job and races; demo refills; EV/RTP calculator; admin rules;
responsible-play limits, breaks and self-exclusion; identity lifecycle; geo
parsing; deposits and withdrawals; password reset; rate limiter. CI runs
lint, typecheck, tests and build on every push (`.github/workflows/ci.yml`).

## 4. How it works

### Launch mode

`REAL_MONEY_ENABLED` is read on the server. While `false`:

- new accounts receive demo credits (amount in admin settings) and can refill
  when low;
- spins, the vault and buyback work fully with demo credits;
- deposits, withdrawals and shipping are refused on the server by
  `requireRealMoney()` (`src/server/errors.ts`), and the UI shows a banner.

Demo credits are a separate balance that never converts to real money, and
items won with demo credits can never be shipped, even after launch.

### Money and odds

All money is integer cents. All odds are integer basis points (10,000 =
100%); a wheel cannot be saved or spun unless its tiers total exactly 10,000.

### The spin (src/server/engine/spin.ts)

One database transaction: lock the user row → load the wheel in canonical
order and validate → compliance checks → lock every awardable product and
require stock ≥ 1 for all (the chase included) → debit the balance → roll →
reserve the unit (conditional decrement) → write the immutable spin row with
an odds snapshot → create the vault item → rotate the server seed. Any
failure rolls everything back. Spin and ledger tables have database triggers
rejecting `UPDATE`/`DELETE`.

### Provably fair

Per spin: the server commits to a random seed by showing `sha256(serverSeed)`
first; the outcome is `HMAC-SHA256(serverSeed, "clientSeed:nonce")`; tier =
first 32 bits mod 10,000 against cumulative odds; product = next 24 bits mod
product count; the seed is revealed afterwards and a new one committed.
`/fair` verifies any spin in the browser with Web Crypto and can cross-check
against `POST /api/fair/verify`. Known biases (2³² mod 10,000 ≈ 1 in 429,000
on the tier roll; < 1 in 1,000,000 on the product roll) are disclosed there.

### The wheel UI

The canvas wheel draws slice arcs exactly proportional to the odds (large
tiers split into interleaved slices; the chase is a glowing sliver). It spins
while the server is asked for a result, then eases to a stop on the server's
tier. It never decides anything.

### Vault

Won items are `PENDING` with a deadline (`vaultWindowDays`). Users sell back
for `buybackPercent` of the win-time value (credited to the balance the item
was won with) or request shipping (real-money only; flat `shippingFeeCents`;
creates an `Order`). After the window, `vaultDefaultAction` applies via
`processExpiredVaultItems`, run lazily on vault load and hourly by
`/api/jobs/vault-expiry`.

### Compliance

Age gate + signup confirmation; identity verification required for any
deposit or withdrawal; stated state **and** IP-derived state must both be
allowed and non-US locations are refused; deposit limits and a daily spend
limit (tightening immediate, loosening after a cooling-off); session/24h
spend tracker; breaks that cannot be shortened; self-exclusion that can only
be extended. Admin actions are all audited with before/after snapshots.

### Security

Security headers and a CSP in `next.config.ts`; bcrypt password hashes;
constant-time login behaviour; hashed single-use password reset tokens;
in-memory rate limits on auth, spins, identity and payments (advisory on
serverless: swap `src/server/rate-limit.ts` for a shared store if you need
hard limits); admin routes gated in the proxy and re-checked in the database.

## 5. Admin guide

`/admin` (role `ADMIN`):

- **Overview:** 24h stats and an attention list (RTP warnings, out-of-stock
  prizes, open orders).
- **Wheels & odds:** edit every wheel, tier, odds %, colour and product list
  with a live EV / RTP panel. Save is blocked unless odds total 100%. Tiers
  that have been awarded cannot be deleted: set them to 0% to retire them.
  New wheels start inactive.
- **Products & inventory:** values, categories, stock changes (reason
  required, never negative), photo upload. A wheel pauses automatically when
  any prize it can award hits 0 or is inactive.
- **Orders:** fill in carrier and tracking; "shipped" requires a tracking
  number and updates the customer's vault.
- **Payments:** settle pending withdrawals (mark paid / fail and refund).
- **Users:** role, manual balance adjustments (reason required), identity
  override, recent ledger.
- **Spin audit log:** filters, seeds, CSV export.
- **Settings & blocked states:** RTP range, buyback %, vault window and
  default action, shipping fee, demo credit amounts, cooling-off hours, recent
  wins count, blocked US states.
- **Admin audit log.**

Bootstrap admin: the seed creates `ADMIN_EMAIL`. Promote others from the
Users page.

## 6. Providers and how to plug in vendors

Every external dependency sits behind an interface in
`src/server/providers/<kind>/` with a factory in `index.ts` selected by an env
var. To add a vendor: implement the interface in a new file, verify webhook
signatures in `parseWebhook`, add a `case` to the factory, set the env var.

| Kind | Interface | Shipped implementations | Notes |
| --- | --- | --- | --- |
| Payments | `PaymentProvider` | `test` | Choose a processor **after legal review**; many prohibit chance-based products. Webhooks → `/api/webhooks/payment`. |
| Identity | `IdentityProvider` | `mock` | Persona, Veriff or Stripe Identity map cleanly. Webhooks → `/api/webhooks/identity`. |
| Geolocation | `GeoProvider` | `mock`, `header`, `maxmind` | MaxMind fails open to "unknown"; flip `FAIL_CLOSED` if counsel requires. GeoComply is the regulated-gaming option. |
| Storage | `StorageProvider` | `local`, `s3` | Use `s3` (Cloudflare R2) in production; `local` is ephemeral on Vercel. |
| Mail | `MailProvider` | `console`, `resend` | Welcome, password reset and shipped notifications. |

## 7. Deploying (Vercel + Neon + Cloudflare R2)

1. **Neon:** create a Postgres project; copy the pooled connection string to
   `DATABASE_URL` (append `?sslmode=require`). Run
   `npx prisma migrate deploy` and `npx prisma db seed` against it once (from
   your machine with that `DATABASE_URL`, plus `ADMIN_EMAIL`/`ADMIN_PASSWORD`).
2. **Cloudflare R2:** create a bucket with public access (or a custom domain);
   create an API token; set `STORAGE_PROVIDER=s3`,
   `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `S3_BUCKET`,
   `S3_REGION=auto`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
   `S3_PUBLIC_BASE_URL=https://<public bucket host>`.
3. **Resend:** verify your sending domain; set `MAIL_PROVIDER=resend`,
   `RESEND_API_KEY`, `MAIL_FROM`.
4. **Geolocation:** `GEO_PROVIDER=header` works immediately on Vercel; use
   `maxmind` for better accuracy.
5. **Vercel:** import the repo; set all variables above plus `AUTH_SECRET`,
   `AUTH_URL=https://your-domain`, `AUTH_TRUST_HOST=true`,
   `JOBS_SECRET`, and `CRON_SECRET` equal to `JOBS_SECRET` (Vercel sends it as
   the bearer token for the hourly cron in `vercel.json`). Keep
   `REAL_MONEY_ENABLED=false`. Build command is the default (`npm run build`
   runs `prisma generate`).
6. Point `/api/health` at your uptime monitor.
7. Confirm each provider's acceptable-use policy permits chance-based
   products before launch.

## 8. API reference

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /api/spins` `{ wheelSlug }` | user | Perform a spin; returns result, revealed seed, next seed hash |
| `GET /api/spins/:id` | owner/admin | Fairness record of a spin plus server-side verification |
| `GET /api/fair/state` | user | Next server seed hash, client seed, next nonce |
| `POST /api/fair/client-seed` `{ clientSeed }` | user | Change client seed |
| `POST /api/fair/verify` | public | Stateless verifier |
| `GET /api/wheels/:slug/recent-wins` | public | Latest wins, names masked |
| `GET`/`POST /api/demo/refill` | user | Demo refill status / grant (demo mode) |
| `POST /api/vault/:id/sell`, `POST /api/vault/:id/ship` | owner | Vault decisions (shipping real-money only) |
| `POST /api/identity/start`, `GET /api/identity/status` | user | Identity verification |
| `POST /api/wallet/deposit`, `POST /api/wallet/withdraw` | user, real-money only | Payments via the PaymentProvider |
| `GET`/`POST /api/account/limits`, `POST /api/account/break`, `POST /api/account/self-exclude` | user | Responsible play |
| `GET /api/me/activity` | user | Spend tracker |
| `POST /api/webhooks/identity`, `POST /api/webhooks/payment` | vendor | Provider callbacks |
| `GET`/`POST /api/jobs/vault-expiry` | bearer `JOBS_SECRET` | Vault expiry job |
| `POST /api/admin/uploads`, `GET /api/admin/spins.csv` | admin | Photo upload, CSV export |
| `GET /api/health` | public | Liveness + database check |

Error codes: `UNAUTHORIZED` 401, `VALIDATION` 400, `INSUFFICIENT_FUNDS` 402,
`NOT_ELIGIBLE` 403 with `reason` (AGE_NOT_CONFIRMED, NO_STATE, BLOCKED_STATE,
BLOCKED_IP_STATE, OUTSIDE_US, SELF_EXCLUDED, COOLDOWN, SPEND_LIMIT,
DEPOSIT_LIMIT, IDENTITY_REQUIRED), `DEMO_MODE` 403, `FORBIDDEN` 403,
`OUT_OF_STOCK` / `WHEEL_UNAVAILABLE` / `VAULT_ITEM_UNAVAILABLE` 409,
`REFILL_NOT_AVAILABLE` 429, `RATE_LIMITED` 429.

## 9. Pre-launch checklist: before turning on REAL_MONEY_ENABLED

Do not set `REAL_MONEY_ENABLED=true` until every item is done. The flag is
deliberately an environment variable, not an admin setting.

**Legal and regulatory**

- [ ] Attorney has reviewed the business model (prize wheels with guaranteed
      prizes, buyback, demo credits) under federal law and each state you
      will operate in, and confirmed the blocked-state list.
- [ ] Attorney has approved the Terms of Service, Privacy Policy, Official
      Rules and Shipping & Buyback Policy; all `[BRACKETED]` placeholders
      replaced; "DRAFT" banners removed (`src/components/legal/LegalPage.tsx`).
- [ ] Entity, business licences, sales tax collection and any sweepstakes /
      gaming registrations in place as advised.
- [ ] Trademark review of the site name, copy and product naming (no logos,
      characters, official artwork or brand fonts anywhere; only your own
      product photos uploaded).
- [ ] Responsible-gambling obligations confirmed (helpline text, limits,
      self-exclusion durations, age verification standard).

**Payments and KYC**

- [ ] Payment processor selected that permits chance-based products;
      merchant account approved; `PaymentProvider` implemented with webhook
      signature verification; `PAYMENT_PROVIDER` set.
- [ ] Identity vendor selected; `IdentityProvider` implemented with webhook
      signature verification; `IDENTITY_PROVIDER` set; tested approve and
      reject paths end to end.
- [ ] Withdrawal flow tested end to end including admin settlement and
      failure refunds; payout destination fields match the processor.
- [ ] Chargeback / dispute process documented.

**Geolocation and restrictions**

- [ ] `GEO_PROVIDER` is `header` or `maxmind` (never `mock`) in production;
      decide on fail-open vs fail-closed with counsel.
- [ ] Blocked states reviewed in `/admin/settings`; Official Rules match.

**Operations**

- [ ] Production database on Neon with backups and point-in-time recovery
      enabled; `prisma migrate deploy` run; seed values replaced with real
      product names, values and stock in `/admin`.
- [ ] Every wheel reviewed in `/admin/wheels`: odds, RTP within your chosen
      range, prize values current, chase prizes physically in stock.
- [ ] `STORAGE_PROVIDER=s3` (R2) configured and a photo upload tested.
- [ ] `MAIL_PROVIDER=resend` with a verified domain; welcome, password reset
      and shipped emails tested.
- [ ] Vercel Cron for `/api/jobs/vault-expiry` running (check logs) with
      `CRON_SECRET` = `JOBS_SECRET`.
- [ ] Rate limiting backed by a shared store if you expect multiple
      instances; CSP tightened if desired.
- [ ] Uptime monitoring on `/api/health`; error reporting wired (e.g.
      Sentry) in `src/app/error.tsx` and server logs.
- [ ] Strong, unique `AUTH_SECRET`, `JOBS_SECRET`, admin password; 2FA on
      Vercel, Neon, Cloudflare, Resend, processor and KYC dashboards.
- [ ] Fulfilment process: who ships, from where, handling time, insurance,
      packaging, carrier accounts; orders page workflow rehearsed.
- [ ] Customer support contact live and listed on the legal pages.

**Final switch**

- [ ] Demo data reviewed: decide whether to keep demo accounts; demo balances
      never convert.
- [ ] Set `REAL_MONEY_ENABLED=true` in Vercel, redeploy, confirm the banner is
      gone, that `/api/health` reports `real-money`, and run one real
      deposit → spin → ship/buyback → withdrawal on a staff account.

## 10. Project structure

```
prisma/                 schema, migrations (incl. immutability triggers), seed + seed-data
src/app/                routes: (public) pages, (auth), (user) vault/wallet/account, admin/, api/
src/components/         wheel/ (canvas, reveal, feed, fair panel), vault/, wallet/, account/, admin/, layout/, ui/
src/server/
  engine/               fair (seeds, HMAC), odds, snapshot, verify, spin (transaction), eligibility, ev
  vault/                decisions (sell/ship), expiry job, queries
  wallet/               ledger (append-only), demo credits, deposits, withdrawals
  compliance/           limits, exclusion, identity
  admin/                wheels, products, orders, users, settings, spins, audit
  providers/            payment, identity, geo, storage, mail (interfaces + implementations)
  auth/                 password reset
  config, settings, guards, errors, api, rate-limit, db
src/lib/                money, fair-core (browser-safe), wheel-layout, us-states, validation
tests/                  Vitest suites (see §3)
```
