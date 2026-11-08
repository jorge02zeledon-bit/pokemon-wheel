import { notFound } from "next/navigation";
import { getWheelForAdmin } from "@/server/admin/wheels";
import { prisma } from "@/server/db";
import { getSettings } from "@/server/settings";
import { WheelEditor } from "@/components/admin/WheelEditor";

export const metadata = { title: "Admin · Edit wheel" };

export default async function EditWheelPage({ params }: PageProps<"/admin/wheels/[id]">) {
  const { id } = await params;
  const [wheel, products, settings] = await Promise.all([getWheelForAdmin(id), prisma.product.findMany({ orderBy: { name: "asc" } }), getSettings()]);
  if (!wheel) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit: {wheel.name}</h1>
      <WheelEditor
        initial={{
          id: wheel.id, slug: wheel.slug, name: wheel.name, tagline: wheel.tagline ?? "", description: wheel.description ?? "",
          spinPrice: (wheel.spinPriceCents / 100).toFixed(2), sortOrder: wheel.sortOrder, isActive: wheel.isActive,
          guaranteedFloor: wheel.guaranteedFloor, accentColor: wheel.accentColor,
          tiers: wheel.tiers.map((t) => ({ id: t.id, name: t.name, rarity: t.rarity, oddsPercent: String(t.oddsBps / 100), color: t.color, productIds: t.products.map((tp) => tp.productId), spins: t._count.spins })),
        }}
        products={products.map((p) => ({ id: p.id, name: p.name, valueCents: p.valueCents, stock: p.stock, isActive: p.isActive, category: p.category }))}
        rtpRange={{ min: settings.rtpWarnMinPercent, max: settings.rtpWarnMaxPercent }}
      />
    </div>
  );
}
