import React from 'react';
import type { AppLang } from '@/core/utils/i18n';
import { getRecoveryText, isChunkLoadError } from '@/startupRecovery';

interface ErrorBoundaryState {
  hasError: boolean;
  isChunkError: boolean;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren<{ lang?: AppLang }>, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, isChunkError: isChunkLoadError(error) };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const text = getRecoveryText(this.props.lang ?? 'en');

    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-xl font-semibold">{text.heading}</h1>
          <p className="text-sm text-muted-foreground">{this.state.isChunkError ? text.chunkMessage : text.renderMessage}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {!this.state.isChunkError && (
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                onClick={() => this.setState({ hasError: false, isChunkError: false })}
              >
                {text.retry}
              </button>
            )}
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium"
              onClick={() => window.location.reload()}
            >
              {text.reload}
            </button>
          </div>
        </div>
      </main>
    );
  }
}
