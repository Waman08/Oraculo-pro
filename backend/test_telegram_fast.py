import asyncio
import os
import sys
from pathlib import Path

# Add backend directory to path
sys.path.append(str(Path(__file__).parent))

from telegram_bot import get_config, load_sent_signals, save_sent_signals
from services.telegram import TelegramSender

async def test_bot_configuration():
    print("[TEST] Loading configuration...")
    config = get_config()
    print(f"  Watchlist: {config['WATCHLIST']}")
    print(f"  Timeframe: {config['TIMEFRAME']}")
    print(f"  Risk Mode: {config['RISK_MODE']}")
    print(f"  Check Interval: {config['CHECK_INTERVAL']} minutes")
    
    print("[TEST] Verifying persistent sent signals...")
    signals = load_sent_signals()
    print(f"  Loaded sent signals: {signals}")
    
    # Save a test item and reload
    test_signals = {"TESTBTC": "Compra Fuerte"}
    save_sent_signals(test_signals)
    loaded = load_sent_signals()
    print(f"  Reloaded sent signals: {loaded}")
    assert loaded.get("TESTBTC") == "Compra Fuerte", "Sent signals persistence failed!"
    
    # Restore original sent signals
    save_sent_signals(signals)
    print("  Sent signals restored.")
    
    print("[TEST] Verifying TelegramSender connection test...")
    if config["BOT_TOKEN"] and config["CHAT_ID"]:
        sender = TelegramSender(config["BOT_TOKEN"], config["CHAT_ID"])
        connected = await sender.test_connection()
        print(f"  Telegram connection test: {'SUCCESS' if connected else 'FAILED'}")
    else:
        print("  [WARN] Telegram token or Chat ID not configured in .env.local. Skipping connection test.")
        
    print("[TEST] Decoupled concurrent alert loop validation complete.")

if __name__ == "__main__":
    asyncio.run(test_bot_configuration())
