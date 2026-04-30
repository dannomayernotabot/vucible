"use client";

import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getStorage, setStorage } from "@/lib/storage/keys";
import type { VucibleStorageV1 } from "@/lib/providers/types";

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

type Section = "keys" | "defaults" | "history";

function SettingsPanels() {
  const [section, setSection] = useState<Section>("keys");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (updater: (prev: VucibleStorageV1) => VucibleStorageV1) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const current = getStorage();
        if (!current) return;
        setStorage(updater(current));
      }, 150);
    },
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2">
        {(["keys", "defaults", "history"] as const).map((s) => (
          <Button
            key={s}
            variant={section === s ? "default" : "ghost"}
            size="sm"
            onClick={() => setSection(s)}
          >
            {s === "keys" ? "Keys" : s === "defaults" ? "Defaults" : "History"}
          </Button>
        ))}
      </div>

      {section === "keys" && <KeysSection />}
      {section === "defaults" && <DefaultsSection save={save} />}
      {section === "history" && <HistorySection />}
    </div>
  );
}

function KeysSection() {
  const storage = getStorage();
  const providers = storage?.providers ?? {};

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Manage your API keys. Changes here will take effect on the next round.
      </p>
      {Object.entries(providers).map(([key, config]) => (
        <div key={key} className="flex items-center justify-between rounded-md border p-3">
          <div>
            <span className="text-sm font-medium capitalize">{key}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {config ? `${config.tier} — ${config.ipm} ipm` : "Not configured"}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {config ? "Connected" : "—"}
          </span>
        </div>
      ))}
      {Object.keys(providers).length === 0 && (
        <p className="text-sm text-muted-foreground">No providers configured.</p>
      )}
    </div>
  );
}

function DefaultsSection({
  save,
}: {
  save: (updater: (prev: VucibleStorageV1) => VucibleStorageV1) => void;
}) {
  const storage = getStorage();
  const defaults = storage?.defaults;

  if (!defaults) {
    return <p className="text-sm text-muted-foreground">No defaults configured.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm">Images per round</span>
        <span className="text-sm font-medium">{defaults.imageCount}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">Aspect ratio</span>
        <span className="text-sm font-medium">
          {defaults.aspectRatio.kind === "discrete"
            ? defaults.aspectRatio.ratio
            : `${defaults.aspectRatio.width}×${defaults.aspectRatio.height}`}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">Theme</span>
        <span className="text-sm font-medium capitalize">{defaults.theme}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Edit support coming in a later release.
      </p>
    </div>
  );
}

function HistorySection() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Round history and session management coming in a later release.
      </p>
    </div>
  );
}
