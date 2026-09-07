# ============================================================
# ON-CHAIN ENGINE v3 - Honest, per-coin data routing
# ============================================================
import time
import httpx
from typing import Dict, Any

from services.onchain_stablecoins import get_stablecoin_overview, get_defi_tvl_by_chain
from services.onchain_defillama import get_full_defillama_metrics, score_defillama_metrics
from services.supply_dynamics import get_supply_data

_onchain_full_cache: dict = {}
ONCHAIN_CACHE_TTL = 3600  # 1 hour

async def get_blockchair_stats(symbol: str) -> Dict[str, Any]:
    bc_map = {'BTC': 'bitcoin', 'ETH': 'ethereum', 'DOGE': 'dogecoin', 'LTC': 'litecoin', 'BCH': 'bitcoin-cash', 'ADA': 'cardano'}
    coin = bc_map.get(symbol.upper())
    if not coin: return None
    
    url = f'https://api.blockchair.com/{coin}/stats'
    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            resp = await client.get(url, headers={'User-Agent': 'Mozilla/5.0'})
            if resp.status_code == 200:
                data = resp.json().get('data', {})
                return {
                    "activeAddresses": data.get("hodling_addresses", 0),
                    "txCount": data.get("transactions_24h", 0),
                    "feesMeanUSD": data.get("average_transaction_fee_usd_24h", 0.0),
                    "hashRate": float(data.get("hashrate_24h", 0)) if data.get("hashrate_24h") else 0.0,
                    "mempoolTps": data.get("mempool_tps", 0.0)
                }
    except Exception as e:
        print(f"Blockchair Error {symbol}: {e}")
    return None

async def get_full_onchain(symbol: str) -> dict:
    current_time = time.time()
    cache_key = symbol.upper()
    
    if cache_key in _onchain_full_cache and (current_time - _onchain_full_cache[cache_key]["timestamp"] < ONCHAIN_CACHE_TTL):
        return _onchain_full_cache[cache_key]["data"]

    result = {"dataAvailable": True, "metrics": {}}
    
    bc_data = await get_blockchair_stats(symbol)
    if bc_data:
        result["metrics"]["fundamentals"] = bc_data

    try:
        supply_data = await get_supply_data(symbol)
        if supply_data:
            result["metrics"]["supplyDynamics"] = supply_data
    except Exception as e:
        print(f"[OnChain] Error fetching supply data: {e}")

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

    try:
        defillama_data = await get_full_defillama_metrics(symbol)
        if defillama_data and defillama_data.get('metricsAvailable', 0) > 0:
            result["metrics"]["defillama"] = defillama_data
    except Exception as e:
        print(f"[OnChainEngine] DefiLlama fetch error: {e}")

    result["dataDepth"] = "standard"
    _onchain_full_cache[cache_key] = {"timestamp": current_time, "data": result}
    return result

async def get_onchain_summary(symbol: str = 'BTC') -> dict:
    data = await get_full_onchain(symbol)
    return data
async def get_signals_index(symbol: str) -> dict:
    return {
        "signalsIndex": 50,
        "signal": "Neutral",
        "subSignals": {}
    }

