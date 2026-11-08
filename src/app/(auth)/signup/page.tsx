import Link from "next/link";
import { SignupForm } from "./SignupForm";
import { isDemoMode } from "@/server/config";
import { getSettings } from "@/server/settings";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Sign up" };

export default async function SignupPage() {
  const settings = await getSettings();
  const demo = isDemoMode();
  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-muted">
          {demo
            ? `Demo mode: new accounts receive ${formatCents(settings.demoStartingCreditsCents, { compact: true })} in free demo credits.`
            : "You must be 18 or older to play."}
        </p>
        <SignupForm />
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
