"use client";

import { useEffect } from 'react';

/**
 * Catches unhandled ChunkLoadErrors (caused by new Vercel deployments
 * invalidating old JS chunk hashes) and transparently reloads the page
 * to fetch the new deployment manifest.
 */
export default function ChunkErrorHandler() {
  useEffect(() => {
    const handleChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const error = 'error' in event ? event.error : (event as PromiseRejectionEvent).reason;
      const message = error?.message || (event as ErrorEvent).message || String(error);
      
      const isChunkError =
        /loading chunk .* failed/i.test(message) ||
        /chunkloaderror/i.test(message) ||
        /failed to fetch dynamically imported module/i.test(message);

      if (isChunkError) {
        const lastReload = parseInt(sessionStorage.getItem('last_chunk_reload') || '0', 10);
        const now = Date.now();
        // Allow reload if more than 15 seconds have passed to prevent infinite refresh loops
        if (now - lastReload > 15000) {
          sessionStorage.setItem('last_chunk_reload', now.toString());
          console.warn('[ChunkErrorHandler] Outdated chunk requested after deployment. Reloading...');
          window.location.reload();
        }
      }
    };

    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleChunkError);

    return () => {
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleChunkError);
    };
  }, []);

  return null;
}
