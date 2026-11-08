"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { resetPasswordAction } from "../password-actions";
import type { AuthFormState } from "../actions";
import { FormField } from "@/components/ui/FormField";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState<AuthFormState, FormData>(resetPasswordAction, undefined);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  if (state?.message === "ok") {
    return <Alert kind="success">Your password has been changed. <Link href="/login" className="underline">Log in</Link>.</Alert>;
  }
  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormField label="New password" htmlFor="password" error={state?.errors?.password} hint="At least 10 characters.">
        <input id="password" name="password" type="password" autoComplete="new-password" required className="input" value={pw} onChange={(e) => setPw(e.target.value)} />
      </FormField>
      <FormField label="Confirm new password" htmlFor="confirm" error={state?.errors?.confirm}>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </FormField>
      <SubmitButton>Set new password</SubmitButton>
    </form>
  );
}
