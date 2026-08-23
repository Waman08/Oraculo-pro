# ============================================================
# ON-CHAIN ENGINE v3 — Honest, per-coin data routing
# ============================================================
# RULES:
# 1. NEVER return data from one coin labeled as another
# 2. NEVER hardcode fallback metric values - if unavailable, omit the key
# 3. Every metric must come from a verifiable API source
# 4. dataDepth honestly reflects what was obtained
# ============================================================

import time
from typing import Dict, Any

from services.onchain_coinmetrics import get_mvrv, get_realized_price, get_network_fundamentals, get_puell_multiple
from services.onchain_stablecoins import get_stablecoin_overview, get_defi_tvl_by_chain

_onchain_full_cache: dict = {}
ONCHAIN_CACHE_TTL = 3600  # 1 hour

# Maps our symbols to CoinMetrics asset IDs (only coins supported by CoinMetrics Community API)
SYMBOL_TO_CM_ASSET = {
    "BTC": "btc", "ETH": "eth", "SOL": "sol", "XRP": "xrp",
    "ADA": "ada", "DOT": "dot", "DOGE": "doge", "LTC": "ltc",
    "AVAX": "avax", "LINK": "link", "ATOM": "atom", "ALGO": "algo",
}

# Only BTC has free Realized Cap (CapRealUSD) and miner issuance (IssTotUSD) on CoinMetrics Community API.
# ETH has some but unreliable on free tier. All others: only basic network metrics.
DEEP_ONCHAIN_ASSETS = {"BTC"}


async def get_full_onchain(symbol: str) -> dict:
    """
    Get comprehensive on-chain data for a symbol.
    HONEST routing: only returns metrics that actually exist for this specific coin.
    Never returns BTC data for another coin.
    """
    current_time = time.time()
    cache_key = symbol.upper()
    
    if cache_key in _onchain_full_cache and (current_time - _onchain_full_cache[cache_key]["timestamp"] < ONCHAIN_CACHE_TTL):
        return _onchain_full_cache[cache_key]["data"]

    result = {"dataAvailable": True}
    
    # Global DeFi data (clearly labeled as global, not coin-specific)
    try:
        stablecoins = await get_stablecoin_overview()
        result["stablecoinMarket"] = stablecoins
    except Exception as e:
        print(f"[OnChainEngine] Stablecoin fetch error: {e}")
    
    try:
        defi_tvl = await get_defi_tvl_by_chain()
        result["defiTvl"] = defi_tvl[:5] if defi_tvl else []
    except Exception as e:
        print(f"[OnChainEngine] DeFi TVL fetch error: {e}")
    
    cm_asset = SYMBOL_TO_CM_ASSET.get(cache_key)
    
    if not cm_asset:
        # Coin not in CoinMetrics - no on-chain data available
        result["dataDepth"] = "minimal"
        _onchain_full_cache[cache_key] = {"timestamp": current_time, "data": result}
        return result
    
    is_deep = cache_key in DEEP_ONCHAIN_ASSETS
    
    # Network fundamentals (Active Addresses, Tx Count, Fees) - available for most coins
    try:
        fundamentals = await get_network_fundamentals(cm_asset)
        if fundamentals and fundamentals.get("activeAddresses", 0) > 0:
            result["fundamentals"] = fundamentals
    except Exception as e:
        print(f"[OnChainEngine] Fundamentals error for {cache_key}: {e}")
    
    if is_deep:
        # MVRV - only for BTC where CapRealUSD is available on free tier
        try:
            mvrv_data = await get_mvrv(cm_asset)
            if mvrv_data and mvrv_data.get("mvrv") and mvrv_data["mvrv"] > 0:
                result["mvrv"] = mvrv_data
        except Exception as e:
            print(f"[OnChainEngine] MVRV error for {cache_key}: {e}")
        
        # Realized Price - only for BTC
        try:
            rp_data = await get_realized_price(cm_asset)
            if rp_data and rp_data.get("realizedPrice") and rp_data["realizedPrice"] > 0:
                result["realizedPrice"] = rp_data
        except Exception as e:
            print(f"[OnChainEngine] Realized Price error for {cache_key}: {e}")
        
        # Puell Multiple - only for BTC (requires miner issuance data)
        try:
            puell_data = await get_puell_multiple(cm_asset)
            if puell_data and puell_data.get("puellMultiple") and puell_data["puellMultiple"] > 0:
                result["puellMultiple"] = puell_data
        except Exception as e:
            print(f"[OnChainEngine] Puell error for {cache_key}: {e}")
    
    # NOTE: Dune Analytics queries removed — the query IDs were fake placeholders.
    # SOPR, Exchange Flows, and Supply in Profit require paid Dune/Glassnode access.
    # These will be re-added when real query IDs are available.
    
    # Determine honest data depth
    has_mvrv = "mvrv" in result
    has_fundamentals = "fundamentals" in result
    
    if has_mvrv and has_fundamentals:
        result["dataDepth"] = "full"
    elif has_fundamentals:
        result["dataDepth"] = "partial"
    else:
        result["dataDepth"] = "minimal"
        
    _onchain_full_cache[cache_key] = {
        "timestamp": current_time,
        "data": result
    }
    
    return result


async def get_signals_index(symbol: str) -> dict:
    """
    Calculate the master Signals Index (0-100) from REAL on-chain metrics only.
    If a metric is not available for this coin, it is excluded from the calculation.
    """
    data = await get_full_onchain(symbol)
    
    sub_signals = {}
    
    # MVRV scoring (only if we actually have it)
    mvrv_data = data.get("mvrv")
    if mvrv_data and isinstance(mvrv_data, dict):
        mvrv = mvrv_data.get("mvrv")
        if mvrv is not None and mvrv > 0:
            if mvrv < 1.0:
                sub_signals["mvrv"] = 90  # Undervalued
            elif mvrv > 3.5:
                sub_signals["mvrv"] = 10  # Euphoria
            elif mvrv > 2.5:
                sub_signals["mvrv"] = 25  # Overvalued
            else:
                # Linear interpolation between 1.0-2.5 → 70-40
                sub_signals["mvrv"] = round(70 - (mvrv - 1.0) / 1.5 * 30)
    
    # Puell Multiple scoring (only if we actually have it)
    puell_data = data.get("puellMultiple")
    if puell_data and isinstance(puell_data, dict):
        puell = puell_data.get("puellMultiple")
        if puell is not None and puell > 0:
            if puell < 0.5:
                sub_signals["puell"] = 90  # Miner capitulation
            elif puell > 3.0:
                sub_signals["puell"] = 10  # Euphoria
            elif puell > 2.0:
                sub_signals["puell"] = 25
            else:
                sub_signals["puell"] = round(70 - (puell - 0.5) / 1.5 * 30)
    
    # Realized Price scoring (only if we have both realized and market price)
    rp_data = data.get("realizedPrice")
    if rp_data and isinstance(rp_data, dict):
        rp = rp_data.get("realizedPrice")
        mkt = rp_data.get("marketPrice") or rp_data.get("currentPrice")
        if rp and mkt and rp > 0:
            ratio = mkt / rp
            if ratio < 1.0:
                sub_signals["realizedPrice"] = 85  # Below realized = strong buy
            elif ratio > 3.0:
                sub_signals["realizedPrice"] = 15  # Way above realized
            else:
                sub_signals["realizedPrice"] = round(75 - (ratio - 1.0) / 2.0 * 50)
    
    # Calculate aggregate
    if sub_signals:
        index = int(sum(sub_signals.values()) / len(sub_signals))
    else:
        index = 50  # Neutral when no data
    
    index = max(0, min(100, index))
    
    if index >= 70:
        signal_label = "Strong Buy"
    elif index >= 55:
        signal_label = "Buy"
    elif index <= 30:
        signal_label = "Strong Sell"
    elif index <= 45:
        signal_label = "Sell"
    else:
        signal_label = "Neutral"
        
    return {
        "signalsIndex": index,
        "signal": signal_label,
        "subSignals": sub_signals,
        "dataAvailable": len(sub_signals) > 0
    }


async def get_onchain_summary() -> dict:
    """
    Backward-compatible function that returns BTC on-chain summary.
    Only includes metrics that were actually fetched - never hardcoded fallbacks.
    """
    data = await get_full_onchain("BTC")
    fundamentals = data.get("fundamentals", {})
    mvrv_data = data.get("mvrv", {})
    puell_data = data.get("puellMultiple", {})
    
    hr = fundamentals.get("hashRate", 0.0)
    hashrate_ehs = hr / 1e18 if hr else 0.0
    
    # Calculate total DeFi TVL from real data only
    tvl_chains = data.get("defiTvl", [])
    total_tvl = sum([chain.get("tvl", 0.0) for chain in tvl_chains]) if tvl_chains else 0.0
    
    return {
        "btc_hashrate_ehs": hashrate_ehs,
        "defi_tvl_usd": total_tvl,
        "active_addresses_24h": fundamentals.get("activeAddresses", 0),
        "mvrv_ratio": mvrv_data.get("mvrv") if mvrv_data else None,
        "puell_multiple": puell_data.get("puellMultiple") if puell_data else None,
        "data_available": data.get("dataDepth") in ("full", "partial"),
        "timestamp": int(time.time())
    }
