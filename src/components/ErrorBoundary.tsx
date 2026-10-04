"use client";

import React from 'react';

export class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null, errorInfo: any, isHydrationError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, isHydrationError: false };
  }

  static getDerivedStateFromError(error: Error) {
    const msg = error.message.toLowerCase();
    const isHydration = msg.includes('hydration') || 
                        msg.includes('minified react error #310') || 
                        msg.includes('minified react error #418') || 
                        msg.includes('minified react error #423') || 
                        msg.includes('minified react error #425') ||
                        msg.includes('text content did not match');
    
    return { hasError: true, error, isHydrationError: isHydration };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    if (this.state.isHydrationError) {
      console.warn("ErrorBoundary caught a hydration mismatch (usually caused by browser extensions). Auto-recovering...");
      // Auto-recover by forcing a clean client-side re-render
      setTimeout(() => {
        this.setState({ hasError: false, error: null, errorInfo: null, isHydrationError: false });
      }, 0);
      return;
    }
    
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.state.isHydrationError) {
        // Render a transparent fallback for 1 frame while auto-recovering
        return <div className="min-h-screen w-full bg-transparent" />;
      }

      return (
        <div className="glass-card p-6 border border-red-500/50 m-4 w-full max-w-4xl mx-auto animate-fadeInUp">
          <h2 className="text-xl font-bold text-red-500 mb-2">¡Ups! Algo se rompió en este componente</h2>
          <p className="text-sm text-gray-300 mb-4">{this.state.error?.toString()}</p>
          <pre className="text-xs opacity-70 overflow-auto max-h-[300px] bg-black/50 p-4 rounded-lg font-mono leading-relaxed text-gray-300">
            {this.state.errorInfo?.componentStack || this.state.error?.stack}
          </pre>
          <button 
            className="mt-6 px-6 py-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all rounded-lg font-semibold"
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
          >
            Intentar de nuevo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
