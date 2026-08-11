import asyncio
from services.binance_client import init_binance_symbols
from services.analyzer import run_analysis
import pprint

async def main():
    await init_binance_symbols()
    
    for symbol in ["BTC", "ETH", "SOL"]:
        r = await run_analysis(symbol)
        if r:
            sm = r["smartMoney"]
            print(f"\n{'='*50}")
            print(f"  {symbol} — Smart Money (DATOS REALES)")
            print(f"{'='*50}")
            print(f"  Precio Actual: ${r['currentPrice']:,.2f}")
            print(f"  Señal: {r['signal']} (Score: {r['mlScore']})")
            print(f"  POC (Volume Profile): ${sm['volumeProfilePOC']:,.2f}")
            print(f"  Order Blocks:")
            for ob in sm["orderBlocks"]:
                print(f"    - {ob['type'].upper()}: ${ob['priceLow']:,.2f} — ${ob['priceHigh']:,.2f} (Fuerza: {ob['strength']}%)")
            print(f"  Fair Value Gaps:")
            for fvg in sm["fairValueGaps"]:
                status = "MITIGADO" if fvg["filled"] else "ABIERTO"
                print(f"    - {fvg['type'].upper()}: ${fvg['low']:,.2f} — ${fvg['high']:,.2f} [{status}]")
        else:
            print(f"[WARN] No se pudo analizar {symbol}")

asyncio.run(main())
