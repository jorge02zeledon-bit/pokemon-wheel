import { prisma } from "@/server/db";
import { config } from "@/server/config";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const [users, wheels, products, spins] = await Promise.all([
    prisma.user.count(),
    prisma.wheel.count(),
    prisma.product.count(),
    prisma.spin.count(),
  ]);
  const stats = [
    ["Users", users],
    ["Wheels", wheels],
    ["Products", products],
    ["Spins", spins],
  ] as const;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>
      <p className="text-sm">
        Launch mode:{" "}
        <span className={`badge ${config.realMoneyEnabled ? "bg-danger/20 text-danger" : "bg-warning/20 text-warning"}`}>
          {config.realMoneyEnabled ? "REAL MONEY ENABLED" : "DEMO MODE"}
        </span>
      </p>
      <dl className="grid gap-4 sm:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="card p-4">
            <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
            <dd className="mt-1 font-mono text-2xl font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
