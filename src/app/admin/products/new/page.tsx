import { ProductForm } from "@/components/admin/ProductForm";

export const metadata = { title: "Admin · New product" };

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New product</h1>
      <ProductForm initial={{ slug: "", name: "", category: "BOOSTER_PACK", value: "", description: "", isActive: true, initialStock: "0" }} />
    </div>
  );
}
