"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type { Locale } from '@/lib/i18n';
import { t as translate } from '@/lib/i18n';
import type { RiskMode, Timeframe } from '@/types';
import { isSupabaseEnabled } from '@/lib/supabase';
import {
  loadPreferences, savePreferences,
  loadWatchlist as sbLoadWatchlist,
  addWatchlistItem, removeWatchlistItem,
} from '@/lib/useSupabaseSync';
import { initializeDynamicSymbols } from '@/lib/api';

// ---- Theme Context ----

interface ThemeContextType {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

// ---- Locale Context ----

interface LocaleContextType {
  locale: Locale;
  toggleLocale: () => void;
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'es',
  toggleLocale: () => {},
  t: (key: string) => key,
});

export function useLocale() {
  return useContext(LocaleContext);
}

// ---- App Settings Context ----

interface AppSettingsContextType {
  symbol: string;
  setSymbol: (s: string) => void;
  mode: RiskMode;
  setMode: (m: RiskMode) => void;
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  activeTab: 'analysis' | 'screener';
  setActiveTab: (tab: 'analysis' | 'screener') => void;
  watchlist: string[];
  setWatchlist: (w: string[]) => void;
  toggleWatchlist: (s: string) => void;
  cloudSynced: boolean;
}

const AppSettingsContext = createContext<AppSettingsContextType>({
  symbol: 'BTC',
  setSymbol: () => {},
  mode: 'Balanceado',
  setMode: () => {},
  timeframe: '1S',
  setTimeframe: () => {},
  activeTab: 'analysis',
  setActiveTab: () => {},
  watchlist: ['BTC', 'ETH', 'SOL'],
  setWatchlist: () => {},
  toggleWatchlist: () => {},
  cloudSynced: false,
});

export function useAppSettings() {
  return useContext(AppSettingsContext);
}

// ---- Combined Provider ----

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [locale, setLocale] = useState<Locale>('es');
  const [symbol, setSymbol] = useState('BTC');
  const [mode, setMode] = useState<RiskMode>('Balanceado');
  const [timeframe, setTimeframe] = useState<Timeframe>('1S');
  const [activeTab, setActiveTab] = useState<'analysis' | 'screener'>('analysis');
  const [watchlist, setWatchlist] = useState<string[]>(['BTC', 'ETH', 'SOL']);
  const [isLoaded, setIsLoaded] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(false);
  const prevWatchlistRef = useRef<string[]>([]);

  const [uuid, setUuid] = useState<string | null>(null);

  // Load from localStorage first, then overlay with Supabase if available
  useEffect(() => {
    // 0. Fetch dynamic symbols
    initializeDynamicSymbols();

    // 0.5 Generate or retrieve UUID for anonymous personalization
    let localUuid = localStorage.getItem('user_uuid');
    if (!localUuid) {
      localUuid = crypto.randomUUID ? crypto.randomUUID() : 'user-' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('user_uuid', localUuid);
    }
    setUuid(localUuid);

    // 1. Load from localStorage (instant)
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    const savedLocale = localStorage.getItem('locale') as Locale | null;
    const savedSymbol = localStorage.getItem('symbol');
    const savedMode = localStorage.getItem('mode') as RiskMode | null;
    const savedTimeframe = localStorage.getItem('timeframe') as Timeframe | null;
    const savedWatchlist = localStorage.getItem('watchlist');

    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    if (savedLocale) setLocale(savedLocale);
    if (savedSymbol) setSymbol(savedSymbol);
    if (savedMode) setMode(savedMode);
    if (savedTimeframe) setTimeframe(savedTimeframe);
    let localWatchlist = ['BTC', 'ETH', 'SOL'];
    if (savedWatchlist) {
      try { localWatchlist = JSON.parse(savedWatchlist); } catch {}
    }
    setWatchlist(localWatchlist);
    prevWatchlistRef.current = localWatchlist;
    setIsLoaded(true);

    // 2. Overlay with Supabase data (async, non-blocking)
    if (isSupabaseEnabled()) {
      (async () => {
        try {
          const [prefs, sbWatchlist] = await Promise.all([
            loadPreferences(),
            sbLoadWatchlist(),
          ]);

          if (prefs) {
            if (prefs.theme) {
              setTheme(prefs.theme as 'dark' | 'light');
              document.documentElement.setAttribute('data-theme', prefs.theme);
            }
            if (prefs.locale) setLocale(prefs.locale as Locale);
            if (prefs.symbol) setSymbol(prefs.symbol);
            if (prefs.risk_mode) setMode(prefs.risk_mode as RiskMode);
            if (prefs.timeframe) setTimeframe(prefs.timeframe as Timeframe);
          }

          if (sbWatchlist.length > 0) {
            setWatchlist(sbWatchlist);
            prevWatchlistRef.current = sbWatchlist;
          }

          setCloudSynced(true);
          console.log('[Supabase] ☁️ Cloud sync loaded successfully');
        } catch (err) {
          console.warn('[Supabase] Cloud sync unavailable, using localStorage', err);
        }
      })();
    }
  }, []);

  // Sync to localStorage (always)
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('theme', theme);
    localStorage.setItem('locale', locale);
    localStorage.setItem('symbol', symbol);
    localStorage.setItem('mode', mode);
    localStorage.setItem('timeframe', timeframe);
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
  }, [theme, locale, symbol, mode, timeframe, watchlist, isLoaded]);

  // Sync preferences to Supabase (debounced)
  useEffect(() => {
    if (!isLoaded || !isSupabaseEnabled()) return;

    const timeout = setTimeout(() => {
      savePreferences({
        theme,
        locale,
        symbol,
        risk_mode: mode,
        timeframe,
      }).catch(() => {}); // Silent fail
    }, 1000); // 1s debounce

    return () => clearTimeout(timeout);
  }, [theme, locale, symbol, mode, timeframe, isLoaded]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(prev => prev === 'es' ? 'en' : 'es');
  }, []);

  const t = useCallback((key: string) => translate(key, locale), [locale]);

  const toggleWatchlist = useCallback((sym: string) => {
    setWatchlist(prev => {
      const isRemoving = prev.includes(sym);
      const next = isRemoving ? prev.filter(s => s !== sym) : [...prev, sym];

      // Sync to Supabase in background
      if (isSupabaseEnabled()) {
        if (isRemoving) {
          removeWatchlistItem(sym).catch(() => {});
        } else {
          addWatchlistItem(sym).catch(() => {});
        }
      }

      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <LocaleContext.Provider value={{ locale, toggleLocale, t }}>
        <AppSettingsContext.Provider value={{
          symbol, setSymbol,
          mode, setMode,
          timeframe, setTimeframe,
          activeTab, setActiveTab,
          watchlist, setWatchlist,
          toggleWatchlist,
          cloudSynced,
        }}>
          {children}
        </AppSettingsContext.Provider>
      </LocaleContext.Provider>
    </ThemeContext.Provider>
  );
}
