import type { Rarity } from "@prisma/client";

const CLASSES: Record<Rarity, string> = {
  COMMON: "bg-tier-common/20 text-tier-common",
  UNCOMMON: "bg-tier-uncommon/20 text-tier-uncommon",
  RARE: "bg-tier-rare/20 text-tier-rare",
  CHASE: "bg-tier-chase/20 text-tier-chase",
};

export function TierBadge({ rarity, name }: { rarity: Rarity; name?: string }) {
  return <span className={`badge ${CLASSES[rarity]}`}>{name ?? rarity}</span>;
}
