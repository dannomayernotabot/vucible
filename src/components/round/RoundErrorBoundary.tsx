"use client";

import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class RoundErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[RoundErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center p-8 text-center"
          role="alert"
        >
          <p className="text-sm font-medium text-destructive">
            Round display failed
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Reload the page to try again.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
