import { requireUserOrRedirect } from "@/server/guards";
import { stateName } from "@/lib/us-states";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUserOrRedirect();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-black">Account</h1>
      <section className="card p-6">
        <h2 className="text-lg font-bold">Profile</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Display name</dt><dd>{user.displayName}</dd></div>
          <div><dt className="text-muted">Email</dt><dd>{user.email}</dd></div>
          <div><dt className="text-muted">State</dt><dd>{user.stateCode ? stateName(user.stateCode) : "—"}</dd></div>
          <div><dt className="text-muted">Age confirmed</dt><dd>{user.ageConfirmedAt ? "Yes (18+)" : "No"}</dd></div>
          <div><dt className="text-muted">Identity verification</dt><dd>{user.identityStatus.replace("_", " ").toLowerCase()}</dd></div>
          <div><dt className="text-muted">Member since</dt><dd>{user.createdAt.toLocaleDateString("en-US")}</dd></div>
        </dl>
      </section>
      <section id="responsible-play" className="card p-6 text-sm text-muted">
        <h2 className="text-lg font-bold text-text">Responsible play</h2>
        <p className="mt-2">Deposit limits, breaks and self-exclusion controls arrive in a later phase.</p>
      </section>
    </div>
  );
}
