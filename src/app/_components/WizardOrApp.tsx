"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { getStorage } from "@/lib/storage/keys";

const WizardShell = dynamic(
  () =>
    import("@/components/wizard/WizardShell").then((m) => ({
      default: m.WizardShell,
    })),
  { ssr: false },
);

const AppShell = dynamic(
  () =>
    import("@/components/shell/AppShell").then((m) => ({
      default: m.AppShell,
    })),
  { ssr: false },
);

type Gate = "loading" | "wizard" | "app";

export default function WizardOrApp() {
  const [gate, setGate] = useState<Gate>("loading");

  useEffect(() => {
    const storage = getStorage();
    setGate(storage ? "app" : "wizard");
  }, []);

  if (gate === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (gate === "wizard") {
    return <WizardShell onComplete={() => setGate("app")} />;
  }

  return <AppShell />;
}
