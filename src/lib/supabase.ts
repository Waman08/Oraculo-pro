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
