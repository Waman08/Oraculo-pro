# ============================================================
# ON-CHAIN DEFILLAMA — Real altcoin on-chain metrics
# ============================================================
# Source: DeFiLlama API (100% free, no key required)
# Provides: Fees/Revenue, DEX Volumes, TVL, Protocol Metrics
# All data is verified on-chain aggregation by DeFiLlama
# ============================================================

import httpx
import time
from typing import Dict, Any, Optional

_defillama_cache: dict = {}
DEFILLAMA_CACHE_TTL = 1800  # 30 minutes

# Maps our symbol to DeFiLlama protocol slug
# DeFiLlama uses chain names and protocol slugs differently
SYMBOL_TO_CHAIN = {
    "ETH": "Ethereum",
    "SOL": "Solana",
    "AVAX": "Avalanche",
    "ADA": "Cardano",
    "DOT": "Polkadot",
    "MATIC": "Polygon",
    "ARB": "Arbitrum",
    "OP": "Optimism",
    "BNB": "BSC",
    "FTM": "Fantom",
    "NEAR": "NEAR",
    "ATOM": "Cosmos",
    "ALGO": "Algorand",
    "TRX": "Tron",
    "BASE": "Base",
    "SUI": "Sui",
    "SEI": "Sei",
    "APT": "Aptos",
}

# Maps symbol to DeFiLlama fees protocol slug
SYMBOL_TO_FEES_SLUG = {
    "ETH": "ethereum",
    "SOL": "solana",
    "AVAX": "avalanche",
    "BNB": "bsc",
    "ARB": "arbitrum",
    "OP": "optimism",
    "MATIC": "polygon",
    "BASE": "base",
    "TRX": "tron",
    "SUI": "sui",
    "SEI": "sei",
    "APT": "aptos",
}


async def _fetch_defillama(url: str, cache_key: str) -> Optional[Any]:
    """Fetch from DeFiLlama with caching."""
    current_time = time.time()
    if cache_key in _defillama_cache and (current_time - _defillama_cache[cache_key]["timestamp"] < DEFILLAMA_CACHE_TTL):
        return _defillama_cache[cache_key]["data"]

    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                _defillama_cache[cache_key] = {
                    "timestamp": current_time,
                    "data": data
                }
                return data
            else:
                print(f"[DeFiLlama] HTTP {response.status_code} from {url}")
    except Exception as e:
        print(f"[DeFiLlama] Error fetching {url}: {e}")

    # Return stale cache if available
    if cache_key in _defillama_cache:
        return _defillama_cache[cache_key]["data"]
    return None


async def get_chain_tvl(symbol: str) -> Optional[Dict]:
    """
    Get Total Value Locked (TVL) for a specific chain.
    Source: https://api.llama.fi/v2/chains
    """
    chain_name = SYMBOL_TO_CHAIN.get(symbol.upper())
    if not chain_name:
        return None

    data = await _fetch_defillama("https://api.llama.fi/v2/chains", "all_chains")
    if not data:
        return None

    for chain in data:
        if chain.get("name", "").lower() == chain_name.lower():
            return {
                "chain": chain_name,
                "tvl": float(chain.get("tvl", 0)),
                "tokenSymbol": chain.get("tokenSymbol", symbol.upper()),
            }
    return None


async def get_chain_fees(symbol: str) -> Optional[Dict]:
    """
    Get 24h fees and revenue for a chain/protocol.
    Source: https://api.llama.fi/overview/fees
    High fees = high usage = bullish signal for the network.
    """
    slug = SYMBOL_TO_FEES_SLUG.get(symbol.upper())
    if not slug:
        return None

    data = await _fetch_defillama("https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true", "fees_overview")
    if not data:
        return None

    protocols = data.get("protocols", [])
    for p in protocols:
        if p.get("module", "").lower() == slug or p.get("name", "").lower() == slug:
            return {
                "protocol": p.get("name", slug),
                "fees24h": float(p.get("total24h", 0) or 0),
                "fees7d": float(p.get("total7d", 0) or 0),
                "fees30d": float(p.get("total30d", 0) or 0),
                "revenue24h": float(p.get("revenue24h", 0) or 0),
            }

    # Also try matching by chain name in the chain-level data
    chain_name = SYMBOL_TO_CHAIN.get(symbol.upper(), "")
    for p in protocols:
        if p.get("chains") and chain_name in p.get("chains", []):
            if p.get("category") == "Chain":
                return {
                    "protocol": p.get("name", slug),
                    "fees24h": float(p.get("total24h", 0) or 0),
                    "fees7d": float(p.get("total7d", 0) or 0),
                    "fees30d": float(p.get("total30d", 0) or 0),
                    "revenue24h": float(p.get("revenue24h", 0) or 0),
                }
    return None


async def get_chain_dex_volume(symbol: str) -> Optional[Dict]:
    """
    Get DEX trading volume on a specific chain.
    Source: https://api.llama.fi/overview/dexs
    High DEX volume = active on-chain economy = bullish.
    """
    chain_name = SYMBOL_TO_CHAIN.get(symbol.upper())
    if not chain_name:
        return None

    url = f"https://api.llama.fi/overview/dexs/{chain_name}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true"
    data = await _fetch_defillama(url, f"dex_vol_{chain_name}")
    if not data:
        return None

    return {
        "chain": chain_name,
        "dexVolume24h": float(data.get("total24h", 0) or 0),
        "dexVolume7d": float(data.get("total7d", 0) or 0),
        "change24h": float(data.get("change_1d", 0) or 0),
        "change7d": float(data.get("change_7d", 0) or 0),
        "change30d": float(data.get("change_1m", 0) or 0),
    }


async def get_chain_stablecoin_tvl(symbol: str) -> Optional[Dict]:
    """
    Get stablecoin liquidity on a specific chain.
    More stablecoins on a chain = more buying power = bullish for that ecosystem.
    Source: https://stablecoins.llama.fi/stablecoinchains
    """
    chain_name = SYMBOL_TO_CHAIN.get(symbol.upper())
    if not chain_name:
        return None

    data = await _fetch_defillama("https://stablecoins.llama.fi/stablecoinchains", "stable_chains")
    if not data:
        return None

    for chain in data:
        if chain.get("name", "").lower() == chain_name.lower():
            return {
                "chain": chain_name,
                "stablecoinTVL": float(chain.get("totalCirculatingUSD", {}).get("peggedUSD", 0)),
            }
    return None


async def get_full_defillama_metrics(symbol: str) -> Dict:
    """
    Get ALL available DeFiLlama metrics for a chain/token.
    Returns a comprehensive dict with TVL, Fees, DEX Volume, and Stablecoin liquidity.
    Only includes metrics that were actually retrieved — never fakes data.
    """
    result = {"source": "defillama", "symbol": symbol.upper()}
    
    tvl_data = await get_chain_tvl(symbol)
    if tvl_data:
        result["tvl"] = tvl_data

    fees_data = await get_chain_fees(symbol)
    if fees_data:
        result["fees"] = fees_data

    dex_data = await get_chain_dex_volume(symbol)
    if dex_data:
        result["dexVolume"] = dex_data

    stable_data = await get_chain_stablecoin_tvl(symbol)
    if stable_data:
        result["stablecoinLiquidity"] = stable_data

    result["metricsAvailable"] = len([k for k in ["tvl", "fees", "dexVolume", "stablecoinLiquidity"] if k in result])
    
    return result


def score_defillama_metrics(metrics: Dict, market_cap: float = 0) -> Dict:
    """
    Score altcoin on-chain health using DeFiLlama data.
    Returns a 0-100 score where:
    - Low score (0-40): Undervalued / growing usage
    - Mid score (40-60): Fair value
    - High score (60-100): Potentially overvalued
    
    Key ratios:
    - Mcap/TVL < 1: Undervalued (more value locked than market cap)
    - Fees growing: Bullish adoption signal
    - DEX volume growing: Active on-chain economy
    """
    sub_scores = {}
    weights = {}
    
    # 1. Mcap/TVL Ratio (the DeFi equivalent of MVRV)
    tvl_data = metrics.get("tvl")
    if tvl_data and market_cap > 0:
        tvl = tvl_data.get("tvl", 0)
        if tvl > 0:
            ratio = market_cap / tvl
            # ratio < 1 = undervalued, ratio > 10 = overvalued
            if ratio < 0.5:
                sub_scores["mcapTvl"] = 10  # Extremely undervalued
            elif ratio < 1.0:
                sub_scores["mcapTvl"] = 25  # Undervalued
            elif ratio < 3.0:
                sub_scores["mcapTvl"] = 40  # Fair
            elif ratio < 7.0:
                sub_scores["mcapTvl"] = 60  # Getting expensive
            elif ratio < 15.0:
                sub_scores["mcapTvl"] = 75  # Expensive
            else:
                sub_scores["mcapTvl"] = 90  # Very overvalued
            weights["mcapTvl"] = 0.35
    
    # 2. Fee Revenue Trend (high fees = adoption)
    fees_data = metrics.get("fees")
    if fees_data:
        fees_24h = fees_data.get("fees24h", 0)
        fees_7d = fees_data.get("fees7d", 0)
        
        if fees_24h > 0 and fees_7d > 0:
            # Daily vs weekly average — is usage accelerating?
            daily_avg_7d = fees_7d / 7
            if daily_avg_7d > 0:
                fee_momentum = fees_24h / daily_avg_7d
                # > 1.0 = accelerating usage (bullish for price but more "hot")
                if fee_momentum < 0.5:
                    sub_scores["feesTrend"] = 25  # Declining usage
                elif fee_momentum < 0.8:
                    sub_scores["feesTrend"] = 35
                elif fee_momentum < 1.2:
                    sub_scores["feesTrend"] = 50  # Stable usage
                elif fee_momentum < 2.0:
                    sub_scores["feesTrend"] = 65  # Growing usage
                else:
                    sub_scores["feesTrend"] = 80  # Very hot
                weights["feesTrend"] = 0.30
    
    # 3. DEX Volume Momentum
    dex_data = metrics.get("dexVolume")
    if dex_data:
        change_7d = dex_data.get("change7d", 0)
        # Positive change = growing on-chain activity
        if change_7d < -30:
            sub_scores["dexMomentum"] = 20  # Collapsing volume
        elif change_7d < -10:
            sub_scores["dexMomentum"] = 35  # Declining
        elif change_7d < 10:
            sub_scores["dexMomentum"] = 50  # Stable
        elif change_7d < 50:
            sub_scores["dexMomentum"] = 65  # Growing
        else:
            sub_scores["dexMomentum"] = 80  # Explosive growth
        weights["dexMomentum"] = 0.35
    
    if not sub_scores:
        return {"total": 50, "score": 50, "subScores": {}, "source": "defillama", "dataDepth": "minimal", "weight": 0.05}
    
    # Weighted average
    total_weight = sum(weights.values())
    if total_weight > 0:
        norm_weights = {k: v / total_weight for k, v in weights.items()}
    else:
        norm_weights = weights
    
    total = sum(sub_scores[k] * norm_weights.get(k, 0) for k in sub_scores)
    total = round(max(0, min(100, total)), 1)
    
    depth = "full" if len(sub_scores) >= 3 else "partial" if len(sub_scores) >= 1 else "minimal"
    rec_weight = 0.25 if depth == "full" else 0.15 if depth == "partial" else 0.05
    
    return {
        "total": total,
        "score": total,
        "subScores": sub_scores,
        "source": "defillama",
        "dataDepth": depth,
        "weight": rec_weight,
    }
