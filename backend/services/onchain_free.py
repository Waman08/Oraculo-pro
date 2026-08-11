import httpx
import time
from typing import Dict, Optional

# Cache variables
_onchain_cache = {}
_cache_ttl = 600  # 10 minutes

async def fetch_with_retry(client: httpx.AsyncClient, url: str) -> Optional[Dict]:
    try:
        response = await client.get(url)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"[OnChain] Error fetching {url}: {e}")
    return None

async def get_onchain_summary() -> Dict:
    global _onchain_cache
    current_time = time.time()
    
    if _onchain_cache and (current_time - _onchain_cache.get("timestamp", 0) < _cache_ttl):
        return _onchain_cache["data"]

    # Default fallback values
    btc_hashrate_ehs = 600.0
    defi_tvl_usd = 95000000000.0
    active_addresses_24h = 1000000
    mvrv_ratio = 1.5
    puell_multiple = 1.0
    data_available = False

    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. BTC Hash Rate
        hash_data = await fetch_with_retry(client, "https://api.blockchain.info/charts/hash-rate?format=json&timespan=1days")
        if hash_data and "values" in hash_data and hash_data["values"]:
            last_val = hash_data["values"][-1].get("y")
            if last_val is not None:
                btc_hashrate_ehs = float(last_val) / 1_000_000.0
                data_available = True
                
        # 2. Active Addresses
        addr_data = await fetch_with_retry(client, "https://api.blockchain.info/charts/n-unique-addresses?format=json&timespan=1days")
        if addr_data and "values" in addr_data and addr_data["values"]:
            last_val = addr_data["values"][-1].get("y")
            if last_val is not None:
                active_addresses_24h = int(last_val)
                data_available = True

        # 3. MVRV Ratio (Simplified proxy: Market Cap / 365-day moving average)
        mcap_data = await fetch_with_retry(client, "https://api.blockchain.info/charts/market-cap?format=json&timespan=1days")
        mcap_365_data = await fetch_with_retry(client, "https://api.blockchain.info/charts/market-cap?format=json&timespan=365days")
        
        if mcap_data and "values" in mcap_data and mcap_data["values"] and \
           mcap_365_data and "values" in mcap_365_data and mcap_365_data["values"]:
            current_mcap = mcap_data["values"][-1].get("y")
            mcap_vals = [v.get("y") for v in mcap_365_data["values"] if v.get("y") is not None]
            if current_mcap is not None and mcap_vals:
                avg_mcap = sum(mcap_vals) / len(mcap_vals)
                if avg_mcap > 0:
                    mvrv_ratio = current_mcap / avg_mcap
                    data_available = True
                    
        # 4. Puell Multiple
        miners_rev_data = await fetch_with_retry(client, "https://api.blockchain.info/charts/miners-revenue?format=json&timespan=365days")
        if miners_rev_data and "values" in miners_rev_data and miners_rev_data["values"]:
            rev_vals = [v.get("y") for v in miners_rev_data["values"] if v.get("y") is not None]
            if rev_vals:
                current_rev = rev_vals[-1]
                avg_rev = sum(rev_vals) / len(rev_vals)
                if avg_rev > 0:
                    puell_multiple = current_rev / avg_rev
                    data_available = True

        # 5. DeFi TVL
        try:
            resp = await client.get("https://api.llama.fi/tvl")
            if resp.status_code == 200:
                tvl_data = resp.json()
                if isinstance(tvl_data, (int, float)):
                    defi_tvl_usd = float(tvl_data)
                    data_available = True
        except Exception as e:
            print(f"[OnChain] Error fetching TVL: {e}")

    # If API calls fail, fallback to previous cache if available
    if not data_available and _onchain_cache and "data" in _onchain_cache:
        # Use previous cache even if expired
        return _onchain_cache["data"]

    result = {
        "btc_hashrate_ehs": btc_hashrate_ehs,
        "defi_tvl_usd": defi_tvl_usd,
        "active_addresses_24h": active_addresses_24h,
        "mvrv_ratio": mvrv_ratio,
        "puell_multiple": puell_multiple,
        "data_available": data_available,
        "timestamp": int(current_time)
    }
    
    _onchain_cache = {
        "timestamp": current_time,
        "data": result
    }
    
    return result
