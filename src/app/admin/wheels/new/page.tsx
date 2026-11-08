import { prisma } from "@/server/db";
import { getSettings } from "@/server/settings";
import { WheelEditor } from "@/components/admin/WheelEditor";

export const metadata = { title: "Admin · New wheel" };

export default async function NewWheelPage() {
  const [products, settings, count] = await Promise.all([prisma.product.findMany({ orderBy: { name: "asc" } }), getSettings(), prisma.wheel.count()]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New wheel</h1>
      <WheelEditor
        initial={{
          slug: "", name: "", tagline: "", description: "", spinPrice: "10.00", sortOrder: count, isActive: false, guaranteedFloor: false, accentColor: "#22d3ee",
          tiers: [
            { name: "Common", rarity: "COMMON", oddsPercent: "80", color: "#64748b", productIds: [], spins: 0 },
            { name: "Uncommon", rarity: "UNCOMMON", oddsPercent: "10", color: "#22d3ee", productIds: [], spins: 0 },
            { name: "Rare", rarity: "RARE", oddsPercent: "8", color: "#a78bfa", productIds: [], spins: 0 },
            { name: "Chase", rarity: "CHASE", oddsPercent: "2", color: "#fbbf24", productIds: [], spins: 0 },
          ],
        }}
        products={products.map((p) => ({ id: p.id, name: p.name, valueCents: p.valueCents, stock: p.stock, isActive: p.isActive, category: p.category }))}
        rtpRange={{ min: settings.rtpWarnMinPercent, max: settings.rtpWarnMaxPercent }}
      />
    </div>
  );
}
