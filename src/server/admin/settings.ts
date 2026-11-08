import { prisma } from "../db";
import { getSettings, setSetting, settingSchemas, type SettingKey } from "../settings";
import { ValidationError } from "../engine/errors";
import { logAdminAction } from "./audit";
import { US_STATE_CODES, stateName } from "@/lib/us-states";

export async function updateSettings(adminId: string, raw: Record<string, unknown>) {
  const before = await getSettings();
  const changes: Partial<Record<SettingKey, unknown>> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!(k in settingSchemas)) continue;
    const key = k as SettingKey;
    const parsed = settingSchemas[key].safeParse(v);
    if (!parsed.success) throw new ValidationError(`${key}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
    if (parsed.data !== before[key]) changes[key] = parsed.data;
  }
  if ("rtpWarnMinPercent" in changes || "rtpWarnMaxPercent" in changes) {
    const min = (changes.rtpWarnMinPercent ?? before.rtpWarnMinPercent) as number;
    const max = (changes.rtpWarnMaxPercent ?? before.rtpWarnMaxPercent) as number;
    if (min > max) throw new ValidationError("RTP minimum must not exceed the maximum");
  }
  await prisma.$transaction(async (tx) => {
    for (const [k, v] of Object.entries(changes)) await setSetting(k as SettingKey, v, tx);
    if (Object.keys(changes).length > 0) {
      await logAdminAction(tx, {
        adminId, action: "settings.update", entityType: "Setting",
        before: Object.fromEntries(Object.keys(changes).map((k) => [k, before[k as SettingKey]])), after: changes,
      });
    }
  });
  return Object.keys(changes) as SettingKey[];
}

export async function addBlockedState(adminId: string, code: string, note?: string) {
  const c = code.trim().toUpperCase();
  if (!US_STATE_CODES.has(c)) throw new ValidationError("Unknown state code");
  return prisma.$transaction(async (tx) => {
    const row = await tx.blockedState.upsert({ where: { code: c }, create: { code: c, name: stateName(c), note: note?.trim() || null }, update: { note: note?.trim() || null } });
    await logAdminAction(tx, { adminId, action: "blockedState.add", entityType: "BlockedState", entityId: c, after: row });
    return row;
  });
}

export async function removeBlockedState(adminId: string, code: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.blockedState.findUnique({ where: { code } });
    if (!before) throw new ValidationError("State is not blocked");
    await tx.blockedState.delete({ where: { code } });
    await logAdminAction(tx, { adminId, action: "blockedState.remove", entityType: "BlockedState", entityId: code, before });
  });
}
