import asyncio
import sys
sys.path.append('backend')
from services.binance_client import fetch_klines, init_binance_symbols
async def main():
    await init_binance_symbols()
    k = await fetch_klines('BTC', '1D')
    print('klines:', k)
asyncio.run(main())
