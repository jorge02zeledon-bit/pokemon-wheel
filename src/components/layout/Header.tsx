import Link from "next/link";
import { auth, signOut } from "@/auth";
import { prisma } from "@/server/db";
import { formatCents } from "@/lib/money";
import { isDemoMode } from "@/server/config";

const NAV = [
  { href: "/", label: "Wheels" },
  { href: "/odds", label: "Odds & Rules" },
  { href: "/fair", label: "Provably Fair" },
  { href: "/faq", label: "FAQ" },
];

export async function Header() {
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { demoBalanceCents: true, realBalanceCents: true, role: true, displayName: true },
      })
    : null;
  const demo = isDemoMode();
  const balance = user ? (demo ? user.demoBalanceCents : user.realBalanceCents) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span aria-hidden className="inline-block h-6 w-6 rounded-full bg-[conic-gradient(var(--color-accent),var(--color-accent-2),var(--color-tier-chase),var(--color-accent))]" />
          Honshu<span className="text-accent">Wheel</span>
        </Link>

        <nav aria-label="Main" className="order-3 flex w-full gap-4 text-sm text-muted sm:order-none sm:w-auto">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-text">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 text-sm">
          {user ? (
            <>
              <Link href="/wallet" className="badge border border-border bg-surface-2 font-mono text-text" title={demo ? "Demo credits" : "Balance"}>
                {demo && <span className="mr-1 text-warning">DEMO</span>}
                {formatCents(balance ?? 0)}
              </Link>
              <Link href="/vault" className="btn-ghost hidden sm:inline-flex">Vault</Link>
              <Link href="/account" className="btn-ghost">Account</Link>
              {user.role === "ADMIN" && (
                <Link href="/admin" className="btn-ghost text-accent-2">Admin</Link>
              )}
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button type="submit" className="btn-secondary px-3 py-1.5">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">Log in</Link>
              <Link href="/signup" className="btn-primary px-3 py-1.5">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
