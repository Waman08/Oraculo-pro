# ============================================================
# PYDANTIC SCHEMAS — Matching TypeScript types from frontend
# ============================================================

from pydantic import BaseModel
from typing import List, Literal, Optional
from datetime import datetime


class MACDData(BaseModel):
    value: float
    signal: float
    hist: float


class BollingerData(BaseModel):
    upper: float
    lower: float
    basis: float


class StochasticData(BaseModel):
    k: float
    d: float


class IchimokuData(BaseModel):
    tenkan: float
    kijun: float
    senkouA: float
    senkouB: float
    chikou: float


class SupertrendData(BaseModel):
    value: float
    direction: Literal["up", "down"]


class FullIndicatorSet(BaseModel):
    rsi: float
    stochastic: StochasticData
    macd: MACDData
    ema20: float
    ema50: float
    ema200: float
    sma50: float
    sma200: float
    adx: float
    supertrend: SupertrendData
    ichimoku: IchimokuData
    bollinger: BollingerData
    atr: float
    williamsR: float
    cci: float
    obv: float
    obvChange: float
    cmf: float
    vwap: float
    parabolicSar: dict
    donchian: dict
    pivotPoints: dict
    squeeze: dict


class SentimentData(BaseModel):
    fearGreedIndex: int
    fearGreedLabel: str
    altcoinSeasonIndex: int
    altcoinSeasonLabel: str


class OnChainData(BaseModel):
    mvrvZScore: float
    puellMultiple: float
    exchangeNetFlow: float
    exchangeNetFlowLabel: str
    minerPrice: float


class OrderBlock(BaseModel):
    type: Literal["bullish", "bearish"]
    priceHigh: float
    priceLow: float
    strength: int


class FairValueGap(BaseModel):
    type: Literal["bullish", "bearish"]
    high: float
    low: float
    filled: bool


class SmartMoneyData(BaseModel):
    volumeProfilePOC: float
    orderBlocks: List[OrderBlock]
    fairValueGaps: List[FairValueGap]


class MacroData(BaseModel):
    dxy: float
    dxyTrend: str
    m2Global: float
    m2Trend: str


class DCALevel(BaseModel):
    level: int
    price: float
    type: Literal["compra", "venta"]
    label: str
    percentFromCurrent: float


class ActionableData(BaseModel):
    optimalEntry: float
    dcaLevels: List[DCALevel]
    takeProfit: float
    stopLoss: float
    riskLevel: int
    macroRisk: str


class ScoreBreakdownCategory(BaseModel):
    score: float
    weight: float


class ScoreBreakdown(BaseModel):
    momentum: ScoreBreakdownCategory
    trend: ScoreBreakdownCategory
    sentiment: ScoreBreakdownCategory
    onChain: ScoreBreakdownCategory
    total: float


class MarketAnalysis(BaseModel):
    symbol: str
    name: str
    timeframe: str
    currentPrice: float
    priceChange24h: float
    volume24h: float
    marketCap: float
    quantScore: float
    signal: str
    indicators: FullIndicatorSet
    candlestickPatterns: dict
    divergences: dict
    sentiment: SentimentData
    onChain: OnChainData
    smartMoney: SmartMoneyData
    macro: MacroData
    actionableData: ActionableData
    timestamp: str
    source: str = "python"


class ScreenerEntry(BaseModel):
    rank: int
    symbol: str
    name: str
    price: float
    priceChange24h: float
    rsi: float
    quantScore: float
    signal: str
    volume24h: float


class HealthResponse(BaseModel):
    status: str
    version: str
    uptime_seconds: float
