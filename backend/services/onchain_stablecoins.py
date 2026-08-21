import httpx
import time

_stable_cache = {}
STABLE_CACHE_TTL = 1800  # 30 minutes

async def _fetch_llama(url: str, cache_key: str):
    current_time = time.time()
    if cache_key in _stable_cache and (current_time - _stable_cache[cache_key]["timestamp"] < STABLE_CACHE_TTL):
        return _stable_cache[cache_key]["data"]
        
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                _stable_cache[cache_key] = {
                    "timestamp": current_time,
                    "data": data
                }
                return data
            else:
                print(f"[Stablecoins] HTTP {response.status_code} from {url}")
    except Exception as e:
        print(f"[Stablecoins] Error fetching {url}: {e}")
        
    if cache_key in _stable_cache:
        return _stable_cache[cache_key]["data"]
    return None

async def get_stablecoin_overview() -> dict:
    """
    Get global stablecoin market data.
    Endpoint: https://stablecoins.llama.fi/stablecoins?includePrices=true
    Returns: {"totalMcap": float, "top": [{"name": str, "symbol": str, "mcap": float, "dominance": float}]}
    """
    url = "https://stablecoins.llama.fi/stablecoins?includePrices=true"
    data = await _fetch_llama(url, "overview")
    fallback = {"totalMcap": 0.0, "top": []}
    
    if not data:
        return fallback
        
    pegged = data.get("peggedAssets", [])
    total_mcap = sum([float(p.get("circulating", {}).get("peggedUSD", 0)) for p in pegged])
    
    top = []
    for p in pegged[:10]:
        mcap = float(p.get("circulating", {}).get("peggedUSD", 0))
        top.append({
            "name": p.get("name", ""),
            "symbol": p.get("symbol", ""),
            "mcap": mcap,
            "dominance": (mcap / total_mcap * 100) if total_mcap > 0 else 0
        })
        
    return {
        "totalMcap": total_mcap,
        "top": top
    }

async def get_stablecoin_chains() -> list[dict]:
    """
    Get stablecoin distribution by chain.
    Endpoint: https://stablecoins.llama.fi/stablecoinchains
    Returns: [{"chain": str, "totalUSD": float}]
    """
    url = "https://stablecoins.llama.fi/stablecoinchains"
    data = await _fetch_llama(url, "chains")
    if not data:
        return []
        
    result = []
    for c in data:
        result.append({
            "chain": c.get("name", ""),
            "totalUSD": float(c.get("totalCirculatingUSD", {}).get("peggedUSD", 0.0))
        })
    return result

async def get_defi_tvl_by_chain() -> list[dict]:
    """
    Get DeFi TVL per chain.
    Endpoint: https://api.llama.fi/v2/chains
    Returns: [{"name": str, "tvl": float}]
    """
    url = "https://api.llama.fi/v2/chains"
    data = await _fetch_llama(url, "tvl_chains")
    if not data:
        return []
        
    result = []
    for c in data:
        result.append({
            "name": c.get("name", ""),
            "tvl": float(c.get("tvl", 0.0))
        })
    return result
