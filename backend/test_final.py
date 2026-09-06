import asyncio
import os
import sys
sys.path.append(os.getcwd())
from services.binance_client import fetch_klines, init_binance_symbols
from services.analyzer import run_analysis
from pprint import pprint

async def main():
    await init_binance_symbols()
    res = await run_analysis('BTC', 'Balanceado')
    if res:
        print('SUCCESS!')
        print('ACTUARIAL: ', res.get('actuarial', {}).get('dataAvailable'))
        print('LIQUIDITY: ', res.get('liquidity', {}).get('liquidityScore'))
        print('ONCHAIN SCORE: ', res.get('scoreBreakdown', {}).get('onChain', {}).get('score'))
    else:
        print('FAILED TO FETCH')

asyncio.run(main())
