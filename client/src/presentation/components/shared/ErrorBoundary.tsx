import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">This view could not be loaded. Retry the page to continue.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => this.setState({ hasError: false })}
            >
              Try again
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      </main>
    );
  }
}
