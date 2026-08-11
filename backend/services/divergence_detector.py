# ============================================================
# DIVERGENCE DETECTOR — Price vs Indicator divergence analysis
# ============================================================

import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import pandas_ta as ta


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _safe_float(value, fallback: float = 0.0) -> float:
    """Safely convert a value to float, handling NaN/Inf/None."""
    if value is None:
        return fallback
    try:
        f = float(value)
        if math.isnan(f) or math.isinf(f):
            return fallback
        return f
    except (ValueError, TypeError):
        return fallback


def _find_swing_lows(
    series: pd.Series, window: int = 5
) -> List[Tuple[int, float]]:
    """
    Return a list of (index_position, value) for swing lows.

    A swing low is a bar whose value is the minimum within ±window bars.
    Only considers bars that have a full window on each side.
    """
    values = series.values
    n = len(values)
    swings: List[Tuple[int, float]] = []

    for i in range(window, n - window):
        val = values[i]
        if math.isnan(val):
            continue
        segment = values[i - window : i + window + 1]
        if np.any(np.isnan(segment)):
            continue
        if val == np.nanmin(segment):
            swings.append((i, float(val)))

    return swings


def _find_swing_highs(
    series: pd.Series, window: int = 5
) -> List[Tuple[int, float]]:
    """
    Return a list of (index_position, value) for swing highs.

    A swing high is a bar whose value is the maximum within ±window bars.
    Only considers bars that have a full window on each side.
    """
    values = series.values
    n = len(values)
    swings: List[Tuple[int, float]] = []

    for i in range(window, n - window):
        val = values[i]
        if math.isnan(val):
            continue
        segment = values[i - window : i + window + 1]
        if np.any(np.isnan(segment)):
            continue
        if val == np.nanmax(segment):
            swings.append((i, float(val)))

    return swings


# ------------------------------------------------------------------
# Core divergence comparison
# ------------------------------------------------------------------

def _detect_divergences_between(
    price_series: pd.Series,
    indicator_series: pd.Series,
    indicator_name: str,
    window: int = 5,
    max_lookback: int = 50,
) -> List[Dict[str, Any]]:
    """
    Compare swing pivots of *price_series* vs *indicator_series* and return
    a list of divergence dicts.

    Divergence types detected:
      - Regular Bullish:  price lower-low  + indicator higher-low
      - Regular Bearish:  price higher-high + indicator lower-high
      - Hidden Bullish:   price higher-low + indicator lower-low
      - Hidden Bearish:   price lower-high + indicator higher-high

    Parameters
    ----------
    price_series : pd.Series
        Typically the 'close' column (or 'low'/'high' for pivot source).
    indicator_series : pd.Series
        The indicator values aligned to the same index.
    indicator_name : str
        Human-readable name like "RSI", "MACD Histogram", etc.
    window : int
        Number of bars on each side to qualify a swing pivot.
    max_lookback : int
        Only consider pivots within the last *max_lookback* bars.

    Returns
    -------
    list[dict]
        Each element follows the divergence schema (indicator, type,
        direction, strength, barsAgo, description).
    """
    n = len(price_series)
    if n < window * 2 + 2:
        return []

    cutoff = max(0, n - max_lookback)

    # --- Swing lows for bullish divergences ---
    price_lows = [
        (i, v) for i, v in _find_swing_lows(price_series, window) if i >= cutoff
    ]
    ind_lows = [
        (i, v) for i, v in _find_swing_lows(indicator_series, window) if i >= cutoff
    ]

    # --- Swing highs for bearish divergences ---
    price_highs = [
        (i, v) for i, v in _find_swing_highs(price_series, window) if i >= cutoff
    ]
    ind_highs = [
        (i, v) for i, v in _find_swing_highs(indicator_series, window) if i >= cutoff
    ]

    results: List[Dict[str, Any]] = []

    # ---- Bullish divergences (compare consecutive swing lows) ----
    paired_lows = _pair_pivots(price_lows, ind_lows, window)
    for (pi1, pv1), (pi2, pv2), (_, iv1), (_, iv2) in paired_lows:
        # Most recent pivot must be close to the current bar
        if pi2 < cutoff:
            continue

        bars_ago = n - 1 - pi2

        # Regular Bullish: price lower-low, indicator higher-low
        if pv2 < pv1 and iv2 > iv1:
            strength = _calc_strength(pv1, pv2, iv1, iv2, bars_ago)
            results.append({
                "indicator": indicator_name,
                "type": "regular",
                "direction": "bullish",
                "strength": strength,
                "barsAgo": bars_ago,
                "description": (
                    f"Price made lower low but {indicator_name} made higher "
                    f"low — bullish divergence"
                ),
            })

        # Hidden Bullish: price higher-low, indicator lower-low
        if pv2 > pv1 and iv2 < iv1:
            strength = _calc_strength(pv1, pv2, iv1, iv2, bars_ago)
            results.append({
                "indicator": indicator_name,
                "type": "hidden",
                "direction": "bullish",
                "strength": strength,
                "barsAgo": bars_ago,
                "description": (
                    f"Price made higher low but {indicator_name} made lower "
                    f"low — hidden bullish divergence (trend continuation)"
                ),
            })

    # ---- Bearish divergences (compare consecutive swing highs) ----
    paired_highs = _pair_pivots(price_highs, ind_highs, window)
    for (pi1, pv1), (pi2, pv2), (_, iv1), (_, iv2) in paired_highs:
        if pi2 < cutoff:
            continue

        bars_ago = n - 1 - pi2

        # Regular Bearish: price higher-high, indicator lower-high
        if pv2 > pv1 and iv2 < iv1:
            strength = _calc_strength(pv1, pv2, iv1, iv2, bars_ago)
            results.append({
                "indicator": indicator_name,
                "type": "regular",
                "direction": "bearish",
                "strength": strength,
                "barsAgo": bars_ago,
                "description": (
                    f"Price made higher high but {indicator_name} made lower "
                    f"high — bearish divergence"
                ),
            })

        # Hidden Bearish: price lower-high, indicator higher-high
        if pv2 < pv1 and iv2 > iv1:
            strength = _calc_strength(pv1, pv2, iv1, iv2, bars_ago)
            results.append({
                "indicator": indicator_name,
                "type": "hidden",
                "direction": "bearish",
                "strength": strength,
                "barsAgo": bars_ago,
                "description": (
                    f"Price made lower high but {indicator_name} made higher "
                    f"high — hidden bearish divergence (trend continuation)"
                ),
            })

    return results


def _pair_pivots(
    price_pivots: List[Tuple[int, float]],
    ind_pivots: List[Tuple[int, float]],
    window: int,
) -> List[Tuple[Tuple[int, float], Tuple[int, float],
                Tuple[int, float], Tuple[int, float]]]:
    """
    Match each consecutive pair of price pivots to the closest indicator
    pivots (by bar index).  Returns tuples of
    (price_pivot_1, price_pivot_2, ind_pivot_1, ind_pivot_2).
    """
    if len(price_pivots) < 2 or len(ind_pivots) < 2:
        return []

    pairs: List[Tuple[Tuple[int, float], Tuple[int, float],
                       Tuple[int, float], Tuple[int, float]]] = []

    for idx in range(len(price_pivots) - 1):
        pp1 = price_pivots[idx]
        pp2 = price_pivots[idx + 1]

        ip1 = _closest_pivot(ind_pivots, pp1[0], window)
        ip2 = _closest_pivot(ind_pivots, pp2[0], window)

        if ip1 is None or ip2 is None:
            continue
        # Ensure the two indicator pivots are distinct
        if ip1[0] == ip2[0]:
            continue

        pairs.append((pp1, pp2, ip1, ip2))

    return pairs


def _closest_pivot(
    pivots: List[Tuple[int, float]], target_idx: int, max_dist: int
) -> Optional[Tuple[int, float]]:
    """Return the pivot whose index is closest to *target_idx* within ±max_dist."""
    best: Optional[Tuple[int, float]] = None
    best_dist = max_dist + 1
    for p in pivots:
        d = abs(p[0] - target_idx)
        if d < best_dist:
            best_dist = d
            best = p
    return best if best_dist <= max_dist else None


def _calc_strength(
    price_v1: float,
    price_v2: float,
    ind_v1: float,
    ind_v2: float,
    bars_ago: int,
) -> int:
    """
    Rate divergence strength from 1 (weak) to 3 (strong).

    Criteria:
      • Magnitude of divergence — how much price and indicator diverge.
      • Recency — divergences closer to the current bar are stronger.
    """
    # Percentage change in price vs indicator (absolute direction difference)
    price_denom = abs(price_v1) if abs(price_v1) > 1e-12 else 1.0
    ind_denom = abs(ind_v1) if abs(ind_v1) > 1e-12 else 1.0

    price_change = abs(price_v2 - price_v1) / price_denom
    ind_change = abs(ind_v2 - ind_v1) / ind_denom

    divergence_magnitude = price_change + ind_change

    score = 0

    # Magnitude scoring
    if divergence_magnitude > 0.10:
        score += 2
    elif divergence_magnitude > 0.04:
        score += 1

    # Recency scoring
    if bars_ago <= 5:
        score += 2
    elif bars_ago <= 15:
        score += 1

    # Map to 1-3
    if score >= 3:
        return 3
    elif score >= 2:
        return 2
    else:
        return 1


# ------------------------------------------------------------------
# Indicator series helpers (compute from raw OHLCV)
# ------------------------------------------------------------------

def _get_rsi_series(df: pd.DataFrame) -> Optional[pd.Series]:
    """Calculate RSI(14) and return the full series."""
    try:
        series = ta.rsi(df["close"], length=14)
        if series is not None and not series.empty:
            return series
    except Exception:
        pass
    return None


def _get_macd_hist_series(df: pd.DataFrame) -> Optional[pd.Series]:
    """Calculate MACD histogram (12, 26, 9) and return the full series."""
    try:
        result = ta.macd(df["close"], fast=12, slow=26, signal=9)
        if result is not None and not result.empty:
            # pandas_ta macd returns: MACD, MACDh, MACDs
            return result.iloc[:, 1]
    except Exception:
        pass
    return None


def _get_obv_series(df: pd.DataFrame) -> Optional[pd.Series]:
    """Calculate OBV and return the full series."""
    try:
        series = ta.obv(df["close"], df["volume"])
        if series is not None and not series.empty:
            return series
    except Exception:
        pass
    return None


def _get_stoch_k_series(df: pd.DataFrame) -> Optional[pd.Series]:
    """Calculate Stochastic %K (14, 3, 3) and return the full series."""
    try:
        result = ta.stoch(
            df["high"], df["low"], df["close"], k=14, d=3, smooth_k=3
        )
        if result is not None and not result.empty:
            return result.iloc[:, 0]
    except Exception:
        pass
    return None


# ------------------------------------------------------------------
# Public API
# ------------------------------------------------------------------

def detect_divergences(
    df: pd.DataFrame, indicators: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Detect divergences between price and technical indicators.

    Analyses RSI, MACD histogram, OBV, and Stochastic %K for both
    regular and hidden divergences in bullish / bearish directions.

    Parameters
    ----------
    df : pd.DataFrame
        OHLCV DataFrame with columns ['open', 'high', 'low', 'close',
        'volume'].  Should contain at least 50 rows for meaningful
        results.
    indicators : dict
        The dictionary returned by ``calculate_all_indicators()``.
        Currently used for contextual information; the raw indicator
        series are recomputed internally for full-length pivot analysis.

    Returns
    -------
    dict
        {
            "divergences": [ … ],   # list of divergence dicts
            "summary": {
                "totalFound": int,
                "bullishCount": int,
                "bearishCount": int,
                "strongestSignal": str   # "bullish", "bearish", or "neutral"
            }
        }
    """
    empty_result: Dict[str, Any] = {
        "divergences": [],
        "summary": {
            "totalFound": 0,
            "bullishCount": 0,
            "bearishCount": 0,
            "strongestSignal": "neutral",
        },
    }

    # ---- Guard clauses ----
    if df is None or df.empty or len(df) < 50:
        return empty_result

    required_cols = {"open", "high", "low", "close", "volume"}
    if not required_cols.issubset(set(df.columns)):
        return empty_result

    # ---- Price series (use 'low' for bullish pivots, 'high' for bearish) ----
    price_low = df["low"].astype(float)
    price_high = df["high"].astype(float)
    price_close = df["close"].astype(float)

    # ---- Build indicator series ----
    ind_map: Dict[str, Optional[pd.Series]] = {
        "RSI": _get_rsi_series(df),
        "MACD Histogram": _get_macd_hist_series(df),
        "OBV": _get_obv_series(df),
        "Stochastic %K": _get_stoch_k_series(df),
    }

    all_divergences: List[Dict[str, Any]] = []

    for name, ind_series in ind_map.items():
        if ind_series is None or ind_series.empty:
            continue

        # Ensure same length / alignment
        ind_aligned = ind_series.reindex(df.index).astype(float)

        # Detect using close for a unified price reference, window=5
        divs = _detect_divergences_between(
            price_series=price_close,
            indicator_series=ind_aligned,
            indicator_name=name,
            window=5,
            max_lookback=50,
        )
        all_divergences.extend(divs)

    # ---- Deduplicate: keep strongest per (indicator, direction, type) ----
    seen_keys: Dict[str, Dict[str, Any]] = {}
    for d in all_divergences:
        key = f"{d['indicator']}|{d['direction']}|{d['type']}"
        existing = seen_keys.get(key)
        if existing is None or d["strength"] > existing["strength"]:
            seen_keys[key] = d

    unique_divs = sorted(
        seen_keys.values(),
        key=lambda x: (-x["strength"], x["barsAgo"]),
    )

    # ---- Build summary ----
    bullish_count = sum(1 for d in unique_divs if d["direction"] == "bullish")
    bearish_count = sum(1 for d in unique_divs if d["direction"] == "bearish")

    # Strongest signal = direction with more divergences; tie → compare max strength
    if bullish_count == 0 and bearish_count == 0:
        strongest = "neutral"
    elif bullish_count > bearish_count:
        strongest = "bullish"
    elif bearish_count > bullish_count:
        strongest = "bearish"
    else:
        # Equal counts — compare max strength
        max_bull = max(
            (d["strength"] for d in unique_divs if d["direction"] == "bullish"),
            default=0,
        )
        max_bear = max(
            (d["strength"] for d in unique_divs if d["direction"] == "bearish"),
            default=0,
        )
        if max_bull > max_bear:
            strongest = "bullish"
        elif max_bear > max_bull:
            strongest = "bearish"
        else:
            strongest = "neutral"

    return {
        "divergences": unique_divs,
        "summary": {
            "totalFound": len(unique_divs),
            "bullishCount": bullish_count,
            "bearishCount": bearish_count,
            "strongestSignal": strongest,
        },
    }
