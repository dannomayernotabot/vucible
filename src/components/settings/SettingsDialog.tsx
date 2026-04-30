"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KeysPanel } from "./KeysPanel";
import { DefaultsPanel } from "./DefaultsPanel";
import { ConcurrencyPanel } from "./ConcurrencyPanel";
import { HistoryPanel } from "./HistoryPanel";

interface SettingsDialogProps {
  trigger: React.ReactNode;
}

export function SettingsDialog({ trigger }: SettingsDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<span />}>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        {open && <SettingsPanels />}
      </DialogContent>
    </Dialog>
  );
}

type Section = "keys" | "defaults" | "concurrency" | "history";

const SECTION_LABELS: Record<Section, string> = {
  keys: "Keys",
  defaults: "Defaults",
  concurrency: "Concurrency",
  history: "History",
};

function SettingsPanels() {
  const [section, setSection] = useState<Section>("keys");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2" role="tablist" aria-label="Settings sections">
        {(Object.keys(SECTION_LABELS) as Section[]).map((s) => (
          <Button
            key={s}
            variant={section === s ? "default" : "ghost"}
            size="sm"
            role="tab"
            aria-selected={section === s}
            aria-controls={`panel-${s}`}
            onClick={() => setSection(s)}
          >
            {SECTION_LABELS[s]}
          </Button>
        ))}
      </div>

      <div id={`panel-${section}`} role="tabpanel">
        {section === "keys" && <KeysPanel />}
        {section === "defaults" && <DefaultsPanel />}
        {section === "concurrency" && <ConcurrencyPanel />}
        {section === "history" && <HistoryPanel />}
      </div>
    </div>
  );
}
