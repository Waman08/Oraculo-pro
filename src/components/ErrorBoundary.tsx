"use client";

import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  isHydrationError: boolean;
  isChunkError: boolean;
  recoveryAttempts: number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isHydrationError: false,
      isChunkError: false,
      recoveryAttempts: 0,
    };
  }

  static getDerivedStateFromError(error: Error) {
    const msg = (error?.message || '').toLowerCase();
    const errorStr = (error?.toString() || '').toLowerCase();
    
    const isHydration =
      msg.includes('hydration') ||
      msg.includes('minified react error #418') ||
      msg.includes('minified react error #423') ||
      msg.includes('minified react error #425') ||
      msg.includes('text content did not match');

    const isChunk =
      error?.name === 'ChunkLoadError' ||
      msg.includes('chunkloaderror') ||
      msg.includes('loading chunk') ||
      msg.includes('failed to fetch dynamically imported module') ||
      errorStr.includes('chunkloaderror') ||
      errorStr.includes('loading chunk');

    return {
      hasError: true,
      error,
      isHydrationError: isHydration,
      isChunkError: isChunk,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // 1. ChunkLoadError handling: auto-reload page once to fetch new deploy
    if (this.state.isChunkError && typeof window !== 'undefined') {
      const lastReload = parseInt(sessionStorage.getItem('last_chunk_reload') || '0', 10);
      const now = Date.now();
      // If we haven't auto-reloaded in the last 15 seconds, reload cleanly to get latest Vercel build
      if (now - lastReload > 15000) {
        sessionStorage.setItem('last_chunk_reload', now.toString());
        console.warn('[ErrorBoundary] ChunkLoadError detected (new deployment). Auto-reloading to fetch latest version...');
        window.location.reload();
        return;
      }
    }

    // 2. Hydration error handling
    if (this.state.isHydrationError) {
      if (this.state.recoveryAttempts >= 2) {
        console.error("ErrorBoundary: Hydration recovery failed after 2 attempts.");
        this.setState({ isHydrationError: false });
        return;
      }

      console.warn(`ErrorBoundary caught a hydration mismatch. Auto-recovering (Attempt ${this.state.recoveryAttempts + 1})...`);
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

  handleReload = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('last_chunk_reload');
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null, errorInfo: null, recoveryAttempts: 0 });
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.state.isHydrationError) {
        return <div className="min-h-screen w-full bg-transparent" />;
      }

      // Special friendly UI for ChunkLoadError (new deploy / network interruption)
      if (this.state.isChunkError) {
        return (
          <div className="glass-card p-6 border border-amber-500/40 m-6 w-full max-w-lg mx-auto text-center animate-fadeInUp shadow-2xl">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-[var(--accent-gold)] flex items-center justify-center">
              <RefreshCw size={24} className="animate-spin" />
            </div>
            <h2 className="text-lg font-black text-white mb-2">Nueva versión disponible</h2>
            <p className="text-xs text-gray-300 leading-relaxed mb-6">
              Se ha desplegado una nueva versión de Oráculo Pro. Haz clic en el botón inferior para sincronizar los módulos actualizados.
            </p>
            <button
              onClick={this.handleReload}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
            >
              <RefreshCw size={14} />
              Actualizar Aplicación
            </button>
          </div>
        );
      }

      // Generic error UI
      return (
        <div className="glass-card p-6 border border-red-500/50 m-4 w-full max-w-4xl mx-auto animate-fadeInUp">
          <div className="flex items-center gap-2 mb-2 text-red-400 font-bold text-lg">
            <AlertTriangle size={20} />
            <h2>¡Ups! Algo se rompió en este componente</h2>
          </div>
          <p className="text-sm text-gray-300 mb-4">{this.state.error?.toString()}</p>
          <pre className="text-xs opacity-70 overflow-auto max-h-[300px] bg-black/50 p-4 rounded-lg font-mono leading-relaxed text-gray-300">
            {this.state.errorInfo?.componentStack || this.state.error?.stack}
          </pre>
          <div className="mt-6 flex gap-3">
            <button 
              className="px-5 py-2.5 bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-all rounded-xl font-semibold text-xs"
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null, recoveryAttempts: 0 })}
            >
              Intentar de nuevo
            </button>
            <button 
              className="px-5 py-2.5 bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-all rounded-xl font-semibold text-xs flex items-center gap-1.5"
              onClick={this.handleReload}
            >
              <RefreshCw size={12} /> Recargar Página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
