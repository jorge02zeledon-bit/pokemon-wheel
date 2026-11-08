/**
 * Seed DATA for the five launch wheels, products, blocked states and settings.
 * Kept separate from the seed script so tests can import it without running
 * the seed. These are STARTING values; the admin panel owns them after first run.
 */
import { ProductCategory, Rarity } from "@prisma/client";

// ---------------------------------------------------------------------------
// Products. Values are approximate market prices in cents. Names are plain
// text only (no logos or artwork); images are uploaded later in admin.
// Products shared between wheels appear once and share stock.
// ---------------------------------------------------------------------------
export type ProductSeed = {
  slug: string;
  name: string;
  category: ProductCategory;
  valueCents: number;
  stock: number;
  description?: string;
};

const P = ProductCategory;
export const products: ProductSeed[] = [
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
export type TierSeed = { name: string; rarity: Rarity; oddsBps: number; color: string; products: string[] };
export type WheelSeed = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  spinPriceCents: number;
  accentColor: string;
  tiers: TierSeed[];
};

export const TIER_COLORS = { COMMON: "#64748b", UNCOMMON: "#22d3ee", RARE: "#a78bfa", CHASE: "#fbbf24" } as const;

const tier = (rarity: Rarity, oddsBps: number, products: string[], name?: string): TierSeed => ({
  name: name ?? rarity.charAt(0) + rarity.slice(1).toLowerCase(),
  rarity,
  oddsBps,
  color: TIER_COLORS[rarity],
  products,
});

export const wheels: WheelSeed[] = [
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

export const blockedStates = [
  { code: "NV", name: "Nevada" },
  { code: "WA", name: "Washington" },
  { code: "MT", name: "Montana" },
];

// Settings are only written if absent, so admin edits survive re-seeding.
export const defaultSettings: Record<string, unknown> = {
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

