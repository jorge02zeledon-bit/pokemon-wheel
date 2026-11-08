import { requireUserOrRedirect } from "@/server/guards";
import { prisma } from "@/server/db";
import { config } from "@/server/config";
import { getSettings } from "@/server/settings";
import { getEffectiveLimits } from "@/server/compliance/limits";
import { getActiveExclusion } from "@/server/compliance/exclusion";
import { stateName } from "@/lib/us-states";
import { IdentityCard } from "@/components/account/IdentityCard";
import { ResponsiblePlay } from "@/components/account/ResponsiblePlay";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUserOrRedirect();
  const [limits, exclusion, settings] = await Promise.all([getEffectiveLimits(prisma, user.id), getActiveExclusion(user.id), getSettings()]);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-black">Account</h1>
      <section className="card p-6">
        <h2 className="text-lg font-bold">Profile</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Display name</dt><dd>{user.displayName}</dd></div>
          <div><dt className="text-muted">Email</dt><dd>{user.email}</dd></div>
          <div><dt className="text-muted">State</dt><dd>{user.stateCode ? stateName(user.stateCode) : "—"}</dd></div>
          <div><dt className="text-muted">Age confirmed</dt><dd>{user.ageConfirmedAt ? `Yes (18+), ${user.ageConfirmedAt.toLocaleDateString("en-US")}` : "No"}</dd></div>
          <div><dt className="text-muted">Member since</dt><dd>{user.createdAt.toLocaleDateString("en-US")}</dd></div>
        </dl>
      </section>
      <IdentityCard initialStatus={user.identityStatus} realMoney={config.realMoneyEnabled} />
      <ResponsiblePlay
        limits={limits.limits}
        pending={limits.pending}
        pendingEffectiveAt={limits.pendingEffectiveAt?.toISOString() ?? null}
        coolingHours={settings.limitIncreaseCoolingHours}
        cooldownUntil={user.cooldownUntil?.toISOString() ?? null}
        exclusion={exclusion ? { duration: exclusion.duration, endsAt: exclusion.endsAt?.toISOString() ?? null } : null}
      />
    </div>
  );
}
