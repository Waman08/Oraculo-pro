// ============================================================
// MOCK DATA — Datos Simulados Realistas para 100+ Criptos
// ============================================================

import type {
  FullIndicatorSet, SentimentData, OnChainData,
  SmartMoneyData, MacroData, Timeframe, ScreenerEntry, Signal
} from '@/types';
import { calculateFullScore } from '@/lib/ml-engine';
import { getSignalFromScore } from '@/lib/scoring-utils';

// ---- Base de datos de criptomonedas ----

export interface CryptoBase {
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  category: 'layer1' | 'defi' | 'meme' | 'layer2' | 'infrastructure' | 'gaming' | 'ai';
}

export const CRYPTO_DATABASE: CryptoBase[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: 69015, marketCap: 1350000000000, volume24h: 28000000000, priceChange24h: -2.3, category: 'layer1' },
  { symbol: 'ETH', name: 'Ethereum', price: 3485, marketCap: 418000000000, volume24h: 15000000000, priceChange24h: -1.8, category: 'layer1' },
  { symbol: 'BNB', name: 'BNB', price: 598, marketCap: 89000000000, volume24h: 1200000000, priceChange24h: 0.5, category: 'layer1' },
  { symbol: 'SOL', name: 'Solana', price: 142, marketCap: 63000000000, volume24h: 2500000000, priceChange24h: -3.2, category: 'layer1' },
  { symbol: 'XRP', name: 'Ripple', price: 0.52, marketCap: 28000000000, volume24h: 1100000000, priceChange24h: -0.8, category: 'layer1' },
  { symbol: 'ADA', name: 'Cardano', price: 0.45, marketCap: 16000000000, volume24h: 400000000, priceChange24h: -1.5, category: 'layer1' },
  { symbol: 'AVAX', name: 'Avalanche', price: 35.2, marketCap: 13000000000, volume24h: 550000000, priceChange24h: -4.1, category: 'layer1' },
  { symbol: 'DOT', name: 'Polkadot', price: 6.8, marketCap: 9500000000, volume24h: 300000000, priceChange24h: -2.7, category: 'layer1' },
  { symbol: 'LINK', name: 'Chainlink', price: 14.5, marketCap: 8500000000, volume24h: 450000000, priceChange24h: 1.2, category: 'infrastructure' },
  { symbol: 'MATIC', name: 'Polygon', price: 0.68, marketCap: 6800000000, volume24h: 350000000, priceChange24h: -1.9, category: 'layer2' },
  { symbol: 'UNI', name: 'Uniswap', price: 7.8, marketCap: 5900000000, volume24h: 200000000, priceChange24h: -0.5, category: 'defi' },
  { symbol: 'ATOM', name: 'Cosmos', price: 8.9, marketCap: 3400000000, volume24h: 180000000, priceChange24h: -3.5, category: 'layer1' },
  { symbol: 'FIL', name: 'Filecoin', price: 5.6, marketCap: 3100000000, volume24h: 200000000, priceChange24h: -2.1, category: 'infrastructure' },
  { symbol: 'APT', name: 'Aptos', price: 8.2, marketCap: 3500000000, volume24h: 150000000, priceChange24h: -5.2, category: 'layer1' },
  { symbol: 'ARB', name: 'Arbitrum', price: 1.05, marketCap: 3200000000, volume24h: 280000000, priceChange24h: -2.8, category: 'layer2' },
  { symbol: 'OP', name: 'Optimism', price: 2.3, marketCap: 2800000000, volume24h: 220000000, priceChange24h: -1.3, category: 'layer2' },
  { symbol: 'INJ', name: 'Injective', price: 24.5, marketCap: 2200000000, volume24h: 180000000, priceChange24h: 2.5, category: 'defi' },
  { symbol: 'SUI', name: 'Sui', price: 1.15, marketCap: 2100000000, volume24h: 250000000, priceChange24h: -6.1, category: 'layer1' },
  { symbol: 'NEAR', name: 'NEAR Protocol', price: 5.8, marketCap: 5800000000, volume24h: 300000000, priceChange24h: -3.8, category: 'layer1' },
  { symbol: 'DOGE', name: 'Dogecoin', price: 0.15, marketCap: 21000000000, volume24h: 1500000000, priceChange24h: 1.2, category: 'meme' },
  { symbol: 'SHIB', name: 'Shiba Inu', price: 0.0000245, marketCap: 14000000000, volume24h: 800000000, priceChange24h: 0.8, category: 'meme' },
  { symbol: 'PEPE', name: 'Pepe', price: 0.00001125, marketCap: 4700000000, volume24h: 1200000000, priceChange24h: 8.5, category: 'meme' },
  { symbol: 'WIF', name: 'dogwifhat', price: 2.65, marketCap: 2600000000, volume24h: 600000000, priceChange24h: 5.3, category: 'meme' },
  { symbol: 'FLOKI', name: 'Floki', price: 0.000185, marketCap: 1800000000, volume24h: 400000000, priceChange24h: 3.1, category: 'meme' },
  { symbol: 'BONK', name: 'Bonk', price: 0.0000265, marketCap: 1700000000, volume24h: 350000000, priceChange24h: 4.2, category: 'meme' },
  { symbol: 'AAVE', name: 'Aave', price: 92, marketCap: 1350000000, volume24h: 120000000, priceChange24h: -0.3, category: 'defi' },
  { symbol: 'MKR', name: 'Maker', price: 2850, marketCap: 2600000000, volume24h: 80000000, priceChange24h: 0.7, category: 'defi' },
  { symbol: 'CRV', name: 'Curve DAO', price: 0.45, marketCap: 550000000, volume24h: 120000000, priceChange24h: -4.5, category: 'defi' },
  { symbol: 'LDO', name: 'Lido DAO', price: 2.1, marketCap: 1900000000, volume24h: 100000000, priceChange24h: -1.8, category: 'defi' },
  { symbol: 'RENDER', name: 'Render', price: 7.8, marketCap: 3000000000, volume24h: 200000000, priceChange24h: 2.8, category: 'ai' },
  { symbol: 'FET', name: 'Fetch.AI', price: 2.15, marketCap: 1800000000, volume24h: 350000000, priceChange24h: 5.1, category: 'ai' },
  { symbol: 'RNDR', name: 'Render Token', price: 8.5, marketCap: 3200000000, volume24h: 250000000, priceChange24h: 3.4, category: 'ai' },
  { symbol: 'TAO', name: 'Bittensor', price: 415, marketCap: 2800000000, volume24h: 80000000, priceChange24h: -2.1, category: 'ai' },
  { symbol: 'IMX', name: 'Immutable', price: 1.85, marketCap: 2700000000, volume24h: 90000000, priceChange24h: -3.2, category: 'gaming' },
  { symbol: 'GALA', name: 'Gala', price: 0.038, marketCap: 1200000000, volume24h: 150000000, priceChange24h: -1.5, category: 'gaming' },
  { symbol: 'AXS', name: 'Axie Infinity', price: 7.2, marketCap: 980000000, volume24h: 60000000, priceChange24h: -2.8, category: 'gaming' },
  { symbol: 'SAND', name: 'The Sandbox', price: 0.42, marketCap: 950000000, volume24h: 100000000, priceChange24h: -1.1, category: 'gaming' },
  { symbol: 'MANA', name: 'Decentraland', price: 0.38, marketCap: 720000000, volume24h: 80000000, priceChange24h: -0.9, category: 'gaming' },
  { symbol: 'FLOW', name: 'Flow', price: 0.72, marketCap: 1100000000, volume24h: 40000000, priceChange24h: -7.2, category: 'layer1' },
  { symbol: 'EIGEN', name: 'EigenLayer', price: 3.8, marketCap: 700000000, volume24h: 120000000, priceChange24h: -8.5, category: 'infrastructure' },
  { symbol: 'SEI', name: 'Sei', price: 0.48, marketCap: 1500000000, volume24h: 180000000, priceChange24h: -5.8, category: 'layer1' },
  { symbol: 'STRK', name: 'Starknet', price: 1.15, marketCap: 850000000, volume24h: 90000000, priceChange24h: -6.3, category: 'layer2' },
  { symbol: 'TIA', name: 'Celestia', price: 9.5, marketCap: 1800000000, volume24h: 200000000, priceChange24h: -4.7, category: 'infrastructure' },
  { symbol: 'ALGO', name: 'Algorand', price: 0.18, marketCap: 1500000000, volume24h: 70000000, priceChange24h: -2.3, category: 'layer1' },
  { symbol: 'VET', name: 'VeChain', price: 0.035, marketCap: 2500000000, volume24h: 90000000, priceChange24h: -1.7, category: 'layer1' },
  { symbol: 'HBAR', name: 'Hedera', price: 0.078, marketCap: 2800000000, volume24h: 80000000, priceChange24h: -0.5, category: 'layer1' },
  { symbol: 'FTM', name: 'Fantom', price: 0.72, marketCap: 2000000000, volume24h: 200000000, priceChange24h: -3.9, category: 'layer1' },
  { symbol: 'RUNE', name: 'THORChain', price: 5.2, marketCap: 1700000000, volume24h: 180000000, priceChange24h: 1.8, category: 'defi' },
  { symbol: 'DYDX', name: 'dYdX', price: 2.0, marketCap: 1200000000, volume24h: 60000000, priceChange24h: -3.1, category: 'defi' },
  { symbol: 'SNX', name: 'Synthetix', price: 2.8, marketCap: 900000000, volume24h: 50000000, priceChange24h: -2.2, category: 'defi' },
  // --- Cryptos populares adicionales ---
  { symbol: 'HYPE', name: 'Hyperliquid', price: 21.5, marketCap: 7200000000, volume24h: 450000000, priceChange24h: 3.8, category: 'defi' },
  { symbol: 'PENDLE', name: 'Pendle', price: 4.2, marketCap: 680000000, volume24h: 120000000, priceChange24h: 2.1, category: 'defi' },
  { symbol: 'JUP', name: 'Jupiter', price: 0.95, marketCap: 1300000000, volume24h: 200000000, priceChange24h: -1.5, category: 'defi' },
  { symbol: 'W', name: 'Wormhole', price: 0.38, marketCap: 700000000, volume24h: 80000000, priceChange24h: -3.2, category: 'infrastructure' },
  { symbol: 'ONDO', name: 'Ondo Finance', price: 1.25, marketCap: 1800000000, volume24h: 180000000, priceChange24h: 1.7, category: 'defi' },
  { symbol: 'PYTH', name: 'Pyth Network', price: 0.35, marketCap: 1200000000, volume24h: 100000000, priceChange24h: -2.8, category: 'infrastructure' },
  { symbol: 'JTO', name: 'Jito', price: 3.1, marketCap: 380000000, volume24h: 60000000, priceChange24h: -4.1, category: 'defi' },
  { symbol: 'BLUR', name: 'Blur', price: 0.22, marketCap: 600000000, volume24h: 90000000, priceChange24h: -1.9, category: 'infrastructure' },
  { symbol: 'WLD', name: 'Worldcoin', price: 2.4, marketCap: 620000000, volume24h: 150000000, priceChange24h: -5.3, category: 'ai' },
  { symbol: 'ENA', name: 'Ethena', price: 0.85, marketCap: 2500000000, volume24h: 300000000, priceChange24h: 4.2, category: 'defi' },
  { symbol: 'POPCAT', name: 'Popcat', price: 0.52, marketCap: 510000000, volume24h: 80000000, priceChange24h: 7.1, category: 'meme' },
  { symbol: 'AERO', name: 'Aerodrome', price: 1.15, marketCap: 420000000, volume24h: 55000000, priceChange24h: 2.9, category: 'defi' },
  { symbol: 'ETHFI', name: 'Ether.fi', price: 1.8, marketCap: 390000000, volume24h: 70000000, priceChange24h: -0.8, category: 'defi' },
  { symbol: 'BOME', name: 'Book of Meme', price: 0.008, marketCap: 550000000, volume24h: 120000000, priceChange24h: 6.3, category: 'meme' },
  { symbol: 'MEME', name: 'Memecoin', price: 0.018, marketCap: 410000000, volume24h: 60000000, priceChange24h: -3.5, category: 'meme' },
];

// ---- Generador Seeded Random ----

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return () => {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return (hash % 10000) / 10000;
  };
}

function randomInRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

// ---- Generadores de Datos Simulados ----

export function generateIndicators(symbol: string, timeframe: Timeframe, livePrice?: number): FullIndicatorSet {
  const rng = seededRandom(`${symbol}-${timeframe}-ind`);
  const crypto = CRYPTO_DATABASE.find(c => c.symbol === symbol);
  const price = livePrice ?? crypto?.price ?? 100;

  // Generar RSI basado en categoría y cambio de precio
  const change = crypto?.priceChange24h ?? 0;
  let rsiBase = 50 - change * 3;
  rsiBase = Math.max(5, Math.min(95, rsiBase + randomInRange(rng, -15, 15)));

  const macdHist = randomInRange(rng, -price * 0.02, price * 0.02);

  return {
    rsi: parseFloat(rsiBase.toFixed(2)),
    stochastic: {
      k: parseFloat(randomInRange(rng, 10, 90).toFixed(2)),
      d: parseFloat(randomInRange(rng, 10, 90).toFixed(2)),
    },
    macd: {
      value: parseFloat(randomInRange(rng, -price * 0.03, price * 0.03).toFixed(4)),
      signal: parseFloat(randomInRange(rng, -price * 0.02, price * 0.02).toFixed(4)),
      hist: parseFloat(macdHist.toFixed(4)),
    },
    ema20: parseFloat((price * randomInRange(rng, 0.97, 1.03)).toFixed(2)),
    ema50: parseFloat((price * randomInRange(rng, 0.94, 1.06)).toFixed(2)),
    ema200: parseFloat((price * randomInRange(rng, 0.85, 1.15)).toFixed(2)),
    sma50: parseFloat((price * randomInRange(rng, 0.93, 1.07)).toFixed(2)),
    sma200: parseFloat((price * randomInRange(rng, 0.82, 1.18)).toFixed(2)),
    adx: parseFloat(randomInRange(rng, 10, 60).toFixed(2)),
    supertrend: {
      value: parseFloat((price * randomInRange(rng, 0.95, 1.05)).toFixed(2)),
      direction: rng() > 0.5 ? 'up' : 'down',
    },
    ichimoku: {
      tenkan: parseFloat((price * randomInRange(rng, 0.98, 1.02)).toFixed(2)),
      kijun: parseFloat((price * randomInRange(rng, 0.96, 1.04)).toFixed(2)),
      senkouA: parseFloat((price * randomInRange(rng, 0.95, 1.05)).toFixed(2)),
      senkouB: parseFloat(randomInRange(rng, price * 0.85, price * 1.15).toFixed(2)),
      chikou: parseFloat(randomInRange(rng, price * 0.9, price * 1.1).toFixed(2)),
    },
    bollinger: {
      upper: parseFloat((price * 1.05).toFixed(2)),
      lower: parseFloat((price * 0.95).toFixed(2)),
      basis: parseFloat(price.toFixed(2)),
    },
    atr: parseFloat((price * 0.05).toFixed(2)),
    williamsR: parseFloat(randomInRange(rng, -100, 0).toFixed(2)),
    cci: parseFloat(randomInRange(rng, -200, 200).toFixed(2)),
    obv: parseFloat(randomInRange(rng, 1000, 1000000).toFixed(2)),
    obvChange: parseFloat(randomInRange(rng, -5000, 5000).toFixed(2)),
    cmf: parseFloat(randomInRange(rng, -1, 1).toFixed(2)),
    vwap: parseFloat(randomInRange(rng, price * 0.95, price * 1.05).toFixed(2)),
    parabolicSar: {
      value: parseFloat(randomInRange(rng, price * 0.9, price * 1.1).toFixed(2)),
      direction: rng() > 0.5 ? 'up' : 'down',
    },
    donchian: {
      upper: parseFloat((price * 1.1).toFixed(2)),
      lower: parseFloat((price * 0.9).toFixed(2)),
      mid: parseFloat(price.toFixed(2)),
    },
    pivotPoints: {
      pivot: parseFloat(price.toFixed(2)),
      r1: parseFloat((price * 1.05).toFixed(2)),
      r2: parseFloat((price * 1.1).toFixed(2)),
      s1: parseFloat((price * 0.95).toFixed(2)),
      s2: parseFloat((price * 0.9).toFixed(2)),
    },
    squeeze: {
      isActive: rng() > 0.5,
      momentum: parseFloat(randomInRange(rng, -1, 1).toFixed(2)),
      direction: rng() > 0.5 ? 'up' : 'down',
    }
  };
}

export function generateSentiment(symbol: string): SentimentData {
  const rng = seededRandom(`${symbol}-sentiment`);
  const fg = Math.round(randomInRange(rng, 15, 78));

  let fgLabel: SentimentData['fearGreedLabel'];
  if (fg <= 20) fgLabel = 'Miedo Extremo';
  else if (fg <= 40) fgLabel = 'Miedo';
  else if (fg <= 60) fgLabel = 'Neutral';
  else if (fg <= 80) fgLabel = 'Codicia';
  else fgLabel = 'Codicia Extrema';

  const altIdx = Math.round(randomInRange(rng, 20, 80));
  let altLabel: SentimentData['altcoinSeasonLabel'];
  if (altIdx < 25) altLabel = 'Bitcoin Season';
  else if (altIdx > 75) altLabel = 'Altcoin Season';
  else altLabel = 'Neutral';

  return {
    fearGreedIndex: fg,
    fearGreedLabel: fgLabel,
    altcoinSeasonIndex: altIdx,
    altcoinSeasonLabel: altLabel,
  };
}

export function generateOnChain(symbol: string): OnChainData {
  const rng = seededRandom(`${symbol}-onchain`);
  const netFlow = randomInRange(rng, -5000, 5000);
  let nfLabel: OnChainData['exchangeNetFlowLabel'];
  if (netFlow < -3000) nfLabel = 'Acumulación Fuerte';
  else if (netFlow < -500) nfLabel = 'Acumulación';
  else if (netFlow > 3000) nfLabel = 'Distribución Fuerte';
  else if (netFlow > 500) nfLabel = 'Distribución';
  else nfLabel = 'Neutral';

  return {
    mvrvZScore: parseFloat(randomInRange(rng, -0.5, 5).toFixed(2)),
    puellMultiple: parseFloat(randomInRange(rng, 0.3, 3).toFixed(2)),
    exchangeNetFlow: parseFloat(netFlow.toFixed(0)),
    exchangeNetFlowLabel: nfLabel,
    minerPrice: symbol === 'BTC' ? parseFloat(randomInRange(rng, 38000, 45000).toFixed(0)) : 0,
  };
}

export function generateSmartMoney(symbol: string, price: number): SmartMoneyData {
  const rng = seededRandom(`${symbol}-sm`);

  return {
    volumeProfilePOC: parseFloat((price * randomInRange(rng, 0.92, 1.08)).toFixed(2)),
    orderBlocks: [
      {
        type: 'bullish',
        priceHigh: parseFloat((price * 0.93).toFixed(2)),
        priceLow: parseFloat((price * 0.90).toFixed(2)),
        strength: Math.round(randomInRange(rng, 60, 95)),
      },
      {
        type: 'bearish',
        priceHigh: parseFloat((price * 1.12).toFixed(2)),
        priceLow: parseFloat((price * 1.10).toFixed(2)),
        strength: Math.round(randomInRange(rng, 50, 85)),
      },
    ],
    fairValueGaps: [
      {
        type: 'bullish',
        high: parseFloat((price * 0.96).toFixed(2)),
        low: parseFloat((price * 0.94).toFixed(2)),
        filled: rng() > 0.5,
      },
      {
        type: 'bearish',
        high: parseFloat((price * 1.08).toFixed(2)),
        low: parseFloat((price * 1.06).toFixed(2)),
        filled: rng() > 0.7,
      },
    ],
  };
}

export function generateMacro(): MacroData {
  return {
    dxy: 104.35,
    dxyTrend: 'Alcista',
    m2Global: 21.5,
    m2Trend: 'Expansión',
  };
}

// ---- Generador de Sparkline ----

export function generateSparkline(symbol: string, points: number = 7): number[] {
  const rng = seededRandom(`${symbol}-sparkline`);
  const crypto = CRYPTO_DATABASE.find(c => c.symbol === symbol);
  const basePrice = crypto?.price ?? 100;
  const data: number[] = [];

  let current = basePrice * randomInRange(rng, 0.9, 1.1);
  for (let i = 0; i < points; i++) {
    current *= randomInRange(rng, 0.97, 1.03);
    data.push(parseFloat(current.toFixed(2)));
  }
  return data;
}

// ---- Generar Screener completo ----

export function generateScreenerData(timeframe: Timeframe, mode?: string): ScreenerEntry[] {
  const riskMode = (mode || 'Balanceado') as import('@/types').RiskMode;

  return CRYPTO_DATABASE.map((crypto, idx) => {
    const indicators = generateIndicators(crypto.symbol, timeframe, crypto.price);
    const sentiment = generateSentiment(crypto.symbol);
    const onChain = generateOnChain(crypto.symbol);

    const breakdown = calculateFullScore(indicators, sentiment, onChain, crypto.price, riskMode);
    const signal: Signal = getSignalFromScore(breakdown.total, riskMode);

    return {
      rank: idx + 1,
      symbol: crypto.symbol,
      name: crypto.name,
      price: crypto.price,
      priceChange24h: crypto.priceChange24h,
      rsi: indicators.rsi,
      quantScore: breakdown.total,
      signal,
      volume24h: crypto.volume24h,
      sparklineData: generateSparkline(crypto.symbol),
    };
  });
}
