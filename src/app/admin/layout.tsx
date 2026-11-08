import Link from "next/link";
import { requireAdminOrRedirect } from "@/server/guards";

const NAV = [
  ["/admin", "Overview"],
  ["/admin/wheels", "Wheels & odds"],
  ["/admin/products", "Products & inventory"],
  ["/admin/orders", "Orders"],
  ["/admin/payments", "Payments"],
  ["/admin/users", "Users"],
  ["/admin/spins", "Spin audit log"],
  ["/admin/settings", "Settings & blocked states"],
  ["/admin/audit", "Admin audit log"],
] as const;

export const metadata = { robots: { index: false, follow: false } };

/** Every admin page re-checks the ADMIN role in the database via this layout. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdminOrRedirect();
  return (
    <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
      <nav aria-label="Admin" className="card h-fit p-3 text-sm">
        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-accent-2">Admin</p>
        <ul className="space-y-0.5">
          {NAV.map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="block rounded-lg px-3 py-2 text-muted hover:bg-surface-2 hover:text-text">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
