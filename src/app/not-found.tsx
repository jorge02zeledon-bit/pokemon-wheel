import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <p className="font-mono text-6xl font-black text-accent">404</p>
      <h1 className="text-2xl font-bold">That page does not exist</h1>
      <p className="text-muted">The wheel you are looking for may have been retired or renamed.</p>
      <Link href="/" className="btn-primary">Back to the wheels</Link>
    </div>
  );
}
