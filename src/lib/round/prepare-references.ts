import type { Round, RoundResult } from "@/lib/storage/schema";
import type { Provider } from "@/lib/providers/types";

export interface PreparedReferences {
  readonly blobs: readonly Blob[];
  readonly base64Parts: readonly string[];
}

interface Selection {
  readonly provider: Provider;
  readonly index: number;
}

const CHUNK_SIZE = 8192;

function chunkedBase64(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < u8.length; i += CHUNK_SIZE) {
    const chunk = u8.subarray(i, Math.min(i + CHUNK_SIZE, u8.length));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

function getResult(round: Round, selection: Selection): RoundResult | undefined {
  const results =
    selection.provider === "openai"
      ? round.openaiResults
      : round.geminiResults;
  return results[selection.index];
}

export function prepareReferences(
  round: Round,
  selections: readonly Selection[],
): PreparedReferences {
  const blobs: Blob[] = [];
  const base64Parts: string[] = [];

  for (const sel of selections) {
    const result = getResult(round, sel);
    if (!result || result.status !== "success") continue;

    if (!result.mimeType) {
      console.warn(
        `[prepareReferences] missing mimeType for ${sel.provider}[${sel.index}]`,
      );
      continue;
    }

    blobs.push(new Blob([result.bytes], { type: result.mimeType }));
    base64Parts.push(chunkedBase64(result.bytes));
  }

  return { blobs, base64Parts };
}
