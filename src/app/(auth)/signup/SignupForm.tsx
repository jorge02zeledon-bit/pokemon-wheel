"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signup, type AuthFormState } from "../actions";
import { FormField } from "@/components/ui/FormField";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { US_STATES } from "@/lib/us-states";

/**
 * Inputs are controlled so a failed server-side validation does not wipe what
 * the user typed (React resets uncontrolled form fields after a form action).
 */
export function SignupForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(signup, undefined);
  const [v, setV] = useState({ displayName: "", email: "", password: "", stateCode: "", ageConfirmed: false, termsAccepted: false });
  const e = state?.errors ?? {};
  const set = (k: keyof typeof v) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((p) => ({ ...p, [k]: ev.target.type === "checkbox" ? (ev.target as HTMLInputElement).checked : ev.target.value }));

  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      {state?.message && <Alert kind="danger">{state.message}</Alert>}
      <FormField label="Display name" htmlFor="displayName" error={e.displayName} hint="Shown in the recent wins feed.">
        <input id="displayName" name="displayName" autoComplete="nickname" required className="input" value={v.displayName} onChange={set("displayName")} />
      </FormField>
      <FormField label="Email" htmlFor="email" error={e.email}>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" value={v.email} onChange={set("email")} />
      </FormField>
      <FormField label="Password" htmlFor="password" error={e.password} hint="At least 10 characters.">
        <input id="password" name="password" type="password" autoComplete="new-password" required className="input" value={v.password} onChange={set("password")} />
      </FormField>
      <FormField label="State of residence" htmlFor="stateCode" error={e.stateCode} hint="Spinning is not available in some states.">
        <select id="stateCode" name="stateCode" required className="input" value={v.stateCode} onChange={set("stateCode")}>
          <option value="" disabled>Select your state</option>
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
      </FormField>

      <div className="space-y-2 rounded-xl border border-border bg-bg/40 p-4 text-sm">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="ageConfirmed" className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]" checked={v.ageConfirmed} onChange={set("ageConfirmed")} />
          <span>I confirm that I am 18 years of age or older.</span>
        </label>
        {e.ageConfirmed && <p role="alert" className="text-xs text-danger">{e.ageConfirmed[0]}</p>}
        <label className="flex items-start gap-3">
          <input type="checkbox" name="termsAccepted" className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]" checked={v.termsAccepted} onChange={set("termsAccepted")} />
          <span>
            I agree to the <Link href="/legal/terms" className="underline">Terms of Service</Link> and{" "}
            <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.
          </span>
        </label>
        {e.termsAccepted && <p role="alert" className="text-xs text-danger">{e.termsAccepted[0]}</p>}
      </div>

      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}
