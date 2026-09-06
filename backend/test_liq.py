import asyncio
import os
import sys
sys.path.append(os.getcwd())
from services.liquidity_engine import get_liquidity_data
async def main():
    res = await get_liquidity_data('BTC')
    print('LIQUIDITY: ', res)
asyncio.run(main())
