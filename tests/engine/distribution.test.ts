import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { wheels } from "../../prisma/seed-data";
import { computeRolls, generateClientSeed, generateServerSeed } from "@/server/engine/fair";
import { selectIndex, selectTier } from "@/server/engine/odds";
import { BPS_SCALE } from "@/lib/money";

/**
 * Odds distribution test.
 *
 * Runs the real roll pipeline (HMAC -> tier roll -> cumulative odds -> product
 * index) 100,000 times per wheel and checks that every tier's observed share
 * matches its configured odds. The tolerance is statistical: for a binomial
 * with n = 100,000 the standard deviation of the count is sqrt(n p (1-p)), and
 * we allow 4.5 standard deviations, so a correct engine fails this test with
 * probability ~ 7e-6 per tier. A biased engine (e.g. off-by-one at a tier
 * boundary, wrong modulus, a tier skipped) fails by many deviations.
 *
 * The first run uses deterministic seeds derived from the wheel slug so the
 * numbers are reproducible; the second uses fresh CSPRNG seeds each run.
 */
const SPINS = 100_000;
const SIGMA = 4.5;

type Outcome = { tierName: string; productSlug: string };

function simulate(wheel: (typeof wheels)[number], serverSeed: string, clientSeed: string): Outcome[] {
  const tiers = wheel.tiers.map((t) => ({ id: t.name, oddsBps: t.oddsBps, products: t.products }));
  const out: Outcome[] = new Array(SPINS);
  for (let nonce = 1; nonce <= SPINS; nonce++) {
    const rolls = computeRolls(serverSeed, clientSeed, nonce);
    const tier = selectTier(tiers, rolls.tierRoll);
    const product = tier.products[selectIndex(rolls.productRoll, tier.products.length)];
    out[nonce - 1] = { tierName: tier.id, productSlug: product };
  }
  return out;
}

function assertDistribution(wheel: (typeof wheels)[number], outcomes: Outcome[], label: string) {
  const counts = new Map<string, number>();
  for (const o of outcomes) counts.set(o.tierName, (counts.get(o.tierName) ?? 0) + 1);

  const rows: string[] = [];
  for (const t of wheel.tiers) {
    const p = t.oddsBps / BPS_SCALE;
    const expected = SPINS * p;
    const sd = Math.sqrt(SPINS * p * (1 - p));
    const observed = counts.get(t.name) ?? 0;
    const z = (observed - expected) / sd;
    rows.push(`${t.name.padEnd(9)} expected ${expected.toFixed(0).padStart(6)} observed ${String(observed).padStart(6)} (${((observed / SPINS) * 100).toFixed(2)}%) z=${z.toFixed(2)}`);
    expect(Math.abs(z), `${label} ${wheel.slug}/${t.name}: ${observed} vs ${expected} (z=${z.toFixed(2)})`).toBeLessThanOrEqual(SIGMA);
  }
  // Every spin landed in exactly one tier.
  expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(SPINS);

  // Chi-square goodness of fit across tiers, as a second, joint check.
  const chi2 = wheel.tiers.reduce((acc, t) => {
    const expected = SPINS * (t.oddsBps / BPS_SCALE);
    const observed = counts.get(t.name) ?? 0;
    return acc + (observed - expected) ** 2 / expected;
  }, 0);
  // df = tiers - 1 (3 for our wheels). Critical value at p=0.0001 for df=3 is 21.1.
  expect(chi2, `${label} ${wheel.slug} chi-square ${chi2.toFixed(2)}\n${rows.join("\n")}`).toBeLessThan(21.1);
  return rows;
}

function assertUniformProducts(wheel: (typeof wheels)[number], outcomes: Outcome[], label: string) {
  for (const t of wheel.tiers) {
    if (t.products.length < 2) continue;
    const inTier = outcomes.filter((o) => o.tierName === t.name);
    const p = 1 / t.products.length;
    const sd = Math.sqrt(inTier.length * p * (1 - p));
    for (const slug of t.products) {
      const observed = inTier.filter((o) => o.productSlug === slug).length;
      const z = (observed - inTier.length * p) / sd;
      expect(Math.abs(z), `${label} ${wheel.slug}/${t.name}/${slug}: z=${z.toFixed(2)}`).toBeLessThanOrEqual(SIGMA);
    }
  }
}

describe(`odds distribution over ${SPINS.toLocaleString()} spins per wheel`, () => {
  it("every seeded wheel's odds total exactly 100%", () => {
    for (const w of wheels) expect(w.tiers.reduce((a, t) => a + t.oddsBps, 0), w.slug).toBe(BPS_SCALE);
  });

  for (const wheel of wheels) {
    it(`${wheel.name}: deterministic seeds match configured odds`, () => {
      const serverSeed = createHash("sha256").update(`server:${wheel.slug}`).digest("hex");
      const clientSeed = createHash("sha256").update(`client:${wheel.slug}`).digest("hex").slice(0, 32);
      const outcomes = simulate(wheel, serverSeed, clientSeed);
      const rows = assertDistribution(wheel, outcomes, "deterministic");
      assertUniformProducts(wheel, outcomes, "deterministic");
      console.log(`${wheel.name}\n  ${rows.join("\n  ")}`);
    });

    it(`${wheel.name}: fresh random seeds match configured odds`, () => {
      const outcomes = simulate(wheel, generateServerSeed(), generateClientSeed());
      assertDistribution(wheel, outcomes, "random");
      assertUniformProducts(wheel, outcomes, "random");
    });
  }

  it("tier rolls are uniform over [0, 10000) (no modulo bias beyond 2^32 mod 10000)", () => {
    // 2^32 mod 10000 = 7296, so values < 7296 are favoured by 1 part in ~429,496.
    // That is far below anything measurable here; this test guards against a
    // gross bias such as using too few hash bits.
    const buckets = new Array(10).fill(0);
    const serverSeed = "uniformity-check-server-seed";
    for (let nonce = 1; nonce <= SPINS; nonce++) {
      buckets[Math.floor(computeRolls(serverSeed, "uniformity-check", nonce).tierRoll / 1000)]++;
    }
    const expected = SPINS / 10;
    const sd = Math.sqrt(SPINS * 0.1 * 0.9);
    for (const [i, b] of buckets.entries()) {
      expect(Math.abs((b - expected) / sd), `bucket ${i}: ${b}`).toBeLessThanOrEqual(SIGMA);
    }
  });

  it("a biased engine is detected (sanity check on the test itself)", () => {
    // Simulate an off-by-one boundary bug: the chase tier only hit on roll >= 9801 instead of 9800.
    const wheel = wheels[0];
    const tiers = wheel.tiers.map((t) => ({ id: t.name, oddsBps: t.oddsBps }));
    const counts = new Map<string, number>();
    for (let nonce = 1; nonce <= SPINS; nonce++) {
      const roll = computeRolls("biased", "biased", nonce).tierRoll;
      const t = selectTier(tiers, roll >= 9800 && roll < 9850 ? 9799 : roll); // steal 0.5% from chase
      counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
    }
    const chase = wheel.tiers.find((t) => t.rarity === "CHASE")!;
    const p = chase.oddsBps / BPS_SCALE;
    const z = ((counts.get(chase.name) ?? 0) - SPINS * p) / Math.sqrt(SPINS * p * (1 - p));
    expect(Math.abs(z)).toBeGreaterThan(SIGMA);
  });
});
