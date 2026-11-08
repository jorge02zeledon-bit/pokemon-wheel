"use client";

import { useActionState, useState } from "react";
import { login, type AuthFormState } from "../actions";
import { FormField } from "@/components/ui/FormField";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<AuthFormState, FormData>(login, undefined);
  // Controlled so a wrong password does not clear the email field.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state?.message && <Alert kind="danger">{state.message}</Alert>}
      <FormField label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </FormField>
      <FormField label="Password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
      </FormField>
      <SubmitButton>Log in</SubmitButton>
    </form>
  );
}
