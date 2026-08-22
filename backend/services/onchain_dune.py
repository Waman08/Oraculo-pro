import os
import httpx
import time

_dune_cache = {}
DUNE_CACHE_TTL = 3600
DUNE_BASE_URL = "https://api.dune.com/api/v1"

def _get_api_key():
    return os.environ.get("DUNE_API_KEY")

async def fetch_dune_query(query_id: int) -> list[dict] | None:
    """
    Fetch cached results of a public Dune query.
    Returns the rows from the query result, or None if no API key / error.
    """
    api_key = _get_api_key()
    if not api_key:
        return None
        
    current_time = time.time()
    cache_key = str(query_id)
    
    if cache_key in _dune_cache and (current_time - _dune_cache[cache_key]["timestamp"] < DUNE_CACHE_TTL):
        return _dune_cache[cache_key]["data"]
        
    url = f"{DUNE_BASE_URL}/query/{query_id}/results"
    headers = {"X-Dune-API-Key": api_key}
    
    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json().get("result", {}).get("rows", [])
                _dune_cache[cache_key] = {
                    "timestamp": current_time,
                    "data": data
                }
                return data
            else:
                print(f"[Dune] HTTP {response.status_code} for query {query_id}")
    except Exception as e:
        print(f"[Dune] Error fetching query {query_id}: {e}")
        
    if cache_key in _dune_cache:
        return _dune_cache[cache_key]["data"]
    return None

async def get_sopr() -> dict | None:
    """
    Get Bitcoin SOPR from a well-known public Dune query.
    Returns: {"sopr": float, "asopr": float, "history": list} or None
    """
    data = await fetch_dune_query(2458921)
    if data is None:
        return None
        
    if not data:
        return {"sopr": 1.0, "asopr": 1.0, "history": []}
        
    # Dune often returns descending by date. We want ascending for charts, limited to 90 days
    # Let's sort by date ascending to be sure
    try:
        sorted_data = sorted(data, key=lambda x: x.get("date", x.get("time", "")))
        history = []
        for row in sorted_data[-90:]:
            time_str = str(row.get("date", row.get("time", ""))).split("T")[0]
            if time_str:
                history.append({
                    "time": time_str,
                    "value": float(row.get("sopr", 1.0)),
                    "asopr": float(row.get("asopr", 1.0))
                })
        
        if not history:
            return {"sopr": 1.0, "asopr": 1.0, "history": []}
            
        latest = history[-1]
        return {
            "sopr": latest["value"],
            "asopr": latest["asopr"],
            "history": history
        }
    except Exception:
        # Fallback to single value
        latest = data[0]
        return {
            "sopr": float(latest.get("sopr", 1.0)),
            "asopr": float(latest.get("asopr", 1.0)),
            "history": []
        }

async def get_exchange_flows() -> dict | None:
    """
    Get BTC/ETH exchange inflows and outflows.
    Returns: {"btcNetFlow": float, "ethNetFlow": float, "history": list} or None
    """
    data = await fetch_dune_query(1234567)  # Example query ID
    if data is None:
        return None
        
    if not data:
        return {"btcNetFlow": 0.0, "ethNetFlow": 0.0, "history": []}
        
    try:
        sorted_data = sorted(data, key=lambda x: x.get("date", x.get("time", "")))
        history = []
        for row in sorted_data[-90:]:
            time_str = str(row.get("date", row.get("time", ""))).split("T")[0]
            if time_str:
                history.append({
                    "time": time_str,
                    "value": float(row.get("btc_netflow", 0.0)),
                    "ethNetFlow": float(row.get("eth_netflow", 0.0))
                })
                
        if not history:
            return {"btcNetFlow": 0.0, "ethNetFlow": 0.0, "history": []}
            
        latest = history[-1]
        return {
            "btcNetFlow": latest["value"],
            "ethNetFlow": latest["ethNetFlow"],
            "history": history
        }
    except Exception:
        latest = data[0]
        return {
            "btcNetFlow": float(latest.get("btc_netflow", 0.0)),
            "ethNetFlow": float(latest.get("eth_netflow", 0.0)),
            "history": []
        }

async def get_supply_in_profit() -> dict | None:
    """
    Get percentage of BTC supply currently in profit.
    Returns: {"supplyInProfitPercent": float, "history": list} or None
    """
    data = await fetch_dune_query(987654) # Example query ID
    if data is None:
        return None
        
    if not data:
        return {"supplyInProfitPercent": 50.0, "history": []}
        
    try:
        sorted_data = sorted(data, key=lambda x: x.get("date", x.get("time", "")))
        history = []
        for row in sorted_data[-90:]:
            time_str = str(row.get("date", row.get("time", ""))).split("T")[0]
            if time_str:
                history.append({
                    "time": time_str,
                    "value": float(row.get("supply_in_profit_pct", 50.0))
                })
                
        if not history:
            return {"supplyInProfitPercent": 50.0, "history": []}
            
        latest = history[-1]
        return {
            "supplyInProfitPercent": latest["value"],
            "history": history
        }
    except Exception:
        latest = data[0]
        return {
            "supplyInProfitPercent": float(latest.get("supply_in_profit_pct", 50.0)),
            "history": []
        }
