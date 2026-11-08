import Link from "next/link";
import { ForgotForm } from "./ForgotForm";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold">Reset your password</h1>
        <p className="mt-1 text-sm text-muted">Enter your email and we will send a one-hour reset link.</p>
        <ForgotForm />
        <p className="mt-6 text-center text-sm text-muted"><Link href="/login" className="font-semibold text-accent">Back to log in</Link></p>
      </div>
    </div>
  );
}
