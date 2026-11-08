"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finalizeWithdrawalAction } from "@/app/admin/actions";

export function WithdrawalActions({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const go = (s: "SUCCEEDED" | "FAILED" | "CANCELLED") => start(async () => { await finalizeWithdrawalAction(id, s, note); router.refresh(); });
  return (
    <div className="flex flex-wrap gap-1">
      <input className="input w-40 px-2 py-1 text-xs" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
      <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={pending} onClick={() => go("SUCCEEDED")}>Mark paid</button>
      <button type="button" className="btn-secondary px-2 py-1 text-xs text-danger" disabled={pending} onClick={() => go("FAILED")}>Fail &amp; refund</button>
    </div>
  );
}
