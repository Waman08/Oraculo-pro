"use client";

import { useState, useEffect } from 'react';
import { useAppSettings, useLocale } from './AppContext';
import { fetchAllBinancePrices } from '@/lib/api';
import { generateFullAnalysis, calculateFullScore } from '@/lib/ml-engine';
import { TrendingUp, TrendingDown, Trash2, Search, Plus } from 'lucide-react';
import { CRYPTO_DATABASE } from '@/lib/mock-data';

interface WatchlistEntry {
  symbol: string;
  price: number;
  change: number;
  score: number;
  signal: string;
}

export default function WatchlistPanel() {
  const { watchlist, toggleWatchlist, setSymbol, mode, timeframe } = useAppSettings();
  const { t } = useLocale();
  const [data, setData] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;

    async function loadWatchlist() {
      setLoading(true);
      const prices = await fetchAllBinancePrices();
      
      const entries: WatchlistEntry[] = watchlist.map(sym => {
        const p = prices.get(sym);
        const analysis = generateFullAnalysis(sym, timeframe, mode, p?.price, p?.priceChange24h, p?.volume24h);
        const breakdown = calculateFullScore(analysis.indicators, analysis.sentiment, analysis.onChain, analysis.currentPrice, mode);

        return {
          symbol: sym,
          price: analysis.currentPrice,
          change: analysis.priceChange24h,
          score: breakdown.total,
          signal: analysis.signal
        };
      });

      if (active) {
        setData(entries);
        setLoading(false);
      }
    }

    loadWatchlist();
    const interval = setInterval(loadWatchlist, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [watchlist, mode, timeframe]);

  const filteredCryptos = CRYPTO_DATABASE.filter(c => 
    !watchlist.includes(c.symbol) && 
    (c.symbol.toLowerCase().includes(search.toLowerCase()) || c.name.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 5);

  return (
    <div className="glass-card p-5 animate-fadeInUp">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          ⭐ {t('watchlist.title')}
        </h3>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="p-1 rounded transition-colors hover:bg-white/5"
          style={{ color: 'var(--text-muted)' }}
        >
          <Plus size={16} />
        </button>
      </div>

      {showAdd && (
        <div className="mb-4">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={t('watchlist.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 transition-all"
              style={{
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          {search && filteredCryptos.length > 0 && (
            <div className="space-y-1 border rounded-lg p-1" style={{ borderColor: 'var(--border-color)' }}>
              {filteredCryptos.map(c => (
                <button
                  key={c.symbol}
                  onClick={() => {
                    toggleWatchlist(c.symbol);
                    setSearch('');
                    setShowAdd(false);
                  }}
                  className="w-full flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{c.symbol}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.name}</span>
                  </div>
                  <Plus size={14} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && data.length === 0 ? (
        <div className="py-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('general.loading') || 'Cargando...'}
        </div>
      ) : data.length === 0 ? (
        <div className="py-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('watchlist.empty')}
        </div>
      ) : (
        <div className="space-y-2">
          {data.map(entry => (
            <div 
              key={entry.symbol} 
              className="group relative flex items-center justify-between p-3 rounded-lg border transition-all hover:bg-white/5 cursor-pointer"
              style={{ borderColor: 'var(--border-color)', background: 'var(--bg-tertiary)' }}
              onClick={() => setSymbol(entry.symbol)}
            >
              <div>
                <div className="font-bold text-sm">{entry.symbol}</div>
                <div className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: entry.change >= 0 ? 'var(--signal-buy)' : 'var(--signal-sell)' }}>
                  {entry.change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {Math.abs(entry.change).toFixed(2)}%
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-mono">${formatPrice(entry.price)}</div>
                <div 
                  className="text-[10px] font-bold mt-0.5 px-1.5 py-0.5 rounded inline-block"
                  style={{
                    color: entry.score >= 60 ? 'var(--signal-sell)' : entry.score <= 40 ? 'var(--signal-buy)' : 'var(--text-muted)',
                    background: entry.score >= 60 ? 'var(--signal-sell-dim)' : entry.score <= 40 ? 'var(--signal-buy-dim)' : 'var(--border-color)'
                  }}
                >
                  {entry.score.toFixed(1)} {getSignalLabel(entry.signal)}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWatchlist(entry.symbol);
                }}
                className="absolute -right-2 -top-2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/10 text-red-500 hover:bg-red-500/20"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatPrice(price: number): string {
  if (price === undefined || price === null || isNaN(price)) return '0.00';
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(8);
}

function getSignalLabel(signal: string) {
  if (signal === 'Compra Fuerte') return 'STR BUY';
  if (signal === 'Compra') return 'BUY';
  if (signal === 'Mantener') return 'HOLD';
  if (signal === 'Venta') return 'SELL';
  if (signal === 'Venta Fuerte') return 'STR SELL';
  return signal;
}
