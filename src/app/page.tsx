import Link from "next/link";
import { listActiveWheels } from "@/server/wheels/queries";
import { WheelCard } from "@/components/wheel/WheelCard";

export default async function HomePage() {
  const wheels = await listActiveWheels();
  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface/70 px-6 py-14 text-center sm:px-12">
        <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
        <h1 className="relative text-4xl font-black tracking-tight sm:text-5xl">
          Spin. Win <span className="text-accent">sealed</span> product.
        </h1>
        <p className="relative mx-auto mt-4 max-w-2xl text-balance text-muted">
          Every spin wins a real sealed trading card product. Odds are published before you spin,
          every result is provably fair, and prizes ship to your door or sell back for instant credit.
        </p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="#wheels" className="btn-primary">Choose a wheel</Link>
          <Link href="/fair" className="btn-secondary">How fairness works</Link>
        </div>
      </section>

      <section id="wheels" className="space-y-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">The wheels</h2>
          <Link href="/odds" className="text-sm text-accent">Full odds & rules →</Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {wheels.map((w) => <WheelCard key={w.id} wheel={w} />)}
        </div>
      </section>
    </div>
  );
}
