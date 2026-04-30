"use client";

import { Button } from "@/components/ui/button";

interface NewSessionButtonProps {
  readonly visible: boolean;
  readonly onNewSession: () => void;
}

export function NewSessionButton({
  visible,
  onNewSession,
}: NewSessionButtonProps) {
  if (!visible) return null;

  return (
    <Button type="button" variant="outline" size="sm" onClick={onNewSession}>
      New session
    </Button>
  );
}
