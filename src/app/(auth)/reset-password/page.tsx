import Link from "next/link";
import { ResetForm } from "./ResetForm";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold">Choose a new password</h1>
        {token ? <ResetForm token={token} /> : <p className="mt-4 text-sm text-danger">This link is missing its token. <Link href="/forgot-password" className="underline">Request a new one</Link>.</p>}
      </div>
    </div>
  );
}
