"use client";

import { useActionState, useState } from "react";
import { forgotPasswordAction } from "../password-actions";
import type { AuthFormState } from "../actions";
import { FormField } from "@/components/ui/FormField";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function ForgotForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(forgotPasswordAction, undefined);
  const [email, setEmail] = useState("");
  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      {state?.message && <Alert kind="info">{state.message}</Alert>}
      <FormField label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </FormField>
      <SubmitButton>Send reset link</SubmitButton>
    </form>
  );
}
