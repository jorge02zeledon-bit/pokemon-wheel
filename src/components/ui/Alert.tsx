import type { ReactNode } from "react";

const STYLES = {
  info: "border-accent/40 bg-accent/10 text-text",
  success: "border-success/40 bg-success/10 text-text",
  warning: "border-warning/50 bg-warning/10 text-text",
  danger: "border-danger/50 bg-danger/10 text-text",
} as const;

export function Alert({ kind = "info", children }: { kind?: keyof typeof STYLES; children: ReactNode }) {
  return (
    <div role={kind === "danger" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${STYLES[kind]}`}>
      {children}
    </div>
  );
}
