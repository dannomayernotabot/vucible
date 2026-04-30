"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { clearHistory } from "@/lib/storage/purge";

export function HistoryPanel() {
  const [estimate, setEstimate] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    if (typeof navigator.storage?.estimate !== "function") return;
    navigator.storage.estimate().then((est) => {
      if (est.usage !== undefined) {
        const mb = (est.usage / 1024 / 1024).toFixed(1);
        setEstimate(`${mb} MB used`);
      }
    });
  }, [cleared]);

  async function handleClear() {
    await clearHistory();
    setCleared(true);
  }

  return (
    <div className="space-y-4">
      {estimate && (
        <p className="text-sm text-muted-foreground">
          Storage: {estimate}
        </p>
      )}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Clear all history</p>
          <p className="text-xs text-muted-foreground">
            Removes all sessions and rounds from IndexedDB.
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleClear}
          disabled={cleared}
        >
          {cleared ? "Cleared" : "Clear"}
        </Button>
      </div>
    </div>
  );
}
