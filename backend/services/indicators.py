# ============================================================
# INDICATORS — Real technical analysis with pandas-ta
# ============================================================

import math
import numpy as np
import pandas as pd
import pandas_ta as ta
from typing import Dict, Any


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


def calculate_all_indicators(df: pd.DataFrame, current_price: float) -> Dict[str, Any]:
    """
    Calculate a comprehensive set of technical indicators on OHLCV DataFrame.
    Returns a dict matching the FullIndicatorSet schema.
    
    Requires: df with columns ['open', 'high', 'low', 'close', 'volume']
    and at least 200 rows for EMA200 to be meaningful.
    """
    close = df["close"]
    high = df["high"]
    low = df["low"]
    volume = df["volume"]

    # ---- Momentum ----

    # RSI (14 periods)
    rsi_series = ta.rsi(close, length=14)
    rsi = round(_safe_float(
        rsi_series.iloc[-1] if rsi_series is not None and not rsi_series.empty else None,
        50.0
    ), 2)

    # Stochastic (14, 3, 3)
    stoch = ta.stoch(high, low, close, k=14, d=3, smooth_k=3)
    if stoch is not None and not stoch.empty:
        stoch_k = round(_safe_float(stoch.iloc[-1, 0], 50.0), 2)
        stoch_d = round(_safe_float(stoch.iloc[-1, 1], 50.0), 2)
    else:
        stoch_k, stoch_d = 50.0, 50.0

    # MACD (12, 26, 9)
    macd_result = ta.macd(close, fast=12, slow=26, signal=9)
    if macd_result is not None and not macd_result.empty:
        macd_val = round(_safe_float(macd_result.iloc[-1, 0], 0.0), 4)
        macd_hist = round(_safe_float(macd_result.iloc[-1, 1], 0.0), 4)
        macd_sig = round(_safe_float(macd_result.iloc[-1, 2], 0.0), 4)
    else:
        macd_val, macd_sig, macd_hist = 0.0, 0.0, 0.0

    # ---- Trend ----

    # EMAs
    ema20_series = ta.ema(close, length=20)
    ema50_series = ta.ema(close, length=50)
    ema200_series = ta.ema(close, length=200)
    sma50_series = ta.sma(close, length=50)
    sma200_series = ta.sma(close, length=200)

    ema20 = round(_safe_float(
        ema20_series.iloc[-1] if ema20_series is not None and not ema20_series.empty else None,
        current_price
    ), 2)
    ema50 = round(_safe_float(
        ema50_series.iloc[-1] if ema50_series is not None and not ema50_series.empty else None,
        current_price
    ), 2)
    ema200 = round(_safe_float(
        ema200_series.iloc[-1] if ema200_series is not None and not ema200_series.empty else None,
        current_price
    ), 2)
    sma50 = round(_safe_float(
        sma50_series.iloc[-1] if sma50_series is not None and not sma50_series.empty else None,
        current_price
    ), 2)
    sma200 = round(_safe_float(
        sma200_series.iloc[-1] if sma200_series is not None and not sma200_series.empty else None,
        current_price
    ), 2)

    # ADX (14)
    adx_result = ta.adx(high, low, close, length=14)
    if adx_result is not None and not adx_result.empty:
        adx_val = round(_safe_float(adx_result.iloc[-1, 0], 25.0), 2)
        # DI+ and DI- for trend direction
        di_plus = _safe_float(adx_result.iloc[-1, 1] if adx_result.shape[1] > 1 else None, 25.0)
        di_minus = _safe_float(adx_result.iloc[-1, 2] if adx_result.shape[1] > 2 else None, 25.0)
    else:
        adx_val = 25.0
        di_plus, di_minus = 25.0, 25.0

    # Supertrend (period=10, multiplier=3)
    # pandas_ta supertrend returns columns: [SUPERT, SUPERTd, SUPERTl, SUPERTs]
    # SUPERTd: 1 = uptrend (bullish), -1 = downtrend (bearish)
    st = ta.supertrend(high, low, close, length=10, multiplier=3.0)
    if st is not None and not st.empty:
        st_val = round(_safe_float(st.iloc[-1, 0], current_price), 2)
        # SUPERTd column: 1 means uptrend (price above supertrend line = bullish)
        # -1 means downtrend (price below supertrend line = bearish)
        st_direction_val = _safe_float(st.iloc[-1, 1], 1.0)
        st_dir = "up" if st_direction_val > 0 else "down"
    else:
        st_val = current_price
        st_dir = "up" if current_price > ema50 else "down"

    # Ichimoku (9, 26, 52)
    ichimoku_result = ta.ichimoku(high, low, close, tenkan=9, kijun=26, senkou=52)
    if ichimoku_result is not None and isinstance(ichimoku_result, tuple) and len(ichimoku_result) >= 2:
        ichi_df = ichimoku_result[0]
        if not ichi_df.empty:
            tenkan = round(_safe_float(ichi_df.iloc[-1, 0], current_price), 2)
            kijun = round(_safe_float(ichi_df.iloc[-1, 1], current_price), 2)
            senkou_a = round(_safe_float(
                ichi_df.iloc[-1, 2] if ichi_df.shape[1] > 2 else None,
                current_price
            ), 2)
            senkou_b = round(_safe_float(
                ichi_df.iloc[-1, 3] if ichi_df.shape[1] > 3 else None,
                current_price
            ), 2)
            chikou = round(_safe_float(
                ichi_df.iloc[-1, 4] if ichi_df.shape[1] > 4 else None,
                current_price
            ), 2)
        else:
            tenkan = kijun = senkou_a = senkou_b = chikou = current_price
    else:
        tenkan = kijun = senkou_a = senkou_b = chikou = current_price

    # ---- Volatility ----

    # Bollinger Bands (20, 2)
    bb = ta.bbands(close, length=20, std=2.0)
    if bb is not None and not bb.empty:
        bb_lower = round(_safe_float(bb.iloc[-1, 0], current_price * 0.95), 2)
        bb_mid = round(_safe_float(bb.iloc[-1, 1], current_price), 2)
        bb_upper = round(_safe_float(bb.iloc[-1, 2], current_price * 1.05), 2)
    else:
        bb_upper = round(current_price * 1.05, 2)
        bb_lower = round(current_price * 0.95, 2)
        bb_mid = current_price

    # ATR (14)
    atr_series = ta.atr(high, low, close, length=14)
    atr_val = round(_safe_float(
        atr_series.iloc[-1] if atr_series is not None and not atr_series.empty else None,
        current_price * 0.03
    ), 2)

    # ---- Momentum (advanced) ----

    # Williams %R (14 periods)
    willr_series = ta.willr(high, low, close, length=14)
    willr_val = round(_safe_float(
        willr_series.iloc[-1] if willr_series is not None and not willr_series.empty else None,
        -50.0
    ), 2)

    # CCI — Commodity Channel Index (20 periods)
    cci_series = ta.cci(high, low, close, length=20)
    cci_val = round(_safe_float(
        cci_series.iloc[-1] if cci_series is not None and not cci_series.empty else None,
        0.0
    ), 2)

    # ---- Volume ----

    # OBV (On Balance Volume)
    obv_series = ta.obv(close, volume)
    if obv_series is not None and not obv_series.empty:
        obv_val = round(_safe_float(obv_series.iloc[-1], 0.0), 2)
        # OBV change % over last 20 bars
        if len(obv_series) >= 20:
            obv_20_ago = _safe_float(obv_series.iloc[-20], 0.0)
            if obv_20_ago != 0.0:
                obv_change = round(((obv_val - obv_20_ago) / abs(obv_20_ago)) * 100.0, 2)
            else:
                obv_change = 0.0
        else:
            obv_change = 0.0
    else:
        obv_val = 0.0
        obv_change = 0.0

    # CMF — Chaikin Money Flow (20 periods)
    cmf_series = ta.cmf(high, low, close, volume, length=20)
    cmf_val = round(_safe_float(
        cmf_series.iloc[-1] if cmf_series is not None and not cmf_series.empty else None,
        0.0
    ), 4)

    # VWAP
    vwap_series = ta.vwap(high, low, close, volume)
    vwap_val = round(_safe_float(
        vwap_series.iloc[-1] if vwap_series is not None and not vwap_series.empty else None,
        current_price
    ), 2)

    # ---- Trend (advanced) ----

    # Parabolic SAR
    psar_result = ta.psar(high, low, close)
    if psar_result is not None and not psar_result.empty:
        # pandas_ta psar returns columns: [PSARl, PSARs, PSARaf, PSARr]
        # PSARl = long SAR (bullish), PSARs = short SAR (bearish)
        psar_long = _safe_float(psar_result.iloc[-1, 0], None)
        psar_short = _safe_float(psar_result.iloc[-1, 1], None)
        if psar_long is not None and psar_long != 0.0:
            psar_val = round(psar_long, 2)
            psar_dir = "up"
        elif psar_short is not None and psar_short != 0.0:
            psar_val = round(psar_short, 2)
            psar_dir = "down"
        else:
            psar_val = round(current_price, 2)
            psar_dir = "up" if current_price > ema50 else "down"
    else:
        psar_val = round(current_price, 2)
        psar_dir = "up" if current_price > ema50 else "down"

    # Donchian Channels (20 periods)
    dc = ta.donchian(high, low, length=20)
    if dc is not None and not dc.empty:
        dc_lower = round(_safe_float(dc.iloc[-1, 0], current_price * 0.95), 2)
        dc_mid = round(_safe_float(dc.iloc[-1, 1], current_price), 2)
        dc_upper = round(_safe_float(dc.iloc[-1, 2], current_price * 1.05), 2)
    else:
        dc_upper = round(current_price * 1.05, 2)
        dc_lower = round(current_price * 0.95, 2)
        dc_mid = round(current_price, 2)

    # Pivot Points (classic: P, S1, S2, R1, R2) — manual calculation
    prev_high = _safe_float(high.iloc[-1], current_price)
    prev_low = _safe_float(low.iloc[-1], current_price)
    prev_close = _safe_float(close.iloc[-1], current_price)
    pivot = round((prev_high + prev_low + prev_close) / 3.0, 2)
    r1 = round((2.0 * pivot) - prev_low, 2)
    s1 = round((2.0 * pivot) - prev_high, 2)
    r2 = round(pivot + (prev_high - prev_low), 2)
    s2 = round(pivot - (prev_high - prev_low), 2)

    # ---- Volatility (advanced) ----

    # TTM Squeeze — uses ta.squeeze()
    squeeze_result = ta.squeeze(high, low, close, bb_length=20, kc_length=20)
    if squeeze_result is not None and not squeeze_result.empty:
        # squeeze columns: [SQZ, SQZ_ON, SQZ_OFF, SQZ_NO]
        # SQZ = momentum value, SQZ_ON = 1 when squeeze is active (BB inside KC)
        # Find the squeeze-on column and momentum column
        cols = squeeze_result.columns.tolist()
        # Momentum is the first column (SQZ_...)
        sqz_momentum = round(_safe_float(squeeze_result.iloc[-1, 0], 0.0), 4)
        # Squeeze on indicator — look for "_ON" column
        sqz_on_col = [c for c in cols if "_ON" in c.upper()]
        if sqz_on_col:
            sqz_active = _safe_float(squeeze_result[sqz_on_col[0]].iloc[-1], 0.0) > 0
        else:
            sqz_active = False
        sqz_dir = "up" if sqz_momentum >= 0 else "down"
    else:
        sqz_momentum = 0.0
        sqz_active = False
        sqz_dir = "up"

    # ---- Build result ----
    return {
        "rsi": rsi,
        "stochastic": {"k": stoch_k, "d": stoch_d},
        "macd": {"value": macd_val, "signal": macd_sig, "hist": macd_hist},
        "ema20": ema20,
        "ema50": ema50,
        "ema200": ema200,
        "sma50": sma50,
        "sma200": sma200,
        "adx": adx_val,
        "supertrend": {"value": st_val, "direction": st_dir},
        "ichimoku": {
            "tenkan": tenkan,
            "kijun": kijun,
            "senkouA": senkou_a,
            "senkouB": senkou_b,
            "chikou": chikou,
        },
        "bollinger": {"upper": bb_upper, "lower": bb_lower, "basis": bb_mid},
        "atr": atr_val,
        "williamsR": willr_val,
        "cci": cci_val,
        "obv": obv_val,
        "obvChange": obv_change,
        "cmf": cmf_val,
        "vwap": vwap_val,
        "parabolicSar": {"value": psar_val, "direction": psar_dir},
        "donchian": {"upper": dc_upper, "lower": dc_lower, "mid": dc_mid},
        "pivotPoints": {
            "pivot": pivot,
            "r1": r1,
            "r2": r2,
            "s1": s1,
            "s2": s2,
        },
        "squeeze": {
            "isActive": sqz_active,
            "momentum": sqz_momentum,
            "direction": sqz_dir,
        },
    }
