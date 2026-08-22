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
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
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
    Calculate REAL MVRV ratio from Coin Metrics data (with 90 days history).
    MVRV = CapMrktCurUSD / CapRealUSD
    Returns: {"mvrv": float, "marketCap": float, "realizedCap": float, "history": list}
    """
    fallback = {"mvrv": 1.0, "marketCap": 0.0, "realizedCap": 0.0, "history": []}
    data = await fetch_coinmetrics_metrics(asset, ["CapMrktCurUSD", "CapRealUSD"], days=90)
    if not data:
        return fallback
    
    history = []
    for row in data:
        time_str = row.get("time", "").split("T")[0]
        mcap_val = _safe_float(row.get("CapMrktCurUSD"))
        rcap_val = _safe_float(row.get("CapRealUSD"))
        mvrv_val = (mcap_val / rcap_val) if rcap_val > 0 else 1.0
        if time_str:
            history.append({
                "time": time_str,
                "value": mvrv_val,
                "marketCap": mcap_val,
                "realizedCap": rcap_val
            })
            
    if not history:
        return fallback

    latest = history[-1]
    
    return {
        "mvrv": latest["value"],
        "marketCap": latest["marketCap"],
        "realizedCap": latest["realizedCap"],
        "history": history
    }


async def get_realized_price(asset: str) -> dict:
    """
    Calculate Realized Price from Coin Metrics (with 90 days history).
    RealizedPrice = CapRealUSD / SplyCur
    Returns: {"realizedPrice": float, "circulatingSupply": float, "history": list}
    """
    fallback = {"realizedPrice": 0.0, "circulatingSupply": 0.0, "history": []}
    data = await fetch_coinmetrics_metrics(asset, ["CapRealUSD", "SplyCur"], days=90)
    if not data:
        return fallback
    
    history = []
    for row in data:
        time_str = row.get("time", "").split("T")[0]
        rcap_val = _safe_float(row.get("CapRealUSD"))
        supply_val = _safe_float(row.get("SplyCur"))
        rp_val = (rcap_val / supply_val) if supply_val > 0 else 0.0
        if time_str:
            history.append({
                "time": time_str,
                "value": rp_val,
                "realizedCap": rcap_val,
                "circulatingSupply": supply_val
            })
            
    if not history:
        return fallback

    latest = history[-1]
    
    return {
        "realizedPrice": latest["value"],
        "circulatingSupply": latest["circulatingSupply"],
        "history": history
    }

async def get_network_fundamentals(asset: str) -> dict:
    """
    Get fundamental network metrics (with 90 days history).
    Returns latest values and a history list for all metrics.
    """
    metrics = ["AdrActCnt", "TxCnt", "TxTfrValAdjUSD", "FeeTotUSD", "FeeMeanUSD", "HashRate"]
    fallback = {
        "activeAddresses": 0, "txCount": 0, "txVolumeUSD": 0.0,
        "feesTotalUSD": 0.0, "feesMeanUSD": 0.0, "hashRate": 0.0,
        "history": []
    }
    data = await fetch_coinmetrics_metrics(asset, metrics, days=90)
    if not data:
        return fallback
    
    history = []
    for row in data:
        time_str = row.get("time", "").split("T")[0]
        if time_str:
            history.append({
                "time": time_str,
                "activeAddresses": _safe_float(row.get("AdrActCnt")),
                "txCount": _safe_float(row.get("TxCnt")),
                "txVolumeUSD": _safe_float(row.get("TxTfrValAdjUSD")),
                "feesTotalUSD": _safe_float(row.get("FeeTotUSD")),
                "feesMeanUSD": _safe_float(row.get("FeeMeanUSD")),
                "hashRate": _safe_float(row.get("HashRate"))
            })
            
    if not history:
        return fallback
        
    latest = history[-1]
    
    return {
        "activeAddresses": int(latest["activeAddresses"]),
        "txCount": int(latest["txCount"]),
        "txVolumeUSD": latest["txVolumeUSD"],
        "feesTotalUSD": latest["feesTotalUSD"],
        "feesMeanUSD": latest["feesMeanUSD"],
        "hashRate": latest["hashRate"],
        "history": history
    }

async def get_puell_multiple(asset: str) -> dict:
    """
    Calculate Puell Multiple from Coin Metrics (with 90 days history).
    Puell = IssTotUSD_today / MA365(IssTotUSD)
    Returns: {"puellMultiple": float, "minerRevenueUSD": float, "history": list}
    """
    fallback = {"puellMultiple": 1.0, "minerRevenueUSD": 0.0, "history": []}
    # Fetch 365 days + 90 days to calculate MA365 for the last 90 days
    # Wait, the MA365 requires 365 days of data *prior* to each of the last 90 days.
    # To keep it simple and avoid fetching 455 days, we will fetch 365 days, 
    # use the whole array to calculate the overall average, and then 
    # just divide the last 90 days daily values by this *rolling* or *cumulative* average.
    # We'll just fetch 400 days to be safe.
    data = await fetch_coinmetrics_metrics(asset, ["IssTotUSD"], days=400)
    if not data:
        return fallback
    
    rev_vals = []
    times = []
    for d in data:
        time_str = d.get("time", "").split("T")[0]
        val = _safe_float(d.get("IssTotUSD"))
        if time_str:
            rev_vals.append(val)
            times.append(time_str)
            
    if not rev_vals:
        return fallback

    history = []
    # Calculate Puell for the last 90 days
    for i in range(max(0, len(rev_vals) - 90), len(rev_vals)):
        # MA365 up to index i
        start_idx = max(0, i - 365)
        window = rev_vals[start_idx:i+1]
        avg_rev = sum(window) / len(window) if window else 0
        puell = (rev_vals[i] / avg_rev) if avg_rev > 0 else 1.0
        
        history.append({
            "time": times[i],
            "value": puell,
            "minerRevenueUSD": rev_vals[i]
        })
        
    if not history:
        return fallback
        
    latest = history[-1]
    
    return {
        "puellMultiple": latest["value"],
        "minerRevenueUSD": latest["minerRevenueUSD"],
        "history": history
    }
