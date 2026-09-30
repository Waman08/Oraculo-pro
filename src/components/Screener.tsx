"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { fetchPythonScreener } from '@/lib/api';
import type { Signal, ScreenerEntry } from '@/types';
import { useAppSettings, useLocale } from './AppContext';
import { TrendingUp, TrendingDown, Filter, RefreshCw, Search, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';

const SECTOR_KEYS = ['all', 'Layer 1', 'Layer 2', 'AI & Big Data', 'DeFi', 'Memecoins', 'Gaming', 'RWA & Oracles', 'Otros'];

const SIGNAL_I18N: Record<Signal | 'all', string> = {
  'all': 'screener.all',
  'Compra Fuerte': 'signal.strongBuy',
  'Compra': 'signal.buy',
  'Mantener': 'signal.hold',
  'Venta': 'signal.sell',
  'Venta Fuerte': 'signal.strongSell',
};

type SortCol = 'score' | 'symbol' | 'price' | 'change' | 'rsi';

export default function Screener() {
  const { timeframe, setTimeframe, mode, setSymbol, setActiveTab } = useAppSettings();
  const { t } = useLocale();
  
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [alphaFilter, setAlphaFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Default to score desc
  const [sortBy, setSortBy] = useState<SortCol>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [data, setData] = useState<ScreenerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    // SWR: Load from cache first
    const cacheKey = `screener_cache_${timeframe}_${mode}`;
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData && data.length === 0) {
      try {
        setData(JSON.parse(cachedData));
      } catch (e) {}
    }

    setIsLoading(true);
    try {
      const screenerData = await fetchPythonScreener(timeframe, mode, 100);
      if (screenerData && Array.isArray(screenerData)) {
        setData(screenerData);
        localStorage.setItem(cacheKey, JSON.stringify(screenerData));
        setLastUpdate(new Date());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, mode]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // 1 min update
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSort = (col: SortCol) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortOrder(col === 'symbol' ? 'asc' : 'desc');
    }
  };

  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.symbol.toLowerCase().includes(q) || 
        (item.name && item.name.toLowerCase().includes(q))
      );
    }

    // Sector
    if (sectorFilter !== 'all') {
      filtered = filtered.filter((item) => item.sector === sectorFilter);
    }

    // Alpha Presets
    if (alphaFilter === 'confluence') {
      filtered = filtered.filter(item => (item.quantScore || 0) >= 70 && (item.rsi || 50) <= 60);
    } else if (alphaFilter === 'oversold') {
      filtered = filtered.filter(item => (item.rsi || 50) <= 35);
    } else if (alphaFilter === 'overbought') {
      filtered = filtered.filter(item => (item.rsi || 50) >= 68 || (item.quantScore || 50) <= 35);
    } else if (alphaFilter === 'volume') {
      // Sort by volume if available, top 15
      filtered = filtered.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0)).slice(0, 15);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = 0;
      let bVal: any = 0;
      switch (sortBy) {
        case 'score': aVal = a.quantScore || 0; bVal = b.quantScore || 0; break;
        case 'symbol': aVal = a.symbol; bVal = b.symbol; break;
        case 'price': aVal = a.price || 0; bVal = b.price || 0; break;
        case 'change': aVal = a.priceChange24h || 0; bVal = b.priceChange24h || 0; break;
        case 'rsi': aVal = a.rsi || 50; bVal = b.rsi || 50; break;
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  }, [data, sectorFilter, alphaFilter, searchQuery, sortBy, sortOrder]);

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortBy !== col) return <ArrowDown size={12} className="inline opacity-0 group-hover:opacity-30" />;
    return sortOrder === 'asc' ? <ArrowUp size={12} className="inline text-[var(--accent-gold)]" /> : <ArrowDown size={12} className="inline text-[var(--accent-gold)]" />;
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Title & Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold font-mono tracking-tight text-[var(--text-primary)]">
            Quantitative Screener <span className="text-[var(--accent-gold)]">Top 100</span>
          </h2>
          <p className="text-sm text-[var(--text-muted)] flex items-center gap-2 mt-1">
            {lastUpdate ? `Actualizado: ${lastUpdate.toLocaleTimeString()}` : 'Cargando datos...'}
            <button onClick={() => fetchData()} className="hover:text-[var(--text-primary)] transition-colors">
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-500" />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-sm focus:border-[var(--accent-gold)] focus:ring-1 focus:ring-[var(--accent-gold)] focus:outline-none transition-all placeholder-gray-500 text-white"
            placeholder="Buscar activo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Alpha Filters */}
      <div className="flex flex-wrap gap-2">
        <AlphaChip id="all" label="🌟 Todos" active={alphaFilter === 'all'} onClick={() => setAlphaFilter('all')} />
        <AlphaChip id="confluence" label="💎 Confluencia Compra" active={alphaFilter === 'confluence'} onClick={() => setAlphaFilter('confluence')} />
        <AlphaChip id="oversold" label="⚡ Sobreventa Extrema" active={alphaFilter === 'oversold'} onClick={() => setAlphaFilter('oversold')} />
        <AlphaChip id="overbought" label="⚠️ Sobrecompra / Riesgo" active={alphaFilter === 'overbought'} onClick={() => setAlphaFilter('overbought')} />
        <AlphaChip id="volume" label="🔥 Mayor Volumen" active={alphaFilter === 'volume'} onClick={() => setAlphaFilter('volume')} />
      </div>

      {/* Sector Filters (Existing) */}
      <div className="flex flex-wrap gap-2 border-t border-white/5 pt-4">
        {SECTOR_KEYS.map((sector) => (
          <button
            key={sector}
            onClick={() => setSectorFilter(sector)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              sectorFilter === sector
                ? 'bg-[var(--accent-gold)] text-black'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            {sector === 'all' ? t('screener.all') : sector}
          </button>
        ))}
      </div>

      {/* Table Container */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Header */}
            <div
              className="grid gap-2 px-4 py-3 text-xs font-bold tracking-wider uppercase bg-black/20 select-none"
              style={{
                gridTemplateColumns: '40px 1.5fr 100px 80px 70px 70px 120px',
                borderBottom: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
              }}
            >
              <div className="text-center cursor-default">Rank</div>
              <div className="cursor-pointer hover:text-white group flex items-center gap-1" onClick={() => handleSort('symbol')}>
                Símbolo <SortIcon col="symbol" />
              </div>
              <div className="text-right cursor-pointer hover:text-white group flex items-center justify-end gap-1" onClick={() => handleSort('price')}>
                <SortIcon col="price" /> {t('screener.price')}
              </div>
              <div className="text-right cursor-pointer hover:text-white group flex items-center justify-end gap-1" onClick={() => handleSort('change')}>
                <SortIcon col="change" /> {t('screener.24h')}
              </div>
              <div className="text-right cursor-pointer hover:text-white group flex items-center justify-end gap-1" onClick={() => handleSort('rsi')}>
                <SortIcon col="rsi" /> {t('screener.rsi')}
              </div>
              <div className="text-right cursor-pointer hover:text-[var(--accent-gold)] group flex items-center justify-end gap-1" onClick={() => handleSort('score')}>
                <SortIcon col="score" /> {t('screener.score')}
              </div>
              <div className="text-center">{t('screener.signal')}</div>
            </div>

            {/* Body */}
            <div className="stagger-children max-h-[600px] overflow-y-auto custom-scrollbar">
              {filteredData.map((entry, idx) => (
                <div
                  key={entry.symbol}
                  onClick={() => {
                    setSymbol(entry.symbol);
                    setActiveTab('analysis');
                  }}
                  className="group grid gap-2 px-4 py-3 text-sm items-center transition-all cursor-pointer hover:bg-white/5 border-b border-white/5 last:border-0"
                  style={{
                    gridTemplateColumns: '40px 1.5fr 100px 80px 70px 70px 120px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {/* Rank */}
                  <div className="text-xs font-mono text-center text-gray-500">
                    {idx + 1}
                  </div>

                  {/* Crypto */}
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base group-hover:text-[var(--accent-gold)] transition-colors flex items-center gap-1">
                      {entry.symbol} <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                    <span className="text-xs text-gray-500 hidden sm:inline truncate max-w-[80px]">
                      {entry.name}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="text-right font-mono text-sm">
                    ${formatPrice(entry.price)}
                  </div>

                  {/* Change */}
                  <div className="text-right">
                    <span
                      className="text-xs font-mono font-semibold flex items-center justify-end gap-0.5"
                      style={{
                        color: (entry.priceChange24h || 0) >= 0 ? 'var(--signal-buy)' : 'var(--signal-sell)',
                      }}
                    >
                      {(entry.priceChange24h || 0) >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {(entry.priceChange24h || 0) >= 0 ? '+' : ''}{typeof entry.priceChange24h === 'number' ? entry.priceChange24h.toFixed(2) : '0.00'}%
                    </span>
                  </div>

                  {/* RSI */}
                  <div className="text-right font-mono font-bold text-xs"
                    style={{
                      color: (entry.rsi || 50) < 30 ? 'var(--signal-buy)' : (entry.rsi || 50) > 70 ? 'var(--signal-sell)' : 'var(--text-secondary)',
                    }}
                  >
                    {typeof entry.rsi === 'number' ? entry.rsi.toFixed(1) : '50.0'}
                  </div>

                  {/* Score */}
                  <div className="text-right flex justify-end">
                    <div className="font-mono font-bold text-sm px-2 py-0.5 rounded" style={{ 
                      color: getScoreColor(entry.quantScore),
                      background: `${getScoreColor(entry.quantScore)}15`,
                      border: `1px solid ${getScoreColor(entry.quantScore)}30`
                    }}>
                      {typeof entry.quantScore === 'number' ? entry.quantScore.toFixed(1) : '50.0'}
                    </div>
                  </div>

                  {/* Signal */}
                  <div className="text-center">
                    <span className={`signal-badge text-[10px] py-1 px-2 ${getSignalBadgeClass(entry.signal)}`}>
                      {getSignalEmoji(entry.signal)} {t(SIGNAL_I18N[entry.signal] || 'signal.hold')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {filteredData.length === 0 && (
              <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white/20 border-t-[var(--accent-gold)] rounded-full animate-spin mb-3"></div>
                    Cargando screener top 100...
                  </div>
                ) : (
                  <>
                    <Filter size={24} className="mx-auto mb-3 opacity-30" />
                    No se encontraron activos con estos filtros.
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Subcomponents & Helpers ----

function AlphaChip({ id, label, active, onClick }: { id: string, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border ${
        active 
          ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
          : 'bg-black/40 border-white/10 text-gray-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function formatPrice(price: number): string {
  if (price === undefined || price === null || isNaN(price)) return '0.00';
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(8);
}

function getScoreColor(score: number): string {
  if (score === undefined || score === null || isNaN(score)) return '#94A3B8';
  if (score >= 70) return '#10B981'; // Compra fuerte / Compra
  if (score <= 35) return '#EF4444'; // Venta fuerte / Venta
  return '#F59E0B'; // Neutral
}

function getSignalEmoji(signal: Signal | 'all'): string {
  switch (signal) {
    case 'Compra Fuerte': return '✨';
    case 'Compra': return '🟢';
    case 'Mantener': return '⚪';
    case 'Venta': return '🔴';
    case 'Venta Fuerte': return '🚨';
    default: return '⚪';
  }
}

function getSignalBadgeClass(signal: Signal): string {
  switch (signal) {
    case 'Compra Fuerte': return 'signal-badge--compra-fuerte';
    case 'Compra': return 'signal-badge--compra';
    case 'Mantener': return 'signal-badge--mantener';
    case 'Venta': return 'signal-badge--venta';
    case 'Venta Fuerte': return 'signal-badge--venta-fuerte';
    default: return 'signal-badge--mantener';
  }
}
