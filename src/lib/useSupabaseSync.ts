// ============================================================
// useSupabaseSync — Hook de sincronización con Supabase
// Fallback automático a localStorage si Supabase no está configurado
// ============================================================

import { getSupabase, getSessionId, isSupabaseEnabled } from './supabase';
import type {
  DbUserPreferences, DbWatchlistItem,
  DbPortfolioItem, DbPriceAlert, DbTelegramConfig
} from './supabase';

// ---- Preferences ----

export async function loadPreferences(): Promise<DbUserPreferences | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const sessionId = getSessionId();
  const { data, error } = await sb
    .from('user_preferences')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error || !data) return null;
  return data as DbUserPreferences;
}

export async function savePreferences(prefs: Partial<DbUserPreferences>): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const sessionId = getSessionId();
  const { error } = await sb
    .from('user_preferences')
    .upsert({
      session_id: sessionId,
      ...prefs,
    }, { onConflict: 'session_id' });

  if (error) {
    console.error('[Supabase] Error saving preferences:', error.message);
  }
}

// ---- Watchlist ----

export async function loadWatchlist(): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const sessionId = getSessionId();
  const { data, error } = await sb
    .from('watchlist_items')
    .select('symbol')
    .eq('session_id', sessionId)
    .order('added_at', { ascending: true });

  if (error || !data) return [];
  return data.map((item: { symbol: string }) => item.symbol);
}

export async function addWatchlistItem(symbol: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const sessionId = getSessionId();
  const { error } = await sb
    .from('watchlist_items')
    .upsert({
      session_id: sessionId,
      symbol: symbol.toUpperCase(),
    }, { onConflict: 'session_id,symbol' });

  if (error) {
    console.error('[Supabase] Error adding watchlist item:', error.message);
  }
}

export async function removeWatchlistItem(symbol: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const sessionId = getSessionId();
  const { error } = await sb
    .from('watchlist_items')
    .delete()
    .eq('session_id', sessionId)
    .eq('symbol', symbol.toUpperCase());

  if (error) {
    console.error('[Supabase] Error removing watchlist item:', error.message);
  }
}

// ---- Portfolio ----

export interface PortfolioItemLocal {
  id: string;
  symbol: string;
  amount: number;
  entryPrice: number;
}

export async function loadPortfolio(): Promise<PortfolioItemLocal[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const sessionId = getSessionId();
  const { data, error } = await sb
    .from('portfolio_items')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data.map((item: DbPortfolioItem) => ({
    id: item.id!,
    symbol: item.symbol,
    amount: item.amount,
    entryPrice: item.entry_price,
  }));
}

export async function addPortfolioItem(item: PortfolioItemLocal): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const sessionId = getSessionId();
  const { data, error } = await sb
    .from('portfolio_items')
    .insert({
      session_id: sessionId,
      symbol: item.symbol.toUpperCase(),
      amount: item.amount,
      entry_price: item.entryPrice,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Supabase] Error adding portfolio item:', error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function removePortfolioItem(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const { error } = await sb
    .from('portfolio_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Supabase] Error removing portfolio item:', error.message);
  }
}

// ---- Price Alerts ----

export interface PriceAlertLocal {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'above' | 'below';
  triggered: boolean;
}

export async function loadAlerts(): Promise<PriceAlertLocal[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const sessionId = getSessionId();
  const { data, error } = await sb
    .from('price_alerts')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data.map((item: DbPriceAlert) => ({
    id: item.id!,
    symbol: item.symbol,
    targetPrice: item.target_price,
    condition: item.condition,
    triggered: item.triggered,
  }));
}

export async function addAlert(alert: PriceAlertLocal): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const sessionId = getSessionId();
  const { data, error } = await sb
    .from('price_alerts')
    .insert({
      session_id: sessionId,
      symbol: alert.symbol.toUpperCase(),
      target_price: alert.targetPrice,
      condition: alert.condition,
      triggered: false,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Supabase] Error adding alert:', error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function updateAlertTriggered(id: string, triggered: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const { error } = await sb
    .from('price_alerts')
    .update({ triggered })
    .eq('id', id);

  if (error) {
    console.error('[Supabase] Error updating alert:', error.message);
  }
}

export async function removeAlert(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const { error } = await sb
    .from('price_alerts')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Supabase] Error removing alert:', error.message);
  }
}

// ---- Signal History ----

export async function saveSignal(signal: {
  symbol: string;
  signal: string;
  score: number;
  price: number;
  timeframe: string;
  riskMode: string;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const { error } = await sb
    .from('signal_history')
    .insert({
      symbol: signal.symbol,
      signal: signal.signal,
      score: signal.score,
      price: signal.price,
      timeframe: signal.timeframe,
      risk_mode: signal.riskMode,
    });

  if (error) {
    console.error('[Supabase] Error saving signal:', error.message);
  }
}

// ---- Telegram Config ----

export async function loadTelegramConfig(): Promise<DbTelegramConfig | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const sessionId = getSessionId();
  const { data, error } = await sb
    .from('telegram_config')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error || !data) return null;
  return data as DbTelegramConfig;
}

export async function saveTelegramConfig(config: Partial<DbTelegramConfig>): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const sessionId = getSessionId();
  const { error } = await sb
    .from('telegram_config')
    .upsert({
      session_id: sessionId,
      ...config,
    }, { onConflict: 'session_id' });

  if (error) {
    console.error('[Supabase] Error saving telegram config:', error.message);
  }
}

// ---- Utility ----

/** Check if Supabase is available for sync */
export { isSupabaseEnabled };
