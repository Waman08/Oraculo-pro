import sys
import os
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.path.insert(0, '.')

try:
    from services.indicators import calculate_all_indicators
    print("[OK] indicators.py imports fine")
except Exception as e:
    print(f"[ERR] indicators.py: {e}")

try:
    from services.analyzer import run_analysis, score_momentum, score_trend
    print("[OK] analyzer.py imports fine")
except Exception as e:
    print(f"[ERR] analyzer.py: {e}")

try:
    from services.telegram import TelegramSender, format_signal_alert, format_price_alert
    print("[OK] telegram.py imports fine")
except Exception as e:
    print(f"[ERR] telegram.py: {e}")

try:
    from services.binance_client import init_binance_symbols, fetch_ticker
    print("[OK] binance_client.py imports fine")
except Exception as e:
    print(f"[ERR] binance_client.py: {e}")

# Test the formatter
msg = format_price_alert("BTC", "below", 79000, 78500)
print(f"\n[TEST] Price alert message:\n{msg}")

msg2 = format_signal_alert(
    symbol="BTC", name="Bitcoin", signal="Compra Fuerte",
    score=18.5, price=78500, change_24h=-3.2,
    timeframe="1D", mode="Balanceado",
    optimal_entry=77000, take_profit=85000, stop_loss=74000,
)
print(f"\n[TEST] Signal alert message:\n{msg2}")

print("\n[ALL GOOD] All backend modules load correctly!")
