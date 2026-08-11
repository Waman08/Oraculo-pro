import asyncio
import pandas as pd
from services.binance_client import BINANCE_PAIR_MAP, init_binance_symbols, fetch_klines
from services.backtester import run_backtest

async def test():
    await init_binance_symbols()
    df = await fetch_klines("BTC", "1D", 500)
    print("Fetched df shape:", df.shape if df is not None else None)
    if df is not None and not df.empty:
        results = run_backtest(df)
        print("Metrics:", results.get("metrics"))
        print("Total Trades:", len(results.get("trades", [])))

if __name__ == "__main__":
    asyncio.run(test())
