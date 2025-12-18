// app/components/ErrorBoundary.tsx
"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    // Log to our logger if available
    if (typeof window !== "undefined" && (window as any).logError) {
      try {
        (window as any).logError("React Error Boundary", error, {
          componentStack: errorInfo.componentStack,
        });
      } catch {
        // Ignore logging errors
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Reload the page to ensure clean state
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
          <div className="max-w-md w-full rounded-xl border border-red-200 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-red-900 mb-2">
              Ein Fehler ist aufgetreten
            </h2>
            <p className="text-sm text-gray-700 mb-4">
              Die Anwendung ist auf einen Fehler gestoßen. Bitte lade die Seite neu.
            </p>
            {this.state.error && (
              <details className="mb-4">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                  Fehlerdetails anzeigen
                </summary>
                <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto max-h-32">
                  {this.state.error.toString()}
                  {this.state.error.stack && (
                    <div className="mt-2 text-[10px] opacity-75">
                      {this.state.error.stack.split("\n").slice(0, 5).join("\n")}
                    </div>
                  )}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReset}
              className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 active:scale-[0.98]"
            >
              Seite neu laden
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

