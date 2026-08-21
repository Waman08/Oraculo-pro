# ============================================================
# ON-CHAIN SCORING — Normalize raw on-chain metrics to 0-100 scores
# ============================================================
#
# Scoring Convention:
#   0-30  = COMPRA zone (market undervalued / capitulation)
#   30-50 = Accumulation zone
#   50-70 = Neutral / Distribution
#   70-100 = VENTA zone (market overvalued / euphoria)
#
# Each function takes a raw metric value and returns a score 0-100.
# ============================================================

import math
from typing import Dict, Optional


def _safe(v, fallback=0.0):
    """Safely convert to float, handling None/NaN/Inf."""
    if v is None:
        return fallback
    try:
        f = float(v)
        return fallback if (math.isnan(f) or math.isinf(f)) else f
    except (ValueError, TypeError):
        return fallback


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


# ============================================================
# Individual Metric Normalizers
# ============================================================

def normalize_mvrv(mvrv: float) -> float:
    """
    MVRV (Market Value / Realized Value):
    - < 0.8  → 0-10   (Extreme undervaluation / capitulation)
    - 0.8-1.0 → 10-25 (Undervalued)
    - 1.0-1.5 → 25-40 (Accumulation)
    - 1.5-2.5 → 40-60 (Fair value)
    - 2.5-3.5 → 60-80 (Getting expensive)
    - > 3.5   → 80-100 (Euphoria / top signal)
    """
    mvrv = _safe(mvrv, 1.5)
    if mvrv < 0.8:
        return _clamp(mvrv / 0.8 * 10, 0, 10)
    elif mvrv < 1.0:
        return _clamp(10 + (mvrv - 0.8) / 0.2 * 15, 10, 25)
    elif mvrv < 1.5:
        return _clamp(25 + (mvrv - 1.0) / 0.5 * 15, 25, 40)
    elif mvrv < 2.5:
        return _clamp(40 + (mvrv - 1.5) / 1.0 * 20, 40, 60)
    elif mvrv < 3.5:
        return _clamp(60 + (mvrv - 2.5) / 1.0 * 20, 60, 80)
    else:
        return _clamp(80 + (mvrv - 3.5) / 2.0 * 20, 80, 100)


def normalize_sopr(sopr: float) -> float:
    """
    SOPR (Spent Output Profit Ratio):
    - < 0.90  → 0-10   (Deep capitulation — strong buy)
    - 0.90-0.97 → 10-25 (Capitulation)
    - 0.97-1.00 → 25-40 (Holders at break-even)
    - 1.00-1.03 → 40-55 (Slight profit-taking)
    - 1.03-1.10 → 55-75 (Distribution)
    - > 1.10  → 75-100 (Euphoria / top)
    """
    sopr = _safe(sopr, 1.0)
    if sopr < 0.90:
        return _clamp(sopr / 0.90 * 10, 0, 10)
    elif sopr < 0.97:
        return _clamp(10 + (sopr - 0.90) / 0.07 * 15, 10, 25)
    elif sopr < 1.00:
        return _clamp(25 + (sopr - 0.97) / 0.03 * 15, 25, 40)
    elif sopr < 1.03:
        return _clamp(40 + (sopr - 1.00) / 0.03 * 15, 40, 55)
    elif sopr < 1.10:
        return _clamp(55 + (sopr - 1.03) / 0.07 * 20, 55, 75)
    else:
        return _clamp(75 + (sopr - 1.10) / 0.15 * 25, 75, 100)


def normalize_realized_price(market_price: float, realized_price: float) -> float:
    """
    Market Price vs Realized Price:
    - Price far below realized → strong buy (0-20)
    - Price near realized → accumulation (20-40)
    - Price 1.5x-2.5x realized → fair value (40-65)
    - Price > 3x realized → overheated (65-100)
    """
    market_price = _safe(market_price, 1.0)
    realized_price = _safe(realized_price, 1.0)
    if realized_price <= 0:
        return 50.0

    ratio = market_price / realized_price

    if ratio < 0.8:
        return _clamp(ratio / 0.8 * 10, 0, 10)
    elif ratio < 1.0:
        return _clamp(10 + (ratio - 0.8) / 0.2 * 15, 10, 25)
    elif ratio < 1.5:
        return _clamp(25 + (ratio - 1.0) / 0.5 * 15, 25, 40)
    elif ratio < 2.5:
        return _clamp(40 + (ratio - 1.5) / 1.0 * 25, 40, 65)
    elif ratio < 3.5:
        return _clamp(65 + (ratio - 2.5) / 1.0 * 20, 65, 85)
    else:
        return _clamp(85 + (ratio - 3.5) / 2.0 * 15, 85, 100)


def normalize_exchange_flow(net_flow: float) -> float:
    """
    Exchange Net Flow (BTC):
    - Large negative (outflow) = bullish (coins leaving exchanges) → low score (buy)
    - Large positive (inflow) = bearish (coins entering exchanges) → high score (sell)
    Scale: roughly -5000 to +5000 BTC/day
    """
    net_flow = _safe(net_flow, 0.0)
    # Normalize from [-5000, +5000] to [0, 100]
    normalized = (net_flow + 5000) / 10000 * 100
    return _clamp(normalized, 0, 100)


def normalize_supply_profit(supply_in_profit_pct: float) -> float:
    """
    Supply in Profit (%):
    - < 40% → 0-15  (Mass capitulation — strong buy)
    - 40-60% → 15-35 (Bear market bottom area)
    - 60-80% → 35-55 (Recovery / neutral)
    - 80-92% → 55-75 (Bull market)
    - > 92%  → 75-100 (Euphoria — sell)
    """
    pct = _safe(supply_in_profit_pct, 50.0)
    if pct < 40:
        return _clamp(pct / 40 * 15, 0, 15)
    elif pct < 60:
        return _clamp(15 + (pct - 40) / 20 * 20, 15, 35)
    elif pct < 80:
        return _clamp(35 + (pct - 60) / 20 * 20, 35, 55)
    elif pct < 92:
        return _clamp(55 + (pct - 80) / 12 * 20, 55, 75)
    else:
        return _clamp(75 + (pct - 92) / 8 * 25, 75, 100)


def normalize_puell(puell: float) -> float:
    """
    Puell Multiple:
    - < 0.5  → 0-15   (Miners capitulating — bottom)
    - 0.5-1.0 → 15-35 (Low revenue — accumulation)
    - 1.0-1.5 → 35-55 (Normal)
    - 1.5-3.0 → 55-75 (Elevated)
    - > 3.0  → 75-100 (Euphoria)
    """
    puell = _safe(puell, 1.0)
    if puell < 0.5:
        return _clamp(puell / 0.5 * 15, 0, 15)
    elif puell < 1.0:
        return _clamp(15 + (puell - 0.5) / 0.5 * 20, 15, 35)
    elif puell < 1.5:
        return _clamp(35 + (puell - 1.0) / 0.5 * 20, 35, 55)
    elif puell < 3.0:
        return _clamp(55 + (puell - 1.5) / 1.5 * 20, 55, 75)
    else:
        return _clamp(75 + (puell - 3.0) / 3.0 * 25, 75, 100)


# ============================================================
# MASTER SCORING FUNCTION
# ============================================================

def score_onchain_v2(onchain: Dict) -> Dict:
    """
    Calculate the comprehensive on-chain score from verified blockchain data.
    
    Returns a dict with:
    - total: float (0-100, the aggregate on-chain score)
    - subScores: dict of individual metric scores
    - dataDepth: 'full' | 'partial' | 'minimal'
    """
    data_depth = onchain.get("dataDepth", "minimal")
    
    sub_scores = {}
    weights = {}
    
    # Always available metrics (from Coin Metrics for BTC/ETH)
    if onchain.get("mvrv") is not None:
        sub_scores["mvrv"] = normalize_mvrv(onchain["mvrv"])
        weights["mvrv"] = 0.25
    
    if onchain.get("realizedPrice") is not None and onchain.get("marketPrice") is not None:
        sub_scores["realizedPrice"] = normalize_realized_price(
            onchain["marketPrice"], onchain["realizedPrice"]
        )
        weights["realizedPrice"] = 0.15
    
    if onchain.get("puellMultiple") is not None:
        sub_scores["puell"] = normalize_puell(onchain["puellMultiple"])
        weights["puell"] = 0.10
    
    # Dune-dependent metrics (optional)
    if onchain.get("sopr") is not None:
        sub_scores["sopr"] = normalize_sopr(onchain["sopr"])
        weights["sopr"] = 0.20
    
    if onchain.get("exchangeNetFlow") is not None:
        sub_scores["exchangeFlow"] = normalize_exchange_flow(onchain["exchangeNetFlow"])
        weights["exchangeFlow"] = 0.15
    
    if onchain.get("supplyInProfit") is not None:
        sub_scores["supplyProfit"] = normalize_supply_profit(onchain["supplyInProfit"])
        weights["supplyProfit"] = 0.15
    
    # If no metrics available at all, return neutral
    if not sub_scores:
        return {
            "total": 50.0,
            "subScores": {},
            "dataDepth": "minimal",
            "weight": 0.10,  # Reduced weight when no real data
        }
    
    # Normalize weights to sum to 1.0
    total_weight = sum(weights.values())
    if total_weight > 0:
        normalized_weights = {k: v / total_weight for k, v in weights.items()}
    else:
        normalized_weights = weights
    
    # Weighted average
    total = sum(sub_scores[k] * normalized_weights.get(k, 0) for k in sub_scores)
    total = round(_clamp(total), 1)
    
    # Determine recommended weight for the aggregate score
    # More data available = more weight in final scoring
    if data_depth == "full":
        recommended_weight = 0.35  # Full on-chain data: 35% of final score
    elif data_depth == "partial":
        recommended_weight = 0.25  # Partial: 25%
    else:
        recommended_weight = 0.10  # Minimal: 10%
    
    return {
        "total": total,
        "subScores": {k: round(v, 1) for k, v in sub_scores.items()},
        "dataDepth": data_depth,
        "weight": recommended_weight,
    }


def get_signal_from_score(score: float) -> str:
    """Convert a 0-100 on-chain score to a human-readable signal."""
    if score <= 20:
        return "Compra Fuerte"
    elif score <= 40:
        return "Compra"
    elif score <= 60:
        return "Mantener"
    elif score <= 80:
        return "Venta"
    else:
        return "Venta Fuerte"
