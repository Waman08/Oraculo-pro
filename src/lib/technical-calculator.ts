export function calculateRSI(prices: number[], period = 14): number {
  if (prices.length <= period) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    let gain = change > 0 ? change : 0;
    let loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function calculateEMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  if (prices.length < period) return result;
  
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * k + ema;
    result.push(ema);
  }
  return result;
}

export function calculateMACD(prices: number[]): { value: number; signal: number; hist: number } {
  if (prices.length < 26) return { value: 0, signal: 0, hist: 0 };
  
  const ema12Array = calculateEMA(prices, 12);
  const ema26Array = calculateEMA(prices, 26);
  
  const macdArray: number[] = [];
  // Align arrays from the end
  const diff = ema12Array.length - ema26Array.length;
  for (let i = 0; i < ema26Array.length; i++) {
    macdArray.push(ema12Array[i + diff] - ema26Array[i]);
  }
  
  const signalArray = calculateEMA(macdArray, 9);
  
  const value = macdArray[macdArray.length - 1];
  const signal = signalArray[signalArray.length - 1] || 0;
  
  return { value, signal, hist: value - signal };
}

export function calculateBollingerBands(prices: number[], period = 20): { upper: number; lower: number; basis: number } {
  if (prices.length < period) return { upper: 0, lower: 0, basis: 0 };
  const slice = prices.slice(-period);
  const basis = slice.reduce((a, b) => a + b, 0) / period;
  
  const variance = slice.reduce((acc, val) => acc + Math.pow(val - basis, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  
  return {
    basis,
    upper: basis + stdDev * 2,
    lower: basis - stdDev * 2
  };
}

export function calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (highs.length <= period) return 0;
  
  const trArray: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const tr1 = highs[i] - lows[i];
    const tr2 = Math.abs(highs[i] - closes[i - 1]);
    const tr3 = Math.abs(lows[i] - closes[i - 1]);
    trArray.push(Math.max(tr1, tr2, tr3));
  }
  
  let atr = trArray.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trArray.length; i++) {
    atr = (atr * (period - 1) + trArray[i]) / period;
  }
  return atr;
}
