import httpx
import time
import math
from typing import Dict, List, Optional, Any

_cm_cache = {}
CM_CACHE_TTL = 3600  # 1 hour
CM_BASE_URL = "https://community-api.coinmetrics.io/v4"

def _safe_float(val: Any) -> float:
    if val is None:
        return 0.0
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return 0.0
        return f
    except (ValueError, TypeError):
        return 0.0

async def fetch_coinmetrics_metrics(asset: str, metrics: list[str], days: int = 30) -> list[dict]:
    """
    Fetch time-series metrics from Coin Metrics Community API.
    asset: 'btc', 'eth', 'sol', etc.
    metrics: list of metric IDs like ['AdrActCnt', 'TxCnt', 'CapRealUSD', 'CapMrktCurUSD']
    Returns list of daily data points.
    """
    cache_key = f"{asset}_{','.join(metrics)}_{days}"
    current_time = time.time()
    
    if cache_key in _cm_cache and (current_time - _cm_cache[cache_key]["timestamp"] < CM_CACHE_TTL):
        return _cm_cache[cache_key]["data"]

    url = f"{CM_BASE_URL}/timeseries/asset-metrics"
    params = {
        "assets": asset,
        "metrics": ",".join(metrics),
        "frequency": "1d",
        "limit_per_asset": days
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                data = response.json().get("data", [])
                
                _cm_cache[cache_key] = {
                    "timestamp": current_time,
                    "data": data
                }
                return data
            else:
                print(f"[CoinMetrics] HTTP {response.status_code} for {asset} metrics {metrics}")
    except Exception as e:
        print(f"[CoinMetrics] Error fetching for {asset}: {e}")
        
    # Fallback to previous cache if available
    if cache_key in _cm_cache:
        return _cm_cache[cache_key]["data"]
    return []

async def get_mvrv(asset: str) -> dict:
    """
    Calculate REAL MVRV ratio from Coin Metrics data.
    MVRV = CapMrktCurUSD / CapRealUSD
    Returns: {"mvrv": float, "marketCap": float, "realizedCap": float}
    """
    fallback = {"mvrv": 1.0, "marketCap": 0.0, "realizedCap": 0.0}
    data = await fetch_coinmetrics_metrics(asset, ["CapMrktCurUSD", "CapRealUSD"], days=1)
    if not data:
        return fallback
    
    latest = data[-1]
    mcap = _safe_float(latest.get("CapMrktCurUSD"))
    rcap = _safe_float(latest.get("CapRealUSD"))
    
    mvrv = (mcap / rcap) if rcap > 0 else 1.0
    
    return {
        "mvrv": mvrv,
        "marketCap": mcap,
        "realizedCap": rcap
    }

async def get_realized_price(asset: str) -> dict:
    """
    Calculate Realized Price from Coin Metrics.
    RealizedPrice = CapRealUSD / SplyCur
    Returns: {"realizedPrice": float, "circulatingSupply": float}
    """
    fallback = {"realizedPrice": 0.0, "circulatingSupply": 0.0}
    data = await fetch_coinmetrics_metrics(asset, ["CapRealUSD", "SplyCur"], days=1)
    if not data:
        return fallback
    
    latest = data[-1]
    rcap = _safe_float(latest.get("CapRealUSD"))
    supply = _safe_float(latest.get("SplyCur"))
    
    rp = (rcap / supply) if supply > 0 else 0.0
    
    return {
        "realizedPrice": rp,
        "circulatingSupply": supply
    }

async def get_network_fundamentals(asset: str) -> dict:
    """
    Get fundamental network metrics.
    Returns: {"activeAddresses": int, "txCount": int, "txVolumeUSD": float,
              "feesTotalUSD": float, "feesMeanUSD": float, "hashRate": float}
    """
    metrics = ["AdrActCnt", "TxCnt", "TxTfrValAdjUSD", "FeeTotUSD", "FeeMeanUSD", "HashRate"]
    fallback = {
        "activeAddresses": 0, "txCount": 0, "txVolumeUSD": 0.0,
        "feesTotalUSD": 0.0, "feesMeanUSD": 0.0, "hashRate": 0.0
    }
    data = await fetch_coinmetrics_metrics(asset, metrics, days=1)
    if not data:
        return fallback
    
    latest = data[-1]
    
    return {
        "activeAddresses": int(_safe_float(latest.get("AdrActCnt"))),
        "txCount": int(_safe_float(latest.get("TxCnt"))),
        "txVolumeUSD": _safe_float(latest.get("TxTfrValAdjUSD")),
        "feesTotalUSD": _safe_float(latest.get("FeeTotUSD")),
        "feesMeanUSD": _safe_float(latest.get("FeeMeanUSD")),
        "hashRate": _safe_float(latest.get("HashRate"))
    }

async def get_puell_multiple(asset: str) -> dict:
    """
    Calculate Puell Multiple from Coin Metrics.
    Puell = IssTotUSD_today / MA365(IssTotUSD)
    Returns: {"puellMultiple": float, "minerRevenueUSD": float}
    """
    fallback = {"puellMultiple": 1.0, "minerRevenueUSD": 0.0}
    data = await fetch_coinmetrics_metrics(asset, ["IssTotUSD"], days=365)
    if not data:
        return fallback
    
    rev_vals = [_safe_float(d.get("IssTotUSD")) for d in data if d.get("IssTotUSD") is not None]
    if not rev_vals:
        return fallback
        
    latest_rev = rev_vals[-1]
    avg_rev = sum(rev_vals) / len(rev_vals)
    puell = (latest_rev / avg_rev) if avg_rev > 0 else 1.0
    
    return {
        "puellMultiple": puell,
        "minerRevenueUSD": latest_rev
    }
