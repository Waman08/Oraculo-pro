// ============================================================
// MOTOR ML — Weighted Scoring Algorítmico Completo
// ============================================================

import type {
  MarketAnalysis, RiskMode, FullIndicatorSet,
  SentimentData, OnChainData, ScoreBreakdown,
  IndicatorScore, Signal, DCALevel, ActionableData,
  Timeframe
} from '@/types';
import {
  CRYPTO_DATABASE, generateIndicators, generateSentiment,
  generateOnChain, generateSmartMoney, generateMacro
} from './mock-data';
import { getSignalFromScore, THRESHOLDS } from './scoring-utils';

// Re-export for backward compatibility
export { getSignalFromScore } from './scoring-utils';

// ---- Pesos del Motor POR MODO DE RIESGO ----
// Seguro: más peso a on-chain y sentimiento (largo plazo)
// Agresivo: más peso a momentum (corto plazo)

const MODE_WEIGHTS: Record<RiskMode, { momentum: number; trend: number; sentiment: number; onChain: number }> = {
  Seguro: { momentum: 0.20, trend: 0.25, sentiment: 0.20, onChain: 0.35 },
  Balanceado: { momentum: 0.35, trend: 0.30, sentiment: 0.15, onChain: 0.20 },
  Agresivo: { momentum: 0.50, trend: 0.30, sentiment: 0.10, onChain: 0.10 },
};

// Umbrales importados de scoring-utils
// THRESHOLDS ya importado arriba

// ---- Cálculos de Score por Categoría ----

function scoreMomentum(ind: FullIndicatorSet): { score: number; details: IndicatorScore[] } {
  const details: IndicatorScore[] = [];

  // RSI: bajo = compra (score bajo), alto = venta (score alto)
  const rsiScore = ind.rsi;
  details.push({
    name: 'RSI',
    value: ind.rsi.toFixed(2),
    contribution: rsiScore * 0.50,
    signal: ind.rsi < 30 ? 'bullish' : ind.rsi > 70 ? 'bearish' : 'neutral',
  });

  // Estocástico
  const stochScore = (ind.stochastic.k + ind.stochastic.d) / 2;
  details.push({
    name: 'Estocástico',
    value: `K:${ind.stochastic.k.toFixed(1)} D:${ind.stochastic.d.toFixed(1)}`,
    contribution: stochScore * 0.30,
    signal: stochScore < 20 ? 'bullish' : stochScore > 80 ? 'bearish' : 'neutral',
  });

  // MACD
  const macdSignal = ind.macd.hist > 0 ? 'bullish' : ind.macd.hist < 0 ? 'bearish' : 'neutral';
  const macdScore = ind.macd.hist > 0 ? 30 : ind.macd.hist < 0 ? 70 : 50;
  details.push({
    name: 'MACD',
    value: `Hist: ${ind.macd.hist > 0 ? '+' : ''}${ind.macd.hist.toFixed(4)}`,
    contribution: macdScore * 0.20,
    signal: macdSignal,
  });

  const totalScore = details.reduce((sum, d) => sum + d.contribution, 0) / 100;
  return { score: Math.min(100, Math.max(0, totalScore * 100)), details };
}

function scoreTrend(ind: FullIndicatorSet, price: number): { score: number; details: IndicatorScore[] } {
  const details: IndicatorScore[] = [];

  // EMA Stack: si precio está SOBRE las EMAs → mercado alcista → score alto (venta)
  const aboveEma20 = price > ind.ema20;
  const aboveEma50 = price > ind.ema50;
  const aboveEma200 = price > ind.ema200;
  const emaStackScore = (aboveEma20 ? 25 : 0) + (aboveEma50 ? 25 : 0) + (aboveEma200 ? 25 : 0);
  details.push({
    name: 'EMA Stack',
    value: `${aboveEma20 ? '✓' : '✗'}20 ${aboveEma50 ? '✓' : '✗'}50 ${aboveEma200 ? '✓' : '✗'}200`,
    contribution: emaStackScore * 0.35,
    signal: emaStackScore > 50 ? 'bearish' : emaStackScore < 25 ? 'bullish' : 'neutral',
  });

  // ADX
  const adxScore = ind.adx > 25 ? (ind.supertrend.direction === 'down' ? 30 : 70) : 50;
  details.push({
    name: 'ADX',
    value: ind.adx.toFixed(1),
    contribution: adxScore * 0.25,
    signal: ind.adx > 25 ? (ind.supertrend.direction === 'up' ? 'bearish' : 'bullish') : 'neutral',
  });

  // Supertrend
  const stScore = ind.supertrend.direction === 'up' ? 70 : 30;
  details.push({
    name: 'Supertrend',
    value: ind.supertrend.direction === 'up' ? '▲ Alcista' : '▼ Bajista',
    contribution: stScore * 0.20,
    signal: ind.supertrend.direction === 'up' ? 'bearish' : 'bullish',
  });

  // Ichimoku
  const aboveCloud = price > Math.max(ind.ichimoku.senkouA, ind.ichimoku.senkouB);
  const belowCloud = price < Math.min(ind.ichimoku.senkouA, ind.ichimoku.senkouB);
  const ichiScore = aboveCloud ? 75 : belowCloud ? 25 : 50;
  details.push({
    name: 'Ichimoku',
    value: aboveCloud ? 'Sobre la nube' : belowCloud ? 'Bajo la nube' : 'En la nube',
    contribution: ichiScore * 0.20,
    signal: aboveCloud ? 'bearish' : belowCloud ? 'bullish' : 'neutral',
  });

  const totalParts = emaStackScore * 0.35 + adxScore * 0.25 + stScore * 0.20 + ichiScore * 0.20;
  return { score: Math.min(100, Math.max(0, totalParts / 100 * 100)), details };
}

function scoreSentiment(sent: SentimentData): { score: number; details: IndicatorScore[] } {
  const details: IndicatorScore[] = [];

  const fgScore = sent.fearGreedIndex;
  details.push({
    name: 'Fear & Greed',
    value: `${sent.fearGreedIndex} (${sent.fearGreedLabel})`,
    contribution: fgScore * 0.70,
    signal: fgScore < 25 ? 'bullish' : fgScore > 75 ? 'bearish' : 'neutral',
  });

  const altScore = sent.altcoinSeasonIndex;
  details.push({
    name: 'Altcoin Season',
    value: `${sent.altcoinSeasonIndex} (${sent.altcoinSeasonLabel})`,
    contribution: altScore * 0.30,
    signal: altScore > 75 ? 'bearish' : altScore < 25 ? 'bullish' : 'neutral',
  });

  const totalScore = (fgScore * 0.70 + altScore * 0.30);
  return { score: Math.min(100, Math.max(0, totalScore)), details };
}

function scoreOnChain(oc: OnChainData): { score: number; details: IndicatorScore[] } {
  const details: IndicatorScore[] = [];

  const mvrv = oc.mvrvZScore ?? 0;
  const puell = oc.puellMultiple ?? 0;
  const flow = oc.exchangeNetFlow ?? 0;

  // MVRV: < 0 infravalorado = compra (score bajo), > 7 sobrevalorado = venta
  const mvrvNorm = Math.min(100, Math.max(0, (mvrv + 0.5) / 7.5 * 100));
  details.push({
    name: 'MVRV Z-Score',
    value: mvrv.toFixed(2),
    contribution: mvrvNorm * 0.40,
    signal: mvrv < 0 ? 'bullish' : mvrv > 5 ? 'bearish' : 'neutral',
  });

  const puellNorm = Math.min(100, Math.max(0, puell / 4 * 100));
  details.push({
    name: 'Puell Multiple',
    value: puell.toFixed(2),
    contribution: puellNorm * 0.30,
    signal: puell < 0.5 ? 'bullish' : puell > 3 ? 'bearish' : 'neutral',
  });

  const flowNorm = Math.min(100, Math.max(0, (flow + 5000) / 10000 * 100));
  details.push({
    name: 'Flujo Exchanges',
    value: `${flow > 0 ? '+' : ''}${flow.toFixed(0)} BTC`,
    contribution: flowNorm * 0.30,
    signal: flow < -1000 ? 'bullish' : flow > 1000 ? 'bearish' : 'neutral',
  });

  const totalScore = mvrvNorm * 0.40 + puellNorm * 0.30 + flowNorm * 0.30;
  return { score: Math.min(100, Math.max(0, totalScore)), details };
}

// ---- Cálculo Principal del Score ----

export function calculateFullScore(
  indicators: FullIndicatorSet,
  sentiment: SentimentData,
  onChain: OnChainData,
  price: number,
  mode: RiskMode = 'Balanceado',
): ScoreBreakdown {
  const weights = MODE_WEIGHTS[mode];

  const mom = scoreMomentum(indicators);
  const trend = scoreTrend(indicators, price);
  const sent = scoreSentiment(sentiment);
  const oc = scoreOnChain(onChain);

  const total =
    mom.score * weights.momentum +
    trend.score * weights.trend +
    sent.score * weights.sentiment +
    oc.score * weights.onChain;

  return {
    momentum: { score: mom.score, weight: weights.momentum, details: mom.details },
    trend: { score: trend.score, weight: weights.trend, details: trend.details },
    sentiment: { score: sent.score, weight: weights.sentiment, details: sent.details },
    onChain: { score: oc.score, weight: weights.onChain, details: oc.details },
    total: parseFloat(total.toFixed(1)),
  };
}

// getSignalFromScore importado y re-exportado desde scoring-utils

// ---- DCA Bidireccional ----

function calculateDCA(price: number, signal: Signal, atr: number): DCALevel[] {
  const levels: DCALevel[] = [];

  if (signal === 'Compra Fuerte' || signal === 'Compra') {
    // DCA de compra hacia abajo — promediar más barato
    const steps = signal === 'Compra Fuerte' ? 5 : 3;
    for (let i = 1; i <= steps; i++) {
      const pct = i * 0.05;
      const dcaPrice = price * (1 - pct);
      levels.push({
        level: i,
        price: parseFloat(dcaPrice.toFixed(2)),
        type: 'compra',
        label: `DCA Compra ${i}`,
        percentFromCurrent: parseFloat((-pct * 100).toFixed(1)),
      });
    }
  } else if (signal === 'Venta Fuerte' || signal === 'Venta') {
    // DCA de venta hacia arriba — take profits escalonados
    const steps = signal === 'Venta Fuerte' ? 5 : 3;
    for (let i = 1; i <= steps; i++) {
      const pct = i * 0.05;
      const dcaPrice = price * (1 + pct);
      levels.push({
        level: i,
        price: parseFloat(dcaPrice.toFixed(2)),
        type: 'venta',
        label: `TP ${i}`,
        percentFromCurrent: parseFloat((pct * 100).toFixed(1)),
      });
    }
  }

  return levels;
}

// ---- Generar Análisis Completo ----

export function generateFullAnalysis(
  symbol: string,
  timeframe: Timeframe,
  mode: RiskMode,
  livePrice?: number,
  liveChange?: number,
  liveVolume?: number,
): MarketAnalysis {
  const crypto = CRYPTO_DATABASE.find(c => c.symbol === symbol.toUpperCase());
  const price = livePrice ?? crypto?.price ?? 100;
  const change24h = liveChange ?? crypto?.priceChange24h ?? 0;
  const vol24h = liveVolume ?? crypto?.volume24h ?? 0;
  const name = crypto?.name ?? symbol;
  const marketCap = crypto?.marketCap ?? 0;

  const indicators = generateIndicators(symbol, timeframe, price);
  const sentiment = generateSentiment(symbol);
  const onChain = generateOnChain(symbol);
  const smartMoney = generateSmartMoney(symbol, price);
  const macro = generateMacro();

  const breakdown = calculateFullScore(indicators, sentiment, onChain, price, mode);
  const signal = getSignalFromScore(breakdown.total, mode);
  const dcaLevels = calculateDCA(price, signal, indicators.atr);

  // Entry, TP, SL basados en ATR y señal
  let optimalEntry: number;
  let takeProfit: number;
  let stopLoss: number;

  if (signal === 'Compra Fuerte' || signal === 'Compra') {
    // Para compra: entrada más abajo, SL más abajo aún, TP arriba
    optimalEntry = parseFloat((price - indicators.atr * 1.5).toFixed(2));
    takeProfit = parseFloat((price + indicators.atr * 3).toFixed(2));
    stopLoss = parseFloat((price - indicators.atr * 3).toFixed(2));
  } else if (signal === 'Venta Fuerte' || signal === 'Venta') {
    // Para venta: entrada más arriba, TP arriba, SL cercano
    optimalEntry = parseFloat((price + indicators.atr * 0.5).toFixed(2));
    takeProfit = parseFloat((price + indicators.atr * 3).toFixed(2));
    stopLoss = parseFloat((price - indicators.atr * 1.5).toFixed(2));
  } else {
    // Mantener: entry = precio actual, TP y SL equidistantes
    optimalEntry = parseFloat(price.toFixed(2));
    takeProfit = parseFloat((price + indicators.atr * 2).toFixed(2));
    stopLoss = parseFloat((price - indicators.atr * 2).toFixed(2));
  }

  // Risk level: 1 (muy seguro) to 5 (muy riesgoso)
  let riskLevel: number;
  if (breakdown.total <= 20 || breakdown.total >= 80) riskLevel = 1; // Señal clara
  else if (breakdown.total <= 30 || breakdown.total >= 70) riskLevel = 2;
  else if (breakdown.total <= 40 || breakdown.total >= 60) riskLevel = 3;
  else riskLevel = 4; // Zona indecisa = más riesgo

  const actionableData: ActionableData = {
    optimalEntry,
    dcaLevels,
    takeProfit,
    stopLoss,
    riskLevel,
    macroRisk: getMacroRiskText(breakdown.total),
  };

  return {
    symbol: symbol.toUpperCase(),
    name,
    timeframe,
    currentPrice: price,
    priceChange24h: change24h,
    volume24h: vol24h,
    marketCap,
    quantScore: breakdown.total,
    signal,
    indicators,
    sentiment,
    onChain,
    smartMoney,
    macro,
    actionableData,
    ml: {
      prediction: { 
        prediction: parseFloat((price * (1 + (Math.random() * 0.1 - 0.05))).toFixed(2)),
        confidence: parseFloat((0.6 + Math.random() * 0.3).toFixed(2))
      },
      volume_anomaly: { 
        anomaly: vol24h > (marketCap * 0.1)
      }
    },
    candlestickPatterns: {
      engulfing: Math.random() > 0.5 ? 1 : 0,
      doji: Math.random() > 0.8 ? 1 : 0,
      hammer: Math.random() > 0.7 ? 1 : 0
    },
    divergences: {
      rsi_bullish: Math.random() > 0.8,
      rsi_bearish: Math.random() > 0.8,
      macd_bullish: Math.random() > 0.8,
      macd_bearish: Math.random() > 0.8
    },
    timestamp: new Date().toISOString(),
  };
}

function getMacroRiskText(score: number): string {
  if (score <= 20) return 'macrorisk.floor';
  if (score <= 40) return 'macrorisk.weak';
  if (score <= 60) return 'macrorisk.sideways';
  if (score <= 80) return 'macrorisk.hot';
  return 'macrorisk.euphoria';
}

export { calculateFullScore as calculateMLScore };
