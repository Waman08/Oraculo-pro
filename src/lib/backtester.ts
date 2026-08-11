import { calculateFullScore, getSignalFromScore } from './ml-engine';
import { calculateRSI, calculateMACD, calculateBollingerBands, calculateATR, calculateEMA } from './technical-calculator';
import type { RiskMode, Signal, FullIndicatorSet, SentimentData, OnChainData } from '@/types';

export interface BacktestResult {
  symbol: string;
  totalTrades: number;
  winRate: number; // percentage
  profitFactor: number;
  netProfit: number; // percentage
  maxDrawdown: number; // percentage
  buyHoldReturn: number; // percentage
}

// Simula la ejecución de una estrategia a través del histórico de klines
export function runBacktest(
  symbol: string,
  klines: number[][], // [time, open, high, low, close, volume][]
  mode: RiskMode
): BacktestResult {
  if (klines.length < 50) {
    return {
      symbol, totalTrades: 0, winRate: 0, profitFactor: 0, netProfit: 0, maxDrawdown: 0, buyHoldReturn: 0
    };
  }

  const closes = klines.map(k => parseFloat(String(k[4])));
  const highs = klines.map(k => parseFloat(String(k[2])));
  const lows = klines.map(k => parseFloat(String(k[3])));
  const volumes = klines.map(k => parseFloat(String(k[5])));

  let balance = 10000;
  let inPosition = false;
  let entryPrice = 0;
  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let peakBalance = balance;
  let maxDrawdown = 0;

  for (let i = 50; i < closes.length; i++) {
    const currentPrice = closes[i];
    
    // Simulate real indicator calculation up to day `i`
    const sliceCloses = closes.slice(0, i + 1);
    
    const rsi = calculateRSI(sliceCloses);
    const macd = calculateMACD(sliceCloses);
    const bb = calculateBollingerBands(sliceCloses);
    const ema20 = calculateEMA(sliceCloses, 20).pop() || currentPrice;
    const ema50 = calculateEMA(sliceCloses, 50).pop() || currentPrice;
    const ema200 = calculateEMA(sliceCloses, 200).pop() || currentPrice;
    
    // Build FullIndicatorSet for the ML engine
    const mockIndicators: FullIndicatorSet = {
      rsi,
      stochastic: { k: 50, d: 50 },
      macd,
      ema20,
      ema50,
      ema200,
      sma50: ema50,
      sma200: ema200,
      adx: 25,
      supertrend: { value: currentPrice, direction: currentPrice > ema50 ? 'up' : 'down' },
      ichimoku: { tenkan: currentPrice, kijun: currentPrice, senkouA: currentPrice, senkouB: currentPrice, chikou: currentPrice },
      bollinger: bb,
      atr: calculateATR(highs.slice(0, i + 1), lows.slice(0, i + 1), closes.slice(0, i + 1)),
      williamsR: -50,
      cci: 0,
      obv: 0,
      obvChange: 0,
      cmf: 0,
      vwap: currentPrice,
      parabolicSar: { value: currentPrice, direction: 'up' },
      donchian: { upper: currentPrice, lower: currentPrice, mid: currentPrice },
      pivotPoints: { pivot: currentPrice, r1: currentPrice, r2: currentPrice, s1: currentPrice, s2: currentPrice },
      squeeze: { isActive: false, momentum: 0, direction: 'up' }
    };

    const mockSentiment: SentimentData = {
      fearGreedIndex: 50,
      fearGreedLabel: 'Neutral',
      altcoinSeasonIndex: 50,
      altcoinSeasonLabel: 'Neutral',
    };

    const mockOnChain: OnChainData = {
      mvrvZScore: 1.5,
      puellMultiple: 1.0,
      exchangeNetFlow: 0,
      exchangeNetFlowLabel: 'Neutral',
      minerPrice: 0,
    };

    const breakdown = calculateFullScore(mockIndicators, mockSentiment, mockOnChain, currentPrice, mode);
    const signal = getSignalFromScore(breakdown.total, mode);

    if (!inPosition && (signal === 'Compra' || signal === 'Compra Fuerte')) {
      // Buy
      inPosition = true;
      entryPrice = currentPrice;
    } else if (inPosition && (signal === 'Venta' || signal === 'Venta Fuerte')) {
      // Sell
      inPosition = false;
      const tradeReturn = (currentPrice - entryPrice) / entryPrice;
      const profit = balance * tradeReturn;
      
      balance += profit;

      if (profit > 0) {
        wins++;
        grossProfit += profit;
      } else {
        losses++;
        grossLoss += Math.abs(profit);
      }

      if (balance > peakBalance) peakBalance = balance;
      const drawdown = (peakBalance - balance) / peakBalance * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
  }

  // Force close position at the end
  if (inPosition) {
    const tradeReturn = (closes[closes.length - 1] - entryPrice) / entryPrice;
    const profit = balance * tradeReturn;
    balance += profit;
    if (profit > 0) { wins++; grossProfit += profit; }
    else { losses++; grossLoss += Math.abs(profit); }
  }

  const totalTrades = wins + losses;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99 : 0);
  const netProfit = ((balance - 10000) / 10000) * 100;
  
  const buyHoldReturn = ((closes[closes.length - 1] - closes[50]) / closes[50]) * 100;

  return {
    symbol,
    totalTrades,
    winRate,
    profitFactor,
    netProfit,
    maxDrawdown,
    buyHoldReturn
  };
}
