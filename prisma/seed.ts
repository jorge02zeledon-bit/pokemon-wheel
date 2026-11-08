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
 * Data lives in ./seed-data.ts. Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { blockedStates, defaultSettings, products, wheels } from "./seed-data";
import { hash } from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";

const prisma = new PrismaClient();


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
