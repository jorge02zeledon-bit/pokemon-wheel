import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/server/db";
import { Verifier } from "@/components/fair/Verifier";
import { TierBadge } from "@/components/wheel/TierBadge";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Provably Fair" };

export default async function FairPage({ searchParams }: PageProps<"/fair">) {
  const sp = await searchParams;
  const spinId = typeof sp.spin === "string" ? sp.spin : undefined;
  const session = await auth();
  const mySpins = session?.user?.id
    ? await prisma.spin.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { wheel: { select: { name: true } }, tier: { select: { name: true, rarity: true } }, product: { select: { name: true } } },
      })
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-black">Provably fair</h1>
        <p className="text-muted">
          Every spin&apos;s outcome is decided by a hash that neither you nor we can predict or alter. The wheel animation only
          displays a result the server has already committed to and recorded.
        </p>
      </header>

      <section className="card space-y-4 p-6 text-sm">
        <h2 className="text-lg font-bold">How a spin is decided</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li><strong>Commitment.</strong> Before you spin, the server generates a random 256-bit <em>server seed</em> and shows you only its SHA-256 hash. The seed cannot be changed afterwards without the hash changing.</li>
          <li><strong>Your input.</strong> You control a <em>client seed</em> (change it any time on the wheel page) and each spin uses the next <em>nonce</em> (1, 2, 3…).</li>
          <li><strong>The roll.</strong> <code className="font-mono">resultHash = HMAC-SHA256(serverSeed, &quot;clientSeed:nonce&quot;)</code>.</li>
          <li><strong>Tier.</strong> The first 8 hex characters of the hash (32 bits) are taken modulo 10,000 to give a number from 0 to 9,999. Tiers are laid out in order with widths equal to their odds in hundredths of a percent; the number falls into exactly one tier.</li>
          <li><strong>Product.</strong> The next 6 hex characters (24 bits) modulo the number of products in that tier pick the product, each equally likely.</li>
          <li><strong>Reveal.</strong> After the spin, the server seed is revealed and a new one is committed for your next spin. Every spin stores the seeds, nonce, hash and a snapshot of the odds in force, in a table the database refuses to modify.</li>
        </ol>
        <p className="text-xs text-muted">
          Known bias: 2<sup>32</sup> is not a multiple of 10,000, so rolls below 7,296 are favoured by about 1 part in 429,000
          (roughly 0.0002% of a 1% tier). Product selection uses 24 bits for at most a handful of products, a bias below 1 in 1,000,000.
          Both are disclosed here rather than hidden.
        </p>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">Verify a spin</h2>
        <p className="text-sm text-muted">Paste the values from any spin, or open one of your spins below. Verification runs in your browser.</p>
        <Verifier spinId={spinId} />
      </section>

      {session?.user && (
        <section className="card p-6">
          <h2 className="text-lg font-bold">Your recent spins</h2>
          {mySpins.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No spins yet.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr><th className="py-2">#</th><th className="py-2">Wheel</th><th className="py-2">Result</th><th className="py-2 text-right">Value</th><th className="py-2"></th></tr></thead>
              <tbody className="divide-y divide-border">
                {mySpins.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 font-mono text-muted">{s.nonce}</td>
                    <td className="py-2">{s.wheel.name}</td>
                    <td className="py-2"><TierBadge rarity={s.tier.rarity} name={s.tier.name} /> <span className="ml-1">{s.product.name}</span></td>
                    <td className="py-2 text-right font-mono">{formatCents(s.productValueCents, { compact: true })}</td>
                    <td className="py-2 text-right"><Link href={`/fair?spin=${s.id}`} className="text-accent underline-offset-2 hover:underline">Verify</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
