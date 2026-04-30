import type { Round } from "@/lib/storage/schema";

export const MAX_PROMPT_CHARS = 3500;

const RECENT_ROUNDS_KEPT = 3;

interface Selection {
  readonly provider: string;
  readonly index: number;
}

export function buildEvolvePrompt(
  originalPrompt: string,
  priorRounds: readonly Round[],
  currentSelections: readonly Selection[],
  currentCommentary: string | null,
): string {
  const roundN = priorRounds.length + 1;

  if (roundN <= 1) return originalPrompt;

  const selectionDesc = formatSelections(currentSelections);
  const commentaryLine = currentCommentary
    ? `Their commentary: "${currentCommentary}".`
    : "No additional commentary.";

  if (roundN === 2) {
    const raw = [
      originalPrompt,
      "",
      `After round 1 the user picked ${selectionDesc}.`,
      commentaryLine,
      "Generate fresh variations.",
    ].join("\n");

    return enforceLimit(raw, originalPrompt, priorRounds);
  }

  const trail = buildTrail(priorRounds, currentCommentary);
  const raw = [
    originalPrompt,
    "",
    `After rounds 1-${roundN - 1}, accumulated commentary: ${trail}`,
    `Current selections: ${selectionDesc}.`,
    commentaryLine,
    "Generate fresh variations.",
  ].join("\n");

  return enforceLimit(raw, originalPrompt, priorRounds);
}

function formatSelections(selections: readonly Selection[]): string {
  if (selections.length === 0) return "no references";
  return selections
    .map((s) => `${s.provider}[${s.index}]`)
    .join(", ");
}

function buildTrail(
  rounds: readonly Round[],
  currentCommentary: string | null,
): string {
  const entries = rounds
    .map((r) => r.commentary ?? "(none)")
    .concat(currentCommentary ?? "(none)");

  return entries.map((c) => '"' + c + '"').join(" → ");
}

function enforceLimit(
  prompt: string,
  originalPrompt: string,
  priorRounds: readonly Round[],
): string {
  if (prompt.length <= MAX_PROMPT_CHARS) return prompt;

  const recentStart = Math.max(0, priorRounds.length - RECENT_ROUNDS_KEPT);
  const oldRounds = priorRounds.slice(0, recentStart);
  const recentRounds = priorRounds.slice(recentStart);

  const collapsed = oldRounds.length > 0
    ? `After rounds 1-${oldRounds.length}: (commentary trail summarized: ${oldRounds
        .map((r) => (r.commentary ?? "").slice(0, 50))
        .join(" · ")})`
    : "";

  const recentTrail = recentRounds
    .map((r) => '"' + (r.commentary ?? "(none)") + '"')
    .join(" → ");

  const parts = [originalPrompt];
  if (collapsed) {
    parts.push("", collapsed);
  }
  if (recentTrail) {
    parts.push("", "Recent rounds: " + recentTrail);
  }
  parts.push("", "Generate fresh variations.");

  const result = parts.join("\n");
  return result.slice(0, MAX_PROMPT_CHARS);
}
