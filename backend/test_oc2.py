import asyncio
import os
import sys
sys.path.append(os.getcwd())
sys.stdout.reconfigure(encoding='utf-8')
from services.binance_client import fetch_klines, init_binance_symbols
from services.analyzer import run_analysis
from pprint import pprint

async def main():
    await init_binance_symbols()
    res = await run_analysis('BTC', 'Balanceado')
    print('ONCHAIN SCORE BREAKDOWN:')
    pprint(res.get('scoreBreakdown', {}).get('onChain'))

asyncio.run(main())
