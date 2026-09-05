"use client";

import React from 'react';

export class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null, errorInfo: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-card p-6 border border-red-500/50 m-4 w-full">
          <h2 className="text-red-500 text-xl font-bold mb-2">¡Ups! Algo se rompió en este componente</h2>
          <p className="text-sm text-gray-300 mb-4">{this.state.error?.toString()}</p>
          <pre className="text-xs text-gray-500 bg-black/50 p-4 rounded overflow-auto max-h-64 whitespace-pre-wrap">
            {this.state.errorInfo?.componentStack}
          </pre>
          <button 
            className="mt-4 px-4 py-2 bg-red-500/20 text-red-500 hover:bg-red-500/40 rounded"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Intentar de nuevo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
