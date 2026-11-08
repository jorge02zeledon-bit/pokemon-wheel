import { requireUserOrRedirect } from "@/server/guards";
import { isDemoMode } from "@/server/config";
import { getSettings } from "@/server/settings";
import { processExpiredVaultItems } from "@/server/vault/expiry";
import { listVaultItems } from "@/server/vault/queries";
import { VaultList } from "@/components/vault/VaultList";

export const metadata = { title: "Vault" };

export default async function VaultPage() {
  const user = await requireUserOrRedirect();
  // Apply the default action to anything that expired, so the page never
  // shows a stale "pending" item even if the cron job has not run yet.
  await processExpiredVaultItems({ userId: user.id });
  const [items, settings] = await Promise.all([listVaultItems(user.id), getSettings()]);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-black">Vault</h1>
      <VaultList
        items={items}
        isDemo={isDemoMode()}
        buybackPercent={settings.buybackPercent}
        shippingFeeCents={settings.shippingFeeCents}
        defaultAction={settings.vaultDefaultAction}
        windowDays={settings.vaultWindowDays}
      />
    </div>
  );
}
