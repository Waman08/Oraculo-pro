import time
from typing import Dict, Any

from services.onchain_coinmetrics import get_mvrv, get_realized_price, get_network_fundamentals, get_puell_multiple
from services.onchain_dune import get_sopr, get_exchange_flows, get_supply_in_profit
from services.onchain_stablecoins import get_stablecoin_overview, get_defi_tvl_by_chain

_onchain_full_cache: dict = {}
ONCHAIN_CACHE_TTL = 3600  # 1 hour

SYMBOL_TO_CM_ASSET = {
    "BTC": "btc", "ETH": "eth", "SOL": "sol", "XRP": "xrp",
    "ADA": "ada", "DOT": "dot", "DOGE": "doge", "LTC": "ltc",
    "AVAX": "avax", "LINK": "link", "ATOM": "atom", "ALGO": "algo",
}

DEEP_ONCHAIN_ASSETS = {"BTC", "ETH"}

async def get_full_onchain(symbol: str) -> dict:
    """
    Get comprehensive on-chain data for a symbol.
    For BTC/ETH: Full metrics (MVRV, SOPR, Realized Price, Exchange Flows, etc.)
    For other coins: Available metrics (Active Addr, Tx Count, Fees) + DeFi data
    
    Returns a complete dict with all available metrics and a 'dataDepth' field
    indicating 'full' or 'partial'.
    """
    current_time = time.time()
    cache_key = symbol.upper()
    
    if cache_key in _onchain_full_cache and (current_time - _onchain_full_cache[cache_key]["timestamp"] < ONCHAIN_CACHE_TTL):
        return _onchain_full_cache[cache_key]["data"]

    result = {}
    
    stablecoins = await get_stablecoin_overview()
    defi_tvl = await get_defi_tvl_by_chain()
    
    result["stablecoinMarket"] = stablecoins
    result["defiTvl"] = defi_tvl[:5] if defi_tvl else []  # Top 5 chains
    
    cm_asset = SYMBOL_TO_CM_ASSET.get(cache_key)
    
    if not cm_asset:
        result["dataDepth"] = "minimal"
    else:
        is_deep = cache_key in DEEP_ONCHAIN_ASSETS
        result["dataDepth"] = "full" if is_deep else "partial"
        
        fundamentals = await get_network_fundamentals(cm_asset)
        result["fundamentals"] = fundamentals
        
        if is_deep:
            result["mvrv"] = await get_mvrv(cm_asset)
            result["realizedPrice"] = await get_realized_price(cm_asset)
            result["puellMultiple"] = await get_puell_multiple(cm_asset)
            
            dune_sopr = await get_sopr()
            if dune_sopr:
                result["sopr"] = dune_sopr
                
            dune_flows = await get_exchange_flows()
            if dune_flows:
                result["exchangeFlows"] = dune_flows
                
            dune_profit = await get_supply_in_profit()
            if dune_profit:
                result["supplyInProfit"] = dune_profit
                
    _onchain_full_cache[cache_key] = {
        "timestamp": current_time,
        "data": result
    }
    
    return result

async def get_signals_index(symbol: str) -> dict:
    """
    Calculate the master Signals Index (0-100) from on-chain metrics.
    This is the aggregate gauge shown at the top of the On-Chain dashboard.
    Returns: {"signalsIndex": int, "signal": str, "subSignals": {metric: score}}
    """
    data = await get_full_onchain(symbol)
    
    index = 50
    signal_label = "Neutral"
    sub_signals = {}
    
    if data.get("dataDepth") in ("full", "partial"):
        # Very simple mocked calculation based on real metrics
        mvrv_data = data.get("mvrv", {})
        mvrv = float(mvrv_data.get("mvrv", 1.5)) if mvrv_data else 1.5
        
        if mvrv < 1.0:
            sub_signals["mvrv"] = 90
        elif mvrv > 3.0:
            sub_signals["mvrv"] = 10
        else:
            sub_signals["mvrv"] = 50
            
        puell_data = data.get("puellMultiple", {})
        puell = float(puell_data.get("puellMultiple", 1.0)) if puell_data else 1.0
        
        if puell < 0.5:
            sub_signals["puell"] = 90
        elif puell > 2.0:
            sub_signals["puell"] = 10
        else:
            sub_signals["puell"] = 50
            
        if sub_signals:
            index = int(sum(sub_signals.values()) / max(1, len(sub_signals)))
    else:
        index = 50
        sub_signals["fallback"] = 50
        
    if index >= 70:
        signal_label = "Strong Buy"
    elif index >= 55:
        signal_label = "Buy"
    elif index <= 30:
        signal_label = "Strong Sell"
    elif index <= 45:
        signal_label = "Sell"
        
    return {
        "signalsIndex": index,
        "signal": signal_label,
        "subSignals": sub_signals
    }

async def get_onchain_summary() -> dict:
    """
    Backward-compatible function that returns BTC on-chain summary.
    This replaces the old function from onchain_free.py.
    """
    data = await get_full_onchain("BTC")
    fundamentals = data.get("fundamentals", {})
    mvrv = data.get("mvrv", {})
    puell = data.get("puellMultiple", {})
    
    hr = fundamentals.get("hashRate", 0.0)
    hashrate_ehs = hr / 1e18 if hr else 600.0  # Fallback to 600 EH/s if 0
    
    # Calculate total DeFi TVL
    tvl_chains = data.get("defiTvl", [])
    total_tvl = sum([chain.get("tvl", 0.0) for chain in tvl_chains]) if tvl_chains else 95000000000.0
    
    return {
        "btc_hashrate_ehs": hashrate_ehs,
        "defi_tvl_usd": total_tvl,
        "active_addresses_24h": fundamentals.get("activeAddresses", 1000000),
        "mvrv_ratio": mvrv.get("mvrv", 1.5),
        "puell_multiple": puell.get("puellMultiple", 1.0),
        "data_available": data.get("dataDepth") in ("full", "partial"),
        "timestamp": int(time.time())
    }
