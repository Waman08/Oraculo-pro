// ============================================================
// API — Multi-Exchange: Binance (primario) + CoinGecko (fallback)
// ============================================================

export interface BinanceTickerData {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

export interface LivePriceData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  source: 'binance' | 'coingecko' | 'mock' | 'dexscreener';
}

export interface FearGreedData {
  value: number;
  classification: string;
  classificationES: string;
}

// ---- Mapeo de símbolos a pares de Binance ----

export const BINANCE_PAIR_MAP: Record<string, string> = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', BNB: 'BNBUSDT', SOL: 'SOLUSDT',
  XRP: 'XRPUSDT', ADA: 'ADAUSDT', AVAX: 'AVAXUSDT', DOT: 'DOTUSDT',
  LINK: 'LINKUSDT', MATIC: 'MATICUSDT', UNI: 'UNIUSDT', ATOM: 'ATOMUSDT',
  FIL: 'FILUSDT', APT: 'APTUSDT', ARB: 'ARBUSDT', OP: 'OPUSDT',
  INJ: 'INJUSDT', SUI: 'SUIUSDT', NEAR: 'NEARUSDT', DOGE: 'DOGEUSDT',
  SHIB: 'SHIBUSDT', PEPE: 'PEPEUSDT', WIF: 'WIFUSDT', FLOKI: 'FLOKIUSDT',
  BONK: 'BONKUSDT', AAVE: 'AAVEUSDT', MKR: 'MKRUSDT', CRV: 'CRVUSDT',
  LDO: 'LDOUSDT', RENDER: 'RENDERUSDT', FET: 'FETUSDT', RNDR: 'RNDRUSDT',
  TAO: 'TAOUSDT', IMX: 'IMXUSDT', GALA: 'GALAUSDT', AXS: 'AXSUSDT',
  SAND: 'SANDUSDT', MANA: 'MANAUSDT', FLOW: 'FLOWUSDT', EIGEN: 'EIGENUSDT',
  SEI: 'SEIUSDT', STRK: 'STRKUSDT', TIA: 'TIAUSDT', ALGO: 'ALGOUSDT',
  VET: 'VETUSDT', HBAR: 'HBARUSDT', FTM: 'FTMUSDT', RUNE: 'RUNEUSDT',
  DYDX: 'DYDXUSDT', SNX: 'SNXUSDT',
  // Tokens adicionales en Binance
  PENDLE: 'PENDLEUSDT', JUP: 'JUPUSDT', W: 'WUSDT', ONDO: 'ONDOUSDT',
  PYTH: 'PYTHUSDT', JTO: 'JTOUSDT', BLUR: 'BLURUSDT', WLD: 'WLDUSDT',
  ENA: 'ENAUSDT', ETHFI: 'ETHFIUSDT', BOME: 'BOMEUSDT', MEME: 'MEMEUSDT',
  AERO: 'AEROUSDT', POPCAT: 'POPCATUSDT',
};

// Reverse map (BTCUSDT -> BTC)
export const REVERSE_PAIR_MAP: Record<string, string> = {};
for (const [sym, pair] of Object.entries(BINANCE_PAIR_MAP)) {
  REVERSE_PAIR_MAP[pair] = sym;
}

// ---- Mapeo de símbolos a CoinGecko IDs ----
// CoinGecko usa IDs de texto como "bitcoin", "ethereum", "hyperliquid"

const COINGECKO_ID_MAP: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', SOL: 'solana',
  XRP: 'ripple', ADA: 'cardano', AVAX: 'avalanche-2', DOT: 'polkadot',
  LINK: 'chainlink', MATIC: 'matic-network', UNI: 'uniswap', ATOM: 'cosmos',
  FIL: 'filecoin', APT: 'aptos', ARB: 'arbitrum', OP: 'optimism',
  INJ: 'injective-protocol', SUI: 'sui', NEAR: 'near', DOGE: 'dogecoin',
  SHIB: 'shiba-inu', PEPE: 'pepe', WIF: 'dogwifcoin', FLOKI: 'floki',
  BONK: 'bonk', AAVE: 'aave', MKR: 'maker', CRV: 'curve-dao-token',
  LDO: 'lido-dao', RENDER: 'render-token', FET: 'fetch-ai', RNDR: 'render-token',
  TAO: 'bittensor', IMX: 'immutable-x', GALA: 'gala', AXS: 'axie-infinity',
  SAND: 'the-sandbox', MANA: 'decentraland', FLOW: 'flow', EIGEN: 'eigenlayer',
  SEI: 'sei-network', STRK: 'starknet', TIA: 'celestia', ALGO: 'algorand',
  VET: 'vechain', HBAR: 'hedera-hashgraph', FTM: 'fantom', RUNE: 'thorchain',
  DYDX: 'dydx', SNX: 'havven',
  // === Tokens NO disponibles en Binance ===
  HYPE: 'hyperliquid', PENDLE: 'pendle', JUP: 'jupiter-exchange-solana',
  W: 'wormhole', ONDO: 'ondo-finance', PYTH: 'pyth-network',
  JTO: 'jito-governance-token', BLUR: 'blur', WLD: 'worldcoin-wld',
  ENA: 'ethena', ETHFI: 'ether-fi', BOME: 'book-of-meme',
  MEME: 'memecoin-2', POPCAT: 'popcat', AERO: 'aerodrome-finance',
  XMR: 'monero', ZEC: 'zcash', TON: 'the-open-network', KAS: 'kaspa', NOT: 'notcoin',
};

// Reverse map para CoinGecko
export const REVERSE_COINGECKO_MAP: Record<string, string> = {};
for (const [sym, id] of Object.entries(COINGECKO_ID_MAP)) {
  REVERSE_COINGECKO_MAP[id] = sym;
}

// ============================================================
// BINANCE — Funciones de precio
// ============================================================

/**
 * Fetch a single ticker's live data from Binance
 */
async function fetchBinancePriceDirect(symbol: string): Promise<LivePriceData | null> {
  const pair = BINANCE_PAIR_MAP[symbol.toUpperCase()];
  if (!pair) return null;

  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`);
    if (!res.ok) return null;

    const data: BinanceTickerData = await res.json();
    return {
      price: parseFloat(data.lastPrice),
      priceChange24h: parseFloat(data.priceChangePercent),
      volume24h: parseFloat(data.quoteVolume),
      source: 'binance',
    };
  } catch {
    return null;
  }
}

// ============================================================
// COINGECKO — Funciones de precio (fallback)
// ============================================================

/**
 * Fetch a single ticker from CoinGecko
 */
async function fetchCoinGeckoPriceDirect(symbol: string): Promise<LivePriceData | null> {
  const id = COINGECKO_ID_MAP[symbol.toUpperCase()];
  if (!id) return null;

  try {
    // Try proxy first (avoids CORS in browser)
    let res = await fetch(`/api/coingecko?id=${id}`);
    
    if (!res.ok) {
      // Fallback to direct API (works in SSR/Node)
      res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`
      );
    }
    
    if (!res.ok) return null;

    const data = await res.json();
    const coinData = data[id];
    if (!coinData) return null;

    return {
      price: coinData.usd ?? 0,
      priceChange24h: coinData.usd_24h_change ?? 0,
      volume24h: coinData.usd_24h_vol ?? 0,
      source: 'coingecko',
    };
  } catch {
    return null;
  }
}

// ============================================================
// FUNCIONES PÚBLICAS — Intentan Binance primero, CoinGecko como fallback
// ============================================================

/**
 * Fetch price for a single symbol. 
 * Strategy: Binance → CoinGecko → null
 */
export async function fetchBinancePrice(symbol: string): Promise<LivePriceData | null> {
  const sym = symbol.toUpperCase();
  
  // 1. Try Binance first (faster, more reliable for listed tokens)
  const binanceData = await fetchBinancePriceDirect(sym);
  if (binanceData) return binanceData;

  // 2. Fallback to CoinGecko for tokens not on Binance
  const geckoData = await fetchCoinGeckoPriceDirect(sym);
  if (geckoData) return geckoData;

  return null;
}

/**
 * Fetch ALL tickers from Binance in a single batch + CoinGecko for missing ones
 * Returns a Map<OUR_SYMBOL, LivePriceData>
 */
export async function fetchAllBinancePrices(): Promise<Map<string, LivePriceData>> {
  const result = new Map<string, LivePriceData>();

  // 1. Batch fetch from Binance (single request for all Binance-listed tokens)
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');

    if (res.ok) {
      const data: BinanceTickerData[] = await res.json();
      for (const ticker of data) {
        const ourSymbol = REVERSE_PAIR_MAP[ticker.symbol];
        if (ourSymbol) {
          result.set(ourSymbol, {
            price: parseFloat(ticker.lastPrice),
            priceChange24h: parseFloat(ticker.priceChangePercent),
            volume24h: parseFloat(ticker.quoteVolume),
            source: 'binance',
          });
        }
      }
    }
  } catch {
    // Binance batch failed — will try CoinGecko for everything
  }

  // 2. Find symbols that we have in our DB but didn't get from Binance
  const allKnownSymbols = Object.keys(COINGECKO_ID_MAP);
  const missingSymbols = allKnownSymbols.filter(s => !result.has(s));

  if (missingSymbols.length > 0) {
    // Batch fetch from CoinGecko (single request for all missing tokens)
    const geckoIds = missingSymbols
      .map(s => COINGECKO_ID_MAP[s])
      .filter(Boolean);

    if (geckoIds.length > 0) {
      try {
        const idsParam = geckoIds.join(',');
        let res = await fetch(`/api/coingecko?ids=${encodeURIComponent(idsParam)}`);
        
        if (!res.ok) {
          res = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(idsParam)}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`
          );
        }

        if (res.ok) {
          const data = await res.json();
          for (const [geckoId, coinData] of Object.entries(data)) {
            const sym = REVERSE_COINGECKO_MAP[geckoId];
            if (sym && coinData && typeof coinData === 'object') {
              const cd = coinData as { usd?: number; usd_24h_change?: number; usd_24h_vol?: number };
              result.set(sym, {
                price: cd.usd ?? 0,
                priceChange24h: cd.usd_24h_change ?? 0,
                volume24h: cd.usd_24h_vol ?? 0,
                source: 'coingecko',
              });
            }
          }
        }
      } catch {
        // CoinGecko batch failed — these will show mock data
      }
    }
  }

  return result;
}

/**
 * Fetch Fear & Greed Index (via our proxy API route or directly)
 */
export async function fetchFearGreedIndex(): Promise<FearGreedData | null> {
  try {
    // Try our proxy first (works in production behind same origin)
    const res = await fetch('/api/fear-greed');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Proxy failed, try direct API
  }

  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.data || data.data.length === 0) return null;

    const entry = data.data[0];
    const value = parseInt(entry.value, 10);
    const classification = entry.value_classification;

    let classificationES: string;
    switch (classification) {
      case 'Extreme Fear': classificationES = 'Miedo Extremo'; break;
      case 'Fear': classificationES = 'Miedo'; break;
      case 'Neutral': classificationES = 'Neutral'; break;
      case 'Greed': classificationES = 'Codicia'; break;
      case 'Extreme Greed': classificationES = 'Codicia Extrema'; break;
      default: classificationES = 'Neutral';
    }

    return { value, classification, classificationES };
  } catch {
    return null;
  }
}

/**
 * Fetch klines (candlestick data) — Binance primary
 * CoinGecko doesn't offer OHLC in free tier with same format, so klines
 * are only available for Binance-listed tokens.
 */
export async function fetchKlines(
  symbol: string,
  interval: string = '1h',
  limit: number = 48,
): Promise<number[][] | null> {
  const pair = BINANCE_PAIR_MAP[symbol.toUpperCase()];
  if (!pair) return null;

  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Check if a symbol exists on Binance
 */
export function isBinanceSupported(symbol: string): boolean {
  return symbol.toUpperCase() in BINANCE_PAIR_MAP;
}

/**
 * Check if a symbol exists on CoinGecko
 */
export function isCoinGeckoSupported(symbol: string): boolean {
  return symbol.toUpperCase() in COINGECKO_ID_MAP;
}

/**
 * Check if we can get price for a symbol from any source
 */
export function isAnyExchangeSupported(symbol: string): boolean {
  return isBinanceSupported(symbol) || isCoinGeckoSupported(symbol);
}

/**
 * Get all supported symbols (from both exchanges)
 */
export function getSupportedSymbols(): string[] {
  return Array.from(new Set([...Object.keys(BINANCE_PAIR_MAP), ...Object.keys(COINGECKO_ID_MAP)]));
}

// ============================================================
// PYTHON BACKEND — Real Quantitative Analysis
// ============================================================

const PYTHON_API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';

/**
 * Fetch dynamic symbols from the Python backend and merge them into the local maps.
 * This replaces the hardcoded top 64 with the entire Binance USDT universe (400+ pairs).
 */
export async function initializeDynamicSymbols(): Promise<void> {
  try {
    const res = await fetch(`${PYTHON_API_URL}/api/symbols`);
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.symbols && Array.isArray(data.symbols)) {
      data.symbols.forEach((s: any) => {
        BINANCE_PAIR_MAP[s.symbol] = s.pair;
        REVERSE_PAIR_MAP[s.pair] = s.symbol;
      });
      console.log(`[API] Cargados ${data.count} símbolos dinámicos desde el backend.`);
    }
  } catch {
    console.warn('[API] Backend no disponible para símbolos dinámicos. Usando lista estática.');
  }
}

/**
 * Fetch full analysis from the Python backend (real indicators via pandas-ta).
 * Returns null if the backend is unavailable — caller should fallback to JS engine.
 */
export async function fetchPythonAnalysis(
  symbol: string,
  timeframe: string = '1D',
  mode: string = 'Balanceado',
): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for complex analysis

    // Obtener UUID del usuario para personalización anónima
    const userId = typeof window !== 'undefined' ? localStorage.getItem('user_uuid') : null;
    const headers: Record<string, string> = {};
    if (userId) {
      headers['X-User-ID'] = userId;
    }

    const res = await fetch(
      `${PYTHON_API_URL}/api/analyze/${symbol.toUpperCase()}?timeframe=${timeframe}&mode=${mode}`,
      { 
        signal: controller.signal,
        headers 
      }
    );
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Backend unavailable — silent fallback
    return null;
  }
}

/**
 * Fetch screener data from the Python backend.
 * Returns array of ScreenerEntry objects from real quantitative analysis.
 */
export async function fetchPythonScreener(
  timeframe: string = '1D',
  mode: string = 'Balanceado',
  limit: number = 50,
): Promise<any[] | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s for screener (many symbols)

    const userId = typeof window !== 'undefined' ? localStorage.getItem('user_uuid') : null;
    const headers: Record<string, string> = {};
    if (userId) {
      headers['X-User-ID'] = userId;
    }

    const res = await fetch(
      `${PYTHON_API_URL}/api/screener?timeframe=${timeframe}&mode=${mode}&limit=${limit}`,
      { 
        signal: controller.signal,
        headers 
      }
    );
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Check if the Python backend is running.
 */
export async function checkPythonBackendHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${PYTHON_API_URL}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

// ============================================================
// TOP 100 Y DEXSCREENER DYNAMICS
// ============================================================

export async function fetchTop100(): Promise<void> {
  try {
    const res = await fetch('/api/coingecko/top');
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data)) {
      data.forEach((coin: any) => {
        const sym = coin.symbol.toUpperCase();
        if (!BINANCE_PAIR_MAP[sym]) {
          // Add to COINGECKO_ID_MAP only if not in Binance to avoid duplicates
          COINGECKO_ID_MAP[sym] = coin.id;
          REVERSE_COINGECKO_MAP[coin.id] = sym;
        }
      });
      console.log(`[API] Loaded Top 100 coins.`);
    }
  } catch (err) {
    console.error('[API] Error fetching Top 100:', err);
  }
}

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd: string;
  volume: { h24: number };
  priceChange: { h24?: number };
}

export async function searchDexScreener(query: string): Promise<DexScreenerPair[]> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.pairs || [];
  } catch {
    return [];
  }
}
