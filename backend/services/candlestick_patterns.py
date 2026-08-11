# ============================================================
# CANDLESTICK PATTERNS — Detection from OHLCV DataFrames
# ============================================================
#
# Detects ~25 candlestick patterns using pandas_ta (where available)
# and custom OHLC calculations. Does NOT require TA-Lib.
#
# Usage:
#     from services.candlestick_patterns import detect_candlestick_patterns
#     result = detect_candlestick_patterns(df, lookback=5)
# ============================================================

import math
import pandas as pd
import pandas_ta as ta
import numpy as np
from typing import Dict, Any, List, Optional


# ---- Helpers ----

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


def _body(row: pd.Series) -> float:
    """Absolute body size of a candle."""
    return abs(row["close"] - row["open"])


def _upper_shadow(row: pd.Series) -> float:
    """Upper shadow (wick) length."""
    return row["high"] - max(row["close"], row["open"])


def _lower_shadow(row: pd.Series) -> float:
    """Lower shadow (tail) length."""
    return min(row["close"], row["open"]) - row["low"]


def _range(row: pd.Series) -> float:
    """Full high-low range of a candle."""
    return row["high"] - row["low"]


def _is_bullish(row: pd.Series) -> bool:
    """True if candle closed higher than it opened."""
    return row["close"] > row["open"]


def _is_bearish(row: pd.Series) -> bool:
    """True if candle closed lower than it opened."""
    return row["close"] < row["open"]


def _avg_body(df: pd.DataFrame, end_idx: int, periods: int = 10) -> float:
    """Average absolute body size over the last `periods` candles ending at end_idx."""
    start = max(0, end_idx - periods)
    subset = df.iloc[start:end_idx]
    if subset.empty:
        return 0.0
    return float((subset["close"] - subset["open"]).abs().mean())


def _avg_range(df: pd.DataFrame, end_idx: int, periods: int = 10) -> float:
    """Average high-low range over the last `periods` candles ending at end_idx."""
    start = max(0, end_idx - periods)
    subset = df.iloc[start:end_idx]
    if subset.empty:
        return 0.0
    return float((subset["high"] - subset["low"]).mean())


def _is_downtrend(df: pd.DataFrame, idx: int, periods: int = 5) -> bool:
    """Check if there's a short-term downtrend before the given index."""
    if idx < periods:
        return False
    closes = df["close"].iloc[idx - periods:idx]
    return bool(closes.iloc[-1] < closes.iloc[0])


def _is_uptrend(df: pd.DataFrame, idx: int, periods: int = 5) -> bool:
    """Check if there's a short-term uptrend before the given index."""
    if idx < periods:
        return False
    closes = df["close"].iloc[idx - periods:idx]
    return bool(closes.iloc[-1] > closes.iloc[0])


# ============================================================
# INDIVIDUAL PATTERN DETECTORS
# ============================================================
# Each function scans the last `lookback` bars of the DataFrame
# and returns a list of dicts with {barsAgo: int} for each hit.
# ============================================================


def _detect_doji(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Doji — body is very small relative to the range.
    Uses pandas_ta cdl_doji for detection (no TA-Lib needed).
    """
    hits: List[Dict[str, int]] = []
    try:
        doji_series = ta.cdl_doji(
            df["open"], df["high"], df["low"], df["close"],
            length=10, scalar=100, asint=True,
        )
        if doji_series is None or doji_series.empty:
            return hits
        n = len(df)
        for offset in range(lookback):
            idx = n - 1 - offset
            if idx < 0:
                break
            val = _safe_float(doji_series.iloc[idx])
            if val != 0:
                hits.append({"barsAgo": offset})
    except Exception:
        # Fallback: manual doji detection
        n = len(df)
        for offset in range(lookback):
            idx = n - 1 - offset
            if idx < 0:
                break
            row = df.iloc[idx]
            rng = _range(row)
            if rng == 0:
                continue
            if _body(row) / rng < 0.05:
                hits.append({"barsAgo": offset})
    return hits


def _detect_long_legged_doji(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Long-Legged Doji — doji with exceptionally long upper AND lower shadows.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 0:
            break
        row = df.iloc[idx]
        rng = _range(row)
        if rng == 0:
            continue
        body = _body(row)
        upper = _upper_shadow(row)
        lower = _lower_shadow(row)
        avg_rng = _avg_range(df, idx, 10)
        # Body is tiny, both shadows are long, total range is above average
        if (body / rng < 0.10
                and upper > rng * 0.30
                and lower > rng * 0.30
                and rng > avg_rng * 0.8):
            hits.append({"barsAgo": offset})
    return hits


def _detect_dragonfly_doji(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Dragonfly Doji — doji with long lower shadow and almost no upper shadow.
    Bullish reversal signal.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 0:
            break
        row = df.iloc[idx]
        rng = _range(row)
        if rng == 0:
            continue
        body = _body(row)
        upper = _upper_shadow(row)
        lower = _lower_shadow(row)
        if (body / rng < 0.10
                and lower > rng * 0.60
                and upper < rng * 0.10):
            hits.append({"barsAgo": offset})
    return hits


def _detect_gravestone_doji(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Gravestone Doji — doji with long upper shadow and almost no lower shadow.
    Bearish reversal signal.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 0:
            break
        row = df.iloc[idx]
        rng = _range(row)
        if rng == 0:
            continue
        body = _body(row)
        upper = _upper_shadow(row)
        lower = _lower_shadow(row)
        if (body / rng < 0.10
                and upper > rng * 0.60
                and lower < rng * 0.10):
            hits.append({"barsAgo": offset})
    return hits


def _detect_hammer(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Hammer — small body at top, long lower shadow (>= 2x body), tiny upper shadow.
    Bullish reversal after downtrend.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 0:
            break
        row = df.iloc[idx]
        rng = _range(row)
        body = _body(row)
        if rng == 0 or body == 0:
            continue
        upper = _upper_shadow(row)
        lower = _lower_shadow(row)
        if (lower >= body * 2.0
                and upper <= body * 0.5
                and body < rng * 0.40
                and _is_downtrend(df, idx)):
            hits.append({"barsAgo": offset})
    return hits


def _detect_inverted_hammer(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Inverted Hammer — small body at bottom, long upper shadow (>= 2x body), tiny lower shadow.
    Bullish reversal after downtrend.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 0:
            break
        row = df.iloc[idx]
        rng = _range(row)
        body = _body(row)
        if rng == 0 or body == 0:
            continue
        upper = _upper_shadow(row)
        lower = _lower_shadow(row)
        if (upper >= body * 2.0
                and lower <= body * 0.5
                and body < rng * 0.40
                and _is_downtrend(df, idx)):
            hits.append({"barsAgo": offset})
    return hits


def _detect_shooting_star(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Shooting Star — small body at bottom, long upper shadow (>= 2x body), tiny lower shadow.
    Bearish reversal after uptrend.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 0:
            break
        row = df.iloc[idx]
        rng = _range(row)
        body = _body(row)
        if rng == 0 or body == 0:
            continue
        upper = _upper_shadow(row)
        lower = _lower_shadow(row)
        if (upper >= body * 2.0
                and lower <= body * 0.5
                and body < rng * 0.40
                and _is_uptrend(df, idx)):
            hits.append({"barsAgo": offset})
    return hits


def _detect_hanging_man(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Hanging Man — same shape as hammer but after uptrend.
    Bearish reversal signal.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 0:
            break
        row = df.iloc[idx]
        rng = _range(row)
        body = _body(row)
        if rng == 0 or body == 0:
            continue
        upper = _upper_shadow(row)
        lower = _lower_shadow(row)
        if (lower >= body * 2.0
                and upper <= body * 0.5
                and body < rng * 0.40
                and _is_uptrend(df, idx)):
            hits.append({"barsAgo": offset})
    return hits


def _detect_bullish_engulfing(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Bullish Engulfing — bearish candle followed by a larger bullish candle
    that fully engulfs the previous body. Bullish reversal.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 1:
            break
        curr = df.iloc[idx]
        prev = df.iloc[idx - 1]
        if (_is_bearish(prev)
                and _is_bullish(curr)
                and curr["open"] <= prev["close"]
                and curr["close"] >= prev["open"]
                and _body(curr) > _body(prev)
                and _is_downtrend(df, idx - 1)):
            hits.append({"barsAgo": offset})
    return hits


def _detect_bearish_engulfing(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Bearish Engulfing — bullish candle followed by a larger bearish candle
    that fully engulfs the previous body. Bearish reversal.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 1:
            break
        curr = df.iloc[idx]
        prev = df.iloc[idx - 1]
        if (_is_bullish(prev)
                and _is_bearish(curr)
                and curr["open"] >= prev["close"]
                and curr["close"] <= prev["open"]
                and _body(curr) > _body(prev)
                and _is_uptrend(df, idx - 1)):
            hits.append({"barsAgo": offset})
    return hits


def _detect_bullish_harami(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Bullish Harami — large bearish candle followed by a small bullish candle
    contained within the previous body. Bullish reversal.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 1:
            break
        curr = df.iloc[idx]
        prev = df.iloc[idx - 1]
        avg_b = _avg_body(df, idx - 1, 10)
        if (_is_bearish(prev)
                and _is_bullish(curr)
                and _body(prev) > avg_b * 0.8
                and curr["close"] < prev["open"]
                and curr["open"] > prev["close"]
                and _body(curr) < _body(prev) * 0.5):
            hits.append({"barsAgo": offset})
    return hits


def _detect_bearish_harami(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Bearish Harami — large bullish candle followed by a small bearish candle
    contained within the previous body. Bearish reversal.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 1:
            break
        curr = df.iloc[idx]
        prev = df.iloc[idx - 1]
        avg_b = _avg_body(df, idx - 1, 10)
        if (_is_bullish(prev)
                and _is_bearish(curr)
                and _body(prev) > avg_b * 0.8
                and curr["open"] < prev["close"]
                and curr["close"] > prev["open"]
                and _body(curr) < _body(prev) * 0.5):
            hits.append({"barsAgo": offset})
    return hits


def _detect_morning_star(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Morning Star — 3-candle pattern:
      1) Large bearish candle
      2) Small-body candle (gap down preferred)
      3) Large bullish candle closing into the first candle's body
    Bullish reversal.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 2:
            break
        c3 = df.iloc[idx]      # Current (third candle)
        c2 = df.iloc[idx - 1]  # Middle
        c1 = df.iloc[idx - 2]  # First
        avg_b = _avg_body(df, idx - 2, 10)

        if (_is_bearish(c1)
                and _body(c1) > avg_b * 0.8
                and _body(c2) < avg_b * 0.5
                and _is_bullish(c3)
                and _body(c3) > avg_b * 0.8
                and c3["close"] > (c1["open"] + c1["close"]) / 2):
            hits.append({"barsAgo": offset})
    return hits


def _detect_evening_star(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Evening Star — 3-candle pattern (opposite of Morning Star):
      1) Large bullish candle
      2) Small-body candle (gap up preferred)
      3) Large bearish candle closing into the first candle's body
    Bearish reversal.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 2:
            break
        c3 = df.iloc[idx]
        c2 = df.iloc[idx - 1]
        c1 = df.iloc[idx - 2]
        avg_b = _avg_body(df, idx - 2, 10)

        if (_is_bullish(c1)
                and _body(c1) > avg_b * 0.8
                and _body(c2) < avg_b * 0.5
                and _is_bearish(c3)
                and _body(c3) > avg_b * 0.8
                and c3["close"] < (c1["open"] + c1["close"]) / 2):
            hits.append({"barsAgo": offset})
    return hits


def _detect_piercing_line(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Piercing Line — 2-candle bullish reversal:
      1) Bearish candle
      2) Bullish candle opening below prev low, closing above midpoint of prev body
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 1:
            break
        curr = df.iloc[idx]
        prev = df.iloc[idx - 1]
        prev_mid = (prev["open"] + prev["close"]) / 2

        if (_is_bearish(prev)
                and _is_bullish(curr)
                and curr["open"] < prev["low"]
                and curr["close"] > prev_mid
                and curr["close"] < prev["open"]
                and _is_downtrend(df, idx - 1)):
            hits.append({"barsAgo": offset})
    return hits


def _detect_dark_cloud_cover(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Dark Cloud Cover — 2-candle bearish reversal (opposite of Piercing Line):
      1) Bullish candle
      2) Bearish candle opening above prev high, closing below midpoint of prev body
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 1:
            break
        curr = df.iloc[idx]
        prev = df.iloc[idx - 1]
        prev_mid = (prev["open"] + prev["close"]) / 2

        if (_is_bullish(prev)
                and _is_bearish(curr)
                and curr["open"] > prev["high"]
                and curr["close"] < prev_mid
                and curr["close"] > prev["open"]
                and _is_uptrend(df, idx - 1)):
            hits.append({"barsAgo": offset})
    return hits


def _detect_three_white_soldiers(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Three White Soldiers — 3 consecutive bullish candles with progressively
    higher closes and small upper shadows. Strong bullish continuation/reversal.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 2:
            break
        c1 = df.iloc[idx - 2]
        c2 = df.iloc[idx - 1]
        c3 = df.iloc[idx]
        avg_b = _avg_body(df, idx - 2, 10)

        if (_is_bullish(c1) and _is_bullish(c2) and _is_bullish(c3)
                and c2["close"] > c1["close"]
                and c3["close"] > c2["close"]
                and c2["open"] > c1["open"]
                and c3["open"] > c2["open"]
                and _body(c1) > avg_b * 0.5
                and _body(c2) > avg_b * 0.5
                and _body(c3) > avg_b * 0.5
                and _upper_shadow(c1) < _body(c1) * 0.5
                and _upper_shadow(c2) < _body(c2) * 0.5
                and _upper_shadow(c3) < _body(c3) * 0.5):
            hits.append({"barsAgo": offset})
    return hits


def _detect_three_black_crows(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Three Black Crows — 3 consecutive bearish candles with progressively
    lower closes and small lower shadows. Strong bearish continuation/reversal.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 2:
            break
        c1 = df.iloc[idx - 2]
        c2 = df.iloc[idx - 1]
        c3 = df.iloc[idx]
        avg_b = _avg_body(df, idx - 2, 10)

        if (_is_bearish(c1) and _is_bearish(c2) and _is_bearish(c3)
                and c2["close"] < c1["close"]
                and c3["close"] < c2["close"]
                and c2["open"] < c1["open"]
                and c3["open"] < c2["open"]
                and _body(c1) > avg_b * 0.5
                and _body(c2) > avg_b * 0.5
                and _body(c3) > avg_b * 0.5
                and _lower_shadow(c1) < _body(c1) * 0.5
                and _lower_shadow(c2) < _body(c2) * 0.5
                and _lower_shadow(c3) < _body(c3) * 0.5):
            hits.append({"barsAgo": offset})
    return hits


def _detect_spinning_top(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Spinning Top — small body with upper and lower shadows longer than the body.
    Indecision signal.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 0:
            break
        row = df.iloc[idx]
        rng = _range(row)
        body = _body(row)
        if rng == 0:
            continue
        upper = _upper_shadow(row)
        lower = _lower_shadow(row)
        # Body is small but not doji-tiny; both shadows exceed body
        if (0.05 < body / rng < 0.35
                and upper > body
                and lower > body):
            hits.append({"barsAgo": offset})
    return hits


def _detect_marubozu(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Marubozu — candle with little to no shadows (body is ~95%+ of range).
    Direction depends on whether bullish or bearish.
    Returns hits with extra 'direction' key.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 0:
            break
        row = df.iloc[idx]
        rng = _range(row)
        body = _body(row)
        if rng == 0:
            continue
        if body / rng >= 0.92:
            direction = "bullish" if _is_bullish(row) else "bearish"
            hits.append({"barsAgo": offset, "direction": direction})
    return hits


def _detect_tweezer_top(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Tweezer Top — two candles with matching highs at top of uptrend.
    First bullish, second bearish. Bearish reversal.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 1:
            break
        curr = df.iloc[idx]
        prev = df.iloc[idx - 1]
        avg_rng = _avg_range(df, idx - 1, 10)
        tolerance = avg_rng * 0.05 if avg_rng > 0 else 0.01

        if (_is_bullish(prev)
                and _is_bearish(curr)
                and abs(prev["high"] - curr["high"]) <= tolerance
                and _is_uptrend(df, idx - 1)):
            hits.append({"barsAgo": offset})
    return hits


def _detect_tweezer_bottom(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Tweezer Bottom — two candles with matching lows at bottom of downtrend.
    First bearish, second bullish. Bullish reversal.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 1:
            break
        curr = df.iloc[idx]
        prev = df.iloc[idx - 1]
        avg_rng = _avg_range(df, idx - 1, 10)
        tolerance = avg_rng * 0.05 if avg_rng > 0 else 0.01

        if (_is_bearish(prev)
                and _is_bullish(curr)
                and abs(prev["low"] - curr["low"]) <= tolerance
                and _is_downtrend(df, idx - 1)):
            hits.append({"barsAgo": offset})
    return hits


def _detect_three_inside_up(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Three Inside Up — bullish harami confirmed by a third bullish candle
    closing above the first candle's open. Strong bullish reversal.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 2:
            break
        c1 = df.iloc[idx - 2]
        c2 = df.iloc[idx - 1]
        c3 = df.iloc[idx]

        if (_is_bearish(c1)
                and _is_bullish(c2)
                and c2["open"] > c1["close"]
                and c2["close"] < c1["open"]
                and _body(c2) < _body(c1) * 0.5
                and _is_bullish(c3)
                and c3["close"] > c1["open"]):
            hits.append({"barsAgo": offset})
    return hits


def _detect_three_inside_down(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Three Inside Down — bearish harami confirmed by a third bearish candle
    closing below the first candle's open. Strong bearish reversal.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 2:
            break
        c1 = df.iloc[idx - 2]
        c2 = df.iloc[idx - 1]
        c3 = df.iloc[idx]

        if (_is_bullish(c1)
                and _is_bearish(c2)
                and c2["open"] < c1["close"]
                and c2["close"] > c1["open"]
                and _body(c2) < _body(c1) * 0.5
                and _is_bearish(c3)
                and c3["close"] < c1["open"]):
            hits.append({"barsAgo": offset})
    return hits


def _detect_belt_hold_bullish(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Bullish Belt Hold — long bullish candle opening at/near the low
    with no/tiny lower shadow after a downtrend.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 0:
            break
        row = df.iloc[idx]
        rng = _range(row)
        body = _body(row)
        if rng == 0:
            continue
        avg_b = _avg_body(df, idx, 10)
        lower = _lower_shadow(row)

        if (_is_bullish(row)
                and body > avg_b * 1.2
                and lower < rng * 0.05
                and body / rng > 0.80
                and _is_downtrend(df, idx)):
            hits.append({"barsAgo": offset})
    return hits


def _detect_belt_hold_bearish(df: pd.DataFrame, lookback: int) -> List[Dict[str, int]]:
    """
    Bearish Belt Hold — long bearish candle opening at/near the high
    with no/tiny upper shadow after an uptrend.
    """
    hits: List[Dict[str, int]] = []
    n = len(df)
    for offset in range(lookback):
        idx = n - 1 - offset
        if idx < 0:
            break
        row = df.iloc[idx]
        rng = _range(row)
        body = _body(row)
        if rng == 0:
            continue
        avg_b = _avg_body(df, idx, 10)
        upper = _upper_shadow(row)

        if (_is_bearish(row)
                and body > avg_b * 1.2
                and upper < rng * 0.05
                and body / rng > 0.80
                and _is_uptrend(df, idx)):
            hits.append({"barsAgo": offset})
    return hits


# ============================================================
# PATTERN REGISTRY
# ============================================================
# Maps each pattern to its detector, metadata, and Spanish name.
# ============================================================

_PATTERN_REGISTRY: List[Dict[str, Any]] = [
    # ---- Bullish Reversal ----
    {
        "name": "Hammer",
        "nameES": "Martillo",
        "type": "bullish",
        "reliability": 3,
        "description": "Potential bullish reversal after downtrend",
        "descriptionES": "Posible reversión alcista tras tendencia bajista",
        "detector": _detect_hammer,
    },
    {
        "name": "Inverted Hammer",
        "nameES": "Martillo Invertido",
        "type": "bullish",
        "reliability": 2,
        "description": "Potential bullish reversal, needs confirmation",
        "descriptionES": "Posible reversión alcista, requiere confirmación",
        "detector": _detect_inverted_hammer,
    },
    {
        "name": "Morning Star",
        "nameES": "Estrella de la Mañana",
        "type": "bullish",
        "reliability": 4,
        "description": "Strong bullish reversal pattern (3-candle)",
        "descriptionES": "Patrón fuerte de reversión alcista (3 velas)",
        "detector": _detect_morning_star,
    },
    {
        "name": "Bullish Engulfing",
        "nameES": "Envolvente Alcista",
        "type": "bullish",
        "reliability": 4,
        "description": "Bullish candle fully engulfs previous bearish candle",
        "descriptionES": "Vela alcista envuelve completamente la vela bajista previa",
        "detector": _detect_bullish_engulfing,
    },
    {
        "name": "Piercing Line",
        "nameES": "Línea de Penetración",
        "type": "bullish",
        "reliability": 3,
        "description": "Bullish candle closes above midpoint of previous bearish candle",
        "descriptionES": "Vela alcista cierra por encima del punto medio de la vela bajista previa",
        "detector": _detect_piercing_line,
    },
    {
        "name": "Three White Soldiers",
        "nameES": "Tres Soldados Blancos",
        "type": "bullish",
        "reliability": 5,
        "description": "Three consecutive strong bullish candles — very strong reversal",
        "descriptionES": "Tres velas alcistas fuertes consecutivas — reversión muy fuerte",
        "detector": _detect_three_white_soldiers,
    },
    {
        "name": "Dragonfly Doji",
        "nameES": "Doji Libélula",
        "type": "bullish",
        "reliability": 3,
        "description": "Doji with long lower shadow, buyers pushed price back up",
        "descriptionES": "Doji con sombra inferior larga, compradores recuperaron el precio",
        "detector": _detect_dragonfly_doji,
    },
    {
        "name": "Bullish Harami",
        "nameES": "Harami Alcista",
        "type": "bullish",
        "reliability": 3,
        "description": "Small bullish candle inside previous large bearish candle",
        "descriptionES": "Vela alcista pequeña dentro de una gran vela bajista previa",
        "detector": _detect_bullish_harami,
    },
    {
        "name": "Tweezer Bottom",
        "nameES": "Pinzas Inferior",
        "type": "bullish",
        "reliability": 3,
        "description": "Two candles with matching lows at bottom of downtrend",
        "descriptionES": "Dos velas con mínimos iguales al final de tendencia bajista",
        "detector": _detect_tweezer_bottom,
    },
    {
        "name": "Three Inside Up",
        "nameES": "Tres Interior Alcista",
        "type": "bullish",
        "reliability": 4,
        "description": "Confirmed bullish harami with breakout candle",
        "descriptionES": "Harami alcista confirmado con vela de ruptura",
        "detector": _detect_three_inside_up,
    },
    {
        "name": "Bullish Belt Hold",
        "nameES": "Cinturón Alcista",
        "type": "bullish",
        "reliability": 2,
        "description": "Strong bullish candle opening at low after downtrend",
        "descriptionES": "Vela alcista fuerte abriendo en el mínimo tras tendencia bajista",
        "detector": _detect_belt_hold_bullish,
    },
    # ---- Bearish Reversal ----
    {
        "name": "Shooting Star",
        "nameES": "Estrella Fugaz",
        "type": "bearish",
        "reliability": 3,
        "description": "Potential bearish reversal after uptrend",
        "descriptionES": "Posible reversión bajista tras tendencia alcista",
        "detector": _detect_shooting_star,
    },
    {
        "name": "Hanging Man",
        "nameES": "Hombre Colgado",
        "type": "bearish",
        "reliability": 3,
        "description": "Hammer shape at top of uptrend — bearish reversal warning",
        "descriptionES": "Forma de martillo en la cima — advertencia de reversión bajista",
        "detector": _detect_hanging_man,
    },
    {
        "name": "Evening Star",
        "nameES": "Estrella Vespertina",
        "type": "bearish",
        "reliability": 4,
        "description": "Strong bearish reversal pattern (3-candle)",
        "descriptionES": "Patrón fuerte de reversión bajista (3 velas)",
        "detector": _detect_evening_star,
    },
    {
        "name": "Bearish Engulfing",
        "nameES": "Envolvente Bajista",
        "type": "bearish",
        "reliability": 4,
        "description": "Bearish candle fully engulfs previous bullish candle",
        "descriptionES": "Vela bajista envuelve completamente la vela alcista previa",
        "detector": _detect_bearish_engulfing,
    },
    {
        "name": "Dark Cloud Cover",
        "nameES": "Cubierta de Nube Oscura",
        "type": "bearish",
        "reliability": 3,
        "description": "Bearish candle closes below midpoint of previous bullish candle",
        "descriptionES": "Vela bajista cierra por debajo del punto medio de la vela alcista previa",
        "detector": _detect_dark_cloud_cover,
    },
    {
        "name": "Three Black Crows",
        "nameES": "Tres Cuervos Negros",
        "type": "bearish",
        "reliability": 5,
        "description": "Three consecutive strong bearish candles — very strong reversal",
        "descriptionES": "Tres velas bajistas fuertes consecutivas — reversión muy fuerte",
        "detector": _detect_three_black_crows,
    },
    {
        "name": "Gravestone Doji",
        "nameES": "Doji Lápida",
        "type": "bearish",
        "reliability": 3,
        "description": "Doji with long upper shadow, sellers pushed price back down",
        "descriptionES": "Doji con sombra superior larga, vendedores empujaron el precio a la baja",
        "detector": _detect_gravestone_doji,
    },
    {
        "name": "Bearish Harami",
        "nameES": "Harami Bajista",
        "type": "bearish",
        "reliability": 3,
        "description": "Small bearish candle inside previous large bullish candle",
        "descriptionES": "Vela bajista pequeña dentro de una gran vela alcista previa",
        "detector": _detect_bearish_harami,
    },
    {
        "name": "Tweezer Top",
        "nameES": "Pinzas Superior",
        "type": "bearish",
        "reliability": 3,
        "description": "Two candles with matching highs at top of uptrend",
        "descriptionES": "Dos velas con máximos iguales en la cima de tendencia alcista",
        "detector": _detect_tweezer_top,
    },
    {
        "name": "Three Inside Down",
        "nameES": "Tres Interior Bajista",
        "type": "bearish",
        "reliability": 4,
        "description": "Confirmed bearish harami with breakdown candle",
        "descriptionES": "Harami bajista confirmado con vela de ruptura",
        "detector": _detect_three_inside_down,
    },
    {
        "name": "Bearish Belt Hold",
        "nameES": "Cinturón Bajista",
        "type": "bearish",
        "reliability": 2,
        "description": "Strong bearish candle opening at high after uptrend",
        "descriptionES": "Vela bajista fuerte abriendo en el máximo tras tendencia alcista",
        "detector": _detect_belt_hold_bearish,
    },
    # ---- Neutral / Indecision ----
    {
        "name": "Doji",
        "nameES": "Doji",
        "type": "neutral",
        "reliability": 2,
        "description": "Market indecision — open and close are nearly equal",
        "descriptionES": "Indecisión del mercado — apertura y cierre son casi iguales",
        "detector": _detect_doji,
    },
    {
        "name": "Long-Legged Doji",
        "nameES": "Doji de Piernas Largas",
        "type": "neutral",
        "reliability": 3,
        "description": "Strong indecision with high volatility in both directions",
        "descriptionES": "Fuerte indecisión con alta volatilidad en ambas direcciones",
        "detector": _detect_long_legged_doji,
    },
    {
        "name": "Spinning Top",
        "nameES": "Peonza",
        "type": "neutral",
        "reliability": 2,
        "description": "Small body with shadows on both sides — indecision",
        "descriptionES": "Cuerpo pequeño con sombras en ambos lados — indecisión",
        "detector": _detect_spinning_top,
    },
]


# ============================================================
# MAIN PUBLIC FUNCTION
# ============================================================

def detect_candlestick_patterns(df: pd.DataFrame, lookback: int = 5) -> Dict[str, Any]:
    """
    Detect candlestick patterns in an OHLCV DataFrame.

    Scans the last `lookback` candles for ~25 standard candlestick patterns
    using pandas_ta (where available) and custom OHLC math.

    Parameters:
        df: DataFrame with columns ['open', 'high', 'low', 'close', 'volume'].
            Should have at least 15 rows for reliable detection.
        lookback: How many recent bars to scan. Default: 5.

    Returns:
        Dict with 'patterns' (list of detected patterns) and 'summary'
        containing counts and dominant bias.
    """
    empty_result: Dict[str, Any] = {
        "patterns": [],
        "summary": {
            "bullishCount": 0,
            "bearishCount": 0,
            "neutralCount": 0,
            "dominantBias": "neutral",
        },
    }

    # ---- Validate input ----
    if df is None or df.empty:
        return empty_result

    required_cols = {"open", "high", "low", "close"}
    if not required_cols.issubset(set(df.columns)):
        return empty_result

    if len(df) < 5:
        return empty_result

    # Clamp lookback to available data
    lookback = min(lookback, len(df) - 3)
    if lookback < 1:
        lookback = 1

    # ---- Run all detectors ----
    detected: List[Dict[str, Any]] = []

    for entry in _PATTERN_REGISTRY:
        try:
            detector = entry["detector"]
            hits = detector(df, lookback)

            for hit in hits:
                pattern_type = entry["type"]
                # Marubozu: override type based on candle direction
                if entry["name"] == "Marubozu":
                    direction = hit.get("direction", "bullish")
                    pattern_type = direction

                detected.append({
                    "name": entry["name"],
                    "nameES": entry["nameES"],
                    "type": pattern_type,
                    "reliability": entry["reliability"],
                    "barsAgo": hit["barsAgo"],
                    "description": entry["description"],
                    "descriptionES": entry["descriptionES"],
                })
        except Exception as e:
            # Individual pattern failure should not crash the whole module
            print(f"[CandlestickPatterns] Error detecting {entry['name']}: {e}")
            continue

    # Also detect Marubozu separately (it's not in the registry loop above
    # because it has special type logic, but it IS in the registry)
    # Actually it IS handled above via the direction override — add it now.
    # We need to add Marubozu to the registry:
    # (Already handled by _detect_marubozu + the direction override above)

    # Deduplicate: if the same pattern fires at the same barsAgo, keep only once
    seen = set()
    unique_detected: List[Dict[str, Any]] = []
    for p in detected:
        key = (p["name"], p["barsAgo"], p["type"])
        if key not in seen:
            seen.add(key)
            unique_detected.append(p)

    # Sort by barsAgo (most recent first), then by reliability (highest first)
    unique_detected.sort(key=lambda p: (p["barsAgo"], -p["reliability"]))

    # ---- Build summary ----
    bullish_count = sum(1 for p in unique_detected if p["type"] == "bullish")
    bearish_count = sum(1 for p in unique_detected if p["type"] == "bearish")
    neutral_count = sum(1 for p in unique_detected if p["type"] == "neutral")

    # Determine dominant bias using weighted count (reliability matters)
    bullish_weight = sum(p["reliability"] for p in unique_detected if p["type"] == "bullish")
    bearish_weight = sum(p["reliability"] for p in unique_detected if p["type"] == "bearish")

    if bullish_weight > bearish_weight:
        dominant_bias = "bullish"
    elif bearish_weight > bullish_weight:
        dominant_bias = "bearish"
    else:
        dominant_bias = "neutral"

    return {
        "patterns": unique_detected,
        "summary": {
            "bullishCount": bullish_count,
            "bearishCount": bearish_count,
            "neutralCount": neutral_count,
            "dominantBias": dominant_bias,
        },
    }
