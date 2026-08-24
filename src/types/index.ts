// ============================================================
// TIPOS COMPLETOS — Oráculo Definitivo de Trading Cripto
// ============================================================

// ---- Indicadores Técnicos ----

export interface MACDData {
  value: number;
  signal: number;
  hist: number;
}

export interface BollingerData {
  upper: number;
  lower: number;
  basis: number;
}

export interface StochasticData {
  k: number;  // %K line
  d: number;  // %D line
}

export interface IchimokuData {
  tenkan: number;
  kijun: number;
  senkouA: number;
  senkouB: number;
  chikou: number;
}

export interface FullIndicatorSet {
  // Momentum (35% del peso)
  rsi: number;
  stochastic: StochasticData;
  macd: MACDData;

  // Tendencia (30% del peso)
  ema20: number;
  ema50: number;
  ema200: number;
  sma50: number;
  sma200: number;
  adx: number;
  supertrend: { value: number; direction: 'up' | 'down' };
  ichimoku: IchimokuData;

  // Volatilidad
  bollinger: BollingerData;
  atr: number;

  // Nuevos Indicadores Avanzados
  williamsR: number;
  cci: number;
  obv: number;
  obvChange: number;
  cmf: number;
  vwap: number;
  parabolicSar: { value: number; direction: 'up' | 'down' };
  donchian: { upper: number; lower: number; mid: number };
  pivotPoints: { pivot: number; r1: number; r2: number; s1: number; s2: number };
  squeeze: { isActive: boolean; momentum: number; direction: 'up' | 'down' };
}

// ---- Sentimiento de Mercado ----

export interface SentimentData {
  fearGreedIndex: number;      // 0 = Miedo Extremo, 100 = Codicia Extrema
  fearGreedLabel: 'Miedo Extremo' | 'Miedo' | 'Neutral' | 'Codicia' | 'Codicia Extrema';
  altcoinSeasonIndex: number;  // 0-100 (>75 = Altcoin Season, <25 = BTC Season)
  altcoinSeasonLabel: 'Bitcoin Season' | 'Neutral' | 'Altcoin Season';
}

// ---- Datos On-Chain ----

export interface OnChainData {
  mvrvZScore: number;        // <0 = infravalorado, >7 = sobrevalorado
  puellMultiple: number;     // <0.5 = capitulación minera, >4 = euforia
  exchangeNetFlow: number;   // Negativo = acumulación, Positivo = distribución
  exchangeNetFlowLabel: 'Acumulación Fuerte' | 'Acumulación' | 'Neutral' | 'Distribución' | 'Distribución Fuerte';
  minerPrice: number;        // Costo de producción estimado de BTC
  hashRate?: number;
  activeAddresses?: number;
  defiTvl?: number;
  dataAvailable?: boolean;
}

// ---- Análisis Actuarial de Riesgo ----

export interface ActuarialData {
  riskMetrics: {
    var95: number;
    cvar95: number;
    annualVolatility: number;
  };
  monteCarlo7D: {
    p10: number;
    p50: number;
    p90: number;
    paths?: {
      p10: number[];
      p50: number[];
      p90: number[];
    };
    jump_params?: {
      lambda: number;
      mu_j: number;
      sigma_j: number;
    };
  };
  markovRegime: {
    bull: number;
    bear: number;
    sideways: number;
  };
  dataAvailable: boolean;
}

// ---- Backtester ----

export interface BacktestResult {
  metrics: {
    total_return_percent: number;
    max_drawdown_percent: number;
    win_rate_percent: number;
    sharpe_ratio: number;
    initial_balance: number;
    final_balance: number;
    total_trades: number;
  };
  trades: Array<{
    entry_time: string;
    exit_time: string;
    entry_price: number;
    exit_price: number;
    pnl_percent: number;
  }>;
  equity_curve?: Array<{
    time: string;
    value: number;
  }>;
}

// ---- Smart Money Concepts ----

export interface OrderBlock {
  type: 'bullish' | 'bearish';
  priceHigh: number;
  priceLow: number;
  strength: number; // 0-100
}

export interface FairValueGap {
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  filled: boolean;
}

export interface SmartMoneyData {
  volumeProfilePOC: number;     // Point of Control
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
}

// ---- Datos Macroeconómicos ----

export interface MacroData {
  dxy: number;                  // Índice del Dólar
  dxyTrend: 'Alcista' | 'Bajista' | 'Lateral';
  m2Global: number;             // Liquidez global M2
  m2Trend: 'Expansión' | 'Contracción' | 'Estable';
}

// ---- DCA Bidireccional ----

export interface DCALevel {
  level: number;
  price: number;
  type: 'compra' | 'venta';
  label: string;
  percentFromCurrent: number;
}

// ---- Análisis Completo ----

export interface ActionableData {
  optimalEntry: number;
  dcaLevels: DCALevel[];
  takeProfit: number;
  stopLoss: number;
  riskLevel: number;          // 1-5
  macroRisk: string;
}


export interface LiquidityData {
  openInterestUSD: number;
  longRatio: number;
  shortRatio: number;
  lsRatio: number;
  liquidityScore: number;
}

export interface SupplyData {
  symbol: string;
  price: number;
  marketCap: number;
  fdv: number;
  circulatingSupply: number;
  totalSupply: number;
  maxSupply: number | null;
  circulatingRatio: number;
  maxSupplyRatio: number | null;
  fdvMcapRatio: number;
  pendingInflationPct: number;
  dilutionRisk: 'critical' | 'high' | 'medium' | 'low' | 'none';
  dilutionLabel: string;
  source: string;
}

export interface StablecoinAnalysis {
  overview: {
    totalMcap: number;
    top: Array<{ name: string; symbol: string; mcap: number; dominance: number }>;
  };
  ssr?: {
    ssr: number;
    btcMarketCap: number;
    stablecoinMarketCap: number;
    signal: string;
    score: number;
  };
  flows?: {
    usdt?: { current: number; change7d: number; change7dPct: number };
    usdc?: { current: number; change7d: number; change7dPct: number };
  };
  flowSignal?: string;
  flowScore?: number;
  topChains: Array<{ chain: string; totalUSD: number }>;
}

export interface MarketAnalysis {
  symbol: string;
  name: string;
  timeframe: Timeframe;
  currentPrice: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  quantScore: number;            // 0-100
  signal: Signal;
  indicators: FullIndicatorSet;
  candlestickPatterns: any;
  divergences: any;
  sentiment: SentimentData;
  onChain: OnChainData;
  smartMoney: SmartMoneyData;
  liquidity?: LiquidityData;
  supplyDynamics?: SupplyData;
  stablecoinAnalysis?: StablecoinAnalysis;
  macro: MacroData;
  actionableData: ActionableData;
  actuarial?: ActuarialData;
  ml?: {
    score?: number;
    weight?: number;
    prediction?: { prediction: string | number; confidence: number; probabilities?: any };
    volume_anomaly?: { anomaly: boolean; score?: number; description?: string; ratio?: number };
    nlp_sentiment?: any;
  };
  scoreBreakdown?: ScoreBreakdown;
  source?: string;
  timestamp: string;
}

// ---- Scoring Breakdown ----

export interface ScoreBreakdown {
  momentum: { score: number; weight: number; details: IndicatorScore[] };
  trend: { score: number; weight: number; details: IndicatorScore[] };
  sentiment: { score: number; weight: number; details: IndicatorScore[] };
  onChain: { score: number; weight: number; details: IndicatorScore[] };
  total: number;
}

export interface IndicatorScore {
  name: string;
  value: number | string;
  contribution: number;       // Puntos que aporta
  signal: 'bullish' | 'bearish' | 'neutral';
}

// ---- Screener ----

export interface ScreenerEntry {
  rank: number;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  rsi: number;
  quantScore: number;
  signal: Signal;
  volume24h: number;
  sparklineData: number[];    // últimos 7 puntos de precio
}

// ---- Enums & Unions ----

export type Signal = 'Compra Fuerte' | 'Compra' | 'Mantener' | 'Venta' | 'Venta Fuerte';
export type RiskMode = 'Seguro' | 'Balanceado' | 'Agresivo';
export type Timeframe = '1S' | '1D' | '4H' | '1H' | '15M';

// Helpers
export type SignalColor = {
  [K in Signal]: string;
};

export const SIGNAL_COLORS: SignalColor = {
  'Compra Fuerte': '#10B981',
  'Compra': '#34D399',
  'Mantener': '#94A3B8',
  'Venta': '#FB923C',
  'Venta Fuerte': '#EF4444',
};

export const SIGNAL_LABELS: Record<Signal, string> = {
  'Compra Fuerte': '🟢 Compra Fuerte',
  'Compra': '🟡 Compra',
  'Mantener': '⚪ Mantener',
  'Venta': '🟠 Venta',
  'Venta Fuerte': '🔴 Venta Fuerte',
};
