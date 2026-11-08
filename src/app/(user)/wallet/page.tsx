import { requireUserOrRedirect } from "@/server/guards";

export const metadata = { title: "Wallet" };

export default async function Page() {
  await requireUserOrRedirect();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-black">Wallet</h1>
      <p className="text-muted">Coming in a later build phase.</p>
    </div>
  );
}
