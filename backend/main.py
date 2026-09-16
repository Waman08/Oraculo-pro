# ============================================================
# MAIN — FastAPI Backend for Trading Oracle Pro
# ============================================================

import json
import os
import time
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect, Request
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
from services.onchain_engine import get_full_onchain, get_signals_index, get_onchain_summary
from services.onchain_stablecoins import get_stablecoin_chains, get_stablecoin_overview, get_full_stablecoin_analysis
from services.onchain_scoring import score_onchain_v2
from services.supply_dynamics import get_supply_data
# AUDIT FIX: whale_tracker removed (was 100% fake random data)
from services.user_prefs import get_user_prefs, save_user_prefs

from services.paper_trading import get_or_create_portfolio, open_paper_trade, close_paper_trade, update_open_trades, get_performance_metrics, update_auto_trading, calculate_kelly_position_size


from services.telegram import TelegramSender, _escape_html
from services.supabase_client import supabase
from services.liquidity_engine import fetch_funding_rate


import api_public

# ---- Cache ----
_cache: dict = {}
CACHE_TTL = 15  # seconds

# Global Screener Cache (holds long-running analysis results)
_screener_cache: dict = {}

START_TIME = time.time()

# Path to price alerts file (shared with telegram_bot.py)
ALERTS_FILE = Path(__file__).parent / "price_alerts.json"



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
                
            # Paper Trading Update
            try:
                current_prices = {k: v["price"] for k, v in tickers.items()}
                await update_open_trades(current_prices)
            except Exception as pt_err:
                print(f"[Paper Trading] Error tracking trades: {pt_err}")
            
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
                            
                            # === ALPHA CONFLUENCE PUSH ALERTS ===
                            score = analysis["quantScore"]
                            rsi = analysis["rsi"]
                            vol_anom = analysis.get("volume_anomaly", False)
                            
                            is_strong_buy = (score >= 75 and rsi < 35 and vol_anom)
                            is_strong_sell = (score <= 25 and rsi > 65 and vol_anom)
                            
                            if is_strong_buy or is_strong_sell:
                                signal_type = "Compra Fuerte" if is_strong_buy else "Venta Fuerte"
                                price = analysis.get("price", 0.0)
                                change = analysis.get("change_24h", 0.0)
                                
                                # Check cooldown in Supabase (last 6 hours)
                                cooldown_passed = True
                                if supabase:
                                    try:
                                        from datetime import datetime, timedelta, timezone
                                        six_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
                                        res = supabase.table("signal_history")                                            .select("id")                                            .eq("symbol", sym)                                            .eq("signal", signal_type)                                            .gte("created_at", six_hours_ago)                                            .execute()
                                        if res.data and len(res.data) > 0:
                                            cooldown_passed = False
                                    except Exception as e:
                                        print(f"[Alpha] DB check error for {sym}: {e}")
                                        
                                if cooldown_passed:
                                    fr_data = await fetch_funding_rate(sym)
                                    funding_rate = fr_data.get("fundingRate", 0.0)
                                    squeeze_text = ""
                                    if is_strong_buy and funding_rate < -0.01:
                                        squeeze_text = " (Riesgo Short Squeeze ⚠️)"
                                    elif is_strong_sell and funding_rate > 0.01:
                                        squeeze_text = " (Riesgo Long Squeeze ⚠️)"
                                        
                                    atr = analysis.get("indicators", {}).get("atr", 0.0)
                                    if atr == 0: atr = price * 0.02
                                    
                                    if is_strong_buy:
                                        sl = price - (atr * 1.5)
                                        tp = price + (atr * 3.0)
                                    else:
                                        sl = price + (atr * 1.5)
                                        tp = price - (atr * 3.0)
                                        
                                    change_sign = "+" if change >= 0 else ""
                                    emoji = "🟢" if is_strong_buy else "🔴"
                                    
                                    msg = (
                                        f"🚨 <b>ALERTA DE CONFLUENCIA ALFA</b>\n\n"
                                        f"<b>{sym}</b> {emoji}\n"
                                        f"Precio: <code>${price:,.2f}</code> ({change_sign}{change:.2f}%)\n"
                                        f"Score: <code>{score:.1f}/100</code> - {signal_type}\n\n"
                                        f"<b>🔥 Confluencias:</b>\n"
                                        f"✅ Volumen Anómalo Detectado\n"
                                        f"✅ RSI Extremo ({rsi:.1f})\n"
                                        f"✅ Score Cuantitativo Alineado\n"
                                    )
                                    if squeeze_text:
                                        msg += f"✅ Funding Rate: {funding_rate:.4f}% {squeeze_text}\n"
                                        
                                    msg += (
                                        f"\n<b>🎯 Niveles Sugeridos:</b>\n"
                                        f"Entrada: <code>${price:,.2f}</code>\n"
                                        f"Take Profit: <code>${tp:,.2f}</code>\n"
                                        f"Stop Loss: <code>${sl:,.2f}</code>\n\n"
                                        f"<a href='https://oraculo-pro.vercel.app'>Ver en Dashboard Web</a>"
                                    )
                                    
                                    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
                                    if bot_token and supabase:
                                        # Get all active chats
                                        chats_res = supabase.table("telegram_config").select("chat_id, session_id").execute()
                                        if chats_res.data:
                                            chats = set([r["chat_id"] for r in chats_res.data if r.get("chat_id")])
                                            sender = TelegramSender(bot_token, "")
                                            for c in chats:
                                                await sender.send_message(msg, parse_mode="HTML", chat_id=c)
                                            
                                            # Register in DB
                                            supabase.table("signal_history").insert({
                                                "symbol": sym,
                                                "signal": signal_type,
                                                "score": score,
                                                "price": price,
                                                "timeframe": "1D",
                                                "risk_mode": "Alpha"
                                            }).execute()
                                            print(f"[Alpha] Alert sent and logged for {sym}")
                                            
                                            # Auto Paper Trading (Kelly)
                                            for row in chats_res.data:
                                                sess = row.get("session_id")
                                                if sess:
                                                    try:
                                                        port = await get_or_create_portfolio(sess)
                                                        if port and port.get("auto_paper_trading"):
                                                            bal = float(port.get("current_balance", 0.0))
                                                            if bal > 10: # Minimum to trade
                                                                amt = await calculate_kelly_position_size(sess, bal)
                                                                trade_side = "LONG" if is_strong_buy else "SHORT"
                                                                await open_paper_trade(sess, sym, trade_side, price, amt, sl, tp)
                                                                print(f"[AutoTrade] Opened {trade_side} on {sym} for {sess} with ${amt:.2f}")
                                                    except Exception as trade_err:
                                                        print(f"[AutoTrade Err] {trade_err}")
                            
                            return True
                    except Exception as e:
                        import traceback; print(f"\[Screener Loop\] Error analyzing {sym}:\n{traceback.format_exc()}")
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
    
    app.state.bot_task = bot_task
    app.state.screener_task = screener_task
    
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



# ============================================================
# PAPER TRADING ENDPOINTS
# ============================================================

@app.get("/api/paper/portfolio")
async def get_paper_portfolio(request: Request):
    session_id = request.headers.get("x-user-id", "default")
    try:
        portfolio = await get_or_create_portfolio(session_id)
        metrics = await get_performance_metrics(session_id)
        
        # Get active trades
        from services.supabase_client import supabase
        res = supabase.table("paper_trades").select("*").eq("session_id", session_id).eq("status", "OPEN").execute()
        active_trades = res.data or []
        
        return {
            "success": True,
            "portfolio": portfolio,
            "metrics": metrics,
            "active_trades": active_trades
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/paper/trade")
async def execute_paper_trade(request: Request, body: dict):
    session_id = request.headers.get("x-user-id", "default")
    action = body.get("action", "open") # 'open' or 'close'
    
    try:
        if action == "open":
            symbol = body.get("symbol")
            side = body.get("side")
            price = body.get("price")
            amount_usd = body.get("amount_usd")
            sl = body.get("sl")
            tp = body.get("tp")
            
            if not all([symbol, side, price, amount_usd]):
                raise HTTPException(status_code=400, detail="Missing parameters")
                
            trade = await open_paper_trade(session_id, symbol, side, price, amount_usd, sl, tp)
            return {"success": True, "trade": trade}
            
        elif action == "close":
            trade_id = body.get("trade_id")
            exit_price = body.get("exit_price")
            if not trade_id or not exit_price:
                raise HTTPException(status_code=400, detail="Missing trade_id or exit_price")
                
            trade = await close_paper_trade(trade_id, exit_price, "CLOSED_MANUAL")
            return {"success": True, "trade": trade}
            
        elif action == "settings":
            auto_trading = body.get("auto_paper_trading", False)
            await update_auto_trading(session_id, auto_trading)
            return {"success": True, "auto_paper_trading": auto_trading}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health(request: Request):
    """Detailed Health Check Endpoint"""
    import httpx
    
    uptime = time.time() - START_TIME
    
    # Check Tasks
    bot_task = getattr(request.app.state, "bot_task", None)
    screener_task = getattr(request.app.state, "screener_task", None)
    
    bot_active = bot_task is not None and not bot_task.done()
    screener_active = screener_task is not None and not screener_task.done()
    
    # Check Supabase
    db_latency = -1.0
    from services.supabase_client import supabase
    if supabase:
        t0 = time.time()
        try:
            supabase.table("user_preferences").select("id").limit(1).execute()
            db_latency = time.time() - t0
        except:
            db_latency = -1.0
            
    # Check Binance
    binance_latency = -1.0
    t1 = time.time()
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get("https://api.binance.com/api/v3/ping")
            if resp.status_code == 200:
                binance_latency = time.time() - t1
    except:
        binance_latency = -1.0
        
    global _last_screener_run
    screener_delay = time.time() - _last_screener_run if _last_screener_run > 0 else -1
    
    is_degraded = not bot_active or not screener_active or db_latency < 0 or binance_latency < 0
    
    return {
        "status": "degraded" if is_degraded else "ok",
        "uptime_seconds": round(uptime, 2),
        "services": {
            "telegram_bot": {
                "active": bot_active,
                "status": "polling" if bot_active else "stopped"
            },
            "screener_loop": {
                "active": screener_active,
                "cache_size": len(_screener_cache),
                "last_run_seconds_ago": round(screener_delay, 1) if screener_delay >= 0 else "Never"
            },
            "supabase": {
                "connected": db_latency >= 0,
                "latency_ms": round(db_latency * 1000, 2) if db_latency >= 0 else -1
            },
            "binance": {
                "connected": binance_latency >= 0,
                "latency_ms": round(binance_latency * 1000, 2) if binance_latency >= 0 else -1
            }
        }
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
    days: int = Query(90, description="Number of historical days"),
    mode: str = Query("Balanceado", description="Risk mode"),
    feeRate: float = Query(0.1, description="Fee rate percentage")
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
        
    if timeframe == "1D": limit = days
    elif timeframe == "4H": limit = days * 6
    elif timeframe == "1H": limit = days * 24
    else: limit = days

    df = await fetch_klines(symbol, timeframe=timeframe, limit=limit)
    if df is None or df.empty:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch historical data for {symbol}.",
        )
        
    results = run_backtest(df, mode=mode, fee_rate=feeRate / 100.0)
    
    if "error" in results:
        raise HTTPException(
            status_code=400,
            detail=results["error"],
        )
        
    return results


# ============================================================
# ON-CHAIN ENDPOINTS
# ============================================================

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
        "metrics": data.get("metrics", {}),
        "stablecoinMarket": data.get("stablecoinMarket"),
        "defiTvl": data.get("defiTvl"),
        "signalsIndex": signals.get("signalsIndex", 50),
        "signalsSignal": signals.get("signal", "Neutral"),
        "subSignals": signals.get("subSignals", {}),
        "dataVerified": data.get("dataDepth") in ["full", "partial"]
    }


from sector_map import SECTOR_MAP

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
        raise HTTPException(status_code=500, detail="Failed to fetch Binance tickers.")

    results = []
    # 2. Match cached analysis with LIVE prices
    # If the cache is still building, we might have fewer than `limit` coins.
    for sym, ticker in tickers.items():
        cached = _screener_cache.get(sym)
        if cached:
            results.append({
                "symbol": sym,
                "name": get_name(sym),
                "sector": SECTOR_MAP.get(sym, "Otros"),
                "price": ticker["price"],               # 100% REAL-TIME
                "priceChange24h": ticker["priceChange24h"],
                "volume24h": ticker["volume24h"],
                "quantScore": cached["quantScore"],     # From background ML analysis
                "signal": cached["signal"],
                "rsi": cached["rsi"]
            })
            
    
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
    Global On-Chain Analytics.
    AUDIT FIX: Removed fake whale_tracker (was 100% random data).
    """
    try:
        summary = await get_onchain_summary()
        
        return {
            "success": True,
            "summary": summary,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# SUPPLY DYNAMICS ENDPOINTS
# ============================================================

@app.get("/api/supply/{symbol}")
async def supply_dynamics(symbol: str):
    """
    Get token supply analysis: circulating/total/max supply, FDV, dilution risk.
    Source: CoinGecko API (real data).
    """
    try:
        data = await get_supply_data(symbol)
        if not data:
            return {"symbol": symbol.upper(), "available": False, "message": "Supply data not available for this token"}
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# STABLECOIN ANALYSIS ENDPOINTS
# ============================================================

@app.get("/api/stablecoins/analysis")
async def stablecoin_analysis():
    """
    Get comprehensive stablecoin market analysis.
    Includes: SSR, USDT/USDC flows, chain distribution.
    Source: DeFiLlama Stablecoins API (real data).
    """
    try:
        data = await get_full_stablecoin_analysis()
        return data
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
async def telegram_config(request: Request, body: dict):
    """Save Telegram credentials to Supabase telegram_config."""
    from services.supabase_client import supabase
    session_id = request.headers.get("x-user-id", "default")
    bot_token = body.get("bot_token", "")
    chat_id = body.get("chat_id", "")
    if not bot_token or not chat_id:
        raise HTTPException(status_code=400, detail="bot_token and chat_id are required")
    
    if supabase:
        try:
            supabase.table("telegram_config").upsert({
                "session_id": session_id,
                "chat_id": chat_id
            }, on_conflict="session_id").execute()
        except Exception as e:
            print(f"[ERR] Save telegram config to Supabase failed: {e}")
    
    return {"success": True, "message": "Telegram credentials saved to Supabase"}


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
async def get_alerts(request: Request):
    """Get all price alerts from Supabase."""
    from services.supabase_client import supabase
    session_id = request.headers.get("x-user-id", "default")
    if not supabase: return {"alerts": []}
    try:
        res = supabase.table("price_alerts").select("*").eq("session_id", session_id).execute()
        # Mapping to match frontend expected fields
        alerts = []
        for r in res.data:
            alerts.append({
                "id": str(r.get("id")),
                "symbol": r.get("symbol"),
                "targetPrice": r.get("target_price"),
                "condition": r.get("condition"),
                "triggered": r.get("triggered")
            })
        return {"alerts": alerts}
    except Exception as e:
        print(f"Error fetching alerts from Supabase: {e}")
        return {"alerts": []}


@app.post("/api/alerts/sync")
async def sync_alerts(request: Request, body: dict):
    """Sync price alerts to Supabase."""
    from services.supabase_client import supabase
    session_id = request.headers.get("x-user-id", "default")
    alerts = body.get("alerts", [])
    if not isinstance(alerts, list):
        raise HTTPException(status_code=400, detail="alerts must be an array")
    
    if not supabase: return {"success": False, "message": "Supabase not connected"}
    
    try:
        # Delete existing alerts for this session
        supabase.table("price_alerts").delete().eq("session_id", session_id).execute()
        
        valid_alerts = []
        for alert in alerts:
            if all(k in alert for k in ("symbol", "targetPrice", "condition")):
                valid_alerts.append({
                    "session_id": session_id,
                    "symbol": str(alert["symbol"]).upper(),
                    "target_price": float(alert["targetPrice"]),
                    "condition": alert["condition"] if alert["condition"] in ("above", "below") else "above",
                    "triggered": bool(alert.get("triggered", False)),
                })
        
        if valid_alerts:
            supabase.table("price_alerts").insert(valid_alerts).execute()
            
        return {
            "success": True,
            "count": len(valid_alerts),
            "message": f"Synced {len(valid_alerts)} alerts to Supabase"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync alerts to Supabase: {e}")


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
    if not binance_symbol.endswith("usdt"):
        binance_symbol += "usdt"
    
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
    import os
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=False)








