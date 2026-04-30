import { Alert, AlertDescription } from "@/components/ui/alert";

export function RecommendBlend() {
  return (
    <Alert>
      <AlertDescription>
        <strong>Use both for better results.</strong> OpenAI and Gemini produce
        more diverse outputs together. Vucible&apos;s evolution loop benefits from
        cross-model variance.
      </AlertDescription>
    </Alert>
  );
}
