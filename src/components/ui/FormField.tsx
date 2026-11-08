import type { ReactNode } from "react";

interface Props {
  label: string;
  htmlFor: string;
  error?: string[] | string;
  hint?: string;
  children: ReactNode;
}

/** Label + control + inline error, used by auth and account forms. */
export function FormField({ label, htmlFor, error, hint, children }: Props) {
  const err = Array.isArray(error) ? error[0] : error;
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {hint && !err && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {err && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {err}
        </p>
      )}
    </div>
  );
}
