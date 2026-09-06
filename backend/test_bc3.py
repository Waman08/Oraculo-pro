import httpx
import time
from typing import Dict, Any

async def get_blockchair_stats(symbol: str) -> Dict[str, Any]:
    # Blockchair only supports specific coins
    bc_map = {'BTC': 'bitcoin', 'ETH': 'ethereum', 'DOGE': 'dogecoin', 'LTC': 'litecoin', 'BCH': 'bitcoin-cash', 'ADA': 'cardano'}
    coin = bc_map.get(symbol.upper())
    if not coin: return None
    
    url = f'https://api.blockchair.com/{coin}/stats'
    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            resp = await client.get(url, headers={'User-Agent': 'Mozilla/5.0'})
            if resp.status_code == 200:
                return resp.json().get('data', {})
    except Exception as e:
        print(f"Blockchair Error {symbol}: {e}")
    return None

import asyncio
print(asyncio.run(get_blockchair_stats('BTC')))
