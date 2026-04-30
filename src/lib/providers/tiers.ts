import type { Tier } from "./types";

const TIER_IPMS: readonly { tier: Tier; ipm: number }[] = [
  { tier: "free", ipm: 0 },
  { tier: "tier1", ipm: 5 },
  { tier: "tier2", ipm: 20 },
  { tier: "tier3", ipm: 50 },
  { tier: "tier4", ipm: 100 },
  { tier: "tier5", ipm: 250 },
];

const IPM_TO_TIER = new Map<number, Tier>(
  TIER_IPMS.map(({ tier, ipm }) => [ipm, tier]),
);

const TIER_TO_IPM = new Map<Tier, number>(
  TIER_IPMS.map(({ tier, ipm }) => [tier, ipm]),
);

function closestTier(ipm: number): Tier {
  let best = TIER_IPMS[0];
  let bestDelta = Math.abs(ipm - best.ipm);
  for (let i = 1; i < TIER_IPMS.length; i++) {
    const delta = Math.abs(ipm - TIER_IPMS[i].ipm);
    if (delta < bestDelta) {
      best = TIER_IPMS[i];
      bestDelta = delta;
    }
  }
  return best.tier;
}

export function ipmToTier(ipm: number): Tier {
  return IPM_TO_TIER.get(ipm) ?? closestTier(ipm);
}

export function defaultIpm(tier: Tier): number {
  return TIER_TO_IPM.get(tier) ?? 0;
}
