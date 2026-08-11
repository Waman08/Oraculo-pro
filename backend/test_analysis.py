import asyncio
import sys
import traceback

sys.path.insert(0, ".")

from services.analyzer import run_analysis
from services.binance_client import init_binance_symbols

async def test():
    try:
        await init_binance_symbols()
        r = await run_analysis("BTC", "1D", "Balanceado")
        if r:
            print("Symbol:", r["symbol"])
            print("Score:", r["mlScore"])
            print("Signal:", r["signal"])
            print("RSI:", r["indicators"]["rsi"])
            print("Price:", r["currentPrice"])
            print("Source:", r["source"])
            print("[OK] Analysis pipeline works!")
        else:
            print("[FAIL] run_analysis returned None")
    except Exception:
        traceback.print_exc()

asyncio.run(test())
