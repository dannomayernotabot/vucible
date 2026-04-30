"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isPrivateBrowsing } from "@/lib/storage/detect-private";

export function PrivateModeBanner() {
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    isPrivateBrowsing().then(setIsPrivate);
  }, []);

  if (!isPrivate) return null;

  return (
    <Alert>
      <AlertTitle>Private browsing detected</AlertTitle>
      <AlertDescription>
        Your API keys and generation history won&apos;t persist between
        sessions. For the best experience, use a regular browser window.
      </AlertDescription>
    </Alert>
  );
}
