"use client";

import type { Provider } from "@/lib/providers/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WIZARD_COPY } from "@/lib/wizard/copy";
import { KeyPasteField } from "./KeyPasteField";
import { ValidationStatus } from "./ValidationStatus";

const KEY_LINKS: Record<Provider, string> = {
  openai: "https://platform.openai.com/api-keys",
  gemini: "https://aistudio.google.com/apikey",
};

interface ProviderCardProps {
  readonly provider: Provider;
}

export function ProviderCard({ provider }: ProviderCardProps) {
  const copy = WIZARD_COPY.step2[provider];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{copy.label}</span>
          <a
            href={KEY_LINKS[provider]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-normal text-muted-foreground hover:underline"
          >
            Get an API key →
          </a>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <KeyPasteField provider={provider} />
        <ValidationStatus provider={provider} />
      </CardContent>
    </Card>
  );
}
