"use client";

import { useRound } from "./RoundProvider";
import { Textarea } from "@/components/ui/textarea";

export function CommentaryInput() {
  const { selections, commentary, setCommentary } = useRound();

  if (selections.length === 0) return null;

  return (
    <div className="space-y-1">
      <label
        htmlFor="commentary"
        className="text-sm text-muted-foreground"
      >
        Optional commentary for next round
      </label>
      <Textarea
        id="commentary"
        value={commentary}
        onChange={(e) => setCommentary(e.target.value)}
        placeholder="e.g. more vibrant colors, zoom in on the subject..."
        className="min-h-12 resize-none"
      />
    </div>
  );
}
