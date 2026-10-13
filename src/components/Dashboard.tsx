"use client";



import { useState, useEffect, useMemo, useCallback } from 'react';

import { generateFullAnalysis, calculateFullScore } from '@/lib/ml-engine';

import { CRYPTO_DATABASE } from '@/lib/mock-data';

import { fetchBinancePrice, fetchFearGreedIndex, fetchPythonAnalysis, fetchBacktestFromServer, BINANCE_PAIR_MAP, getSupportedSymbols, fetchTop100, searchDexScreener, DexScreenerPair } from '@/lib/api';

import type { BacktestResult, MtfSummaryData } from '@/types';

import type { MarketAnalysis, ScoreBreakdown, SentimentData } from '@/types';

import { useAppSettings, useLocale } from './AppContext';

const ScoreGauge = dynamic(() => import('./ScoreGauge'), { ssr: false });

const IndicatorGrid = dynamic(() => import('./IndicatorGrid'), { ssr: false });

const DCAPanel = dynamic(() => import('./DCAPanel'), { ssr: false });

const SentimentPanel = dynamic(() => import('./SentimentPanel'), { ssr: false });

const OnChainDashboard = dynamic(() => import('./onchain/OnChainDashboard'), { ssr: false });

const CandlestickChart = dynamic(() => import('./CandlestickChart'), { ssr: false });

const SmartMoneyPanel = dynamic(() => import('./SmartMoneyPanel'), { ssr: false });

import WatchlistPanel from './WatchlistPanel';

import AIPanel from './AIPanel';

import PortfolioTracker from './PortfolioTracker';

import AlertsPanel from './AlertsPanel';

const ActuarialPanel = dynamic(() => import('./ActuarialPanel'), { ssr: false });

import dynamic from 'next/dynamic';

const ExportReport = dynamic(() => import('./ExportReport'), { ssr: false });
const ShareCardModal = dynamic(() => import('./ShareCardModal'), { ssr: false });
const SyncDeviceModal = dynamic(() => import('./SyncDeviceModal'), { ssr: false });
import InfoTooltip from './ui/InfoTooltip';

const BacktestChart = dynamic(() => import('./BacktestChart'), { ssr: false });

const LiquidityPanel = dynamic(() => import('./LiquidityPanel'), { ssr: false });

const SupplyDynamicsPanel = dynamic(() => import('./SupplyDynamicsPanel'), { ssr: false });

const StablecoinDashboard = dynamic(() => import('./StablecoinDashboard'), { ssr: false });

import { Search, AlertTriangle, TrendingDown, TrendingUp, BarChart3, Wifi, WifiOff, Cpu, Code2, LineChart, Share2, Link2, Database, Shield, Wallet, Smartphone, QrCode, Radar, Clock } from 'lucide-react';

import { wsManager } from '@/lib/websocket-manager';

import { useAppStore } from '@/lib/store';
import { getCurrentSessionId, linkDeviceSession, isValidSessionId } from '@/lib/supabase';



const PYTHON_API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';



export default function Dashboard() {

  const { symbol, setSymbol, mode, timeframe, setTimeframe } = useAppSettings();

  const { t } = useLocale();

  const livePriceData = useAppStore(state => state.livePrices[symbol]);
  const addToast = useAppStore(state => state.addToast);



  const [data, setData] = useState<MarketAnalysis | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [searchInput, setSearchInput] = useState(symbol);

  const [activeTab, setActiveTab] = useState<'terminal' | 'onchain' | 'actuarial' | 'portfolio'>('terminal');

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
    const [showSyncModal, setShowSyncModal] = useState(false);
  const [mtfData, setMtfData] = useState<MtfSummaryData | null>(null);
  const [mtfLoading, setMtfLoading] = useState(false);

  const [dataSource, setDataSource] = useState<'binance' | 'coingecko' | 'mock' | 'dexscreener'>('mock');

  const [engineSource, setEngineSource] = useState<'python' | 'js'>('js');

  const [dexSuggestions, setDexSuggestions] = useState<DexScreenerPair[]>([]);

  const [selectedDexPair, setSelectedDexPair] = useState<DexScreenerPair | null>(null);

  const [backtestData, setBacktestData] = useState<BacktestResult | null>(null);



    // Multi-Timeframe (MTF) Confluence Radar fetch
  const loadMtf = useCallback(async () => {
    if (!symbol) return;
    setMtfLoading(true);
    try {
      const res = await fetch(`${PYTHON_API_URL}/api/mtf/${symbol}?mode=${mode}`);
      if (res.ok) {
        const json = await res.json();
        setMtfData(json);
      }
    } catch (e) {
      console.warn('[Dashboard] Error fetching MTF radar:', e);
    } finally {
      setMtfLoading(false);
    }
  }, [symbol, mode]);

  useEffect(() => {
    loadMtf();
    const interval = setInterval(loadMtf, 180000); // 3 minutes cache
    return () => clearInterval(interval);
  }, [loadMtf]);

  // Sincronizacion estricta del active timeframe con Radar MTF
  const currentTfKey = (timeframe === '1S' ? '1s' : timeframe.toLowerCase()) as '15m' | '1h' | '4h' | '1d' | '1s';
  const activeMtfItem = mtfData ? ((mtfData as any)[currentTfKey] || (currentTfKey === '1s' ? (mtfData as any)['1w'] : null)) : null;

  // Evaluacion de confluencia fractal (al menos 3 de 4)
  const alignmentType = useMemo(() => {
    if (!mtfData) return null;
    const tfs: Array<'15m' | '1h' | '4h' | '1d'> = ['15m', '1h', '4h', '1d'];
    let bulls = 0;
    let bears = 0;
    for (const tf of tfs) {
      const item = mtfData[tf];
      if (item) {
        if (item.signal === 'Compra' || item.signal === 'Compra Fuerte' || item.trend === 'bullish') {
          bulls++;
        } else if (item.signal === 'Venta' || item.signal === 'Venta Fuerte' || item.trend === 'bearish') {
          bears++;
        }
      }
    }
    if (bulls >= 3) return 'BULLISH';
    if (bears >= 3) return 'BEARISH';
    return null;
  }, [mtfData]);

  const breakdown = useMemo(() => {

    if (!data) return {
      total: 50,
      momentum: { score: 50, weight: 0.25, details: [] },
      trend: { score: 50, weight: 0.25, details: [] },
      sentiment: { score: 50, weight: 0.25, details: [] },
      onChain: { score: 50, weight: 0.25, details: [] }
    } as any;

    if (data.scoreBreakdown) return data.scoreBreakdown;

    

    // Fallback for purely JS-generated data

    // Cast onChain to any because Python structure differs from JS structure

    return calculateFullScore(data.indicators, data.sentiment, data.onChain as any, data.currentPrice, mode);

  }, [data, mode]);



  // Fetch real price + Fear & Greed and generate analysis (REST Fallback)

  const loadAnalysis = useCallback(async () => {
    const cacheKey = `oracle_cache_${symbol}_${timeframe}_${mode}`;
    const cachedData = localStorage.getItem(cacheKey);
    let hasCache = false;
    
    // 1. Mostrar caché de inmediato si coincide exactamente con la selección actual
    if (cachedData) {
      try { 
        const parsed = JSON.parse(cachedData);
        if (parsed.symbol === symbol && parsed.timeframe === timeframe && parsed.riskMode === mode) {
          setData(parsed);
          hasCache = true;
        }
      } catch(e){}
    }
    
    setIsSyncing(true);
    const syncStartTime = Date.now();

    // Función para carga súper rápida del motor JS local
    const runFastFallback = async () => {
      setEngineSource('js');
      let livePrice: number | undefined;
      let liveChange: number | undefined;
      let liveVolume: number | undefined;

      try {
        let priceData = await fetchBinancePrice(symbol);
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
    };

    // 2. Si NO hay caché fresco exacto, calculamos de inmediato para respuesta en 0ms
    if (!hasCache) {
      await runFastFallback();
    }

    // 3. Ejecutar el análisis del servidor Python en SEGUNDO PLANO
    // Esto no bloquea la UI, y cuando responde (aunque tarde), actualiza los datos.
    fetchPythonAnalysis(symbol, timeframe, mode).then(pythonResult => {
      if (pythonResult && pythonResult.indicators) {
        setEngineSource('python');
        setDataSource(pythonResult.source === 'python' ? 'binance' : 'mock');
        useAppStore.getState().setPrice(symbol, {
          price: pythonResult.currentPrice,
          priceChange24h: pythonResult.priceChange24h,
          volume24h: pythonResult.volume24h,
          source: 'binance',
        });

        Promise.allSettled([
          fetch(`${PYTHON_API_URL}/api/supply/${symbol}`).then(r => r.ok ? r.json() : null),
          fetch(`${PYTHON_API_URL}/api/stablecoins/analysis`).then(r => r.ok ? r.json() : null)
        ]).then(([supplyRes, stablecoinRes]) => {
          if (supplyRes.status === 'fulfilled' && supplyRes.value) {
            pythonResult.supplyDynamics = supplyRes.value;
          }
          if (stablecoinRes.status === 'fulfilled' && stablecoinRes.value) {
            pythonResult.stablecoinAnalysis = stablecoinRes.value;
          }
          
          setData(pythonResult as MarketAnalysis);
          localStorage.setItem(cacheKey, JSON.stringify(pythonResult));
          setIsSyncing(false);
          
          const elapsed = Date.now() - syncStartTime;
          if (elapsed > 2000) {
            addToast({ 
              title: 'Análisis IA Actualizado', 
              message: `Nuevos datos cuantitativos para ${symbol} disponibles`, 
              type: 'success', 
              duration: 15000 
            });
          }
        });
      } else {
        setIsSyncing(false);
      }
    }).catch(() => {
      setIsSyncing(false);
      // Fallback message if it fails
      if (hasCache || !!data) {
         addToast({ 
          title: 'Modo Local Activo', 
          message: 'Servidor Python no disponible. Usando datos guardados / motor algorítmico.', 
          type: 'warning',
          duration: 15000
        });
      }
    });
  }, [symbol, mode, timeframe, selectedDexPair]);



  // Initial load and REST polling

  useEffect(() => {

    fetchTop100(); // Initialize Top 100 on mount

    loadAnalysis();

    const interval = setInterval(loadAnalysis, 300000);

    return () => clearInterval(interval);

  }, [loadAnalysis]);

  // Detectar ?sync_id=... en la URL para vinculación automática de dispositivo
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const params = new URLSearchParams(window.location.search);
      const syncId = params.get('sync_id');

      if (syncId) {
        const currentSession = getCurrentSessionId();
        if (syncId !== currentSession && isValidSessionId(syncId)) {
          addToast({
            title: '📱 Sincronización Automática',
            message: 'Vinculando dispositivo y cargando tus datos...',
            type: 'info'
          });

          // Limpiar la URL primero para evitar bucles
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('sync_id');
          window.history.replaceState({}, document.title, cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : ''));

          setTimeout(() => {
            linkDeviceSession(syncId, true);
          }, 350);
        } else {
          // Limpiar si ya es la misma sesión
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('sync_id');
          window.history.replaceState({}, document.title, cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : ''));
        }
      }
    } catch (err) {
      console.error('[Dashboard] Error al sincronizar desde URL:', err);
    }
  }, [addToast]);



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



    const baseDisplayData = data || {
    symbol,
    name: symbol,
    currentPrice: mounted ? (livePriceData?.price || 0) : 0,
    priceChange24h: mounted ? (livePriceData?.priceChange24h || 0) : 0,
    priceChangePeriod: mounted ? (livePriceData?.priceChange24h || 0) : 0,
    volume24h: mounted ? (livePriceData?.volume24h || 0) : 0,
    volumePeriod: mounted ? (livePriceData?.volume24h || 0) : 0,
    quantScore: 50,
    signal: 'Mantener',
    indicators: {},
    sentiment: { fearGreedIndex: 50, fearGreedLabel: 'Neutral' },
    onChain: {},
    actionableData: null,
    actuarial: null,
    supplyDynamics: null,
    stablecoinAnalysis: null,
    metrics: {}
  } as unknown as MarketAnalysis;

  const displayData = useMemo(() => {
    const score = activeMtfItem ? activeMtfItem.score : baseDisplayData.quantScore;
    const signal = (activeMtfItem ? activeMtfItem.signal : baseDisplayData.signal) as any;
    return {
      ...baseDisplayData,
      quantScore: score,
      signal: signal,
    };
  }, [baseDisplayData, activeMtfItem]);

  
  // BYPASS HYDRATION COMPLETELY for the complex dashboard to prevent browser extensions from causing #310
  if (!mounted) {
    return (
      <div className="flex flex-col gap-6 w-full min-h-[80vh] items-center justify-center" suppressHydrationWarning>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-gold" suppressHydrationWarning></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full pb-20 md:pb-6" id="dashboard-export-area" suppressHydrationWarning>
      {isSyncing && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-yellow-500/30 backdrop-blur-md animate-pulse">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-ping"></div>
          <span className="text-xs font-semibold text-yellow-400">Sincronizando motor cuantitativo...</span>
        </div>
      )}

      {/* Search Bar & Sincronizar Móvil */}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full" data-html2canvas-ignore>

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

                  <span className="flex items-center gap-2">

                    <span className="font-bold">{crypto.symbol}</span>

                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{crypto.name}</span>

                    {crypto.isDex && (

                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#1C1C1C] text-[#E0E0E0] border border-[#333]">

                        DEX

                      </span>

                    )}

                  </span>

                  <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>

                    {'price' in crypto ? `$${formatPrice(crypto.price)}` : ''}

                  </span>

                </button>

              ))}

            </div>

          )}

        </div>

        {/* Botón Sincronizar Móvil */}
        <button
          onClick={() => setShowSyncModal(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all border shadow-sm hover:border-[var(--accent-gold)] shrink-0 group cursor-pointer"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
          title="Sincronizar cuenta anónima con teléfono móvil o PC"
          id="sync-device-btn"
        >
          <Smartphone size={16} className="text-[var(--accent-gold)] group-hover:scale-110 transition-transform" />
          <span>📱 Sincronizar Móvil</span>
        </button>

      </div>



      {/* Click outside to close suggestions (Removed overlay to avoid blocking interaction) */}



      {/* Asset Info Header */}

      <div className="text-center animate-fadeInUp">

        <div className="flex items-center justify-center gap-3 mb-1">

          <h2 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>

            {displayData.symbol}

          </h2>

          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>

            {displayData.name}

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

             : dataSource === 'coingecko' ? '??' 

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

            ${formatPrice(displayData.currentPrice)}

          </span>

          <span

            className="flex items-center gap-1 font-semibold text-xs px-2 py-0.5 rounded"

            style={{

              color: (displayData.priceChangePeriod ?? displayData.priceChange24h) >= 0 ? 'var(--signal-buy)' : 'var(--signal-sell)',

              background: (displayData.priceChangePeriod ?? displayData.priceChange24h) >= 0 ? 'var(--signal-buy-dim)' : 'var(--signal-sell-dim)',

            }}

          >

            {(displayData.priceChangePeriod ?? displayData.priceChange24h) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}

            {(displayData.priceChangePeriod ?? displayData.priceChange24h) >= 0 ? '+' : ''}{(displayData.priceChangePeriod ?? displayData.priceChange24h).toFixed(2)}%

          </span>

          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>

            <BarChart3 size={11} />

            Vol: {(() => {
              const rawVol = (displayData as any).quoteVolume24h ?? ((displayData.volumePeriod ?? displayData.volume24h ?? 0) * (displayData.currentPrice || 1));
              if (rawVol >= 1e9) return `$${(rawVol / 1e9).toFixed(2)}B`;
              if (rawVol >= 1e6) return `$${(rawVol / 1e6).toFixed(2)}M`;
              if (rawVol >= 1e3) return `$${(rawVol / 1e3).toFixed(1)}k`;
              return `$${rawVol.toFixed(0)}`;
            })()}

          </span>

        </div>

      </div>

      {/* RADAR MTF (MULTI-TEMPORALIDAD) CON CAMBIO DE TIMEFRAME INTEGRADO */}
      <div className="flex flex-col items-center justify-center my-3 w-full max-w-4xl mx-auto px-2" data-html2canvas-ignore>
        <div className="flex flex-wrap items-center justify-center gap-2 p-2.5 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md w-full shadow-lg">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-300 mr-2">
            <Radar size={15} className="text-[var(--accent-gold)] animate-pulse" />
            <span className="tracking-wider uppercase text-[11px] text-[var(--accent-gold)]">Radar MTF:</span>
          </div>

          {/* 5 Pildoras Interactivas: 15M, 1H, 4H, 1D, 1S */}
          {([
            { key: '15m' as const, label: '15M' },
            { key: '1h' as const, label: '1H' },
            { key: '4h' as const, label: '4H' },
            { key: '1d' as const, label: '1D' },
            { key: '1s' as const, label: '1S' },
          ]).map(({ key, label }) => {
            const item = mtfData ? (mtfData[key] || (key === '1s' ? (mtfData as any)['1w'] : null)) : null;
            const score = item ? item.score : (timeframe === label ? displayData.quantScore : 50.0);
            const signal = item ? item.signal : (timeframe === label ? displayData.signal : 'Mantener');
            const isBull = signal === 'Compra' || signal === 'Compra Fuerte';
            const isBear = signal === 'Venta' || signal === 'Venta Fuerte';
            const isActive = timeframe === label;

            const pillBg = isBull
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25'
              : isBear
              ? 'bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500/25'
              : 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25';

            return (
              <button
                key={key}
                onClick={() => setTimeframe(label as any)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${pillBg} ${
                  isActive
                    ? 'ring-2 ring-[var(--accent-gold)] shadow-lg shadow-amber-500/20 scale-105'
                    : 'opacity-85 hover:opacity-100 hover:scale-102'
                }`}
                title={`Cambiar gráfico y análisis a ${label} (Score: ${score.toFixed(0)}, Señal: ${signal})`}
                id={`mtf-pill-${label}`}
              >
                <span className="font-mono text-xs font-black">{label}</span>
                <span className="font-mono font-black text-xs px-1.5 py-0.5 rounded bg-black/40">{score.toFixed(0)}</span>
                <span className="text-[10px] uppercase font-semibold">
                  {isBull ? '🟢 Compra' : isBear ? '🔴 Venta' : '⚪ Mantener'}
                </span>
              </button>
            );
          })}

          {/* Badge Destacado: Alineacion Fractal */}
          {alignmentType === 'BULLISH' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-black shadow-lg shadow-emerald-500/20 animate-pulse ml-1">
              <span>🔥 Alineación Fractal Alcista</span>
              <InfoTooltip
                title="Alineación Fractal Alcista"
                description="Al menos 3 de las 4 temporalidades (15m, 1h, 4h, 1d) están en confluencia compradora (EMA 20 > EMA 50 y RSI positivo). La confluencia fractal aumenta drásticamente la probabilidad de continuación de la tendencia."
                howToUse="Busca entradas a favor del flujo institucional mayor en retrocesos hacia soportes o EMAs en temporalidades de 15m o 1h."
                placement="bottom"
              />
            </div>
          )}

          {alignmentType === 'BEARISH' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300 text-xs font-black shadow-lg shadow-red-500/20 animate-pulse ml-1">
              <span>🔥 Alineación Fractal Bajista</span>
              <InfoTooltip
                title="Alineación Fractal Bajista"
                description="Al menos 3 de las 4 temporalidades (15m, 1h, 4h, 1d) están en confluencia vendedora bajo sus medias móviles. La presión de oferta domina en múltiples horizontes temporales."
                howToUse="Evita compras contra tendencia y considera operaciones en corto o toma de beneficios preventivos."
                placement="bottom"
              />
            </div>
          )}
        </div>
      </div>



      <div className="flex justify-center items-center w-full max-w-sm mx-auto mb-2 mt-4">

         <ScoreGauge score={displayData.quantScore} signal={displayData.signal} size={160} />

         <div data-html2canvas-ignore className="ml-4 flex flex-col gap-2">

           <ExportReport data={displayData} />

           <button 
             onClick={() => setShowShareModal(true)}
             className="flex items-center justify-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl shadow-lg transition-all font-bold text-xs uppercase tracking-wider"
             title="Compartir tarjeta gráfica en redes"
             id="share-signal-btn"
           >
             <Share2 size={13} />
             📤 Compartir Señal
           </button>

         </div>

      </div>



      {/* TAB NAVIGATION */}

      <div className="hidden md:flex w-full border-b overflow-x-auto gap-4 px-2 mt-4 mb-6" style={{ borderColor: 'var(--bg-tertiary)' }}>

        <button

          onClick={() => setActiveTab('terminal')}

          className={`flex items-center gap-2 pb-3 px-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'terminal' ? 'border-[var(--accent-gold)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}

        >

          <LineChart size={16} /> <span className="text-sm font-semibold">Terminal</span>

        </button>

        <button

          onClick={() => setActiveTab('onchain')}

          className={`flex items-center gap-2 pb-3 px-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'onchain' ? 'border-[var(--accent-gold)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}

        >

          <Database size={16} /> <span className="text-sm font-semibold">On-Chain & Oferta</span>

        </button>

        <button

          onClick={() => setActiveTab('actuarial')}

          className={`flex items-center gap-2 pb-3 px-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'actuarial' ? 'border-[var(--accent-gold)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}

        >

          <Shield size={16} /> <span className="text-sm font-semibold">Riesgo Actuarial</span>

        </button>

        <button

          onClick={() => setActiveTab('portfolio')}

          className={`flex items-center gap-2 pb-3 px-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'portfolio' ? 'border-[var(--accent-gold)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}

        >

          <Wallet size={16} /> <span className="text-sm font-semibold">Portafolio & Alertas</span>

        </button>

      </div>



      {/* TAB CONTENT: TERMINAL */}

      <div className={activeTab === 'terminal' ? 'flex flex-col gap-6 w-full animate-fadeInUp' : 'hidden'}>

        



        {/* Server-Side Backtest: Equity Curve Chart */}

        {symbol && <BacktestChart symbol={symbol} />}



        {/* Macro Risk Alert */}

        {displayData.actionableData?.macroRisk && displayData.actionableData.macroRisk !== 'macrorisk.floor' && (

          <div

            className="glass-card p-4 flex items-start gap-3"

            style={{

              borderLeft: `3px solid ${displayData.quantScore <= 40 ? 'var(--signal-buy)' : displayData.quantScore >= 60 ? 'var(--signal-sell)' : 'var(--accent-gold)'}`,

            }}

          >

            <AlertTriangle size={16} style={{ color: 'var(--accent-gold)', marginTop: '2px', flexShrink: 0 }} />

            <div>

              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>

                {t('action.macroRisk')}

              </div>

              <div className="text-sm" style={{ color: 'var(--text-primary)' }}>

                {t(displayData.actionableData.macroRisk)}

              </div>

            </div>

          </div>

        )}



        <div className="w-full">

          <CandlestickChart symbol={displayData.symbol} actionableData={displayData.actionableData} />

        </div>



        <div className="w-full">

          <IndicatorGrid breakdown={breakdown} />

        </div>



        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" suppressHydrationWarning>

          <DCAPanel
            actionableData={displayData.actionableData}
            currentPrice={displayData.currentPrice}
            symbol={displayData.symbol}
          />

          <SmartMoneyPanel smartMoney={displayData.smartMoney} currentPrice={displayData.currentPrice} />

          <LiquidityPanel liquidity={displayData.liquidity} />

        </div>



        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <SentimentPanel sentiment={displayData.sentiment} macro={displayData.macro} />

          <AIPanel data={displayData} />

        </div>

      </div>



      {/* TAB CONTENT: ON-CHAIN & OFERTA */}

      <div className={activeTab === 'onchain' ? 'flex flex-col gap-6 w-full animate-fadeInUp' : 'hidden'}>

        <div className="mt-2">

          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>

            Inteligencia On-Chain

          </h2>

          <OnChainDashboard symbol={displayData.symbol} onSymbolChange={setSymbol} />

        </div>



        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <SupplyDynamicsPanel supplyData={displayData.supplyDynamics} />

          <StablecoinDashboard stablecoinData={displayData.stablecoinAnalysis} />

        </div>

      </div>



      {/* TAB CONTENT: RIESGO ACTUARIAL */}

      <div className={activeTab === 'actuarial' ? 'flex flex-col gap-6 w-full animate-fadeInUp' : 'hidden'}>

        <ActuarialPanel actuarial={displayData.actuarial} currentPrice={displayData.currentPrice} />

        

        {displayData.actionableData?.positionSizing && displayData.actionableData.positionSizing.recommendedSizeUSD > 0 && (

          <div className="glass-card p-5 border relative overflow-hidden" style={{ borderColor: 'var(--accent-gold)', background: 'rgba(251, 191, 36, 0.03)' }}>

            <div className="absolute top-0 right-0 p-4 opacity-10">

              <Shield size={64} style={{ color: 'var(--accent-gold)' }} />

            </div>

            <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--accent-gold)' }}>

              <Shield size={20} /> Position Sizing (Grado Institucional)

            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <div className="p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>

                <span className="text-xs block mb-1 uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Tamaño Recomendado</span>

                <span className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>${displayData.actionableData.positionSizing.recommendedSizeUSD}</span>

              </div>

              <div className="p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>

                <span className="text-xs block mb-1 uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>% del Portafolio</span>

                <span className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{displayData.actionableData.positionSizing.portfolioPct}%</span>

              </div>

              <div className="p-4 rounded-xl border border-[var(--signal-sell-dim)]" style={{ background: 'rgba(239, 68, 68, 0.05)' }}>

                <span className="text-xs block mb-1 uppercase tracking-wider font-semibold" style={{ color: 'var(--signal-sell)' }}>Pérdida Máxima Tolerable (VaR 95%)</span>

                <span className="text-2xl font-black" style={{ color: 'var(--signal-sell)' }}>${displayData.actionableData.positionSizing.maxRiskUSD}</span>

              </div>

            </div>

            <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>

              Basado en el Criterio de <strong>Fractional Kelly</strong> (crecimiento compuesto) y limitado por el <strong>Value at Risk (VaR 95%)</strong> del modelo estocástico sobre un portafolio simulado de $10,000 USD.

            </p>

          </div>

        )}

      </div>



      {/* TAB CONTENT: PORTAFOLIO & ALERTAS */}

      <div className={activeTab === 'portfolio' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 w-full animate-fadeInUp' : 'hidden'}>

        <div className="flex flex-col gap-6">

          <WatchlistPanel />

          <AlertsPanel />

        </div>

        <div className="flex flex-col gap-6">

          <PortfolioTracker />

        </div>

      </div>

      {/* MODALS */}
      <SyncDeviceModal 
        isOpen={showSyncModal} 
        onClose={() => setShowSyncModal(false)} 
      />

      <ShareCardModal 
        isOpen={showShareModal} 
        onClose={() => setShowShareModal(false)} 
        data={displayData} 
      />

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div 
        data-html2canvas-ignore 
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around py-2 px-2 border-t backdrop-blur-xl shadow-2xl"
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.1)'
        }}
      >
        <button
          onClick={() => setActiveTab('terminal')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === 'terminal' ? 'text-[var(--accent-gold)] font-bold' : 'text-gray-400 hover:text-white'}`}
        >
          <LineChart size={18} />
          <span className="text-[10px]">Terminal</span>
        </button>
        <button
          onClick={() => setActiveTab('onchain')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === 'onchain' ? 'text-[var(--accent-gold)] font-bold' : 'text-gray-400 hover:text-white'}`}
        >
          <Database size={18} />
          <span className="text-[10px]">On-Chain</span>
        </button>
        <button
          onClick={() => setActiveTab('actuarial')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === 'actuarial' ? 'text-[var(--accent-gold)] font-bold' : 'text-gray-400 hover:text-white'}`}
        >
          <Shield size={18} />
          <span className="text-[10px]">Riesgo</span>
        </button>
        <button
          onClick={() => setActiveTab('portfolio')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === 'portfolio' ? 'text-[var(--accent-gold)] font-bold' : 'text-gray-400 hover:text-white'}`}
        >
          <Wallet size={18} />
          <span className="text-[10px]">Portafolio</span>
        </button>
        <button
          onClick={() => setShowSyncModal(true)}
          className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all text-amber-400 hover:text-amber-300"
          title="Sincronizar Dispositivo"
        >
          <Smartphone size={18} />
          <span className="text-[10px]">Sincronizar</span>
        </button>
      </div>

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



















