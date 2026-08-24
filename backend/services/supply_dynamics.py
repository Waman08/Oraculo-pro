# ============================================================
# SUPPLY DYNAMICS — Token supply analysis and inflation risk
# ============================================================
# Source: CoinGecko API (free, rate limited)
# Provides: Circulating/Total/Max Supply, FDV, inflation metrics
# Detects tokens with massive pending dilution
# ============================================================

import httpx
import time
from typing import Dict, Optional

_supply_cache: dict = {}
SUPPLY_CACHE_TTL = 3600  # 1 hour (supply data doesn't change frequently)

# CoinGecko ID mapping for common symbols
SYMBOL_TO_COINGECKO = {
    "BTC": "bitcoin", "ETH": "ethereum", "SOL": "solana",
    "XRP": "ripple", "ADA": "cardano", "DOGE": "dogecoin",
    "DOT": "polkadot", "AVAX": "avalanche-2", "LINK": "chainlink",
    "MATIC": "matic-network", "LTC": "litecoin", "ATOM": "cosmos",
    "UNI": "uniswap", "ARB": "arbitrum", "OP": "optimism",
    "NEAR": "near", "FIL": "filecoin", "APT": "aptos",
    "SUI": "sui", "WLD": "worldcoin-wld", "TIA": "celestia",
    "SEI": "sei-network", "INJ": "injective-protocol",
    "FTM": "fantom", "ALGO": "algorand", "TRX": "tron",
    "BNB": "binancecoin", "PEPE": "pepe", "SHIB": "shiba-inu",
    "WIF": "dogwifcoin", "BONK": "bonk", "FLOKI": "floki",
    "RENDER": "render-token", "FET": "fetch-ai", "TAO": "bittensor",
    "AAVE": "aave", "MKR": "maker", "CRV": "curve-dao-token",
    "STX": "blockstack", "ICP": "internet-computer",
    "HBAR": "hedera-hashgraph", "VET": "vechain",
}


async def get_supply_data(symbol: str) -> Optional[Dict]:
    """
    Fetch supply dynamics from CoinGecko.
    Returns circulating/total/max supply, FDV, market cap, and computed ratios.
    """
    current_time = time.time()
    cache_key = f"supply_{symbol.upper()}"
    
    if cache_key in _supply_cache and (current_time - _supply_cache[cache_key]["timestamp"] < SUPPLY_CACHE_TTL):
        return _supply_cache[cache_key]["data"]
    
    cg_id = SYMBOL_TO_COINGECKO.get(symbol.upper())
    if not cg_id:
        return None
    
    url = f"https://api.coingecko.com/api/v3/coins/{cg_id}"
    params = {
        "localization": "false",
        "tickers": "false",
        "market_data": "true",
        "community_data": "false",
        "developer_data": "false",
        "sparkline": "false",
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
            elif response.status_code == 429:
                print(f"[SupplyDynamics] CoinGecko rate limited for {symbol}")
                if cache_key in _supply_cache:
                    return _supply_cache[cache_key]["data"]
                return None
            else:
                print(f"[SupplyDynamics] HTTP {response.status_code} for {symbol}")
                return None
    except Exception as e:
        print(f"[SupplyDynamics] Error fetching {symbol}: {e}")
        if cache_key in _supply_cache:
            return _supply_cache[cache_key]["data"]
        return None
    
    md = data.get("market_data", {})
    
    circulating = md.get("circulating_supply") or 0
    total = md.get("total_supply") or 0
    max_supply = md.get("max_supply")  # Can be None for infinite supply tokens
    market_cap = md.get("market_cap", {}).get("usd", 0) or 0
    fdv = md.get("fully_diluted_valuation", {}).get("usd", 0) or 0
    price = md.get("current_price", {}).get("usd", 0) or 0
    
    # Calculate key ratios
    result = {
        "symbol": symbol.upper(),
        "price": price,
        "marketCap": market_cap,
        "fdv": fdv,
        "circulatingSupply": circulating,
        "totalSupply": total,
        "maxSupply": max_supply,
        "source": "coingecko",
    }
    
    # Circulating / Total ratio: what % of tokens are already in circulation?
    if total > 0 and circulating > 0:
        result["circulatingRatio"] = round(circulating / total * 100, 2)
    else:
        result["circulatingRatio"] = 100.0  # Assume fully circulating if data missing
    
    # Circulating / Max ratio: what % of the ultimate supply is already out?
    if max_supply and max_supply > 0 and circulating > 0:
        result["maxSupplyRatio"] = round(circulating / max_supply * 100, 2)
    else:
        result["maxSupplyRatio"] = None  # No max supply = infinite inflation possible
    
    # FDV / Market Cap ratio: how much dilution is pending?
    if market_cap > 0 and fdv > 0:
        result["fdvMcapRatio"] = round(fdv / market_cap, 2)
    else:
        result["fdvMcapRatio"] = 1.0
    
    # Inflation estimate: if total > circulating, estimate annual inflation
    # This is a rough proxy — actual vesting schedules vary
    if total > circulating and circulating > 0:
        pending_tokens = total - circulating
        pending_pct = pending_tokens / circulating * 100
        result["pendingInflationPct"] = round(pending_pct, 2)
    else:
        result["pendingInflationPct"] = 0.0
    
    # Risk classification
    fdv_ratio = result["fdvMcapRatio"]
    circ_ratio = result["circulatingRatio"]
    
    if fdv_ratio >= 5 or circ_ratio < 20:
        result["dilutionRisk"] = "critical"
        result["dilutionLabel"] = "⚠️ Dilución Masiva Pendiente"
    elif fdv_ratio >= 3 or circ_ratio < 40:
        result["dilutionRisk"] = "high"
        result["dilutionLabel"] = "🔴 Riesgo Alto de Dilución"
    elif fdv_ratio >= 2 or circ_ratio < 60:
        result["dilutionRisk"] = "medium"
        result["dilutionLabel"] = "🟡 Riesgo Moderado"
    elif fdv_ratio >= 1.5 or circ_ratio < 80:
        result["dilutionRisk"] = "low"
        result["dilutionLabel"] = "🟢 Riesgo Bajo"
    else:
        result["dilutionRisk"] = "none"
        result["dilutionLabel"] = "✅ Totalmente Circulando"
    
    _supply_cache[cache_key] = {"timestamp": current_time, "data": result}
    return result


def score_supply_dynamics(supply_data: Dict) -> Dict:
    """
    Score supply dynamics for the overall analysis.
    
    Returns 0-100 where:
    - Low (0-30): Healthy supply, low dilution risk (bullish for price)
    - Mid (30-60): Moderate supply risk
    - High (60-100): High dilution/inflation risk (bearish for price)
    
    This score is ADDITIVE to the sell signal — high score = more reason to be cautious.
    """
    if not supply_data:
        return {"score": 50, "weight": 0.05, "detail": "No supply data available"}
    
    sub_scores = {}
    
    # 1. FDV/Mcap ratio scoring
    fdv_ratio = supply_data.get("fdvMcapRatio", 1.0)
    if fdv_ratio <= 1.1:
        sub_scores["fdvRatio"] = 10  # Minimal dilution
    elif fdv_ratio <= 1.5:
        sub_scores["fdvRatio"] = 25
    elif fdv_ratio <= 2.0:
        sub_scores["fdvRatio"] = 40
    elif fdv_ratio <= 3.0:
        sub_scores["fdvRatio"] = 55
    elif fdv_ratio <= 5.0:
        sub_scores["fdvRatio"] = 75
    else:
        sub_scores["fdvRatio"] = 90  # Massive pending dilution
    
    # 2. Circulating ratio scoring
    circ_ratio = supply_data.get("circulatingRatio", 100)
    if circ_ratio >= 90:
        sub_scores["circRatio"] = 10  # Almost all tokens in circulation
    elif circ_ratio >= 70:
        sub_scores["circRatio"] = 25
    elif circ_ratio >= 50:
        sub_scores["circRatio"] = 45
    elif circ_ratio >= 30:
        sub_scores["circRatio"] = 65
    else:
        sub_scores["circRatio"] = 85  # Very few tokens circulating
    
    if not sub_scores:
        return {"score": 50, "weight": 0.05, "detail": "Insufficient data"}
    
    # Simple average
    total = sum(sub_scores.values()) / len(sub_scores)
    total = round(max(0, min(100, total)), 1)
    
    return {
        "score": total,
        "weight": 0.10,  # 10% weight in overall scoring
        "subScores": sub_scores,
        "dilutionRisk": supply_data.get("dilutionRisk", "unknown"),
    }
