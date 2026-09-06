import asyncio
import os
import sys
sys.path.append(os.getcwd())
from services.onchain_dune import get_sopr
async def main():
    res = await get_sopr()
    print('SOPR:', res)
asyncio.run(main())
