import type { Prisma } from "@prisma/client";
import type { Tx } from "../db";

/** Record who changed what in the admin panel. Call inside the same transaction as the change. */
export async function logAdminAction(
  tx: Tx,
  input: { adminId: string; action: string; entityType: string; entityId?: string | null; before?: unknown; after?: unknown },
) {
  return tx.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
