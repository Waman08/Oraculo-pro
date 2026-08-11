"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { generateScreenerData } from '@/lib/mock-data';
import { fetchPythonScreener } from '@/lib/api';
import type { Timeframe, Signal, ScreenerEntry } from '@/types';
import { useAppSettings, useLocale } from './AppContext';
import { TrendingUp, TrendingDown, Filter, RefreshCw, Wifi, WifiOff, ArrowUp, ArrowDown } from 'lucide-react';

const SIGNAL_FILTER_KEYS: (Signal | 'all')[] = ['all', 'Compra Fuerte', 'Compra', 'Mantener', 'Venta', 'Venta Fuerte'];

const SIGNAL_I18N: Record<Signal | 'all', string> = {
  'all': 'screener.all',
  'Compra Fuerte': 'signal.strongBuy',
  'Compra': 'signal.buy',
  'Mantener': 'signal.hold',
  'Venta': 'signal.sell',
  'Venta Fuerte': 'signal.strongSell',
};

export default function Screener() {
  const { timeframe, setTimeframe, mode } = useAppSettings();
  const { t } = useLocale();
  const [signalFilter, setSignalFilter] = useState<Signal | 'all'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'rsi' | 'change'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [screenerData, setScreenerData] = useState<ScreenerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isBackendOnline, setIsBackendOnline] = useState(false);

  // Fetch screener data from Python backend
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchPythonScreener(timeframe, mode, 50);
      if (data && data.length > 0) {
        // Map backend response to ScreenerEntry format
        const entries: ScreenerEntry[] = data.map((item: any, idx: number) => ({
          rank: item.rank ?? idx + 1,
          symbol: item.symbol,
          name: item.name || item.symbol,
          price: item.price,
          priceChange24h: item.priceChange24h,
          rsi: item.rsi ?? 50,
          quantScore: item.quantScore,
          signal: item.signal as Signal,
          volume24h: item.volume24h,
          sparklineData: item.sparklineData || [],
        }));
        setScreenerData(entries);
        setIsBackendOnline(true);
        setLastUpdate(new Date());
      } else {
        // Fallback to mock data
        setScreenerData(generateScreenerData(timeframe, mode));
        setIsBackendOnline(false);
        setLastUpdate(new Date());
      }
    } catch {
      setScreenerData(generateScreenerData(timeframe, mode));
      setIsBackendOnline(false);
      setLastUpdate(new Date());
    }
    setIsLoading(false);
  }, [timeframe, mode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle column header click: toggle sort
  const handleSort = (col: 'score' | 'rsi' | 'change') => {
    if (sortBy === col) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortOrder('asc');
    }
  };

  const filteredData = useMemo(() => {
    let result = [...screenerData];
    if (signalFilter !== 'all') {
      result = result.filter(e => e.signal === signalFilter);
    }
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      switch (sortBy) {
        case 'score': return (a.quantScore - b.quantScore) * multiplier;
        case 'rsi': return (a.rsi - b.rsi) * multiplier;
        case 'change': return (a.priceChange24h - b.priceChange24h) * multiplier;
        default: return 0;
      }
    });
    return result;
  }, [screenerData, signalFilter, sortBy, sortOrder]);

  const signalCounts = useMemo(() => {
    const counts: Record<string, number> = { all: screenerData.length };
    screenerData.forEach(e => {
      counts[e.signal] = (counts[e.signal] || 0) + 1;
    });
    return counts;
  }, [screenerData]);

  const timeframes: Timeframe[] = ['1S', '1D', '4H', '1H', '15M'];

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return null;
    return sortOrder === 'asc'
      ? <ArrowUp size={10} className="inline ml-0.5" />
      : <ArrowDown size={10} className="inline ml-0.5" />;
  };

  return (
    <div className="w-full animate-fadeInUp">
      <div className="text-center mb-6">
        <h2 className="text-xl font-black mb-1" style={{ color: 'var(--accent-gold)' }}>
          {t('screener.title')}
        </h2>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('screener.subtitle')}
        </p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className={`text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-full`}
            style={{
              color: isBackendOnline ? 'var(--signal-buy)' : 'var(--text-muted)',
              background: isBackendOnline ? 'var(--signal-buy-dim)' : 'var(--bg-tertiary)',
            }}>
            {isBackendOnline ? <Wifi size={9} /> : <WifiOff size={9} />}
            {isBackendOnline ? 'LIVE' : 'MOCK'}
          </span>
          {lastUpdate && (
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            className="text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors"
            style={{ color: 'var(--accent-gold)', background: 'var(--accent-gold-dim)' }}
            disabled={isLoading}
          >
            <RefreshCw size={9} className={isLoading ? 'animate-spin' : ''} />
            {isLoading ? '...' : '↻'}
          </button>
        </div>
      </div>

      {/* Timeframe Selector */}
      <div className="flex justify-center gap-2 mb-4">
        {timeframes.map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`tab-button ${timeframe === tf ? 'tab-button--active' : ''}`}
            id={`screener-tf-${tf}`}
          >
            {t(`tf.${tf}`)}
          </button>
        ))}
      </div>

      {/* Signal Filter Pills */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {SIGNAL_FILTER_KEYS.map(sig => (
          <button
            key={sig}
            onClick={() => setSignalFilter(sig)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
            style={{
              background: signalFilter === sig ? getSignalBg(sig) : 'var(--bg-secondary)',
              color: signalFilter === sig ? getSignalColor(sig) : 'var(--text-muted)',
              border: `1px solid ${signalFilter === sig ? getSignalColor(sig) + '66' : 'var(--border-color)'}`,
            }}
          >
            {getSignalEmoji(sig)} {t(SIGNAL_I18N[sig])} ({signalCounts[sig] || 0})
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && screenerData.length === 0 && (
        <div className="glass-card py-12 text-center">
          <RefreshCw size={24} className="mx-auto mb-3 animate-spin" style={{ color: 'var(--accent-gold)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Analizando mercado con IA cuantitativa...</p>
        </div>
      )}

      {/* Table */}
      {(!isLoading || screenerData.length > 0) && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {/* Table Header */}
              <div
                className="grid gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                style={{
                  gridTemplateColumns: '40px 1fr 100px 80px 70px 70px 100px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div>{t('screener.rank')}</div>
                <div>{t('screener.crypto')}</div>
                <div className="text-right">{t('screener.price')}</div>
                <div
                  className="text-right cursor-pointer hover:opacity-80 select-none"
                  onClick={() => handleSort('change')}
                  style={{ color: sortBy === 'change' ? 'var(--accent-gold)' : undefined }}
                >
                  {t('screener.change')} <SortIcon col="change" />
                </div>
                <div
                  className="text-right cursor-pointer hover:opacity-80 select-none"
                  onClick={() => handleSort('rsi')}
                  style={{ color: sortBy === 'rsi' ? 'var(--accent-gold)' : undefined }}
                >
                  {t('screener.rsi')} <SortIcon col="rsi" />
                </div>
                <div
                  className="text-right cursor-pointer hover:opacity-80 select-none"
                  onClick={() => handleSort('score')}
                  style={{ color: sortBy === 'score' ? 'var(--accent-gold)' : undefined }}
                >
                  {t('screener.score')} <SortIcon col="score" />
                </div>
                <div className="text-center">{t('screener.signal')}</div>
              </div>

              {/* Table Body */}
              <div className="stagger-children">
                {filteredData.map((entry, idx) => (
                  <div
                    key={entry.symbol}
                    className="grid gap-2 px-4 py-3 text-sm items-center transition-colors cursor-pointer hover:bg-[var(--bg-tertiary)]"
                    style={{
                      gridTemplateColumns: '40px 1fr 100px 80px 70px 70px 100px',
                      borderBottom: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {/* Rank */}
                    <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      {idx + 1}
                    </div>

                    {/* Crypto */}
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{entry.symbol}</span>
                      <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
                        {entry.name}
                      </span>
                      {/* Mini Sparkline */}
                      {entry.sparklineData && entry.sparklineData.length > 0 && (
                        <div className="hidden md:flex items-end gap-px h-4 ml-2">
                          {entry.sparklineData.map((val: number, i: number) => {
                            const min = Math.min(...entry.sparklineData);
                            const max = Math.max(...entry.sparklineData);
                            const range = max - min || 1;
                            const height = ((val - min) / range) * 16 + 2;
                            const isLast = i === entry.sparklineData.length - 1;
                            return (
                              <div
                                key={i}
                                className="rounded-sm"
                                style={{
                                  width: '3px',
                                  height: `${height}px`,
                                  background: entry.priceChange24h >= 0 ? 'var(--signal-buy)' : 'var(--signal-sell)',
                                  opacity: isLast ? 1 : 0.5,
                                }}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Price */}
                    <div className="text-right font-mono text-xs">
                      ${formatPrice(entry.price)}
                    </div>

                    {/* Change */}
                    <div className="text-right">
                      <span
                        className="text-xs font-semibold flex items-center justify-end gap-0.5"
                        style={{
                          color: entry.priceChange24h >= 0 ? 'var(--signal-buy)' : 'var(--signal-sell)',
                        }}
                      >
                        {entry.priceChange24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {entry.priceChange24h >= 0 ? '+' : ''}{entry.priceChange24h.toFixed(1)}%
                      </span>
                    </div>

                    {/* RSI */}
                    <div className="text-right">
                      <span
                        className="text-xs font-bold"
                        style={{
                          color: entry.rsi < 30 ? 'var(--signal-buy)' : entry.rsi > 70 ? 'var(--signal-sell)' : 'var(--text-secondary)',
                        }}
                      >
                        {entry.rsi.toFixed(1)}
                      </span>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <div className="font-mono font-bold text-base" style={{ color: getScoreColor(entry.quantScore) }}>
                        {entry.quantScore.toFixed(1)}
                      </div>
                    </div>

                    {/* Signal */}
                    <div className="text-center">
                      <span className={`signal-badge text-[10px] py-1 px-2 ${getSignalBadgeClass(entry.signal)}`}>
                        {getSignalEmoji(entry.signal)} {t(SIGNAL_I18N[entry.signal])}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {filteredData.length === 0 && !isLoading && (
                <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  <Filter size={20} className="mx-auto mb-2 opacity-50" />
                  {t('general.noFilter')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Helpers ----

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(8);
}

function getScoreColor(score: number): string {
  if (score <= 20) return '#10B981';
  if (score <= 40) return '#34D399';
  if (score <= 60) return '#94A3B8';
  if (score <= 80) return '#FB923C';
  return '#EF4444';
}

function getSignalColor(signal: Signal | 'all'): string {
  switch (signal) {
    case 'Compra Fuerte': return '#10B981';
    case 'Compra': return '#34D399';
    case 'Mantener': return '#94A3B8';
    case 'Venta': return '#FB923C';
    case 'Venta Fuerte': return '#EF4444';
    default: return 'var(--accent-gold)';
  }
}

function getSignalBg(signal: Signal | 'all'): string {
  switch (signal) {
    case 'Compra Fuerte':
    case 'Compra': return 'rgba(16,185,129,0.15)';
    case 'Mantener': return 'rgba(148,163,184,0.1)';
    case 'Venta':
    case 'Venta Fuerte': return 'rgba(239,68,68,0.15)';
    default: return 'var(--accent-gold-dim)';
  }
}

function getSignalEmoji(signal: Signal | 'all'): string {
  switch (signal) {
    case 'Compra Fuerte': return '🟢';
    case 'Compra': return '🟡';
    case 'Mantener': return '⚪';
    case 'Venta': return '🟠';
    case 'Venta Fuerte': return '🔴';
    default: return '📊';
  }
}

function getSignalBadgeClass(signal: Signal): string {
  switch (signal) {
    case 'Compra Fuerte': return 'signal-badge--compra-fuerte';
    case 'Compra': return 'signal-badge--compra';
    case 'Mantener': return 'signal-badge--mantener';
    case 'Venta': return 'signal-badge--venta';
    case 'Venta Fuerte': return 'signal-badge--venta-fuerte';
  }
}
