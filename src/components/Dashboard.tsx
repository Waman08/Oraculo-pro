"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { generateFullAnalysis, calculateFullScore } from '@/lib/ml-engine';
import { CRYPTO_DATABASE } from '@/lib/mock-data';
import { fetchBinancePrice, fetchFearGreedIndex, fetchPythonAnalysis, fetchBacktestFromServer, BINANCE_PAIR_MAP, getSupportedSymbols, fetchTop100, searchDexScreener, DexScreenerPair } from '@/lib/api';
import type { BacktestResult } from '@/types';
import type { MarketAnalysis, ScoreBreakdown, SentimentData } from '@/types';
import { useAppSettings, useLocale } from './AppContext';
import ScoreGauge from './ScoreGauge';
import IndicatorGrid from './IndicatorGrid';
import DCAPanel from './DCAPanel';
import SentimentPanel from './SentimentPanel';
import OnChainPanel from './OnChainPanel';
import CandlestickChart from './CandlestickChart';
import SmartMoneyPanel from './SmartMoneyPanel';
import WatchlistPanel from './WatchlistPanel';
import AIPanel from './AIPanel';
import PortfolioTracker from './PortfolioTracker';
import AlertsPanel from './AlertsPanel';
import ActuarialPanel from './ActuarialPanel';
import dynamic from 'next/dynamic';
const ExportReport = dynamic(() => import('./ExportReport'), { ssr: false });
import BacktestBadge from './BacktestBadge';
import { BacktestChart } from './charts/BacktestChart';
import { Search, AlertTriangle, TrendingDown, TrendingUp, BarChart3, Wifi, WifiOff, Cpu, Code2 } from 'lucide-react';
import { wsManager } from '@/lib/websocket-manager';
import { useAppStore } from '@/lib/store';

export default function Dashboard() {
  const { symbol, setSymbol, mode, timeframe } = useAppSettings();
  const { t } = useLocale();
  const livePriceData = useAppStore(state => state.livePrices[symbol]);

  const [data, setData] = useState<MarketAnalysis | null>(null);
  const [searchInput, setSearchInput] = useState(symbol);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dataSource, setDataSource] = useState<'binance' | 'coingecko' | 'mock' | 'dexscreener'>('mock');
  const [engineSource, setEngineSource] = useState<'python' | 'js'>('js');
  const [dexSuggestions, setDexSuggestions] = useState<DexScreenerPair[]>([]);
  const [selectedDexPair, setSelectedDexPair] = useState<DexScreenerPair | null>(null);
  const [backtestData, setBacktestData] = useState<BacktestResult | null>(null);

  const breakdown = useMemo(() => {
    if (!data) return null;
    return calculateFullScore(data.indicators, data.sentiment, data.onChain, data.currentPrice, mode);
  }, [data, mode]);

  // Fetch real price + Fear & Greed and generate analysis (REST Fallback)
  const loadAnalysis = useCallback(async () => {
    // Strategy: Try Python backend first → fallback to JS engine

    // 1. Try Python backend (real indicators via pandas-ta)
    try {
      const pythonResult = await fetchPythonAnalysis(symbol, timeframe, mode);
      if (pythonResult && pythonResult.indicators) {
        setEngineSource('python');
        setDataSource(pythonResult.source === 'python' ? 'binance' : 'mock');
        // Ensure Zustand has the price
        useAppStore.getState().setPrice(symbol, {
          price: pythonResult.currentPrice,
          priceChange24h: pythonResult.priceChange24h,
          volume24h: pythonResult.volume24h,
          source: 'binance',
        });
        setData(pythonResult as MarketAnalysis);
        return;
      }
    } catch {
      // Python backend unavailable, continue to JS engine
    }

    // 2. Fallback: JS engine with REST price data
    setEngineSource('js');
    let livePrice: number | undefined;
    let liveChange: number | undefined;
    let liveVolume: number | undefined;

    try {
      let priceData = await fetchBinancePrice(symbol);
      
      // If we selected a DEX pair and it's not found in Binance/CoinGecko, use Dex data
      if (!priceData && selectedDexPair && selectedDexPair.baseToken.symbol.toUpperCase() === symbol) {
        priceData = {
          price: parseFloat(selectedDexPair.priceUsd),
          priceChange24h: selectedDexPair.priceChange?.h24 || 0,
          volume24h: selectedDexPair.volume?.h24 || 0,
          source: 'dexscreener'
        };
      }

      if (priceData) {
        livePrice = priceData.price;
        liveChange = priceData.priceChange24h;
        liveVolume = priceData.volume24h;
        setDataSource(priceData.source);
        useAppStore.getState().setPrice(symbol, priceData);
      } else {
        setDataSource('mock');
      }
    } catch {
      setDataSource('mock');
    }

    const analysis = generateFullAnalysis(symbol, timeframe, mode, livePrice, liveChange, liveVolume);

    // Fetch Fear & Greed
    try {
      const fgData = await fetchFearGreedIndex();
      if (fgData) {
        analysis.sentiment = {
          ...analysis.sentiment,
          fearGreedIndex: fgData.value,
          fearGreedLabel: fgData.classificationES as SentimentData['fearGreedLabel'],
        };
      }
    } catch {}

    setData(analysis);
  }, [symbol, mode, timeframe, selectedDexPair]);

  // Initial load and REST polling
  useEffect(() => {
    fetchTop100(); // Initialize Top 100 on mount
    loadAnalysis();
    const interval = setInterval(loadAnalysis, 30000);
    return () => clearInterval(interval);
  }, [loadAnalysis]);

  // Fetch server-side backtest when symbol changes
  useEffect(() => {
    let cancelled = false;
    setBacktestData(null);
    fetchBacktestFromServer(symbol, timeframe, 100).then(result => {
      if (!cancelled && result && !result.error) {
        setBacktestData(result as BacktestResult);
      }
    });
    return () => { cancelled = true; };
  }, [symbol, timeframe]);

  // WebSocket Subscription
  useEffect(() => {
    wsManager.connect();
    wsManager.subscribe(symbol);
    return () => {
      wsManager.unsubscribe(symbol);
    };
  }, [symbol]);

  // Update Data on WebSocket Tick
  useEffect(() => {
    if (livePriceData && livePriceData.source === 'binance') {
      setDataSource('binance');
      setData(prevData => {
         if (!prevData) return prevData;
         // Optimization: Don't update if price is exactly the same to avoid re-renders
         if (prevData.currentPrice === livePriceData.price) return prevData;
         
         if (engineSource === 'python') {
           return {
             ...prevData,
             currentPrice: livePriceData.price,
             priceChange24h: livePriceData.priceChange24h,
             volume24h: livePriceData.volume24h
           };
         } else {
           const newAnalysis = generateFullAnalysis(
             symbol, timeframe, mode, 
             livePriceData.price, livePriceData.priceChange24h, livePriceData.volume24h
           );
           newAnalysis.sentiment = prevData.sentiment; // Keep FG index
           return newAnalysis;
         }
      });
    }
  }, [livePriceData, symbol, timeframe, mode, engineSource]);

  // Debounce search for DexScreener
  useEffect(() => {
    if (searchInput.length < 2) {
      setDexSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const isContract = searchInput.startsWith('0x') || searchInput.length > 25;
      if (isContract || !getSupportedSymbols().includes(searchInput.toUpperCase())) {
        const pairs = await searchDexScreener(searchInput);
        setDexSuggestions(pairs.slice(0, 5));
      } else {
        setDexSuggestions([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const suggestions = useMemo(() => {
    // Generate suggestions dynamically from the real Binance pairs if loaded
    const allSymbols = getSupportedSymbols();
    const available = allSymbols.length > 0 
      ? allSymbols.map(sym => ({ symbol: sym, name: sym })) 
      : CRYPTO_DATABASE; // fallback

    let localFiltered = [];
    if (searchInput.length === 0) {
      localFiltered = available.slice(0, 8);
    } else {
      const query = searchInput.toUpperCase();
      localFiltered = available.filter(
        c => c.symbol.includes(query) || c.name.toUpperCase().includes(query)
      ).slice(0, 8);
    }

    const dexMapped = dexSuggestions.map(dex => ({
      symbol: dex.baseToken.symbol.toUpperCase(),
      name: `${dex.baseToken.name} (${dex.chainId})`,
      price: parseFloat(dex.priceUsd),
      isDex: true,
      dexData: dex
    }));

    return [...localFiltered, ...dexMapped].slice(0, 12);
  }, [searchInput, dexSuggestions]);

  const handleSearch = (sym: string, dexData?: DexScreenerPair) => {
    const symbolToSearch = sym.toUpperCase();
    if (dexData) {
      setSelectedDexPair(dexData);
    } else {
      setSelectedDexPair(null);
    }
    setSymbol(symbolToSearch);
    setSearchInput(symbolToSearch);
    setShowSuggestions(false);
  };

  if (!data || !breakdown) {
    return (
      <div className="flex flex-col gap-6 w-full animate-fadeInUp">
        {/* Search Bar Skeleton */}
        <div className="flex justify-center">
          <div className="w-full max-w-md h-12 rounded-xl shimmer-bg opacity-50" />
        </div>
        
        {/* Header Skeleton */}
        <div className="flex flex-col items-center gap-2 mt-4">
          <div className="w-48 h-8 rounded-lg shimmer-bg opacity-50" />
          <div className="w-32 h-6 rounded-lg shimmer-bg opacity-50" />
        </div>

        {/* Gauge Skeleton */}
        <div className="flex justify-center mt-6 mb-4">
          <div className="w-[280px] h-[190px] rounded-t-full shimmer-bg opacity-30" />
        </div>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 h-64 rounded-xl shimmer-bg opacity-40" />
          <div className="lg:col-span-1 h-64 rounded-xl shimmer-bg opacity-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full" id="dashboard-export-area">
      {/* Search Bar */}
      <div className="flex justify-center" data-html2canvas-ignore>
        <div className="relative w-full max-w-md">
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value.toUpperCase());
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch(searchInput);
              }}
              className="w-full px-4 py-3 pl-10 rounded-xl text-sm font-semibold uppercase outline-none transition-all"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
              placeholder={t('controls.search')}
              id="crypto-search-input"
            />
            <Search
              size={16}
              className="absolute left-3 top-3.5"
              style={{ color: 'var(--accent-gold)' }}
            />
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}
            >
              {suggestions.map((crypto: any) => (
                <button
                  key={crypto.symbol + (crypto.isDex ? '-dex' : '')}
                  onClick={() => handleSearch(crypto.symbol, crypto.dexData)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors"
                  style={{
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{crypto.symbol}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{crypto.name}</span>
                    {crypto.isDex && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#1C1C1C] text-[#E0E0E0] border border-[#333]">
                        DEX
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                    {'price' in crypto ? `$${formatPrice(crypto.price)}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close suggestions (Removed overlay to avoid blocking interaction) */}

      {/* Asset Info Header */}
      <div className="text-center animate-fadeInUp">
        <div className="flex items-center justify-center gap-3 mb-1">
          <h2 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            {data.symbol}
          </h2>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {data.name}
          </span>
          {/* Data source indicator */}
          <span
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              color: dataSource === 'binance' ? 'var(--signal-buy)' 
                   : dataSource === 'coingecko' ? '#8DC63F' 
                   : dataSource === 'dexscreener' ? '#E0E0E0'
                   : 'var(--signal-warning)',
              background: dataSource === 'binance' ? 'var(--signal-buy-dim)' 
                        : dataSource === 'coingecko' ? 'rgba(141,198,63,0.15)' 
                        : dataSource === 'dexscreener' ? '#1C1C1C'
                        : 'rgba(251,146,60,0.15)',
              border: dataSource === 'dexscreener' ? '1px solid #333' : 'none',
            }}
          >
            {dataSource === 'binance' ? <Wifi size={10} /> 
             : dataSource === 'coingecko' ? '🦎' 
             : dataSource === 'dexscreener' ? <Search size={10} />
             : <WifiOff size={10} />}
            {dataSource === 'binance' ? 'BINANCE' 
             : dataSource === 'coingecko' ? 'COINGECKO' 
             : dataSource === 'dexscreener' ? 'DEXSCREENER'
             : 'MOCK'}
          </span>
          {/* Engine Source Indicator */}
          <span
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              color: engineSource === 'python' ? '#818CF8' : 'var(--text-muted)',
              background: engineSource === 'python' ? 'rgba(129,140,248,0.15)' : 'var(--bg-tertiary)',
            }}
          >
            {engineSource === 'python' ? <Cpu size={10} /> : <Code2 size={10} />}
            {engineSource === 'python' ? 'PYTHON' : 'JS'}
          </span>
        </div>
        <div className="flex items-center justify-center gap-4 text-sm">
          <span className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
            ${formatPrice(data.currentPrice)}
          </span>
          <span
            className="flex items-center gap-1 font-semibold text-xs px-2 py-0.5 rounded"
            style={{
              color: data.priceChange24h >= 0 ? 'var(--signal-buy)' : 'var(--signal-sell)',
              background: data.priceChange24h >= 0 ? 'var(--signal-buy-dim)' : 'var(--signal-sell-dim)',
            }}
          >
            {data.priceChange24h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {data.priceChange24h >= 0 ? '+' : ''}{data.priceChange24h.toFixed(2)}%
          </span>
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <BarChart3 size={11} />
            Vol: ${(data.volume24h / 1e9).toFixed(2)}B
          </span>
        </div>
      </div>

      {/* Score Gauge */}
      <div className="flex justify-between items-center w-full max-w-lg mx-auto mb-4">
        <ScoreGauge score={data.quantScore} signal={data.signal} />
        <div data-html2canvas-ignore>
          <ExportReport />
        </div>
      </div>

      <BacktestBadge />

      {/* Server-Side Backtest: Equity Curve Chart */}
      {backtestData && backtestData.equity_curve && backtestData.equity_curve.length > 0 && (
        <BacktestChart data={backtestData} />
      )}

      {/* Macro Risk Alert */}
      <div
        className="glass-card p-4 flex items-start gap-3 animate-fadeInUp"
        style={{
          borderLeft: `3px solid ${data.quantScore <= 40 ? 'var(--signal-buy)' : data.quantScore >= 60 ? 'var(--signal-sell)' : 'var(--accent-gold)'}`,
        }}
      >
        <AlertTriangle size={16} style={{ color: 'var(--accent-gold)', marginTop: '2px', flexShrink: 0 }} />
        <div>
          <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
            {t('action.macroRisk')}
          </div>
          <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
            {t(data.actionableData.macroRisk)}
          </div>
        </div>
      </div>

      {/* Chart and Watchlist Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <CandlestickChart symbol={data.symbol} />
        </div>
        <div className="lg:col-span-1 flex flex-col gap-6">
          <WatchlistPanel />
          <PortfolioTracker />
          <AlertsPanel />
        </div>
      </div>

      {/* Main Grid: Score Breakdown + DCA + Smart Money */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <IndicatorGrid breakdown={breakdown} />
        <DCAPanel
          actionableData={data.actionableData}
          currentPrice={data.currentPrice}
        />
        <SmartMoneyPanel smartMoney={data.smartMoney} currentPrice={data.currentPrice} />
      </div>

      {/* Actuarial Risk Panel — Full Width */}
      <ActuarialPanel actuarial={data.actuarial} currentPrice={data.currentPrice} />

      {/* Bottom Grid: Sentiment + On-Chain + AI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SentimentPanel sentiment={data.sentiment} macro={data.macro} />
        <OnChainPanel onChain={data.onChain} symbol={data.symbol} />
        <AIPanel data={data} />
      </div>
    </div>
  );
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(8);
}
