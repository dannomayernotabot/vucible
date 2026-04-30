"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Tier } from "@/lib/providers/types";

const GEMINI_TIER_OPTIONS: { value: Tier; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "tier1", label: "Tier 1" },
  { value: "tier2", label: "Tier 2" },
  { value: "tier3", label: "Tier 3" },
];

interface TierDropdownProps {
  readonly value: Tier;
  readonly onChange: (tier: Tier) => void;
}

export function TierDropdown({ value, onChange }: TierDropdownProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Tier)}>
      <SelectTrigger aria-label="Select Gemini tier">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {GEMINI_TIER_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
