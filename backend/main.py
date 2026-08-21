# ============================================================
# MAIN — FastAPI Backend for Trading Oracle Pro
# ============================================================

import json
import os
import time
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import websockets
import pandas as pd
import telegram_bot
from telegram_bot import start_bot_loop

from services.analyzer import run_analysis, run_screener_analysis_fast
from services.binance_client import fetch_all_tickers, fetch_ticker, get_name, is_supported, BINANCE_PAIR_MAP, init_binance_symbols, fetch_klines
from services.indicators import calculate_all_indicators
from services.backtester import run_backtest
from services.onchain_engine import get_full_onchain, get_signals_index
from services.onchain_stablecoins import get_stablecoin_chains, get_stablecoin_overview
from services.onchain_scoring import score_onchain_v2
from services.whale_tracker import get_recent_whale_movements
from services.user_prefs import get_user_prefs, save_user_prefs

import api_public

# ---- Cache ----
_cache: dict = {}
CACHE_TTL = 15  # seconds

# Global Screener Cache (holds long-running analysis results)
_screener_cache: dict = {}

START_TIME = time.time()

# Path to price alerts file (shared with telegram_bot.py)
ALERTS_FILE = Path(__file__).parent / "price_alerts.json"
ENV_FILE = Path(__file__).parent.parent / ".env.local"


async def cache_cleanup_loop():
    """
    Garbage Collector: Cleans up expired items from _cache periodically
    to prevent memory leaks over time.
    """
    print("[INIT] Starting Cache Garbage Collector...")
    while True:
        try:
            # Clean up every 1 hour
            await asyncio.sleep(3600)
            now = time.time()
            expired_keys = [k for k, v in _cache.items() if (now - v["ts"]) > CACHE_TTL]
            for k in expired_keys:
                del _cache[k]
            if expired_keys:
                print(f"[GC] Cleared {len(expired_keys)} expired items from cache.")
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[GC] Error in cache cleanup: {e}")
            await asyncio.sleep(60)
            

async def screener_updater_loop():
    """
    Background task: Continuously analyzes the top 100 coins using
    the FAST screener function (no ML/Actuarial/Sentiment HTTP).
    Uses batch concurrency (5 at a time) for speed.
    Stores the quantitative score in _screener_cache.
    """
    print("[INIT] Starting Screener Background Loop (FAST mode)...")
    # Give the server a moment to fully start
    await asyncio.sleep(5)
    
    while True:
        try:
            tickers = await fetch_all_tickers()
            if not tickers:
                print("[Screener Loop] No tickers available, retrying in 30s...")
                await asyncio.sleep(30)
                continue
            
            # Top 100 by volume
            sorted_by_volume = sorted(tickers.items(), key=lambda x: x[1]["volume24h"], reverse=True)
            top_symbols = [sym for sym, _ in sorted_by_volume[:100]]
            
            analyzed_count = 0
            error_count = 0
            
            # Process in batches of 5 for speed while respecting rate limits
            BATCH_SIZE = 5
            for i in range(0, len(top_symbols), BATCH_SIZE):
                batch = top_symbols[i:i+BATCH_SIZE]
                
                async def analyze_one(sym: str):
                    try:
                        analysis = await run_screener_analysis_fast(sym, "Balanceado")
                        if analysis:
                            _screener_cache[sym] = {
                                "quantScore": analysis["quantScore"],
                                "signal": analysis["signal"],
                                "rsi": analysis["rsi"],
                                "ts": time.time()
                            }
                            return True
                    except Exception as e:
                        print(f"[Screener Loop] Error analyzing {sym}: {e}")
                    return False
                
                results = await asyncio.gather(
                    *[analyze_one(sym) for sym in batch],
                    return_exceptions=True
                )
                
                for r in results:
                    if r is True:
                        analyzed_count += 1
                    else:
                        error_count += 1
                
                # Brief pause between batches to respect API rate limits
                await asyncio.sleep(0.5)
            
            print(f"[Screener Loop] Completed: {analyzed_count} OK, {error_count} errors. Cache has {len(_screener_cache)} coins. Sleeping 5 mins.")
            # Wait 5 minutes before restarting the full loop
            await asyncio.sleep(300)
            
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Screener Loop] Fatal error: {e}")
            import traceback
            traceback.print_exc()
            await asyncio.sleep(60)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[OK] Trading Oracle Python Backend starting...")
    await init_binance_symbols()
    
    # Start Telegram bot loop in background
    print("[INIT] Starting Telegram Bot background task...")
    bot_task = asyncio.create_task(start_bot_loop())
    
    # Start Screener background loop
    screener_task = asyncio.create_task(screener_updater_loop())
    
    # Start Garbage Collector
    gc_task = asyncio.create_task(cache_cleanup_loop())
    
    yield
    
    print("[BYE] Backend shutting down.")
    bot_task.cancel()
    screener_task.cancel()
    gc_task.cancel()


app = FastAPI(
    title="Trading Oracle Pro — Quantitative Backend",
    version="1.0.0",
    description="Real-time technical analysis engine with pandas-ta",
    lifespan=lifespan,
)

# CORS — Allow the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production needs specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include public API router
app.include_router(api_public.router)


# ============================================================
# ENDPOINTS
# ============================================================


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "uptime_seconds": round(time.time() - START_TIME, 1),
        "supported_symbols": len(BINANCE_PAIR_MAP),
    }


@app.get("/api/analyze/{symbol}")
async def analyze(
    symbol: str,
    timeframe: str = Query("1D", description="Timeframe: 1S, 1D, 4H, 1H, 15M"),
    mode: str = Query("Balanceado", description="Risk mode: Seguro, Balanceado, Agresivo"),
):
    """
    Full quantitative analysis for a single symbol.
    Uses real technical indicators calculated from Binance klines.
    """
    import traceback
    symbol = symbol.upper()

    if not is_supported(symbol):
        raise HTTPException(
            status_code=404,
            detail=f"Symbol {symbol} not supported. Use /api/symbols for the list.",
        )

    # Check cache
    cache_key = f"{symbol}:{timeframe}:{mode}"
    cached = _cache.get(cache_key)
    if cached and (time.time() - cached["ts"]) < CACHE_TTL:
        return cached["data"]

    # Run analysis
    try:
        result = await run_analysis(symbol, timeframe, mode)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    if result is None:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch data for {symbol} from Binance.",
        )

    _cache[cache_key] = {"data": result, "ts": time.time()}

    return result


@app.get("/api/backtest")
async def backtest(
    symbol: str = Query(..., description="Symbol to backtest (e.g., BTC)"),
    timeframe: str = Query("1D", description="Timeframe: 1D, 4H, 1H, etc."),
    limit: int = Query(500, description="Number of historical candles to fetch")
):
    """
    Run a simulated trading strategy on historical data.
    Returns professional metrics like Sharpe Ratio, Max Drawdown, etc.
    """
    symbol = symbol.upper()

    if not is_supported(symbol):
        raise HTTPException(
            status_code=404,
            detail=f"Symbol {symbol} not supported.",
        )
        
    df = await fetch_klines(symbol, timeframe=timeframe, limit=limit)
    if df is None or df.empty:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch historical data for {symbol}.",
        )
        
    results = run_backtest(df)
    
    if "error" in results:
        raise HTTPException(
            status_code=400,
            detail=results["error"],
        )
        
    return results


# ============================================================
# ON-CHAIN ENDPOINTS
# ============================================================

@app.get("/api/onchain/{symbol}")
async def get_onchain_dashboard_data(symbol: str):
    """
    Get all on-chain data for the specified symbol.
    Provides verified metrics for BTC/ETH and available metrics for altcoins.
    """
    symbol = symbol.upper()
    if not is_supported(symbol):
        raise HTTPException(status_code=404, detail="Symbol not supported")
        
    data = await get_full_onchain(symbol)
    signals = await get_signals_index(symbol)
    
    return {
        "symbol": symbol,
        "metrics": data,
        "signalsIndex": signals.get("signalsIndex", 50),
        "signalsSignal": signals.get("signal", "Neutral"),
        "subSignals": signals.get("subSignals", {}),
        "dataVerified": data.get("dataDepth") in ["full", "partial"]
    }

@app.get("/api/onchain/stablecoins")
async def get_stablecoins_data():
    """Get global stablecoin flows and TVL data."""
    try:
        chains = await get_stablecoin_chains()
        overview = await get_stablecoin_overview()
        return {
            "chains": chains,
            "overview": overview
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/screener")
async def screener(
    timeframe: str = Query("1D"),
    mode: str = Query("Balanceado"),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Screener: return top symbols sorted by quant score.
    Uses pre-calculated scores from background loop + EXACT real-time prices.
    """
    # 1. Fetch live prices (Fast)
    tickers = await fetch_all_tickers()
    if not tickers:
        raise HTTPException(status_code=502, detail="Failed to fetch tickers from Binance")

    results = []
    
    # 2. Match cached analysis with LIVE prices
    # If the cache is still building, we might have fewer than `limit` coins.
    for sym, ticker in tickers.items():
        cached = _screener_cache.get(sym)
        if cached:
            results.append({
                "symbol": sym,
                "name": get_name(sym),
                "price": ticker["price"],               # 100% REAL-TIME
                "priceChange24h": ticker["priceChange24h"], # 100% REAL-TIME
                "volume24h": ticker["volume24h"],           # 100% REAL-TIME
                "rsi": cached["rsi"],
                "quantScore": cached["quantScore"],
                "signal": cached["signal"],
                "sparklineData": [],
            })
            
    if not results:
        # The backend just started and hasn't analyzed any coin yet
        return []

    # 3. Sort by score (lowest first = best buy opportunities)
    results.sort(key=lambda x: x["quantScore"])
    
    # 4. Limit and Re-rank
    top_results = results[:limit]
    for i, r in enumerate(top_results):
        r["rank"] = i + 1

    return top_results


@app.get("/api/symbols")
async def symbols():
    """List all supported symbols."""
    return {
        "symbols": [
            {"symbol": sym, "name": get_name(sym), "pair": pair}
            for sym, pair in BINANCE_PAIR_MAP.items()
        ],
        "count": len(BINANCE_PAIR_MAP),
    }


@app.get("/api/onchain")
async def onchain_data():
    """
    Phase 6: On-Chain Analytics and Whale Tracking
    Fetches global on-chain metrics and recent whale movements.
    """
    try:
        summary = await get_onchain_summary()
        whales = await get_recent_whale_movements(limit=10)
        
        return {
            "success": True,
            "summary": summary,
            "whale_movements": whales
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# USER PREFS ENDPOINTS
# ============================================================

from pydantic import BaseModel

class UserPrefsPayload(BaseModel):
    uuid: str
    preferences: dict

@app.get("/api/user/prefs/{uuid}")
async def fetch_user_prefs(uuid: str):
    return get_user_prefs(uuid)

@app.post("/api/user/prefs")
async def update_user_prefs(payload: UserPrefsPayload):
    success = save_user_prefs(payload.uuid, payload.preferences)
    return {"success": success}

# ============================================================
# TELEGRAM ENDPOINTS
# ============================================================


@app.get("/api/telegram/status")
async def telegram_status():
    """
    Get the current state of the background Telegram bot.
    """
    return {
        "status": telegram_bot.bot_status,
        "last_check": telegram_bot.last_check_time
    }


@app.post("/api/telegram/test")
async def telegram_test(body: dict):
    """
    Test Telegram bot connection.
    Body: { "bot_token": "...", "chat_id": "..." }
    """
    from services.telegram import TelegramSender

    bot_token = body.get("bot_token", "")
    chat_id = body.get("chat_id", "")

    if not bot_token or not chat_id:
        raise HTTPException(status_code=400, detail="bot_token and chat_id are required")

    sender = TelegramSender(bot_token, chat_id)
    is_valid = await sender.test_connection()

    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid bot token")

    success = await sender.send_message(
        "✅ <b>Oráculo de Trading Pro</b>\n\n"
        "Bot conectado exitosamente.\n"
        "Recibirás alertas de señales fuertes de compra/venta.",
        parse_mode="HTML",
    )

    return {
        "success": success,
        "message": "Test message sent successfully" if success else "Failed to send test message",
    }


@app.post("/api/telegram/config")
async def telegram_config(body: dict):
    """
    Save Telegram credentials to .env.local so the bot can use them.
    Body: { "bot_token": "...", "chat_id": "..." }
    """
    bot_token = body.get("bot_token", "")
    chat_id = body.get("chat_id", "")

    if not bot_token or not chat_id:
        raise HTTPException(status_code=400, detail="bot_token and chat_id are required")

    # Read current .env.local
    env_content = ""
    if ENV_FILE.exists():
        env_content = ENV_FILE.read_text(encoding="utf-8")

    # Update or add TELEGRAM_BOT_TOKEN
    lines = env_content.split("\n")
    new_lines = []
    token_set = False
    chat_set = False

    for line in lines:
        if line.startswith("TELEGRAM_BOT_TOKEN="):
            new_lines.append(f"TELEGRAM_BOT_TOKEN={bot_token}")
            token_set = True
        elif line.startswith("TELEGRAM_CHAT_ID="):
            new_lines.append(f"TELEGRAM_CHAT_ID={chat_id}")
            chat_set = True
        else:
            new_lines.append(line)

    if not token_set:
        new_lines.append(f"TELEGRAM_BOT_TOKEN={bot_token}")
    if not chat_set:
        new_lines.append(f"TELEGRAM_CHAT_ID={chat_id}")

    ENV_FILE.write_text("\n".join(new_lines), encoding="utf-8")

    return {"success": True, "message": "Telegram credentials saved to .env.local"}


@app.post("/api/telegram/send-alert")
async def telegram_send_alert(body: dict):
    """
    Send a one-off alert via Telegram.
    Body: { "bot_token": "...", "chat_id": "...", "message": "..." }
    """
    from services.telegram import TelegramSender

    bot_token = body.get("bot_token", "")
    chat_id = body.get("chat_id", "")
    message = body.get("message", "")

    if not bot_token or not chat_id or not message:
        raise HTTPException(status_code=400, detail="bot_token, chat_id, and message are required")

    sender = TelegramSender(bot_token, chat_id)
    success = await sender.send_message(message, parse_mode="HTML")

    return {"success": success}


# ============================================================
# PRICE ALERTS ENDPOINTS
# ============================================================


@app.get("/api/alerts")
async def get_alerts():
    """Get all price alerts from the JSON file."""
    try:
        if ALERTS_FILE.exists():
            data = json.loads(ALERTS_FILE.read_text(encoding="utf-8"))
            return {"alerts": data if isinstance(data, list) else []}
    except Exception:
        pass
    return {"alerts": []}


@app.post("/api/alerts/sync")
async def sync_alerts(body: dict):
    """
    Sync price alerts from the frontend.
    Body: { "alerts": [...] }
    """
    alerts = body.get("alerts", [])

    if not isinstance(alerts, list):
        raise HTTPException(status_code=400, detail="alerts must be an array")

    # Validate each alert
    valid_alerts = []
    for alert in alerts:
        if all(k in alert for k in ("id", "symbol", "targetPrice", "condition")):
            valid_alerts.append({
                "id": str(alert["id"]),
                "symbol": str(alert["symbol"]).upper(),
                "targetPrice": float(alert["targetPrice"]),
                "condition": alert["condition"] if alert["condition"] in ("above", "below") else "above",
                "triggered": bool(alert.get("triggered", False)),
            })

    try:
        ALERTS_FILE.write_text(
            json.dumps(valid_alerts, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save alerts: {e}")

    return {
        "success": True,
        "count": len(valid_alerts),
        "message": f"Synced {len(valid_alerts)} alerts to backend",
    }


@app.post("/api/alerts/check")
async def check_alerts_now():
    """
    Manually trigger a price alert check and return which alerts would fire.
    Useful for testing without waiting for the bot interval.
    """
    try:
        if not ALERTS_FILE.exists():
            return {"triggered": [], "message": "No alerts file found"}

        alerts = json.loads(ALERTS_FILE.read_text(encoding="utf-8"))
        if not isinstance(alerts, list):
            return {"triggered": [], "message": "Invalid alerts file"}

        active = [a for a in alerts if not a.get("triggered", False)]
        if not active:
            return {"triggered": [], "message": "No active alerts"}

        # Fetch prices for all unique symbols
        symbols_needed = list(set(a["symbol"] for a in active))
        price_cache = {}
        for sym in symbols_needed:
            try:
                ticker = await fetch_ticker(sym)
                if ticker:
                    price_cache[sym] = ticker["price"]
            except Exception:
                pass

        # Check which would trigger
        triggered = []
        for alert in active:
            sym = alert["symbol"]
            current_price = price_cache.get(sym)
            if current_price is None:
                continue

            condition = alert.get("condition", "above")
            target = alert.get("targetPrice", 0)

            would_trigger = (
                (condition == "above" and current_price >= target)
                or (condition == "below" and current_price <= target)
            )

            if would_trigger:
                triggered.append({
                    **alert,
                    "currentPrice": current_price,
                })

        return {
            "triggered": triggered,
            "total_active": len(active),
            "prices": price_cache,
            "message": f"{len(triggered)} alerts would trigger now",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# WEBSOCKET ENDPOINTS
# ============================================================

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

manager = ConnectionManager()

@app.websocket("/ws/live/{symbol}")
async def websocket_endpoint(websocket: WebSocket, symbol: str):
    await manager.connect(websocket)
    binance_symbol = symbol.lower()
    
    # Binance WS stream URL for live ticker (1-second updates)
    url = f"wss://stream.binance.com:9443/ws/{binance_symbol}@ticker"
    
    try:
        async with websockets.connect(url) as binance_ws:
            async def forward_from_binance():
                try:
                    while True:
                        msg = await binance_ws.recv()
                        data = json.loads(msg)
                        if "c" in data:
                            # 'c' is the current day's close price
                            await websocket.send_json({
                                "symbol": symbol.upper(),
                                "price": float(data["c"]),
                                "change24h": float(data.get("p", 0)),
                                "change24hPercent": float(data.get("P", 0)),
                                "volume24h": float(data.get("v", 0)),
                                "timestamp": data.get("E", int(time.time() * 1000))
                            })
                except Exception as e:
                    print(f"Binance WS Error for {symbol}: {e}")
            
            # Start background task to read from Binance
            forward_task = asyncio.create_task(forward_from_binance())
            
            # Wait for client to disconnect
            while True:
                _ = await websocket.receive_text()
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        manager.disconnect(websocket)
        print(f"WebSocket Error: {e}")
    finally:
        if 'forward_task' in locals():
            forward_task.cancel()

# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
