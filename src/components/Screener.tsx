"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { fetchPythonScreener } from '@/lib/api';
import type { Signal, ScreenerEntry } from '@/types';
import { CRYPTO_DATABASE } from '@/lib/mock-data';
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

// Helper to categorize tokens
const SECTOR_MAP: Record<string, string> = {
  // Layer 1
  BTC: 'Layer 1', ETH: 'Layer 1', SOL: 'Layer 1', BNB: 'Layer 1', ADA: 'Layer 1', AVAX: 'Layer 1',
  DOT: 'Layer 1', NEAR: 'Layer 1', SUI: 'Layer 1', APT: 'Layer 1', SEI: 'Layer 1', KAS: 'Layer 1',
  TRX: 'Layer 1', ATOM: 'Layer 1', FTM: 'Layer 1', ALGO: 'Layer 1', HBAR: 'Layer 1', INJ: 'Layer 1',
  ICP: 'Layer 1', TIA: 'Layer 1', TON: 'Layer 1', EGLD: 'Layer 1', FLOW: 'Layer 1', MINA: 'Layer 1',
  XTZ: 'Layer 1', EOS: 'Layer 1', KSM: 'Layer 1',
  // Layer 2
  ARB: 'Layer 2', OP: 'Layer 2', MATIC: 'Layer 2', POL: 'Layer 2', STRK: 'Layer 2', MANTA: 'Layer 2',
  METIS: 'Layer 2', BLAST: 'Layer 2', ZK: 'Layer 2', IMX: 'Layer 2',
  // AI & Big Data
  RENDER: 'AI & Big Data', FET: 'AI & Big Data', TAO: 'AI & Big Data', AGIX: 'AI & Big Data',
  OCEAN: 'AI & Big Data', GRT: 'AI & Big Data', WLD: 'AI & Big Data', AR: 'AI & Big Data',
  THETA: 'AI & Big Data', AKT: 'AI & Big Data', JASMY: 'AI & Big Data', IO: 'AI & Big Data',
  // DeFi
  UNI: 'DeFi', AAVE: 'DeFi', MKR: 'DeFi', LDO: 'DeFi', CRV: 'DeFi', SNX: 'DeFi', PENDLE: 'DeFi',
  CAKE: 'DeFi', JUP: 'DeFi', RAY: 'DeFi', COMP: 'DeFi', SUSHI: 'DeFi', DYDX: 'DeFi', RUNE: 'DeFi',
  ENA: 'DeFi', '1INCH': 'DeFi',
  // Memecoins
  DOGE: 'Memecoins', SHIB: 'Memecoins', PEPE: 'Memecoins', WIF: 'Memecoins', BONK: 'Memecoins',
  FLOKI: 'Memecoins', BOME: 'Memecoins', MEME: 'Memecoins', POPCAT: 'Memecoins', BRETT: 'Memecoins',
  MEW: 'Memecoins', TURBO: 'Memecoins', NEIRO: 'Memecoins', PUMP: 'Memecoins',
  // Gaming
  GALA: 'Gaming', AXS: 'Gaming', SAND: 'Gaming', MANA: 'Gaming', ILV: 'Gaming', RONIN: 'Gaming',
  BEAM: 'Gaming', PIXEL: 'Gaming', YGG: 'Gaming', PORTAL: 'Gaming',
  // RWA & Oracles
  LINK: 'RWA & Oracles', PYTH: 'RWA & Oracles', ONDO: 'RWA & Oracles', OM: 'RWA & Oracles',
  CHR: 'RWA & Oracles', TRU: 'RWA & Oracles', PAXG: 'RWA & Oracles', XAUT: 'RWA & Oracles'
};

const STABLE_PAIRS = new Set([
  'USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'EURUSDT', 'BUSDUSDT', 
  'DAIUSDT', 'USDEUSDT', 'USDDUSDT', 'AEURUSDT', 'EURIUSDT', 'BFUSDUSDT', 'RWUSDUSDT'
]);

export default function Screener() {
  const { timeframe, mode, setSymbol, setActiveTab } = useAppSettings();
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
    let hasCache = false;
    if (cachedData && data.length === 0) {
      try {
        setData(JSON.parse(cachedData));
        hasCache = true;
      } catch {}
    }

    setIsLoading(true);

    const runEmpiricalScreener = async () => {
      try {
        // Fetch 24hr tickers en una sola peticion ultra-rapida a Binance Vision
        let res: Response | null = null;
        try {
          res = await fetch('https://data-api.binance.vision/api/v3/ticker/24hr');
        } catch {
          try {
            res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
          } catch {}
        }

        if (!res || !res.ok) {
          throw new Error('Binance ticker fetch failed');
        }

        const tickers: any[] = await res.json();
        const tickerMap = new Map<string, any>();
        for (const t of tickers) {
          tickerMap.set(t.symbol, t);
        }

        // 1. Obtener la variacion de Bitcoin como benchmark
        const btc = tickerMap.get('BTCUSDT');
        const btcChange = btc ? parseFloat(btc.priceChangePercent || '0') : 0;

        // 2. Armar universo Top 100 de criptoactivos:
        // Primero aseguramos los 65 activos curados de CRYPTO_DATABASE
        const symbolSet = new Set<string>();
        const targetList: Array<{ symbol: string; name: string; sector: string }> = [];

        for (const c of CRYPTO_DATABASE) {
          symbolSet.add(c.symbol);
          let sectorName = 'Otros';
          if (c.category === 'layer1') sectorName = 'Layer 1';
          else if (c.category === 'layer2') sectorName = 'Layer 2';
          else if (c.category === 'defi') sectorName = 'DeFi';
          else if (c.category === 'ai') sectorName = 'AI & Big Data';
          else if (c.category === 'meme') sectorName = 'Memecoins';
          else if (c.category === 'gaming') sectorName = 'Gaming';
          else if (c.category === 'infrastructure') sectorName = 'RWA & Oracles';
          else if (SECTOR_MAP[c.symbol]) sectorName = SECTOR_MAP[c.symbol];

          targetList.push({ symbol: c.symbol, name: c.name, sector: sectorName });
        }

        // Rellenar con los pares USDT mas liquidos hasta llegar a 100 activos
        const sortedUsdt = tickers
          .filter(t => t.symbol.endsWith('USDT') && !STABLE_PAIRS.has(t.symbol) && !t.symbol.includes('UP') && !t.symbol.includes('DOWN'))
          .sort((a, b) => parseFloat(b.quoteVolume || '0') - parseFloat(a.quoteVolume || '0'));

        for (const t of sortedUsdt) {
          if (targetList.length >= 100) break;
          const clean = t.symbol.replace(/USDT$/i, '');
          if (!symbolSet.has(clean) && clean.length <= 8 && !clean.includes('BUSD') && !clean.includes('DAI')) {
            symbolSet.add(clean);
            targetList.push({
              symbol: clean,
              name: clean,
              sector: SECTOR_MAP[clean] || 'Otros'
            });
          }
        }

        // 3. Calculo Cuantitativo Empirico de Alta Dispersion (15 a 90)
        const entries: ScreenerEntry[] = [];

        for (const item of targetList) {
          const t = tickerMap.get(`${item.symbol}USDT`) || tickerMap.get(item.symbol);
          if (!t) continue;

          const lastPrice = parseFloat(t.lastPrice || '0');
          const highPrice = parseFloat(t.highPrice || '0');
          const lowPrice = parseFloat(t.lowPrice || '0');
          const priceChange = parseFloat(t.priceChangePercent || '0');
          const quoteVol = parseFloat(t.quoteVolume || '0');

          if (lastPrice <= 0) continue;

          // A) Posicion en el rango intradiario de 24h: [0.0, 1.0]
          const range = highPrice - lowPrice;
          const rangePos = range > 0 ? Math.max(0, Math.min(1, (lastPrice - lowPrice) / range)) : 0.5;

          // B) Estimacion de RSI intradiario realista (12 a 88)
          const momentum = Math.max(-25, Math.min(25, priceChange * 2.2));
          const rsiRaw = 50 + (rangePos - 0.5) * 42 + momentum * 0.85;
          const rsi = Math.round(Math.max(12, Math.min(88, rsiRaw)));

          // C) Impulso relativo vs Bitcoin (Alpha)
          const alphaBtc = priceChange - btcChange;
          const alphaScore = 50 + Math.max(-28, Math.min(28, alphaBtc * 3.2));

          // D) Score del rango de precio
          const rangeScore = rangePos * 100;

          // E) Score de volumen relativo en escala logaritmica
          const logVol = Math.log10(Math.max(1e5, quoteVol));
          const volScore = Math.min(95, Math.max(25, (logVol - 5) * 14 + 40));

          // F) Integracion ponderada del Quant Score
          let rawScore = (rangeScore * 0.32) + (alphaScore * 0.30) + ((100 - Math.abs(rsi - 50) * 1.4) * 0.20) + (volScore * 0.18);

          // Bonificacion por ruptura alcista con rango superior
          if (priceChange > 3.0 && rangePos > 0.70) {
            rawScore += 9;
          }
          if (priceChange > 6.0 && rangePos > 0.80) {
            rawScore += 5;
          }
          // Bonificacion por fuerte alpha positivo frente a BTC
          if (alphaBtc > 4.5) {
            rawScore += 4;
          }

          // Oportunidad de reversion a la media por sobreventa intradiaria profunda con volumen
          if (rsi < 34 && quoteVol > 1e7) {
            rawScore += (34 - rsi) * 0.85;
          }

          // Penalizacion severa por desplome continuo cerca de minimos
          if (priceChange < -4.5 && rangePos < 0.25) {
            rawScore -= 12;
          }
          if (alphaBtc < -5.0) {
            rawScore -= 6;
          }

          // Calibracion por modo de riesgo
          if (mode === 'Seguro') {
            rawScore = 50 + (rawScore - 50) * 0.8;
          } else if (mode === 'Agresivo') {
            rawScore = 50 + (rawScore - 50) * 1.15;
          }

          const quantScore = Number(Math.max(15.0, Math.min(89.5, rawScore)).toFixed(1));

          // Clasificacion estricta de senales
          let signal: Signal = 'Mantener';
          if (quantScore >= 75) {
            signal = 'Compra Fuerte';
          } else if (quantScore >= 60) {
            signal = 'Compra';
          } else if (quantScore <= 25) {
            signal = 'Venta Fuerte';
          } else if (quantScore <= 40) {
            signal = 'Venta';
          }

          // Sparkline dinamica sintetica de 7 puntos simulando el arco de 24h
          const p1 = Number((lastPrice - (lastPrice * (priceChange / 100))).toFixed(4));
          const pMin = lowPrice;
          const pMax = highPrice;
          const pMid = Number(((pMin + pMax) / 2).toFixed(4));
          const sparklineData = [
            p1,
            Number((p1 * 0.6 + pMin * 0.4).toFixed(4)),
            pMin,
            pMid,
            Number((pMax * 0.8 + pMid * 0.2).toFixed(4)),
            pMax,
            lastPrice
          ];

          entries.push({
            rank: 0,
            symbol: item.symbol,
            name: item.name,
            sector: item.sector,
            price: lastPrice,
            priceChange24h: priceChange,
            quantScore,
            signal,
            volume24h: quoteVol,
            rsi,
            priceChangePeriod: priceChange,
            volumePeriod: quoteVol,
            sparklineData
          });
        }

        // Ordenar inicialmente por Quant Score descendente
        entries.sort((a, b) => b.quantScore - a.quantScore);
        entries.forEach((r, i) => { r.rank = i + 1; });

        setData(entries);
        localStorage.setItem(cacheKey, JSON.stringify(entries));
        setLastUpdate(new Date());
      } catch (e) {
        console.error('[Screener] Error generating empirical screener:', e);
      } finally {
        setIsLoading(false);
      }
    };

    if (!hasCache) {
      await runEmpiricalScreener();
    } else {
      runEmpiricalScreener();
    }

    // Si el servidor Python esta disponible en background, traer su version sincronizada
    fetchPythonScreener(timeframe, mode, 100).then(screenerData => {
      if (screenerData && Array.isArray(screenerData) && screenerData.length > 0) {
        setData(screenerData);
        localStorage.setItem(cacheKey, JSON.stringify(screenerData));
        setLastUpdate(new Date());
      }
    }).catch(() => {
      // Mantener el calculo empirico del cliente sin errores
    });
  }, [timeframe, mode]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Actualizacion cada 1 minuto
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

    // Busqueda por simbolo o nombre
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.symbol.toLowerCase().includes(q) || 
        (item.name && item.name.toLowerCase().includes(q))
      );
    }

    // Filtro por Sector
    if (sectorFilter !== 'all') {
      filtered = filtered.filter((item) => item.sector === sectorFilter);
    }

    // Filtros Alpha Institucionales
    if (alphaFilter === 'confluence') {
      // 💎 Confluencia Compra: Alta probabilidad con buen score sin sobrecompra extrema
      filtered = filtered.filter(item => (item.quantScore || 0) >= 65 && (item.rsi || 50) <= 65);
    } else if (alphaFilter === 'oversold') {
      // ⚡ Sobreventa Extrema: Suelo intradiario para rebote cuantitativo
      filtered = filtered.filter(item => (item.rsi || 50) <= 38);
    } else if (alphaFilter === 'overbought') {
      // ⚠️ Sobrecompra / Riesgo
      filtered = filtered.filter(item => (item.rsi || 50) >= 68 || (item.quantScore || 50) <= 35);
    } else if (alphaFilter === 'volume') {
      // 🔥 Mayor Volumen (Top 20 mas negociadas)
      filtered = filtered.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0)).slice(0, 20);
    }

    // Ordenamiento
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
            <button onClick={() => fetchData()} className="hover:text-[var(--text-primary)] transition-colors" title="Actualizar datos">
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

      {/* Sector Filters */}
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
          <div className="min-w-[760px]">
            {/* Header */}
            <div
              className="grid gap-2 px-4 py-3 text-xs font-bold tracking-wider uppercase bg-black/20 select-none"
              style={{
                gridTemplateColumns: '45px 1.4fr 125px 105px 75px 75px 130px',
                borderBottom: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
              }}
            >
              <div className="text-center cursor-default">Rank</div>
              <div className="cursor-pointer hover:text-white group flex items-center gap-1" onClick={() => handleSort('symbol')}>
                {t('screener.symbol') || 'Símbolo'} <SortIcon col="symbol" />
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
                    gridTemplateColumns: '45px 1.4fr 125px 105px 75px 75px 130px',
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
                    {entry.sector && entry.sector !== 'Otros' && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-gray-400 hidden md:inline">
                        {entry.sector}
                      </span>
                    )}
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
                      color: (entry.rsi || 50) < 35 ? 'var(--signal-buy)' : (entry.rsi || 50) > 68 ? 'var(--signal-sell)' : 'var(--text-secondary)',
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
                    Cargando screener cuantitativo top 100...
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
  if (score >= 75) return '#10B981'; // Compra fuerte (Verde brillante)
  if (score >= 60) return '#34D399'; // Compra (Esmeralda)
  if (score <= 25) return '#EF4444'; // Venta fuerte (Rojo vivo)
  if (score <= 40) return '#F87171'; // Venta (Rojo suave)
  return '#F59E0B'; // Mantener (Ambar)
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
