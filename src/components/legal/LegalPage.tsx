import { Alert } from "@/components/ui/Alert";

/** Shared frame for draft legal pages. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-black">{title}</h1>
        <Alert kind="warning">
          <strong>DRAFT — must be reviewed by an attorney before launch.</strong> Bracketed items are placeholders. Nothing on this page
          is legal advice or a binding commitment until counsel has approved it.
        </Alert>
        <p className="text-xs text-muted">Draft last updated {updated}.</p>
      </header>
      <div className="space-y-4 text-sm leading-relaxed text-text [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
        {children}
      </div>
    </article>
  );
}
