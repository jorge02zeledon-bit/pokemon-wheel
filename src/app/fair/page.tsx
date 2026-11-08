export const metadata = { title: "Provably Fair" };

export default function Page() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-black">Provably Fair</h1>
      <p className="text-muted">The spin verifier arrives in Phase 3. Every spin combines a hashed server seed shown before you spin, your client seed and a nonce.</p>
    </div>
  );
}
