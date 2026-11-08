import Link from "next/link";
import { listUsersForAdmin } from "@/server/admin/users";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Admin · Users" };

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const users = await listUsersForAdmin(q || undefined);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Users</h1>
      <form className="flex gap-2" action="/admin/users">
        <input name="q" defaultValue={q} className="input max-w-sm" placeholder="Search email or name" aria-label="Search users" />
        <button className="btn-secondary" type="submit">Search</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">State</th><th className="p-3">Identity</th><th className="p-3 text-right">Demo</th><th className="p-3 text-right">Real</th><th className="p-3 text-right">Spins</th><th className="p-3">Joined</th></tr></thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="p-3"><Link href={`/admin/users/${u.id}`} className="font-medium hover:text-accent">{u.displayName ?? "—"}</Link><br /><span className="text-xs text-muted">{u.email}</span></td>
                <td className="p-3">{u.role === "ADMIN" ? <span className="badge bg-accent-2/20 text-accent-2">ADMIN</span> : "user"}</td>
                <td className="p-3 font-mono">{u.stateCode ?? "—"}</td>
                <td className="p-3 text-xs">{u.identityStatus.toLowerCase().replace("_", " ")}</td>
                <td className="p-3 text-right font-mono">{formatCents(u.demoBalanceCents)}</td>
                <td className="p-3 text-right font-mono">{formatCents(u.realBalanceCents)}</td>
                <td className="p-3 text-right font-mono">{u._count.spins}</td>
                <td className="p-3 text-muted">{u.createdAt.toLocaleDateString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
