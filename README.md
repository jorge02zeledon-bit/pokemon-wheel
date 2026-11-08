# HonshuWheel

Spin prize wheels to win sealed trading card products. Next.js (App Router) +
TypeScript + Tailwind, PostgreSQL via Prisma, Auth.js email/password.

> **Status: Phase 4 of 7 (setup, schema, seed, auth, spin engine, wheel UI, vault).** Not production ready.
> The site runs in **demo mode** (`REAL_MONEY_ENABLED=false`) and must stay
> that way until the pre-launch checklist (added in Phase 7) is complete and an
> attorney has reviewed the legal pages.

## Quick start

```bash
cp .env.example .env            # then edit AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d            # local PostgreSQL 16
npm install
npm run setup                   # prisma migrate deploy + seed (5 wheels, products, admin)
npm run dev                     # http://localhost:3000
```

Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` to reach `/admin`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run setup` | Apply migrations and seed |
| `npm run db:migrate` | Create/apply a migration in development |
| `npm run db:seed` | Re-run the seed (idempotent; never rewrites a wheel that has spins) |
| `npm run db:reset` | Drop and recreate the dev database |
| `npm test` | Vitest. Needs a test database: see below |
| `npm run typecheck` / `lint` | Type and lint checks |

### Tests

Tests run against a separate database defined in `.env.test`
(default `honshuwheel_test`). Create it once and apply migrations:

```bash
createdb -h localhost -U honshu honshuwheel_test
DATABASE_URL="postgresql://honshu:honshu@localhost:5432/honshuwheel_test?schema=public" npx prisma migrate deploy
npm test
```

## Launch mode

`REAL_MONEY_ENABLED` (env) is the single switch between demo mode and real
money. While `false`:

- new accounts receive free demo credits (amount editable in admin settings);
- spins, the vault and buyback work fully using demo credits;
- deposits, withdrawals and shipping are refused **on the server** by
  `requireRealMoney()` in `src/server/guards.ts`, and the UI shows a banner.

## Architecture notes

- **Money** is integer cents everywhere. **Odds** are integer basis points
  (10,000 = 100%) and every wheel's tiers must sum to exactly 10,000.
- **Spin** and **LedgerEntry** tables are append-only: a PostgreSQL trigger in
  the init migration rejects `UPDATE` and `DELETE`.
- **Spin engine** (`src/server/engine/spin.ts`): one database transaction per
  spin that locks the user row, validates the wheel, runs compliance checks,
  locks and checks stock for every awardable product (including the chase),
  debits the balance, rolls, reserves the unit, writes the immutable spin
  record with an odds snapshot, creates the vault item and rotates the seed.
  Any failure rolls everything back.
- **Provably fair:** per spin, `HMAC-SHA256(serverSeed, clientSeed:nonce)`.
  The server seed's SHA-256 hash is shown before the spin; the seed is revealed
  after it. Tier roll = first 32 bits mod 10,000; product roll = next 24 bits.
  See `src/server/engine/fair.ts` and the pure verifier in `verify.ts`.
- **Odds test:** `tests/engine/distribution.test.ts` runs 100,000 spins per
  wheel through the real roll pipeline and checks every tier within 4.5
  standard deviations plus a chi-square test.
- **Products are global** and shared between wheels with one stock count.
- **Providers** (payments, identity, geolocation, storage, mail) sit behind
  interfaces in `src/server/providers/` (added from Phase 4 onward) with safe
  local defaults. No payment processor is wired.
- **Runtime settings** (RTP range, buyback %, vault window, fees, demo credit
  amounts) live in the `Setting` table with typed defaults in
  `src/server/settings.ts`.

## Wheel UI (Phase 3)

- `src/components/wheel/SpinWheel.tsx` draws the wheel on a canvas. Slice arcs
  are exactly proportional to the odds (`src/lib/wheel-layout.ts`, unit
  tested); large tiers are split into interleaved slices, the chase tier is a
  glowing sliver. The wheel spins while the server is asked for a result, then
  eases to a stop on the server-chosen tier. It never decides anything.
- Win reveal modal with confetti for rare and chase tiers, a polling
  recent-wins feed with masked names, and a per-user "next spin commitment"
  panel with client seed editing.
- `/fair` explains the algorithm and verifies any spin in the browser with Web
  Crypto, with a server cross-check. `?spin=<id>` pre-fills a spin you own.
- `/wallet` shows balance, history and the demo refill (available when the
  demo balance is below the refill amount and the cooldown has elapsed).

## Vault, buyback and shipping (Phase 4)

- Won items land in the vault as `PENDING` with a deadline of
  `vaultWindowDays`. The user can **sell back** for `buybackPercent` of the
  win-time value (credited to the balance the item was won with) or **ship**
  (real-money mode only, real items only; charges `shippingFeeCents` and
  creates an `Order` for admin fulfilment).
- When the window closes, `processExpiredVaultItems` applies
  `vaultDefaultAction`: `AUTO_SELL` or `AUTO_SHIP_HOLD` (item kept with no
  deadline until an address is added). It runs lazily for a user when they
  open their vault, and for everyone via the job route below.
- All decisions lock the vault row, so double clicks and races with the job
  produce exactly one outcome. See `tests/vault.test.ts`.

### Vault expiry job

```
GET or POST /api/jobs/vault-expiry
Authorization: Bearer <JOBS_SECRET>
```

`vercel.json` schedules it hourly on Vercel Cron; set `CRON_SECRET` and
`JOBS_SECRET` to the same value there. Any other scheduler works the same way.

## API (Phases 2-4)

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /api/spins` `{ wheelSlug }` | user | Perform a spin; returns result, revealed seed, next seed hash |
| `GET /api/spins/:id` | owner/admin | Full fairness record of a spin plus server-side verification |
| `GET /api/fair/state` | user | Next server seed hash, client seed, next nonce |
| `POST /api/fair/client-seed` `{ clientSeed }` | user | Change client seed for future spins |
| `POST /api/fair/verify` | public | Stateless verifier: recompute any spin from its inputs |
| `GET /api/wheels/:slug/recent-wins` | public | Latest wins on a wheel, names masked |
| `GET` / `POST /api/demo/refill` | user | Demo refill status / grant (demo mode only) |
| `POST /api/vault/:id/sell` | owner | Sell an item back for the configured % |
| `POST /api/vault/:id/ship` `{address}` | owner | Request shipping (real-money mode only) |
| `GET`/`POST /api/jobs/vault-expiry` | bearer `JOBS_SECRET` | Apply the default action to expired vault items |

Error codes: `UNAUTHORIZED` 401, `VALIDATION` 400, `INSUFFICIENT_FUNDS` 402,
`NOT_ELIGIBLE` 403 (with `reason`), `DEMO_MODE` 403, `OUT_OF_STOCK` /
`WHEEL_UNAVAILABLE` / `VAULT_ITEM_UNAVAILABLE` 409, `REFILL_NOT_AVAILABLE` 429.

## Deployment target

Planned: Vercel (app) + Neon (PostgreSQL) + Cloudflare R2 (product photos) +
Vercel Cron for the vault-expiry job. Confirm each provider's acceptable-use
policy for chance-based products during legal review.

## Legal

This project is not affiliated with, endorsed by, or sponsored by The Pokémon
Company, Nintendo, Creatures, or Game Freak. Legal pages are drafts and must be
reviewed by an attorney before launch.
