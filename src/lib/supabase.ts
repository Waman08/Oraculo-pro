// ============================================================
// SUPABASE CLIENT — Inicialización y helpers tipados
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Database types matching our SQL schema
export interface DbUserPreferences {
  id?: string;
  session_id: string;
  theme: string;
  locale: string;
  symbol: string;
  risk_mode: string;
  timeframe: string;
  created_at?: string;
  updated_at?: string;
}

export interface DbWatchlistItem {
  id?: string;
  session_id: string;
  symbol: string;
  added_at?: string;
}

export interface DbPortfolioItem {
  id?: string;
  session_id: string;
  symbol: string;
  amount: number;
  entry_price: number;
  created_at?: string;
}

export interface DbPriceAlert {
  id?: string;
  session_id: string;
  symbol: string;
  target_price: number;
  condition: 'above' | 'below';
  triggered: boolean;
  created_at?: string;
}

export interface DbSignalHistory {
  id?: string;
  symbol: string;
  signal: string;
  score: number;
  price: number;
  timeframe: string;
  risk_mode: string;
  created_at?: string;
}

export interface DbTelegramConfig {
  id?: string;
  session_id: string;
  chat_id: string;
  enabled: boolean;
  alert_interval_minutes: number;
  created_at?: string;
  updated_at?: string;
}

// ---- Singleton Client ----

let supabaseInstance: SupabaseClient | null = null;

/**
 * Returns the Supabase client or null if not configured.
 * This allows graceful fallback to localStorage.
 */
export function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: false, // No auth sessions, we use session_id
      },
    });
  }

  return supabaseInstance;
}

/**
 * Check if Supabase is configured and available
 */
export function isSupabaseEnabled(): boolean {
  return getSupabase() !== null;
}

// ---- Session ID Management ----

const SESSION_KEY = 'oracle_session_id';

/**
 * Get or create a persistent anonymous session ID.
 * This ID links all user data in Supabase without formal auth.
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';

  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `sess_${crypto.randomUUID()}`;
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

/**
 * Devuelve el 'oracle_session_id' actual de localStorage.
 */
export function getCurrentSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  return getSessionId();
}

/**
 * Valida que el ID tenga un formato seguro y consistente (ej. 'sess_...' o alfanumérico).
 */
export function isValidSessionId(targetSessionId: string): boolean {
  if (!targetSessionId || typeof targetSessionId !== 'string') return false;
  let cleanId = targetSessionId.trim();
  if (cleanId.includes('sync_id=')) {
    const match = cleanId.match(/sync_id=([a-zA-Z0-9_-]+)/);
    if (match) cleanId = match[1];
  }
  return cleanId.length >= 8 && cleanId.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(cleanId);
}

/**
 * Valida que el ID tenga formato válido, reemplaza el 'oracle_session_id' en localStorage
 * y recarga el estado de la aplicación para traer el Portafolio, Watchlist, Alertas y Cuenta de Paper Trading de ese ID.
 */
export function linkDeviceSession(targetSessionId: string, reload: boolean = true): boolean {
  if (typeof window === 'undefined') return false;

  let cleanId = (targetSessionId || '').trim();
  if (cleanId.includes('sync_id=')) {
    const match = cleanId.match(/sync_id=([a-zA-Z0-9_-]+)/);
    if (match) cleanId = match[1];
  }

  if (!isValidSessionId(cleanId)) {
    return false;
  }

  try {
    localStorage.setItem(SESSION_KEY, cleanId);

    // Limpia el query param sync_id de la URL actual si está presente para evitar bucles
    if (window.location.search.includes('sync_id')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('sync_id');
      window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
    }

    // Dispara eventos para componentes que escuchen cambios en tiempo real
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('oracle_session_changed', { detail: { sessionId: cleanId } }));

    if (reload) {
      window.location.reload();
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Error al vincular sesión de dispositivo:', err);
    return false;
  }
}

