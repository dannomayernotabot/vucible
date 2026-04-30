import type { Metadata } from "next";
import { Suspense } from "react";
import WizardOrApp from "./_components/WizardOrApp";

export const metadata: Metadata = {
  title: "Vucible",
  description: "Browser-only BYOK image evolution tool",
};

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      }
    >
      <WizardOrApp />
    </Suspense>
  );
}
