import httpx
import time
from typing import Dict, Any

_liquidity_cache = {}
CACHE_TTL = 300  # 5 minutes

BINANCE_FUTURES_URL = "https://fapi.binance.com"

async def fetch_open_interest(symbol: str) -> float:
    """Fetch total Open Interest (in USD) for a given symbol."""
    pair = f"{symbol.upper()}USDT"
    url = f"{BINANCE_FUTURES_URL}/fapi/v1/openInterest"
    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            resp = await client.get(url, params={"symbol": pair})
            if resp.status_code == 200:
                data = resp.json()
                oi_tokens = float(data.get("openInterest", 0))
                
                # Fetch mark price to convert to USD
                price_resp = await client.get(f"{BINANCE_FUTURES_URL}/fapi/v1/premiumIndex", params={"symbol": pair})
                if price_resp.status_code == 200:
                    price = float(price_resp.json().get("markPrice", 0))
                    return oi_tokens * price
    except Exception as e:
        print(f"[LiquidityEngine] Error fetching OI for {symbol}: {e}")
    return 0.0

async def fetch_long_short_ratio(symbol: str) -> dict:
    """Fetch Top Trader Long/Short Ratio (Accounts)."""
    pair = f"{symbol.upper()}USDT"
    url = f"{BINANCE_FUTURES_URL}/futures/data/topLongShortAccountRatio"
    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            # 5m timeframe, 1 limit to get the latest
            resp = await client.get(url, params={"symbol": pair, "period": "5m", "limit": 1})
            if resp.status_code == 200:
                data = resp.json()
                if data and len(data) > 0:
                    latest = data[0]
                    return {
                        "longAccount": float(latest.get("longAccount", 0.5)),
                        "shortAccount": float(latest.get("shortAccount", 0.5)),
                        "longShortRatio": float(latest.get("longShortRatio", 1.0))
                    }
    except Exception as e:
        print(f"[LiquidityEngine] Error fetching L/S Ratio for {symbol}: {e}")
    return {"longAccount": 0.5, "shortAccount": 0.5, "longShortRatio": 1.0}

async def fetch_funding_rate(symbol: str) -> dict:
    """Fetch the latest funding rate for a given symbol."""
    pair = f"{symbol.upper()}USDT"
    url = f"{BINANCE_FUTURES_URL}/fapi/v1/fundingRate"
    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            resp = await client.get(url, params={"symbol": pair, "limit": 3})
            if resp.status_code == 200:
                data = resp.json()
                if data and len(data) > 0:
                    latest = data[-1]
                    rate = float(latest.get("fundingRate", 0))
                    # Binance futures funding occurs every 8 hours usually, annualized = rate * 3 * 365 * 100
                    annualized = rate * 3 * 365 * 100
                    return {"fundingRate": rate, "fundingRateAnnualized": annualized}
    except Exception as e:
        print(f"[LiquidityEngine] Error fetching Funding Rate for {symbol}: {e}")
    return {"fundingRate": 0.0, "fundingRateAnnualized": 0.0}

async def get_liquidity_data(symbol: str) -> Dict[str, Any]:
    """
    Get aggregated liquidity & derivatives data (cached).
    """
    cache_key = f"{symbol.upper()}"
    current_time = time.time()
    
    if cache_key in _liquidity_cache and (current_time - _liquidity_cache[cache_key]["timestamp"] < CACHE_TTL):
        return _liquidity_cache[cache_key]["data"]
        
    oi_usd = await fetch_open_interest(symbol)
    ls_ratio = await fetch_long_short_ratio(symbol)
    funding_data = await fetch_funding_rate(symbol)
    
    score = 50
    squeeze_risk = "low"
    
    # Analyze LS Ratio
    if ls_ratio["longShortRatio"] > 2.5:
        score -= 20
    elif ls_ratio["longShortRatio"] > 1.5:
        score -= 10
    elif ls_ratio["longShortRatio"] < 0.5:
        score += 30
    elif ls_ratio["longShortRatio"] < 0.8:
        score += 10
        
    # Incorporate Funding Rate into scoring
    fr = funding_data["fundingRate"]
    if fr > 0.0005:  # > 0.05% per 8h
        squeeze_risk = "long_squeeze_danger"
        score -= 15  # Warn of long squeeze
    elif fr < -0.0003: # < -0.03% per 8h
        squeeze_risk = "short_squeeze_opportunity"
        score += 15  # Short squeeze opportunity
        
    # Cap score 0-100
    score = max(0, min(100, score))
        
    result = {
        "openInterestUSD": oi_usd,
        "longRatio": ls_ratio["longAccount"],
        "shortRatio": ls_ratio["shortAccount"],
        "lsRatio": ls_ratio["longShortRatio"],
        "fundingRate": fr,
        "fundingRateAnnualized": funding_data["fundingRateAnnualized"],
        "squeezeRisk": squeeze_risk,
        "liquidityScore": score
    }
    
    _liquidity_cache[cache_key] = {
        "timestamp": current_time,
        "data": result
    }
    
    return result


