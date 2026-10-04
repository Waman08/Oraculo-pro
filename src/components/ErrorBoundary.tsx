"use client";

import React from 'react';

export class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null, errorInfo: any, isHydrationError: boolean, recoveryAttempts: number}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, isHydrationError: false, recoveryAttempts: 0 };
  }

  static getDerivedStateFromError(error: Error) {
    const msg = error.message.toLowerCase();
    const isHydration = msg.includes('hydration') || 
                         
                        msg.includes('minified react error #418') || 
                        msg.includes('minified react error #423') || 
                        msg.includes('minified react error #425') ||
                        msg.includes('text content did not match');
    
    return { hasError: true, error, isHydrationError: isHydration };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    if (this.state.isHydrationError) {
      if (this.state.recoveryAttempts >= 2) {
        console.error("ErrorBoundary: Hydration recovery failed after 2 attempts. Halting to prevent infinite loop.");
        // Stop recovering, let it show the red box or a safe fallback
        this.setState({ isHydrationError: false });
        return;
      }

      console.warn(`ErrorBoundary caught a hydration mismatch. Auto-recovering (Attempt ${this.state.recoveryAttempts + 1})...`);
      
      // Auto-recover by forcing a clean client-side re-render
      setTimeout(() => {
        this.setState(prev => ({ 
          hasError: false, 
          error: null, 
          errorInfo: null, 
          isHydrationError: false,
          recoveryAttempts: prev.recoveryAttempts + 1
        }));
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
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null, recoveryAttempts: 0 })}
          >
            Intentar de nuevo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
