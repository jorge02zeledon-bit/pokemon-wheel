import { isDemoMode } from "@/server/config";

/**
 * Site-wide banner shown while REAL_MONEY_ENABLED=false. Server component, so
 * it reflects the real server flag rather than anything the client can change.
 */
export function DemoBanner() {
  if (!isDemoMode()) return null;
  return (
    <div role="status" className="bg-warning px-4 py-2 text-center text-sm font-semibold text-bg">
      Demo mode: spins use free demo credits. No real payments, withdrawals or shipping are possible.
    </div>
  );
}
