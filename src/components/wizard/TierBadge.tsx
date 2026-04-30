import { Badge } from "@/components/ui/badge";
import type { Tier } from "@/lib/providers/types";

const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  tier1: "Tier 1",
  tier2: "Tier 2",
  tier3: "Tier 3",
  tier4: "Tier 4",
  tier5: "Tier 5",
};

interface TierBadgeProps {
  readonly tier: Tier;
  readonly ipm: number;
}

export function TierBadge({ tier, ipm }: TierBadgeProps) {
  return (
    <Badge variant={tier === "free" ? "destructive" : "secondary"}>
      {TIER_LABELS[tier]} — {ipm} images/min
    </Badge>
  );
}
