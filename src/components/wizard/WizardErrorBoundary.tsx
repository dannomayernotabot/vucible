"use client";

import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class WizardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[WizardErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center p-6 text-center">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="mt-2 text-muted-foreground">
            Refresh to retry. Your key drafts are saved.
          </p>
          <Button
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Refresh
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
