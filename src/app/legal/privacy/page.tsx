import { Alert } from "@/components/ui/Alert";

export const metadata = { title: "Privacy Policy" };

export default function Page() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-black">Privacy Policy</h1>
      <Alert kind="warning">DRAFT — must be reviewed by an attorney before launch.</Alert>
      <p className="text-muted">Placeholder text. The full draft is written in Phase 6.</p>
    </div>
  );
}
