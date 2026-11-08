import Link from "next/link";
import { auth, signOut } from "@/auth";
import { prisma } from "@/server/db";
import { formatCents } from "@/lib/money";
import { isDemoMode } from "@/server/config";
import { MobileNav } from "./MobileNav";

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
        select: { demoBalanceCents: true, realBalanceCents: true, role: true, displayName: true, _count: { select: { vaultItems: { where: { status: "PENDING" } } } } },
      })
    : null;
  const demo = isDemoMode();
  const balance = user ? (demo ? user.demoBalanceCents : user.realBalanceCents) : null;
  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/" });
  };
  const userNav = user ? [{ href: "/vault", label: "Vault" }, { href: "/wallet", label: "Wallet" }, { href: "/account", label: "Account" }, ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : [])] : [];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
      <div className="relative mx-auto flex max-w-6xl items-center gap-x-4 px-4 py-3 sm:px-6">
        <MobileNav items={[...NAV, ...userNav]} signOut={user ? signOutAction : undefined} />
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight" aria-label="HonshuWheel home">
          <span aria-hidden className="inline-block h-6 w-6 rounded-full bg-[conic-gradient(var(--color-accent),var(--color-accent-2),var(--color-tier-chase),var(--color-accent))]" />
          Honshu<span className="text-accent">Wheel</span>
        </Link>

        <nav aria-label="Main" className="hidden gap-4 text-sm text-muted sm:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-text">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 text-sm">
          {user ? (
            <>
              <Link href="/wallet" className="badge border border-border bg-surface-2 font-mono text-text" aria-label={`${demo ? "Demo balance" : "Balance"} ${formatCents(balance ?? 0)}`}>
                {demo && <span className="mr-1 text-warning" aria-hidden>DEMO</span>}
                {formatCents(balance ?? 0)}
              </Link>
              <Link href="/vault" className="btn-ghost hidden sm:inline-flex">
                Vault
                {user._count.vaultItems > 0 && (
                  <span className="badge bg-accent text-bg" aria-label={`${user._count.vaultItems} items awaiting a decision`}>{user._count.vaultItems}</span>
                )}
              </Link>
              <Link href="/account" className="btn-ghost hidden sm:inline-flex">Account</Link>
              {user.role === "ADMIN" && <Link href="/admin" className="btn-ghost hidden text-accent-2 sm:inline-flex">Admin</Link>}
              <form action={signOutAction} className="hidden sm:block">
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
