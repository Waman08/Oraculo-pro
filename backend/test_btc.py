import asyncio
import os
import sys
sys.path.append(os.getcwd())
from services.binance_client import fetch_klines, init_binance_symbols
from services.analyzer import run_analysis

async def main():
    await init_binance_symbols()
    res = await run_analysis('BTC', 'Balanceado')
    print('ACTUARIAL: ', res.get('actuarial'))
    print('ONCHAIN: ', res.get('supplyDynamics'))
    print('LIQUIDITY: ', res.get('liquidity'))

asyncio.run(main())
