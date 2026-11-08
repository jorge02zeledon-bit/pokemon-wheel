"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireAdmin } from "@/server/guards";
import { saveWheel } from "@/server/admin/wheels";
import { adjustStock, saveProduct, setProductImage } from "@/server/admin/products";
import { updateOrder } from "@/server/admin/orders";
import { adjustBalance, setUserRole } from "@/server/admin/users";
import { addBlockedState, removeBlockedState, updateSettings } from "@/server/admin/settings";
import { ValidationError } from "@/server/engine/errors";
import { InsufficientFundsError } from "@/server/wallet/ledger";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/** Turn known domain errors into a message; rethrow anything unexpected. */
async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false, error: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    if (e instanceof ValidationError || e instanceof InsufficientFundsError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function saveWheelAction(draft: unknown): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  return run(async () => {
    const w = await saveWheel(admin.id, draft);
    revalidatePath("/");
    revalidatePath("/odds");
    revalidatePath("/admin/wheels");
    return { id: w.id };
  });
}

export async function saveProductAction(draft: unknown): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  return run(async () => {
    const p = await saveProduct(admin.id, draft);
    revalidatePath("/admin/products");
    return { id: p.id };
  });
}

export async function adjustStockAction(productId: string, delta: number, reason: string): Promise<ActionResult<{ stock: number }>> {
  const admin = await requireAdmin();
  return run(async () => {
    const p = await adjustStock(admin.id, productId, delta, reason);
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/admin/products");
    return { stock: p.stock };
  });
}

export async function clearProductImageAction(productId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  return run(async () => {
    await setProductImage(admin.id, productId, null);
    revalidatePath(`/admin/products/${productId}`);
  });
}

export async function updateOrderAction(orderId: string, data: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  return run(async () => {
    await updateOrder(admin.id, orderId, data);
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
  });
}

export async function setUserRoleAction(userId: string, role: "USER" | "ADMIN"): Promise<ActionResult> {
  const admin = await requireAdmin();
  return run(async () => {
    await setUserRole(admin.id, userId, role);
    revalidatePath(`/admin/users/${userId}`);
  });
}

export async function adjustBalanceAction(userId: string, amountCents: number, isDemo: boolean, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  return run(async () => {
    await adjustBalance(admin.id, userId, amountCents, isDemo, reason);
    revalidatePath(`/admin/users/${userId}`);
  });
}

export async function updateSettingsAction(values: Record<string, unknown>): Promise<ActionResult<{ changed: string[] }>> {
  const admin = await requireAdmin();
  return run(async () => {
    const changed = await updateSettings(admin.id, values);
    revalidatePath("/admin/settings");
    revalidatePath("/faq");
    return { changed };
  });
}

export async function addBlockedStateAction(code: string, note: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  return run(async () => {
    await addBlockedState(admin.id, code, note);
    revalidatePath("/admin/settings");
  });
}

export async function removeBlockedStateAction(code: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  return run(async () => {
    await removeBlockedState(admin.id, code);
    revalidatePath("/admin/settings");
  });
}

export async function setIdentityStatusAction(userId: string, status: "APPROVED" | "REJECTED", reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const { adminSetIdentityStatus } = await import("@/server/compliance/identity");
  return run(async () => {
    await adminSetIdentityStatus(admin.id, userId, status, reason);
    revalidatePath(`/admin/users/${userId}`);
  });
}

export async function finalizeWithdrawalAction(withdrawalId: string, status: "SUCCEEDED" | "FAILED" | "CANCELLED", note: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const { finalizeWithdrawal } = await import("@/server/wallet/withdrawals");
  return run(async () => {
    await finalizeWithdrawal(withdrawalId, status, admin.id, note);
    revalidatePath("/admin/payments");
  });
}
