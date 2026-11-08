/**
 * Database seed.
 *
 * Creates the five launch wheels with their tiers and products, the default
 * blocked-state list, default settings and the bootstrap admin account.
 *
 * Idempotent: re-running updates wheels/tiers/products in place by slug, and
 * never resets stock below the current value or touches existing users'
 * balances. All values here are STARTING values; the admin panel is the
 * source of truth after first run.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient, ProductCategory, Rarity } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Products. Values are approximate market prices in cents. Names are plain
// text only (no logos or artwork); images are uploaded later in admin.
// Products shared between wheels appear once and share stock.
// ---------------------------------------------------------------------------
type ProductSeed = {
  slug: string;
  name: string;
  category: ProductCategory;
  valueCents: number;
  stock: number;
  description?: string;
};

const P = ProductCategory;
const products: ProductSeed[] = [
  // Pack wheel
  { slug: "current-english-booster-pack", name: "Current English Expansion Booster Pack", category: P.BOOSTER_PACK, valueCents: 500, stock: 200, description: "One sealed booster pack from the current in-print English expansion." },
  { slug: "sv-151-booster-pack", name: "Scarlet & Violet 151 Booster Pack", category: P.BOOSTER_PACK, valueCents: 1100, stock: 40 },
  { slug: "prismatic-evolutions-booster-pack", name: "Prismatic Evolutions Booster Pack", category: P.BOOSTER_PACK, valueCents: 1100, stock: 40 },
  { slug: "brilliant-stars-booster-pack", name: "Brilliant Stars Booster Pack", category: P.BOOSTER_PACK, valueCents: 1600, stock: 24 },
  { slug: "evolving-skies-booster-pack", name: "Evolving Skies Booster Pack", category: P.BOOSTER_PACK, valueCents: 4500, stock: 8 },

  // Tin & collection wheel
  { slug: "mini-tin-current", name: "Mini Tin (Current Series)", category: P.TIN, valueCents: 1200, stock: 60 },
  { slug: "three-pack-blister-current", name: "3-Pack Blister (Current Set)", category: P.BLISTER, valueCents: 1200, stock: 60 },
  { slug: "standard-tin-current", name: "Standard Tin (Current Series)", category: P.TIN, valueCents: 2500, stock: 20 },
  { slug: "ex-collection-box", name: "ex Collection Box", category: P.COLLECTION_BOX, valueCents: 2500, stock: 20 },
  { slug: "booster-bundle-current", name: "Booster Bundle (Current Set)", category: P.BOOSTER_BUNDLE, valueCents: 4000, stock: 12 },
  { slug: "premium-collection-current", name: "Premium Collection", category: P.PREMIUM_COLLECTION, valueCents: 4000, stock: 12 },
  { slug: "sv-151-etb", name: "Scarlet & Violet 151 Elite Trainer Box", category: P.ELITE_TRAINER_BOX, valueCents: 14000, stock: 6, description: "Shared between the Tin & Collection wheel (chase) and the ETB wheel (rare)." },

  // ETB wheel
  { slug: "in-print-etb-current", name: "In-Print Elite Trainer Box (Current Set)", category: P.ELITE_TRAINER_BOX, valueCents: 6500, stock: 40 },
  { slug: "ascended-heroes-etb", name: "Ascended Heroes Elite Trainer Box", category: P.ELITE_TRAINER_BOX, valueCents: 11200, stock: 10 },
  { slug: "prismatic-evolutions-etb", name: "Prismatic Evolutions Elite Trainer Box", category: P.ELITE_TRAINER_BOX, valueCents: 15000, stock: 6 },
  { slug: "evolving-skies-etb", name: "Evolving Skies Elite Trainer Box", category: P.ELITE_TRAINER_BOX, valueCents: 50000, stock: 2 },

  // Japanese box wheel
  { slug: "jp-current-main-expansion-box", name: "Current Japanese Main Expansion Booster Box", category: P.JAPANESE_BOX, valueCents: 6500, stock: 30 },
  { slug: "jp-mega-dream-ex-box", name: "MEGA Dream ex Booster Box (Japanese)", category: P.JAPANESE_BOX, valueCents: 9000, stock: 12 },
  { slug: "jp-shiny-treasure-ex-box", name: "Shiny Treasure ex Booster Box (Japanese)", category: P.JAPANESE_BOX, valueCents: 9000, stock: 12 },
  { slug: "jp-terastal-festival-ex-box", name: "Terastal Festival ex Booster Box (Japanese)", category: P.JAPANESE_BOX, valueCents: 14000, stock: 6 },
  { slug: "jp-vstar-universe-box", name: "VSTAR Universe Booster Box (Japanese)", category: P.JAPANESE_BOX, valueCents: 14000, stock: 6 },
  { slug: "jp-vmax-climax-box", name: "VMAX Climax Booster Box (Japanese)", category: P.JAPANESE_BOX, valueCents: 23100, stock: 3 },

  // Premium chase wheel
  { slug: "current-english-booster-box", name: "Current English Expansion Booster Box", category: P.BOOSTER_BOX, valueCents: 17000, stock: 20 },
  { slug: "sv-151-pokemon-center-etb", name: "Scarlet & Violet 151 Pokémon Center Elite Trainer Box", category: P.ELITE_TRAINER_BOX, valueCents: 20000, stock: 6 },
  { slug: "prismatic-evolutions-pokemon-center-etb", name: "Prismatic Evolutions Pokémon Center Elite Trainer Box", category: P.ELITE_TRAINER_BOX, valueCents: 20000, stock: 6 },
  { slug: "brilliant-stars-booster-box", name: "Brilliant Stars Booster Box", category: P.BOOSTER_BOX, valueCents: 55000, stock: 3 },
  { slug: "prismatic-evolutions-super-premium-collection", name: "Prismatic Evolutions Super Premium Collection", category: P.PREMIUM_COLLECTION, valueCents: 55000, stock: 3 },
  { slug: "evolving-skies-booster-box", name: "Evolving Skies Booster Box", category: P.BOOSTER_BOX, valueCents: 220000, stock: 1 },
];

// ---------------------------------------------------------------------------
// Wheels. Odds in basis points (10,000 = 100%). Each wheel's tiers must sum to
// exactly 10,000; the seed asserts this before writing.
// ---------------------------------------------------------------------------
type TierSeed = { name: string; rarity: Rarity; oddsBps: number; color: string; products: string[] };
type WheelSeed = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  spinPriceCents: number;
  accentColor: string;
  tiers: TierSeed[];
};

const TIER_COLORS = { COMMON: "#64748b", UNCOMMON: "#22d3ee", RARE: "#a78bfa", CHASE: "#fbbf24" } as const;

const tier = (rarity: Rarity, oddsBps: number, products: string[], name?: string): TierSeed => ({
  name: name ?? rarity.charAt(0) + rarity.slice(1).toLowerCase(),
  rarity,
  oddsBps,
  color: TIER_COLORS[rarity],
  products,
});

const wheels: WheelSeed[] = [
  {
    slug: "pack-wheel",
    name: "Pack Wheel",
    tagline: "Every spin wins a sealed booster pack.",
    description: "Spin for sealed English booster packs, from current sets up to the Evolving Skies chase pack.",
    spinPriceCents: 1000,
    accentColor: "#22d3ee",
    tiers: [
      tier(Rarity.COMMON, 8000, ["current-english-booster-pack"]),
      tier(Rarity.UNCOMMON, 1000, ["sv-151-booster-pack", "prismatic-evolutions-booster-pack"]),
      tier(Rarity.RARE, 800, ["brilliant-stars-booster-pack"]),
      tier(Rarity.CHASE, 200, ["evolving-skies-booster-pack"]),
    ],
  },
  {
    slug: "tin-collection-wheel",
    name: "Tin & Collection Wheel",
    tagline: "Tins, blisters and collection boxes.",
    description: "Spin for tins, blisters, bundles and premium collections, with a 151 Elite Trainer Box as the chase prize.",
    spinPriceCents: 2500,
    accentColor: "#f472b6",
    tiers: [
      tier(Rarity.COMMON, 8000, ["mini-tin-current", "three-pack-blister-current"]),
      tier(Rarity.UNCOMMON, 1000, ["standard-tin-current", "ex-collection-box"]),
      tier(Rarity.RARE, 800, ["booster-bundle-current", "premium-collection-current"]),
      tier(Rarity.CHASE, 200, ["sv-151-etb"]),
    ],
  },
  {
    slug: "etb-wheel",
    name: "ETB Wheel",
    tagline: "Every spin wins an Elite Trainer Box.",
    description: "Spin for Elite Trainer Boxes, from in-print sets up to the Evolving Skies chase ETB.",
    spinPriceCents: 10000,
    accentColor: "#a78bfa",
    tiers: [
      tier(Rarity.COMMON, 8200, ["in-print-etb-current"]),
      tier(Rarity.UNCOMMON, 1000, ["ascended-heroes-etb"]),
      tier(Rarity.RARE, 700, ["sv-151-etb", "prismatic-evolutions-etb"]),
      tier(Rarity.CHASE, 100, ["evolving-skies-etb"]),
    ],
  },
  {
    slug: "japanese-box-wheel",
    name: "Japanese Box Wheel",
    tagline: "Sealed Japanese booster boxes.",
    description: "Spin for sealed Japanese booster boxes, from current main expansions up to VMAX Climax.",
    spinPriceCents: 9500,
    accentColor: "#f87171",
    tiers: [
      tier(Rarity.COMMON, 6000, ["jp-current-main-expansion-box"]),
      tier(Rarity.UNCOMMON, 2800, ["jp-mega-dream-ex-box", "jp-shiny-treasure-ex-box"]),
      tier(Rarity.RARE, 1000, ["jp-terastal-festival-ex-box", "jp-vstar-universe-box"]),
      tier(Rarity.CHASE, 200, ["jp-vmax-climax-box"]),
    ],
  },
  {
    slug: "premium-chase-wheel",
    name: "Premium Chase Wheel",
    tagline: "Booster boxes and the biggest chase on the site.",
    description: "Spin for English booster boxes and premium collections, with an Evolving Skies Booster Box as the chase prize.",
    spinPriceCents: 30000,
    accentColor: "#fbbf24",
    tiers: [
      tier(Rarity.COMMON, 6000, ["current-english-booster-box"]),
      tier(Rarity.UNCOMMON, 2800, ["sv-151-pokemon-center-etb", "prismatic-evolutions-pokemon-center-etb"]),
      tier(Rarity.RARE, 1000, ["brilliant-stars-booster-box", "prismatic-evolutions-super-premium-collection"]),
      tier(Rarity.CHASE, 200, ["evolving-skies-booster-box"]),
    ],
  },
];

const blockedStates = [
  { code: "NV", name: "Nevada" },
  { code: "WA", name: "Washington" },
  { code: "MT", name: "Montana" },
];

// Settings are only written if absent, so admin edits survive re-seeding.
const defaultSettings: Record<string, unknown> = {
  rtpWarnMinPercent: 80,
  rtpWarnMaxPercent: 95,
  buybackPercent: 80,
  vaultWindowDays: 7,
  vaultDefaultAction: "AUTO_SELL",
  shippingFeeCents: 995,
  demoStartingCreditsCents: 100_000,
  demoRefillCents: 100_000,
  demoRefillCooldownHours: 24,
  limitIncreaseCoolingHours: 24,
  recentWinsLimit: 20,
};

export { wheels as SEED_WHEELS, products as SEED_PRODUCTS };

async function main() {
  // Sanity-check odds before touching the database.
  for (const w of wheels) {
    const sum = w.tiers.reduce((a, t) => a + t.oddsBps, 0);
    if (sum !== 10_000) throw new Error(`Wheel ${w.slug}: odds sum to ${sum} bps, expected 10000`);
    for (const t of w.tiers) {
      for (const slug of t.products) {
        if (!products.some((p) => p.slug === slug)) throw new Error(`Wheel ${w.slug}: unknown product ${slug}`);
      }
    }
  }

  // Products: upsert by slug. Stock is only set on create.
  const productIds = new Map<string, string>();
  for (const p of products) {
    const row = await prisma.product.upsert({
      where: { slug: p.slug },
      create: { ...p },
      update: { name: p.name, category: p.category, valueCents: p.valueCents, description: p.description },
    });
    productIds.set(p.slug, row.id);
  }

  // Wheels and tiers: tiers are replaced wholesale per wheel on re-seed only
  // when the wheel has no spins yet (so the audit trail keeps valid tier ids).
  for (const [i, w] of wheels.entries()) {
    const wheel = await prisma.wheel.upsert({
      where: { slug: w.slug },
      create: {
        slug: w.slug, name: w.name, tagline: w.tagline, description: w.description,
        spinPriceCents: w.spinPriceCents, accentColor: w.accentColor, sortOrder: i,
      },
      update: { name: w.name, tagline: w.tagline, description: w.description, sortOrder: i },
    });

    const spinCount = await prisma.spin.count({ where: { wheelId: wheel.id } });
    const tierCount = await prisma.tier.count({ where: { wheelId: wheel.id } });
    if (tierCount > 0 && spinCount > 0) continue; // never rewrite a wheel with history
    if (tierCount > 0) await prisma.tier.deleteMany({ where: { wheelId: wheel.id } });

    for (const [j, t] of w.tiers.entries()) {
      await prisma.tier.create({
        data: {
          wheelId: wheel.id, name: t.name, rarity: t.rarity, oddsBps: t.oddsBps, color: t.color, sortOrder: j,
          products: { create: t.products.map((slug) => ({ productId: productIds.get(slug)! })) },
        },
      });
    }
  }

  for (const s of blockedStates) {
    await prisma.blockedState.upsert({ where: { code: s.code }, create: s, update: {} });
  }

  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value: value as object }, update: {} });
  }

  // Bootstrap admin.
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const serverSeed = randomBytes(32).toString("hex");
    await prisma.user.upsert({
      where: { email: adminEmail },
      create: {
        email: adminEmail,
        passwordHash: await hash(adminPassword, 12),
        displayName: "Admin",
        role: "ADMIN",
        ageConfirmedAt: new Date(),
        clientSeed: randomBytes(16).toString("hex"),
        nextServerSeed: serverSeed,
        nextServerSeedHash: createHash("sha256").update(serverSeed).digest("hex"),
      },
      update: { role: "ADMIN" },
    });
    console.log(`Admin account ready: ${adminEmail}`);
  } else {
    console.warn("ADMIN_EMAIL / ADMIN_PASSWORD not set: no admin account created");
  }

  console.log(`Seeded ${products.length} products, ${wheels.length} wheels, ${blockedStates.length} blocked states.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
