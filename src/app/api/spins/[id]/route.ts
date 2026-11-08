import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUser, ForbiddenError } from "@/server/guards";
import { apiError } from "@/server/api";
import { oddsSnapshotSchema } from "@/server/engine/snapshot";
import { verifySpin } from "@/server/engine/verify";

/**
 * GET /api/spins/:id
 * Full fairness record of one spin, including the revealed server seed, for the
 * owner or an admin. Also returns a fresh server-side verification so the
 * client can show "verified" without trusting itself.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/spins/[id]">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const spin = await prisma.spin.findUnique({
      where: { id },
      include: { wheel: { select: { slug: true, name: true } }, tier: true, product: { select: { id: true, name: true, valueCents: true, imageUrl: true } } },
    });
    if (!spin) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (spin.userId !== user.id && user.role !== "ADMIN") throw new ForbiddenError();

    const snapshot = oddsSnapshotSchema.parse(spin.oddsSnapshot);
    const check = verifySpin({
      serverSeed: spin.serverSeed,
      serverSeedHash: spin.serverSeedHash,
      clientSeed: spin.clientSeed,
      nonce: spin.nonce,
      snapshot,
    });
    return NextResponse.json({
      spin,
      verification: {
        seedHashMatches: check.seedHashMatches,
        resultHashMatches: check.resultHash === spin.resultHash,
        tierMatches: check.tier.id === spin.tierId,
        productMatches: check.product.id === spin.productId,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
