# ============================================================
# ON-CHAIN SCORING v3 — Fixed: properly extracts values from dicts
# ============================================================
#
# Scoring Convention:
#   0-30  = COMPRA zone (market undervalued / capitulation)
#   30-50 = Accumulation zone
#   50-70 = Neutral / Distribution
#   70-100 = VENTA zone (market overvalued / euphoria)
#
# CRITICAL FIX: onchain_engine returns dicts like {"mvrv": 2.3, "marketCap": ...}
# We must extract the float value BEFORE passing to normalizers.
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
# Individual Metric Normalizers (accept FLOAT values only)
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
    net_flow = _safe(net_flow, 0.0)
    normalized = (net_flow + 5000) / 10000 * 100
    return _clamp(normalized, 0, 100)


def normalize_supply_profit(supply_in_profit_pct: float) -> float:
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
    
    CRITICAL FIX: Properly extracts float values from sub-dictionaries.
    onchain_engine returns: {"mvrv": {"mvrv": 2.3, "marketCap": ...}, ...}
    We must do: onchain["mvrv"]["mvrv"] to get the float.
    
    Returns a dict with:
    - total: float (0-100, the aggregate on-chain score)
    - score: float (same as total, for backward compatibility with analyzer.py)
    - subScores: dict of individual metric scores
    - dataDepth: 'full' | 'partial' | 'minimal'
    - weight: recommended weight for this score in the final blend
    """
    data_depth = onchain.get("dataDepth", "minimal")
    
    sub_scores = {}
    weights = {}
    
    # MVRV — extract float from dict
    mvrv_data = onchain.get("mvrv")
    if mvrv_data and isinstance(mvrv_data, dict):
        mvrv_val = mvrv_data.get("mvrv")
        if mvrv_val is not None:
            sub_scores["mvrv"] = normalize_mvrv(mvrv_val)
            weights["mvrv"] = 0.30
    
    # Realized Price — extract both market and realized price from dict
    rp_data = onchain.get("realizedPrice")
    if rp_data and isinstance(rp_data, dict):
        rp_val = rp_data.get("realizedPrice")
        mkt_val = rp_data.get("marketPrice") or rp_data.get("currentPrice")
        if rp_val and mkt_val and rp_val > 0:
            sub_scores["realizedPrice"] = normalize_realized_price(mkt_val, rp_val)
            weights["realizedPrice"] = 0.20
    
    # Puell Multiple — extract float from dict
    puell_data = onchain.get("puellMultiple")
    if puell_data and isinstance(puell_data, dict):
        puell_val = puell_data.get("puellMultiple")
        if puell_val is not None:
            sub_scores["puell"] = normalize_puell(puell_val)
            weights["puell"] = 0.15
    
    # SOPR — extract float from dict
    sopr_data = onchain.get("sopr")
    if sopr_data and isinstance(sopr_data, dict):
        sopr_val = sopr_data.get("sopr")
        if sopr_val is not None:
            sub_scores["sopr"] = normalize_sopr(sopr_val)
            weights["sopr"] = 0.20
    elif sopr_data and isinstance(sopr_data, (int, float)):
        sub_scores["sopr"] = normalize_sopr(sopr_data)
        weights["sopr"] = 0.20
    
    # Exchange Flows — extract float from dict
    flow_data = onchain.get("exchangeFlows")
    if flow_data and isinstance(flow_data, dict):
        flow_val = flow_data.get("netFlow") or flow_data.get("btcNetFlow")
        if flow_val is not None:
            sub_scores["exchangeFlow"] = normalize_exchange_flow(flow_val)
            weights["exchangeFlow"] = 0.15
    
    # DeFiLlama metrics (for altcoins without CoinMetrics deep data)
    defillama_data = onchain.get("defillama")
    if defillama_data and isinstance(defillama_data, dict):
        from services.onchain_defillama import score_defillama_metrics
        market_cap = 0
        # Try to get market cap from various sources in the onchain data
        mvrv_d = onchain.get("mvrv")
        if mvrv_d and isinstance(mvrv_d, dict):
            market_cap = mvrv_d.get("marketCap", 0) or 0
        
        dl_score = score_defillama_metrics(defillama_data, market_cap)
        dl_total = dl_score.get("score", 50)
        if dl_total != 50 or dl_score.get("dataDepth") != "minimal":
            sub_scores["defillamaHealth"] = dl_total
            weights["defillamaHealth"] = 0.25  # Significant weight for DeFi health
    
    # If no metrics available at all, return neutral
    if not sub_scores:
        return {
            "total": 50.0,
            "score": 50.0,
            "subScores": {},
            "dataDepth": data_depth,
            "weight": 0.05,
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
    if data_depth == "full":
        recommended_weight = 0.30
    elif data_depth == "partial":
        recommended_weight = 0.15
    else:
        recommended_weight = 0.05
    
    return {
        "total": total,
        "score": total,  # Backward compat with analyzer.py
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
