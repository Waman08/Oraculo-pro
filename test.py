import asyncio
import sys
sys.path.append('backend')
from services.binance_client import fetch_klines, fetch_ticker
async def main():
    k = await fetch_klines('BTC', '1D')
    print('klines:', len(k) if k is not None else 0)
    t = await fetch_ticker('BTC')
    print('ticker:', t)
asyncio.run(main())
