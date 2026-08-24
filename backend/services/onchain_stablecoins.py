# ============================================================
# ON-CHAIN STABLECOINS — Market liquidity and stablecoin analytics
# ============================================================
# Source: DeFiLlama Stablecoins API (100% free, no key required)
# Provides: Total stablecoin mcap, SSR, USDT/USDC dominance,
#           per-chain stablecoin distribution, historical flows
# ============================================================

import httpx
import time
from typing import Dict, Optional, List

_stable_cache = {}
STABLE_CACHE_TTL = 1800  # 30 minutes


async def _fetch_llama(url: str, cache_key: str):
    current_time = time.time()
    if cache_key in _stable_cache and (current_time - _stable_cache[cache_key]["timestamp"] < STABLE_CACHE_TTL):
        return _stable_cache[cache_key]["data"]
        
    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
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
    Returns: {totalMcap, top stablecoins with dominance, 7d change}
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
        
        # Calculate 7d change if available
        chains_circ = p.get("chainCirculating", {})
        
        top.append({
            "name": p.get("name", ""),
            "symbol": p.get("symbol", ""),
            "mcap": mcap,
            "dominance": (mcap / total_mcap * 100) if total_mcap > 0 else 0,
            "pegType": p.get("pegType", ""),
        })
        
    return {
        "totalMcap": total_mcap,
        "top": top
    }


async def get_stablecoin_chains() -> list[dict]:
    """
    Get stablecoin distribution by chain.
    Shows where the liquidity is concentrated.
    """
    url = "https://stablecoins.llama.fi/stablecoinchains"
    data = await _fetch_llama(url, "chains")
    if not data:
        return []
        
    result = []
    for c in data:
        total_usd = float(c.get("totalCirculatingUSD", {}).get("peggedUSD", 0.0))
        if total_usd > 0:
            result.append({
                "chain": c.get("name", ""),
                "totalUSD": total_usd
            })
    
    # Sort by total descending
    result.sort(key=lambda x: x["totalUSD"], reverse=True)
    return result


async def get_defi_tvl_by_chain() -> list[dict]:
    """
    Get DeFi TVL per chain.
    """
    url = "https://api.llama.fi/v2/chains"
    data = await _fetch_llama(url, "tvl_chains")
    if not data:
        return []
        
    result = []
    for c in data:
        tvl = float(c.get("tvl", 0.0))
        if tvl > 0:
            result.append({
                "name": c.get("name", ""),
                "tvl": tvl
            })
    
    result.sort(key=lambda x: x["tvl"], reverse=True)
    return result


async def get_stablecoin_historical() -> Optional[Dict]:
    """
    Get historical stablecoin market cap (last 90 days).
    Used to detect if stablecoins are flowing INTO or OUT OF crypto.
    Increasing stablecoin supply = bullish (more buying power).
    """
    url = "https://stablecoins.llama.fi/stablecoincharts/all?stablecoin=1"  # USDT
    usdt_data = await _fetch_llama(url, "usdt_history")
    
    url2 = "https://stablecoins.llama.fi/stablecoincharts/all?stablecoin=2"  # USDC  
    usdc_data = await _fetch_llama(url2, "usdc_history")
    
    result = {}
    
    if usdt_data and len(usdt_data) >= 7:
        latest = usdt_data[-1]
        week_ago = usdt_data[-7]
        
        usdt_now = float(latest.get("totalCirculating", {}).get("peggedUSD", 0))
        usdt_7d = float(week_ago.get("totalCirculating", {}).get("peggedUSD", 0))
        
        result["usdt"] = {
            "current": usdt_now,
            "change7d": usdt_now - usdt_7d,
            "change7dPct": ((usdt_now - usdt_7d) / usdt_7d * 100) if usdt_7d > 0 else 0,
        }
    
    if usdc_data and len(usdc_data) >= 7:
        latest = usdc_data[-1]
        week_ago = usdc_data[-7]
        
        usdc_now = float(latest.get("totalCirculating", {}).get("peggedUSD", 0))
        usdc_7d = float(week_ago.get("totalCirculating", {}).get("peggedUSD", 0))
        
        result["usdc"] = {
            "current": usdc_now,
            "change7d": usdc_now - usdc_7d,
            "change7dPct": ((usdc_now - usdc_7d) / usdc_7d * 100) if usdc_7d > 0 else 0,
        }
    
    return result if result else None


async def calculate_ssr(btc_market_cap: float = 0) -> Optional[Dict]:
    """
    Calculate Stablecoin Supply Ratio (SSR).
    SSR = Bitcoin Market Cap / Stablecoin Market Cap
    
    - Low SSR (< 5): High buying power relative to BTC (bullish)
    - Normal SSR (5-15): Balanced market
    - High SSR (> 15): Low stablecoin liquidity (potentially bearish)
    
    If btc_market_cap is not provided, we fetch it from CoinGecko.
    """
    overview = await get_stablecoin_overview()
    total_stable_mcap = overview.get("totalMcap", 0)
    
    if total_stable_mcap <= 0:
        return None
    
    # Fetch BTC market cap if not provided
    if btc_market_cap <= 0:
        try:
            async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
                resp = await client.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true")
                if resp.status_code == 200:
                    data = resp.json()
                    btc_market_cap = data.get("bitcoin", {}).get("usd_market_cap", 0)
        except Exception as e:
            print(f"[SSR] Error fetching BTC mcap: {e}")
            return None
    
    if btc_market_cap <= 0:
        return None
    
    ssr = btc_market_cap / total_stable_mcap
    
    # Score the SSR
    if ssr < 3:
        signal = "Strong Buy"
        score = 15
    elif ssr < 7:
        signal = "Buy"
        score = 30
    elif ssr < 12:
        signal = "Neutral"
        score = 50
    elif ssr < 20:
        signal = "Sell"
        score = 70
    else:
        signal = "Strong Sell"
        score = 85
    
    return {
        "ssr": round(ssr, 2),
        "btcMarketCap": btc_market_cap,
        "stablecoinMarketCap": total_stable_mcap,
        "signal": signal,
        "score": score,
    }


async def get_full_stablecoin_analysis() -> Dict:
    """
    Get comprehensive stablecoin market analysis.
    Combines: overview, SSR, USDT/USDC flows, chain distribution.
    """
    overview = await get_stablecoin_overview()
    ssr_data = await calculate_ssr()
    historical = await get_stablecoin_historical()
    chains = await get_stablecoin_chains()
    
    result = {
        "overview": overview,
        "topChains": chains[:10] if chains else [],
    }
    
    if ssr_data:
        result["ssr"] = ssr_data
    
    if historical:
        result["flows"] = historical
        
        # Calculate net flow direction
        total_change = 0
        if "usdt" in historical:
            total_change += historical["usdt"].get("change7d", 0)
        if "usdc" in historical:
            total_change += historical["usdc"].get("change7d", 0)
        
        if total_change > 1_000_000_000:  # > $1B inflow
            result["flowSignal"] = "Strong Inflow"
            result["flowScore"] = 20  # Bullish
        elif total_change > 100_000_000:  # > $100M inflow
            result["flowSignal"] = "Inflow"
            result["flowScore"] = 35
        elif total_change > -100_000_000:
            result["flowSignal"] = "Neutral"
            result["flowScore"] = 50
        elif total_change > -1_000_000_000:
            result["flowSignal"] = "Outflow"
            result["flowScore"] = 65
        else:
            result["flowSignal"] = "Strong Outflow"
            result["flowScore"] = 80  # Bearish
    
    return result
