import { prisma } from "@/server/db";
import { getSettings, SETTING_LABELS } from "@/server/settings";
import { config } from "@/server/config";
import { SettingsForm, BlockedStates } from "@/components/admin/SettingsForm";

export const metadata = { title: "Admin · Settings" };

export default async function AdminSettingsPage() {
  const [settings, blocked] = await Promise.all([getSettings(), prisma.blockedState.findMany({ orderBy: { name: "asc" } })]);
  const fields = [
    { key: "rtpWarnMinPercent", label: SETTING_LABELS.rtpWarnMinPercent, kind: "number" as const, help: "Admin warns when a wheel's RTP is below this." },
    { key: "rtpWarnMaxPercent", label: SETTING_LABELS.rtpWarnMaxPercent, kind: "number" as const },
    { key: "buybackPercent", label: SETTING_LABELS.buybackPercent, kind: "number" as const, help: "Shown to users before they confirm a sale." },
    { key: "vaultWindowDays", label: SETTING_LABELS.vaultWindowDays, kind: "number" as const },
    { key: "vaultDefaultAction", label: SETTING_LABELS.vaultDefaultAction, kind: "select" as const, options: ["AUTO_SELL", "AUTO_SHIP_HOLD"] },
    { key: "shippingFeeCents", label: "Flat shipping fee", kind: "cents" as const },
    { key: "demoStartingCreditsCents", label: "Demo credits at signup", kind: "cents" as const },
    { key: "demoRefillCents", label: "Demo refill amount", kind: "cents" as const },
    { key: "demoRefillCooldownHours", label: SETTING_LABELS.demoRefillCooldownHours, kind: "number" as const },
    { key: "limitIncreaseCoolingHours", label: SETTING_LABELS.limitIncreaseCoolingHours, kind: "number" as const },
    { key: "recentWinsLimit", label: SETTING_LABELS.recentWinsLimit, kind: "number" as const },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Global settings</h1>
      <p className="text-sm">
        Launch mode: <span className={`badge ${config.realMoneyEnabled ? "bg-danger/20 text-danger" : "bg-warning/20 text-warning"}`}>{config.realMoneyEnabled ? "REAL MONEY ENABLED" : "DEMO MODE"}</span>
        <span className="ml-2 text-muted">Set by the REAL_MONEY_ENABLED environment variable, deliberately not editable here.</span>
      </p>
      <SettingsForm initial={settings as unknown as Record<string, string | number>} fields={fields} />
      <BlockedStates blocked={blocked} />
    </div>
  );
}
