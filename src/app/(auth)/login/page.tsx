import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const raw = sp.callbackUrl ?? sp.next;
  // Only allow same-site relative redirects.
  const next = typeof raw === "string" && raw.startsWith("/") ? raw : undefined;
  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Log in to spin, check your vault and manage your account.</p>
        <LoginForm next={next} />
        <p className="mt-6 text-center text-sm text-muted">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-accent">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
