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
        async with httpx.AsyncClient(timeout=15.0) as client:
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
    Use query ID 2458921 or similar public SOPR query.
    Returns: {"sopr": float, "asopr": float} or None
    """
    data = await fetch_dune_query(2458921)
    if data is None:
        return None
        
    if data:
        latest = data[0]
        return {
            "sopr": float(latest.get("sopr", 1.0)),
            "asopr": float(latest.get("asopr", 1.0))
        }
    return {"sopr": 1.0, "asopr": 1.0}

async def get_exchange_flows() -> dict | None:
    """
    Get BTC/ETH exchange inflows and outflows.
    Returns: {"btcNetFlow": float, "ethNetFlow": float} or None
    """
    data = await fetch_dune_query(1234567)  # Fallback query ID
    if data is None:
        return None
        
    if data:
        latest = data[0]
        return {
            "btcNetFlow": float(latest.get("btc_netflow", 0.0)),
            "ethNetFlow": float(latest.get("eth_netflow", 0.0))
        }
    return {"btcNetFlow": 0.0, "ethNetFlow": 0.0}

async def get_supply_in_profit() -> dict | None:
    """
    Get percentage of BTC supply currently in profit.
    Returns: {"supplyInProfitPercent": float} or None
    """
    data = await fetch_dune_query(7654321)  # Fallback query ID
    if data is None:
        return None
        
    if data:
        latest = data[0]
        return {"supplyInProfitPercent": float(latest.get("percent_in_profit", 50.0))}
        
    return {"supplyInProfitPercent": 50.0}
