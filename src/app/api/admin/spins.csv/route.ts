import { Rarity } from "@prisma/client";
import { requireAdmin } from "@/server/guards";
import { exportSpinsCsv } from "@/server/admin/spins";
import { apiError } from "@/server/api";

/** GET /api/admin/spins.csv?wheelId&email&rarity: CSV export of the spin log (admin). */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const u = new URL(req.url);
    const rarity = u.searchParams.get("rarity");
    const csv = await exportSpinsCsv({
      wheelId: u.searchParams.get("wheelId") || undefined,
      email: u.searchParams.get("email") || undefined,
      rarity: rarity && (Object.values(Rarity) as string[]).includes(rarity) ? (rarity as Rarity) : undefined,
    });
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="spins-${Date.now()}.csv"` } });
  } catch (e) {
    return apiError(e);
  }
}
