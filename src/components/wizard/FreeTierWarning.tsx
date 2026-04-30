import { Alert, AlertDescription } from "@/components/ui/alert";

export function FreeTierWarning() {
  return (
    <Alert variant="destructive">
      <AlertDescription>
        <strong>Free Gemini API tier does not include image generation as of Dec 2025.</strong>{" "}
        Add billing in{" "}
        <a
          href="https://aistudio.google.com/app/billing"
          target="_blank"
          rel="noopener noreferrer"
        >
          AI Studio
        </a>{" "}
        to enable image generation.
      </AlertDescription>
    </Alert>
  );
}
