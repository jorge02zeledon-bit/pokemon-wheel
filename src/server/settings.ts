import { z } from "zod";
import type { InputJsonValue } from "@prisma/client/runtime/library";
import { prisma } from "./db";
import type { Tx } from "./db";

/**
 * Runtime settings editable from the admin panel.
 *
 * Every key has a zod schema (used to validate admin edits) and a default.
 * Values are stored as JSON in the Setting table. Reads are cached briefly
 * per process; writes clear the cache.
 */
export const settingSchemas = {
  /** Warn in admin when a wheel's RTP is below this percentage. */
  rtpWarnMinPercent: z.number().min(0).max(100),
  /** Warn in admin when a wheel's RTP is above this percentage. */
  rtpWarnMaxPercent: z.number().min(0).max(200),
  /** Buyback price as a percentage of the item's listed value. */
  buybackPercent: z.number().int().min(0).max(100),
  /** Days a user has to choose ship/sell before the default action applies. */
  vaultWindowDays: z.number().int().min(1).max(365),
  /** What happens when the vault window closes with no decision. */
  vaultDefaultAction: z.enum(["AUTO_SELL", "AUTO_SHIP_HOLD"]),
  /** Flat shipping fee in cents charged per shipping request. */
  shippingFeeCents: z.number().int().min(0),
  /** Demo credits (cents) granted at signup while in demo mode. */
  demoStartingCreditsCents: z.number().int().min(0),
  /** Demo credits (cents) granted by the "refill" button. */
  demoRefillCents: z.number().int().min(0),
  /** Hours a user must wait between demo refills. */
  demoRefillCooldownHours: z.number().min(0),
  /** Hours before a responsible-play limit INCREASE takes effect. */
  limitIncreaseCoolingHours: z.number().min(0),
  /** How many wins to show in the recent-wins feed. */
  recentWinsLimit: z.number().int().min(1).max(100),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type Settings = { [K in SettingKey]: z.infer<(typeof settingSchemas)[K]> };

export const SETTING_DEFAULTS: Settings = {
  rtpWarnMinPercent: 80,
  rtpWarnMaxPercent: 95,
  buybackPercent: 80,
  vaultWindowDays: 7,
  vaultDefaultAction: "AUTO_SELL",
  shippingFeeCents: 995,
  demoStartingCreditsCents: 100_000, // $1,000 in demo credits
  demoRefillCents: 100_000,
  demoRefillCooldownHours: 24,
  limitIncreaseCoolingHours: 24,
  recentWinsLimit: 20,
};

/** Human-readable labels for the admin settings page. */
export const SETTING_LABELS: Record<SettingKey, string> = {
  rtpWarnMinPercent: "RTP warning: minimum %",
  rtpWarnMaxPercent: "RTP warning: maximum %",
  buybackPercent: "Buyback % of listed value",
  vaultWindowDays: "Vault decision window (days)",
  vaultDefaultAction: "Default action when window closes",
  shippingFeeCents: "Flat shipping fee (cents)",
  demoStartingCreditsCents: "Demo credits at signup (cents)",
  demoRefillCents: "Demo refill amount (cents)",
  demoRefillCooldownHours: "Demo refill cooldown (hours)",
  limitIncreaseCoolingHours: "Cooling-off for limit increases (hours)",
  recentWinsLimit: "Recent wins shown",
};

const CACHE_TTL_MS = 5_000;
let cache: { at: number; values: Settings } | null = null;

/** Load all settings, applying defaults for missing or invalid rows. */
export async function getSettings(db: Tx | typeof prisma = prisma): Promise<Settings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.values;
  const rows = await db.setting.findMany();
  const values: Settings = { ...SETTING_DEFAULTS };
  for (const row of rows) {
    const key = row.key as SettingKey;
    const schema = settingSchemas[key];
    if (!schema) continue;
    const parsed = schema.safeParse(row.value);
    if (parsed.success) (values as Record<string, unknown>)[key] = parsed.data;
  }
  cache = { at: Date.now(), values };
  return values;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  const all = await getSettings();
  return all[key];
}

/** Validate and persist one setting. Throws ZodError on invalid input. */
export async function setSetting<K extends SettingKey>(
  key: K,
  value: unknown,
  db: Tx | typeof prisma = prisma,
): Promise<Settings[K]> {
  const parsed = settingSchemas[key].parse(value) as Settings[K];
  await db.setting.upsert({
    where: { key },
    create: { key, value: parsed as InputJsonValue },
    update: { value: parsed as InputJsonValue },
  });
  cache = null;
  return parsed;
}

/** Drop the in-process cache (used by tests and after bulk writes). */
export function clearSettingsCache() {
  cache = null;
}
