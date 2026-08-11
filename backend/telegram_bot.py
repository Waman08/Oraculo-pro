# ============================================================
# TELEGRAM BOT — Interactive Commands + Automated Alerts
# ============================================================
#
# Features:
#   1. Interactive Commands: /analizar, /precio, /alerta, /top, etc.
#   2. Price Alerts: checks user-defined price thresholds
#   3. Signal Alerts: monitors watchlist for strong buy/sell signals
#   4. Periodic Summary: sends watchlist overview every 6 hours
#   5. Scheduled Reports: morning/evening market reports
# ============================================================

import asyncio
import json
import os
import sys
import time
import traceback
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Set

# Add parent dir so we can import services
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

from services.binance_client import (
    fetch_ticker,
    init_binance_symbols,
    is_supported,
    get_name,
    BINANCE_PAIR_MAP,
)
from services.telegram import TelegramSender, format_signal_alert, format_watchlist_summary

env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")

# File paths
ALERTS_FILE = Path(__file__).parent / "price_alerts.json"
SIGNALS_FILE = Path(__file__).parent / "sent_signals.json"
HISTORY_FILE = Path(__file__).parent / "signal_history.json"
WATCHLIST_FILE = Path(__file__).parent / "bot_watchlist.json"
BOT_CONFIG_FILE = Path(__file__).parent / "bot_config.json"


# ============================================================
# PERSISTENT STATE HELPERS
# ============================================================

def load_json_file(path: Path, default=None):
    """Load a JSON file safely, returning default on failure."""
    if default is None:
        default = {}
    try:
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            return data
    except Exception as e:
        print(f"  [WARN] Error reading {path.name}: {e}")
    return default


def save_json_file(path: Path, data):
    """Save data to a JSON file safely."""
    try:
        path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    except Exception as e:
        print(f"  [WARN] Error writing {path.name}: {e}")


def load_sent_signals() -> Dict[str, str]:
    return load_json_file(SIGNALS_FILE, {})


def save_sent_signals(signals: Dict[str, str]):
    save_json_file(SIGNALS_FILE, signals)


def load_price_alerts() -> List[dict]:
    return load_json_file(ALERTS_FILE, [])


def save_price_alerts(alerts: List[dict]):
    save_json_file(ALERTS_FILE, alerts)


def load_bot_watchlist() -> List[str]:
    data = load_json_file(WATCHLIST_FILE, {"symbols": ["BTC", "ETH", "SOL"]})
    if isinstance(data, dict):
        return data.get("symbols", ["BTC", "ETH", "SOL"])
    return ["BTC", "ETH", "SOL"]


def save_bot_watchlist(symbols: List[str]):
    save_json_file(WATCHLIST_FILE, {"symbols": symbols})


def load_bot_config() -> Dict:
    return load_json_file(BOT_CONFIG_FILE, {
        "risk_mode": "Balanceado",
        "timeframe": "1D",
        "morning_report": True,
        "evening_report": True,
    })


def save_bot_config(config: Dict):
    save_json_file(BOT_CONFIG_FILE, config)


# ============================================================
# GLOBAL STATE
# ============================================================

sent_signals: Dict[str, str] = load_sent_signals()
triggered_price_alerts: Set[str] = set()
last_summary_time: float = 0
last_morning_report: str = ""  # YYYY-MM-DD
last_evening_report: str = ""  # YYYY-MM-DD
last_update_id: int = 0  # For Telegram polling

# Global Bot State for API
bot_status = "idle"
last_check_time = None


def get_config():
    if os.path.exists(env_path):
        load_dotenv(env_path, override=True)
    else:
        load_dotenv(override=True)

    bot_config = load_bot_config()

    return {
        "BOT_TOKEN": os.getenv("TELEGRAM_BOT_TOKEN", ""),
        "CHAT_ID": os.getenv("TELEGRAM_CHAT_ID", ""),
        "CHECK_INTERVAL": int(os.getenv("CHECK_INTERVAL", "5")),
        "WATCHLIST": load_bot_watchlist(),
        "RISK_MODE": bot_config.get("risk_mode", "Balanceado"),
        "TIMEFRAME": bot_config.get("timeframe", "1D"),
    }


# ============================================================
# TELEGRAM COMMAND HANDLER
# ============================================================

def _escape_html(text: str) -> str:
    """Escape special characters for Telegram HTML mode."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


async def handle_command(sender: TelegramSender, text: str, chat_id: str):
    """Route incoming commands to the appropriate handler."""
    text = text.strip()

    # Remove bot username if present (e.g., /analizar@MyBot)
    if "@" in text.split()[0]:
        parts = text.split()
        parts[0] = parts[0].split("@")[0]
        text = " ".join(parts)

    cmd = text.split()[0].lower()
    args = text.split()[1:] if len(text.split()) > 1 else []

    handlers = {
        "/start": cmd_start,
        "/ayuda": cmd_help,
        "/help": cmd_help,
        "/analizar": cmd_analyze,
        "/a": cmd_analyze,
        "/precio": cmd_price,
        "/p": cmd_price,
        "/alerta": cmd_create_alert,
        "/alertas": cmd_list_alerts,
        "/borraralerta": cmd_delete_alert,
        "/watchlist": cmd_watchlist,
        "/w": cmd_watchlist,
        "/agregar": cmd_add_watchlist,
        "/quitar": cmd_remove_watchlist,
        "/top": cmd_top_signals,
        "/resumen": cmd_market_summary,
        "/patron": cmd_patterns,
        "/modo": cmd_set_mode,
        "/estado": cmd_bot_status,
        "/riesgo": cmd_risk,
        "/r": cmd_risk,
        "/backtest": cmd_backtest,
        "/bt": cmd_backtest,
    }

    handler = handlers.get(cmd)
    if handler:
        try:
            await handler(sender, args)
        except Exception as e:
            traceback.print_exc()
            await sender.send_message(
                f"❌ Error procesando comando: <code>{_escape_html(str(e))}</code>",
                parse_mode="HTML",
            )
    elif text.startswith("/"):
        await sender.send_message(
            "❓ Comando no reconocido. Escribe /ayuda para ver los comandos disponibles.",
            parse_mode="HTML",
        )


# ============================================================
# COMMAND IMPLEMENTATIONS
# ============================================================

async def cmd_start(sender: TelegramSender, args: List[str]):
    """Welcome message."""
    msg = (
        "🔮 <b>Oráculo de Trading Pro</b>\n"
        "\n"
        "¡Bienvenido! Soy tu asistente de análisis cuantitativo de criptomonedas.\n"
        "\n"
        "📊 Analizo indicadores técnicos en tiempo real\n"
        "🎯 Genero señales de compra/venta con confluencia multitemporal\n"
        "🔔 Envío alertas automáticas de precios y señales\n"
        "\n"
        "Escribe /ayuda para ver todos los comandos disponibles."
    )
    await sender.send_message(msg, parse_mode="HTML")


async def cmd_help(sender: TelegramSender, args: List[str]):
    """Show all available commands."""
    msg = (
        "📋 <b>COMANDOS DISPONIBLES</b>\n"
        "\n"
        "📊 <b>Análisis</b>\n"
        "  /analizar <code>BTC</code> — Análisis completo con score y señal\n"
        "  /precio <code>SOL</code> — Precio actual con cambio 24h\n"
        "  /patron <code>ETH</code> — Patrones de velas detectados\n"
        "  /top <code>compra</code> — Top señales de compra/venta\n"
        "  /resumen — Resumen general del mercado\n"
        "\n"
        "🧮 <b>Modelos Cuantitativos</b>\n"
        "  /riesgo <code>BTC</code> — Análisis actuarial (VaR, Monte Carlo, Markov)\n"
        "  /backtest <code>ETH</code> — Backtest con Quant Score (90 días)\n"
        "\n"
        "🔔 <b>Alertas de Precio</b>\n"
        "  /alerta <code>BTC above 80000</code> — Crear alerta\n"
        "  /alerta <code>ETH below 2500</code> — Crear alerta\n"
        "  /alertas — Ver alertas activas\n"
        "  /borraralerta <code>1</code> — Borrar alerta por número\n"
        "\n"
        "⭐ <b>Watchlist</b>\n"
        "  /watchlist — Ver tu watchlist con scores\n"
        "  /agregar <code>AVAX DOT</code> — Agregar a watchlist\n"
        "  /quitar <code>DOT</code> — Quitar de watchlist\n"
        "\n"
        "⚙️ <b>Configuración</b>\n"
        "  /modo <code>seguro</code> — Cambiar modo de riesgo\n"
        "  /estado — Estado del bot\n"
        "\n"
        "💡 <i>Atajos: /a = /analizar, /p = /precio, /w = /watchlist, /r = /riesgo, /bt = /backtest</i>"
    )
    await sender.send_message(msg, parse_mode="HTML")



async def cmd_analyze(sender: TelegramSender, args: List[str]):
    """Full analysis for a symbol."""
    if not args:
        await sender.send_message(
            "📊 Uso: /analizar <code>BTC</code>\n"
            "Ejemplo: <code>/analizar SOL</code>",
            parse_mode="HTML",
        )
        return

    symbol = args[0].upper()
    if not is_supported(symbol):
        await sender.send_message(
            f"❌ <code>{_escape_html(symbol)}</code> no está disponible en Binance.",
            parse_mode="HTML",
        )
        return

    # Send "analyzing" message
    await sender.send_message(
        f"⏳ Analizando <b>{_escape_html(symbol)}</b>...",
        parse_mode="HTML",
    )

    from services.analyzer import run_analysis
    config = load_bot_config()
    mode = config.get("risk_mode", "Balanceado")
    tf = config.get("timeframe", "1D")

    result = await run_analysis(symbol, tf, mode)
    if not result:
        await sender.send_message(
            f"❌ No se pudo obtener datos para <code>{_escape_html(symbol)}</code>.",
            parse_mode="HTML",
        )
        return

    signal = result["signal"]
    score = result["quantScore"]
    price = result["currentPrice"]
    change = result["priceChange24h"]
    indicators = result["indicators"]
    ad = result["actionableData"]
    sentiment = result.get("sentiment", {})
    smart = result.get("smartMoney", {})

    # Signal emoji
    signal_emojis = {
        "Compra Fuerte": "🟢🟢", "Compra": "🟢",
        "Mantener": "⚪", "Venta": "🟠", "Venta Fuerte": "🔴🔴",
    }
    emoji = signal_emojis.get(signal, "⚪")
    change_icon = "📈" if change >= 0 else "📉"
    change_sign = "+" if change >= 0 else ""

    # Build comprehensive message
    lines = [
        f"{emoji} <b>ANÁLISIS: {_escape_html(symbol)}</b> ({_escape_html(get_name(symbol))})",
        "",
        f"💰 Precio: <code>${price:,.2f}</code> {change_icon} {change_sign}{change:.2f}%",
        f"📊 Score: <code>{score:.1f}/100</code>",
        f"🎯 Señal: <b>{_escape_html(signal)}</b>",
        f"⏱ TF: <code>{_escape_html(tf)}</code> | Modo: <code>{_escape_html(mode)}</code>",
        "",
        "📈 <b>Indicadores Clave</b>",
        f"  RSI: <code>{indicators['rsi']:.1f}</code>",
        f"  MACD Hist: <code>{indicators['macd']['hist']:.4f}</code>",
        f"  Stoch K/D: <code>{indicators['stochastic']['k']:.1f}/{indicators['stochastic']['d']:.1f}</code>",
        f"  ADX: <code>{indicators['adx']:.1f}</code>",
        f"  Supertrend: <code>{indicators['supertrend']['direction']}</code>",
        "",
        "📐 <b>Medias Móviles</b>",
        f"  EMA20: <code>${indicators['ema20']:,.2f}</code>",
        f"  EMA50: <code>${indicators['ema50']:,.2f}</code>",
        f"  EMA200: <code>${indicators['ema200']:,.2f}</code>",
        "",
        f"🎯 Entrada Óptima: <code>${ad['optimalEntry']:,.2f}</code>",
        f"✅ Take Profit: <code>${ad['takeProfit']:,.2f}</code>",
        f"🛑 Stop Loss: <code>${ad['stopLoss']:,.2f}</code>",
    ]

    # Add DCA levels if available
    if ad.get("dcaLevels"):
        lines.append("")
        lines.append("📊 <b>Niveles DCA</b>")
        for level in ad["dcaLevels"][:5]:
            sign = "+" if level["percentFromCurrent"] > 0 else ""
            lines.append(
                f"  {level['label']}: <code>${level['price']:,.2f}</code> ({sign}{level['percentFromCurrent']:.1f}%)"
            )

    # Sentiment
    fg = sentiment.get("fearGreedIndex", "N/A")
    fg_label = sentiment.get("fearGreedLabel", "N/A")
    alt = sentiment.get("altcoinSeasonIndex", "N/A")
    alt_label = sentiment.get("altcoinSeasonLabel", "N/A")
    lines.extend([
        "",
        "🧠 <b>Sentimiento</b>",
        f"  Fear & Greed: <code>{fg}</code> ({_escape_html(str(fg_label))})",
        f"  Altcoin Season: <code>{alt}</code> ({_escape_html(str(alt_label))})",
    ])

    # Smart Money
    if smart:
        poc = smart.get("volumeProfilePOC", 0)
        if poc:
            lines.extend([
                "",
                "🏦 <b>Smart Money</b>",
                f"  Volume POC: <code>${poc:,.2f}</code>",
            ])
            obs = smart.get("orderBlocks", [])
            for ob in obs[:2]:
                ob_emoji = "🟩" if ob["type"] == "bullish" else "🟥"
                lines.append(
                    f"  {ob_emoji} OB {ob['type']}: <code>${ob['priceLow']:,.2f} - ${ob['priceHigh']:,.2f}</code>"
                )

    lines.extend([
        "",
        f"⚡ <i>Oráculo de Trading Pro</i>",
        f"<i>{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</i>",
    ])

    await sender.send_message("\n".join(lines), parse_mode="HTML")


async def cmd_price(sender: TelegramSender, args: List[str]):
    """Quick price check for a symbol."""
    if not args:
        await sender.send_message(
            "💰 Uso: /precio <code>BTC</code>\nEjemplo: <code>/precio SOL</code>",
            parse_mode="HTML",
        )
        return

    symbol = args[0].upper()
    ticker = await fetch_ticker(symbol)
    if not ticker:
        await sender.send_message(
            f"❌ No se encontró precio para <code>{_escape_html(symbol)}</code>.",
            parse_mode="HTML",
        )
        return

    price = ticker["price"]
    change = ticker["priceChange24h"]
    volume = ticker["volume24h"]
    change_icon = "📈" if change >= 0 else "📉"
    change_sign = "+" if change >= 0 else ""

    msg = (
        f"💰 <b>{_escape_html(symbol)}</b> ({_escape_html(get_name(symbol))})\n"
        f"\n"
        f"Precio: <code>${price:,.2f}</code>\n"
        f"Cambio 24h: {change_icon} <code>{change_sign}{change:.2f}%</code>\n"
        f"Volumen 24h: <code>${volume:,.0f}</code>\n"
        f"\n"
        f"<i>{datetime.now(timezone.utc).strftime('%H:%M UTC')}</i>"
    )
    await sender.send_message(msg, parse_mode="HTML")


async def cmd_create_alert(sender: TelegramSender, args: List[str]):
    """Create a price alert: /alerta BTC above 80000"""
    if len(args) < 3:
        await sender.send_message(
            "🔔 Uso: /alerta <code>SYMBOL above|below PRECIO</code>\n"
            "Ejemplos:\n"
            "  <code>/alerta BTC above 80000</code>\n"
            "  <code>/alerta ETH below 2500</code>",
            parse_mode="HTML",
        )
        return

    symbol = args[0].upper()
    condition = args[1].lower()
    try:
        target_price = float(args[2].replace(",", ""))
    except ValueError:
        await sender.send_message("❌ Precio inválido.", parse_mode="HTML")
        return

    if condition not in ("above", "below"):
        await sender.send_message(
            "❌ Condición debe ser <code>above</code> o <code>below</code>.",
            parse_mode="HTML",
        )
        return

    if not is_supported(symbol):
        await sender.send_message(
            f"❌ <code>{_escape_html(symbol)}</code> no disponible.",
            parse_mode="HTML",
        )
        return

    alerts = load_price_alerts()
    new_alert = {
        "id": f"tg_{int(time.time())}_{symbol}",
        "symbol": symbol,
        "targetPrice": target_price,
        "condition": condition,
        "triggered": False,
    }
    alerts.append(new_alert)
    save_price_alerts(alerts)

    cond_text = "supere" if condition == "above" else "baje de"
    cond_emoji = "📈" if condition == "above" else "📉"

    await sender.send_message(
        f"✅ Alerta creada\n\n"
        f"🪙 {_escape_html(symbol)}\n"
        f"{cond_emoji} Cuando {cond_text} <code>${target_price:,.2f}</code>\n"
        f"\n"
        f"Te notificaré cuando se active. Usa /alertas para ver todas.",
        parse_mode="HTML",
    )


async def cmd_list_alerts(sender: TelegramSender, args: List[str]):
    """List all price alerts."""
    alerts = load_price_alerts()

    if not alerts:
        await sender.send_message(
            "📭 No tienes alertas configuradas.\n\n"
            "Crea una con: /alerta <code>BTC above 80000</code>",
            parse_mode="HTML",
        )
        return

    active = [a for a in alerts if not a.get("triggered", False)]
    triggered = [a for a in alerts if a.get("triggered", False)]

    lines = ["🔔 <b>ALERTAS DE PRECIO</b>", ""]

    if active:
        lines.append(f"📌 <b>Activas ({len(active)})</b>")
        for i, a in enumerate(active, 1):
            cond = "📈 ≥" if a["condition"] == "above" else "📉 ≤"
            lines.append(
                f"  {i}. <b>{a['symbol']}</b> {cond} <code>${a['targetPrice']:,.2f}</code>"
            )
        lines.append("")

    if triggered:
        lines.append(f"✅ <b>Activadas ({len(triggered)})</b>")
        for a in triggered[-5:]:
            cond = "📈" if a["condition"] == "above" else "📉"
            lines.append(
                f"  {cond} {a['symbol']} ${a['targetPrice']:,.2f} ✓"
            )

    lines.append("\n💡 Borrar: /borraralerta <code>1</code>")
    await sender.send_message("\n".join(lines), parse_mode="HTML")


async def cmd_delete_alert(sender: TelegramSender, args: List[str]):
    """Delete a price alert by index."""
    if not args:
        await sender.send_message(
            "🗑 Uso: /borraralerta <code>NÚMERO</code>\nEjemplo: <code>/borraralerta 1</code>",
            parse_mode="HTML",
        )
        return

    try:
        idx = int(args[0]) - 1
    except ValueError:
        await sender.send_message("❌ Número inválido.", parse_mode="HTML")
        return

    alerts = load_price_alerts()
    active = [a for a in alerts if not a.get("triggered", False)]

    if idx < 0 or idx >= len(active):
        await sender.send_message(
            f"❌ No existe la alerta #{idx + 1}. Usa /alertas para ver la lista.",
            parse_mode="HTML",
        )
        return

    removed = active[idx]
    alerts = [a for a in alerts if a.get("id") != removed.get("id")]
    save_price_alerts(alerts)

    await sender.send_message(
        f"🗑 Alerta eliminada: <b>{removed['symbol']}</b> "
        f"{'≥' if removed['condition'] == 'above' else '≤'} "
        f"<code>${removed['targetPrice']:,.2f}</code>",
        parse_mode="HTML",
    )


async def cmd_watchlist(sender: TelegramSender, args: List[str]):
    """Show watchlist with current scores."""
    watchlist = load_bot_watchlist()

    if not watchlist:
        await sender.send_message(
            "📭 Tu watchlist está vacía.\n\n"
            "Agrega con: /agregar <code>BTC ETH SOL</code>",
            parse_mode="HTML",
        )
        return

    await sender.send_message(
        f"⏳ Analizando {len(watchlist)} activos...",
        parse_mode="HTML",
    )

    from services.analyzer import run_analysis
    config = load_bot_config()
    mode = config.get("risk_mode", "Balanceado")
    tf = config.get("timeframe", "1D")

    entries = []
    for symbol in watchlist:
        if not is_supported(symbol):
            continue
        try:
            result = await run_analysis(symbol, tf, mode)
            if result:
                entries.append({
                    "symbol": symbol,
                    "price": result["currentPrice"],
                    "change": result["priceChange24h"],
                    "score": result["quantScore"],
                    "signal": result["signal"],
                })
        except Exception:
            continue

    if not entries:
        await sender.send_message(
            "❌ No se pudieron obtener datos para tu watchlist.",
            parse_mode="HTML",
        )
        return

    # Sort by score (lowest = best buy opportunity)
    entries.sort(key=lambda x: x["score"])

    lines = ["⭐ <b>TU WATCHLIST</b>", ""]

    for e in entries:
        signal_emojis = {
            "Compra Fuerte": "🟢🟢", "Compra": "🟢",
            "Mantener": "⚪", "Venta": "🟠", "Venta Fuerte": "🔴🔴",
        }
        emoji = signal_emojis.get(e["signal"], "⚪")
        change_sign = "+" if e["change"] >= 0 else ""
        lines.append(
            f"{emoji} <b>{e['symbol']}</b> — <code>${e['price']:,.2f}</code> "
            f"({change_sign}{e['change']:.1f}%) — Score: <code>{e['score']:.1f}</code>"
        )

    lines.extend([
        "",
        f"⚙️ Modo: {_escape_html(mode)} | TF: {_escape_html(tf)}",
        f"⚡ <i>Oráculo de Trading Pro</i>",
    ])

    await sender.send_message("\n".join(lines), parse_mode="HTML")


async def cmd_add_watchlist(sender: TelegramSender, args: List[str]):
    """Add symbols to watchlist."""
    if not args:
        await sender.send_message(
            "➕ Uso: /agregar <code>BTC ETH SOL</code>",
            parse_mode="HTML",
        )
        return

    watchlist = load_bot_watchlist()
    added = []
    for s in args:
        sym = s.upper()
        if is_supported(sym) and sym not in watchlist:
            watchlist.append(sym)
            added.append(sym)

    if added:
        save_bot_watchlist(watchlist)
        await sender.send_message(
            f"✅ Agregados a watchlist: <b>{', '.join(added)}</b>\n\n"
            f"Tu watchlist ({len(watchlist)}): {', '.join(watchlist)}",
            parse_mode="HTML",
        )
    else:
        await sender.send_message(
            "⚠️ Ningún símbolo válido o ya están en tu watchlist.",
            parse_mode="HTML",
        )


async def cmd_remove_watchlist(sender: TelegramSender, args: List[str]):
    """Remove symbols from watchlist."""
    if not args:
        await sender.send_message(
            "➖ Uso: /quitar <code>DOT</code>",
            parse_mode="HTML",
        )
        return

    watchlist = load_bot_watchlist()
    removed = []
    for s in args:
        sym = s.upper()
        if sym in watchlist:
            watchlist.remove(sym)
            removed.append(sym)

    if removed:
        save_bot_watchlist(watchlist)
        await sender.send_message(
            f"🗑 Removidos de watchlist: <b>{', '.join(removed)}</b>\n\n"
            f"Tu watchlist ({len(watchlist)}): {', '.join(watchlist) if watchlist else 'vacía'}",
            parse_mode="HTML",
        )
    else:
        await sender.send_message(
            "⚠️ Ningún símbolo encontrado en tu watchlist.",
            parse_mode="HTML",
        )


async def cmd_top_signals(sender: TelegramSender, args: List[str]):
    """Show top buy or sell signals from watchlist."""
    filter_type = args[0].lower() if args else "compra"

    await sender.send_message("⏳ Escaneando mercado...", parse_mode="HTML")

    from services.analyzer import run_analysis
    config = load_bot_config()
    mode = config.get("risk_mode", "Balanceado")
    tf = config.get("timeframe", "1D")

    # Scan top coins
    top_coins = ["BTC", "ETH", "SOL", "XRP", "ADA", "AVAX", "DOT", "LINK",
                 "DOGE", "UNI", "ATOM", "APT", "ARB", "OP", "INJ", "SUI",
                 "NEAR", "BNB", "SHIB", "PEPE"]

    results = []
    for symbol in top_coins:
        if not is_supported(symbol):
            continue
        try:
            result = await run_analysis(symbol, tf, mode)
            if result:
                results.append({
                    "symbol": symbol,
                    "name": get_name(symbol),
                    "price": result["currentPrice"],
                    "change": result["priceChange24h"],
                    "score": result["quantScore"],
                    "signal": result["signal"],
                })
        except Exception:
            continue

    if filter_type in ("compra", "buy"):
        # Best buy: lowest score
        buy_signals = [r for r in results if r["signal"] in ("Compra Fuerte", "Compra")]
        if not buy_signals:
            buy_signals = sorted(results, key=lambda x: x["score"])[:5]
        else:
            buy_signals.sort(key=lambda x: x["score"])
            buy_signals = buy_signals[:5]

        lines = ["🟢 <b>TOP SEÑALES DE COMPRA</b>", ""]
        for i, r in enumerate(buy_signals, 1):
            change_sign = "+" if r["change"] >= 0 else ""
            lines.append(
                f"{i}. 🟢 <b>{r['symbol']}</b> ({r['name']}) — "
                f"Score: <code>{r['score']:.1f}</code> — "
                f"<code>${r['price']:,.2f}</code> ({change_sign}{r['change']:.1f}%)"
            )

    elif filter_type in ("venta", "sell"):
        # Worst sell: highest score
        sell_signals = [r for r in results if r["signal"] in ("Venta Fuerte", "Venta")]
        if not sell_signals:
            sell_signals = sorted(results, key=lambda x: x["score"], reverse=True)[:5]
        else:
            sell_signals.sort(key=lambda x: x["score"], reverse=True)
            sell_signals = sell_signals[:5]

        lines = ["🔴 <b>TOP SEÑALES DE VENTA</b>", ""]
        for i, r in enumerate(sell_signals, 1):
            change_sign = "+" if r["change"] >= 0 else ""
            lines.append(
                f"{i}. 🔴 <b>{r['symbol']}</b> ({r['name']}) — "
                f"Score: <code>{r['score']:.1f}</code> — "
                f"<code>${r['price']:,.2f}</code> ({change_sign}{r['change']:.1f}%)"
            )
    else:
        lines = [
            "📊 Uso: /top <code>compra</code> o /top <code>venta</code>"
        ]

    lines.extend([
        "",
        f"⚙️ Modo: {_escape_html(mode)} | TF: {_escape_html(tf)}",
        f"⚡ <i>Oráculo de Trading Pro</i>",
    ])

    await sender.send_message("\n".join(lines), parse_mode="HTML")


async def cmd_market_summary(sender: TelegramSender, args: List[str]):
    """Send a market summary."""
    await sender.send_message("⏳ Generando resumen del mercado...", parse_mode="HTML")

    from services.analyzer import run_analysis, fetch_fear_greed, fetch_real_macro

    config = load_bot_config()
    mode = config.get("risk_mode", "Balanceado")
    tf = config.get("timeframe", "1D")

    # Key market indicators
    fg = await fetch_fear_greed()
    macro = await fetch_real_macro()

    key_coins = ["BTC", "ETH", "SOL", "XRP", "BNB"]
    coin_data = []
    for sym in key_coins:
        try:
            result = await run_analysis(sym, tf, mode)
            if result:
                coin_data.append({
                    "symbol": sym,
                    "price": result["currentPrice"],
                    "change": result["priceChange24h"],
                    "score": result["quantScore"],
                    "signal": result["signal"],
                })
        except Exception:
            continue

    lines = [
        "📋 <b>RESUMEN DEL MERCADO</b>",
        f"<i>{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</i>",
        "",
    ]

    # Fear & Greed
    if fg:
        fg_emojis = {"Miedo Extremo": "😱", "Miedo": "😨", "Neutral": "😐", "Codicia": "🤑", "Codicia Extrema": "🤯"}
        fg_emoji = fg_emojis.get(fg.get("classificationES", ""), "😐")
        lines.append(f"🧠 Fear & Greed: <code>{fg['value']}</code> {fg_emoji} {_escape_html(fg.get('classificationES', 'N/A'))}")

    # Macro
    if macro and macro.get("dxy"):
        dxy_emoji = "💪" if macro["dxyTrend"] == "Alcista" else "📉" if macro["dxyTrend"] == "Bajista" else "➡️"
        lines.append(f"💵 DXY: <code>{macro['dxy']}</code> {dxy_emoji} {_escape_html(macro['dxyTrend'])}")

    lines.append("")
    lines.append("🪙 <b>Principales Activos</b>")

    for c in coin_data:
        signal_emojis = {
            "Compra Fuerte": "🟢🟢", "Compra": "🟢",
            "Mantener": "⚪", "Venta": "🟠", "Venta Fuerte": "🔴🔴",
        }
        emoji = signal_emojis.get(c["signal"], "⚪")
        change_sign = "+" if c["change"] >= 0 else ""
        lines.append(
            f"  {emoji} <b>{c['symbol']}</b>: <code>${c['price']:,.2f}</code> "
            f"({change_sign}{c['change']:.1f}%) — Score: <code>{c['score']:.1f}</code>"
        )

    # Market sentiment summary
    buy_count = sum(1 for c in coin_data if "Compra" in c["signal"])
    sell_count = sum(1 for c in coin_data if "Venta" in c["signal"])

    lines.append("")
    if buy_count > sell_count:
        lines.append("📊 <b>Sesgo general:</b> 🟢 Alcista")
    elif sell_count > buy_count:
        lines.append("📊 <b>Sesgo general:</b> 🔴 Bajista")
    else:
        lines.append("📊 <b>Sesgo general:</b> ⚪ Neutral")

    lines.extend([
        "",
        "⚡ <i>Oráculo de Trading Pro</i>",
    ])

    await sender.send_message("\n".join(lines), parse_mode="HTML")


async def cmd_patterns(sender: TelegramSender, args: List[str]):
    """Detect candlestick patterns for a symbol."""
    if not args:
        await sender.send_message(
            "🕯 Uso: /patron <code>BTC</code>",
            parse_mode="HTML",
        )
        return

    symbol = args[0].upper()
    if not is_supported(symbol):
        await sender.send_message(
            f"❌ <code>{_escape_html(symbol)}</code> no disponible.",
            parse_mode="HTML",
        )
        return

    await sender.send_message(
        f"⏳ Buscando patrones en <b>{_escape_html(symbol)}</b>...",
        parse_mode="HTML",
    )

    from services.binance_client import fetch_klines

    config = load_bot_config()
    tf = config.get("timeframe", "1D")

    df = await fetch_klines(symbol, tf, limit=100)
    if df is None or df.empty:
        await sender.send_message(
            f"❌ No se pudieron obtener velas para {_escape_html(symbol)}.",
            parse_mode="HTML",
        )
        return

    # Try to use candlestick_patterns module
    try:
        from services.candlestick_patterns import detect_candlestick_patterns
        result = detect_candlestick_patterns(df)
        patterns = result.get("patterns", [])
        summary = result.get("summary", {})
    except ImportError:
        # Module not yet available — use basic detection
        patterns = []
        summary = {"bullishCount": 0, "bearishCount": 0, "neutralCount": 0, "dominantBias": "neutral"}

        # Basic pattern detection without the module
        if len(df) >= 3:
            last = df.iloc[-1]
            prev = df.iloc[-2]

            body = abs(last["close"] - last["open"])
            upper_shadow = last["high"] - max(last["close"], last["open"])
            lower_shadow = min(last["close"], last["open"]) - last["low"]
            total_range = last["high"] - last["low"]

            if total_range > 0:
                # Hammer
                if lower_shadow > body * 2 and upper_shadow < body * 0.5 and last["close"] > last["open"]:
                    patterns.append({"name": "Hammer", "nameES": "Martillo", "type": "bullish", "reliability": 3, "barsAgo": 0})
                    summary["bullishCount"] += 1

                # Shooting Star
                if upper_shadow > body * 2 and lower_shadow < body * 0.5 and last["close"] < last["open"]:
                    patterns.append({"name": "Shooting Star", "nameES": "Estrella Fugaz", "type": "bearish", "reliability": 3, "barsAgo": 0})
                    summary["bearishCount"] += 1

                # Doji
                if body < total_range * 0.1:
                    patterns.append({"name": "Doji", "nameES": "Doji", "type": "neutral", "reliability": 2, "barsAgo": 0})
                    summary["neutralCount"] += 1

                # Bullish Engulfing
                if (last["close"] > last["open"] and prev["close"] < prev["open"] and
                    last["open"] <= prev["close"] and last["close"] >= prev["open"]):
                    patterns.append({"name": "Bullish Engulfing", "nameES": "Envolvente Alcista", "type": "bullish", "reliability": 4, "barsAgo": 0})
                    summary["bullishCount"] += 1

                # Bearish Engulfing
                if (last["close"] < last["open"] and prev["close"] > prev["open"] and
                    last["open"] >= prev["close"] and last["close"] <= prev["open"]):
                    patterns.append({"name": "Bearish Engulfing", "nameES": "Envolvente Bajista", "type": "bearish", "reliability": 4, "barsAgo": 0})
                    summary["bearishCount"] += 1

            summary["dominantBias"] = (
                "bullish" if summary["bullishCount"] > summary["bearishCount"]
                else "bearish" if summary["bearishCount"] > summary["bullishCount"]
                else "neutral"
            )

    if not patterns:
        await sender.send_message(
            f"🕯 <b>{_escape_html(symbol)}</b> — No se detectaron patrones de velas significativos en el TF {_escape_html(tf)}.",
            parse_mode="HTML",
        )
        return

    bias_emojis = {"bullish": "🟢 Alcista", "bearish": "🔴 Bajista", "neutral": "⚪ Neutral"}

    lines = [
        f"🕯 <b>PATRONES DE VELAS — {_escape_html(symbol)}</b>",
        f"<i>Timeframe: {_escape_html(tf)}</i>",
        "",
    ]

    for p in patterns[:8]:
        type_emoji = "🟢" if p["type"] == "bullish" else "🔴" if p["type"] == "bearish" else "⚪"
        stars = "⭐" * p.get("reliability", 1)
        name_es = p.get("nameES", p["name"])
        lines.append(
            f"  {type_emoji} <b>{_escape_html(name_es)}</b> ({_escape_html(p['name'])}) {stars}"
        )
        if p.get("barsAgo", 0) > 0:
            lines.append(f"    <i>Hace {p['barsAgo']} velas</i>")

    lines.extend([
        "",
        f"📊 Sesgo dominante: {bias_emojis.get(summary['dominantBias'], '⚪ Neutral')}",
        f"  Alcistas: {summary.get('bullishCount', 0)} | Bajistas: {summary.get('bearishCount', 0)} | Neutros: {summary.get('neutralCount', 0)}",
        "",
        "⚡ <i>Oráculo de Trading Pro</i>",
    ])

    await sender.send_message("\n".join(lines), parse_mode="HTML")


async def cmd_set_mode(sender: TelegramSender, args: List[str]):
    """Change risk mode."""
    valid_modes = {"seguro": "Seguro", "balanceado": "Balanceado", "agresivo": "Agresivo"}

    if not args or args[0].lower() not in valid_modes:
        config = load_bot_config()
        current = config.get("risk_mode", "Balanceado")
        await sender.send_message(
            f"⚙️ <b>Modo de Riesgo</b>\n\n"
            f"Modo actual: <b>{_escape_html(current)}</b>\n\n"
            f"Cambiar con:\n"
            f"  /modo <code>seguro</code> — Umbrales conservadores\n"
            f"  /modo <code>balanceado</code> — Equilibrio riesgo/oportunidad\n"
            f"  /modo <code>agresivo</code> — Máxima sensibilidad",
            parse_mode="HTML",
        )
        return

    new_mode = valid_modes[args[0].lower()]
    config = load_bot_config()
    config["risk_mode"] = new_mode
    save_bot_config(config)

    mode_emojis = {"Seguro": "🛡️", "Balanceado": "⚖️", "Agresivo": "🔥"}

    await sender.send_message(
        f"✅ Modo cambiado a: {mode_emojis.get(new_mode, '')} <b>{_escape_html(new_mode)}</b>\n\n"
        f"Las señales se calcularán con los umbrales de modo {_escape_html(new_mode)}.",
        parse_mode="HTML",
    )


async def cmd_bot_status(sender: TelegramSender, args: List[str]):
    """Show bot status information."""
    config = load_bot_config()
    watchlist = load_bot_watchlist()
    alerts = load_price_alerts()
    active_alerts = [a for a in alerts if not a.get("triggered", False)]

    status_emoji = "🟢" if bot_status == "running" else "🟡" if bot_status == "idle" else "🔴"

    lines = [
        "🤖 <b>ESTADO DEL BOT</b>",
        "",
        f"Estado: {status_emoji} <code>{bot_status}</code>",
        f"Último check: <code>{last_check_time or 'N/A'}</code>",
        f"Modo: <code>{config.get('risk_mode', 'Balanceado')}</code>",
        f"Timeframe: <code>{config.get('timeframe', '1D')}</code>",
        f"Watchlist: <code>{len(watchlist)} activos</code> ({', '.join(watchlist[:5])}{'...' if len(watchlist) > 5 else ''})",
        f"Alertas activas: <code>{len(active_alerts)}</code>",
        f"Pares soportados: <code>{len(BINANCE_PAIR_MAP)}</code>",
        "",
        "⚡ <i>Oráculo de Trading Pro v2.0</i>",
    ]

    await sender.send_message("\n".join(lines), parse_mode="HTML")


async def cmd_risk(sender: TelegramSender, args: List[str]):
    """Actuarial risk analysis: /riesgo BTC"""
    if not args:
        await sender.send_message(
            "🧮 Uso: /riesgo <code>BTC</code>\nEjemplo: <code>/riesgo SOL</code>",
            parse_mode="HTML",
        )
        return

    symbol = args[0].upper()
    if not is_supported(symbol):
        await sender.send_message(
            f"❌ <code>{_escape_html(symbol)}</code> no disponible.",
            parse_mode="HTML",
        )
        return

    await sender.send_message(
        f"⏳ Calculando riesgo actuarial para <b>{_escape_html(symbol)}</b>...",
        parse_mode="HTML",
    )

    from services.binance_client import fetch_klines
    from services.actuarial_models import ActuarialEngine

    df = await fetch_klines(symbol, timeframe="1D", limit=365)
    if df is None or df.empty or len(df) < 30:
        await sender.send_message(
            f"❌ Datos insuficientes para análisis actuarial de <code>{_escape_html(symbol)}</code>.",
            parse_mode="HTML",
        )
        return

    try:
        engine = ActuarialEngine(df)
        report = engine.generate_full_actuarial_report()
    except Exception as e:
        await sender.send_message(
            f"❌ Error en modelo actuarial: <code>{_escape_html(str(e))}</code>",
            parse_mode="HTML",
        )
        return

    if not report.get("dataAvailable"):
        await sender.send_message(
            f"❌ No se pudo generar el reporte actuarial para {_escape_html(symbol)}.",
            parse_mode="HTML",
        )
        return

    risk = report["riskMetrics"]
    mc = report["monteCarlo7D"]
    markov = report["markovRegime"]
    jp = mc.get("jump_params", {})
    current_price = float(df['close'].iloc[-1])

    # VaR color indicator
    var_abs = abs(risk["var95"])
    var_emoji = "🟢" if var_abs < 3 else "🟡" if var_abs < 5 else "🔴"

    # Dominant regime
    regimes = {"bull": ("🟢 Alcista", markov.get("bull", 0)), "bear": ("🔴 Bajista", markov.get("bear", 0)), "sideways": ("⚪ Lateral", markov.get("sideways", 0))}
    dominant = max(regimes.items(), key=lambda x: x[1][1])
    dom_label, dom_pct = dominant[1]
    dom_pct_val = dom_pct * 100 if dom_pct <= 1 else dom_pct

    lines = [
        f"🧮 <b>ANÁLISIS ACTUARIAL — {_escape_html(symbol)}</b>",
        f"<i>Modelo: Merton Jump-Diffusion</i>",
        "",
        f"💰 Precio actual: <code>${current_price:,.2f}</code>",
        "",
        f"📊 <b>Métricas de Riesgo</b>",
        f"  {var_emoji} VaR 95% (diario): <code>{risk['var95']:.2f}%</code>",
        f"  📉 CVaR / Expected Shortfall: <code>{risk['cvar95']:.2f}%</code>",
        f"  📈 Volatilidad Anualizada: <code>{risk['annualVolatility']:.2f}%</code>",
        "",
        f"🔮 <b>Monte Carlo 7 Días</b>",
        f"  🔴 P10 (Bear): <code>${mc['p10']:,.2f}</code>",
        f"  🟡 P50 (Base): <code>${mc['p50']:,.2f}</code>",
        f"  🟢 P90 (Bull): <code>${mc['p90']:,.2f}</code>",
    ]

    # Jump parameters
    if jp and jp.get("lambda", 0) > 0:
        lines.extend([
            "",
            f"⚡ <b>Parámetros de Salto</b>",
            f"  λ (intensidad): <code>{jp['lambda']:.4f}</code> ({jp['lambda']*365:.1f}/año)",
            f"  μ_J (media salto): <code>{jp['mu_j']:.4f}</code>",
            f"  σ_J (vol salto): <code>{jp['sigma_j']:.4f}</code>",
        ])
    else:
        lines.append("\n✅ No se detectaron eventos extremos (saltos) en el histórico.")

    lines.extend([
        "",
        f"🔄 <b>Régimen de Markov</b>",
        f"  Dominante: {dom_label} ({dom_pct_val:.1f}%)",
        f"  🟢 Alcista: <code>{(markov.get('bull', 0) * 100 if markov.get('bull', 0) <= 1 else markov.get('bull', 0)):.1f}%</code>",
        f"  🔴 Bajista: <code>{(markov.get('bear', 0) * 100 if markov.get('bear', 0) <= 1 else markov.get('bear', 0)):.1f}%</code>",
        f"  ⚪ Lateral: <code>{(markov.get('sideways', 0) * 100 if markov.get('sideways', 0) <= 1 else markov.get('sideways', 0)):.1f}%</code>",
        "",
        "⚡ <i>Oráculo de Trading Pro</i>",
        f"<i>{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</i>",
    ])

    await sender.send_message("\n".join(lines), parse_mode="HTML")


async def cmd_backtest(sender: TelegramSender, args: List[str]):
    """Run backtest: /backtest BTC"""
    if not args:
        await sender.send_message(
            "📊 Uso: /backtest <code>BTC</code>\nEjemplo: <code>/backtest SOL</code>",
            parse_mode="HTML",
        )
        return

    symbol = args[0].upper()
    if not is_supported(symbol):
        await sender.send_message(
            f"❌ <code>{_escape_html(symbol)}</code> no disponible.",
            parse_mode="HTML",
        )
        return

    await sender.send_message(
        f"⏳ Ejecutando backtest de <b>{_escape_html(symbol)}</b> (90 días)...",
        parse_mode="HTML",
    )

    from services.binance_client import fetch_klines
    from services.backtester import run_backtest

    df = await fetch_klines(symbol, timeframe="1D", limit=500)
    if df is None or df.empty or len(df) < 50:
        await sender.send_message(
            f"❌ Datos insuficientes para backtest de <code>{_escape_html(symbol)}</code>.",
            parse_mode="HTML",
        )
        return

    try:
        results = run_backtest(df)
    except Exception as e:
        await sender.send_message(
            f"❌ Error en backtest: <code>{_escape_html(str(e))}</code>",
            parse_mode="HTML",
        )
        return

    if "error" in results:
        await sender.send_message(
            f"❌ {_escape_html(results['error'])}",
            parse_mode="HTML",
        )
        return

    m = results["metrics"]
    trades = results.get("trades", [])

    # Color indicators
    ret_emoji = "🟢" if m["total_return_percent"] >= 0 else "🔴"
    wr_emoji = "🟢" if m["win_rate_percent"] >= 50 else "🟡" if m["win_rate_percent"] >= 40 else "🔴"
    sharpe_emoji = "🟢" if m["sharpe_ratio"] >= 1 else "🟡" if m["sharpe_ratio"] >= 0 else "🔴"
    dd_emoji = "🟢" if abs(m["max_drawdown_percent"]) < 10 else "🟡" if abs(m["max_drawdown_percent"]) < 20 else "🔴"

    lines = [
        f"📊 <b>BACKTEST — {_escape_html(symbol)}</b>",
        f"<i>Motor: Quant Score Proxy (RSI 40% + MACD 30% + EMA 30%)</i>",
        "",
        f"💰 <b>Rendimiento</b>",
        f"  {ret_emoji} Retorno Total: <code>{m['total_return_percent']:+.2f}%</code>",
        f"  💵 Balance: <code>${m['initial_balance']:,.0f}</code> → <code>${m['final_balance']:,.2f}</code>",
        "",
        f"📈 <b>Métricas</b>",
        f"  {wr_emoji} Win Rate: <code>{m['win_rate_percent']:.1f}%</code>",
        f"  {sharpe_emoji} Sharpe Ratio: <code>{m['sharpe_ratio']:.2f}</code>",
        f"  {dd_emoji} Max Drawdown: <code>{m['max_drawdown_percent']:.2f}%</code>",
        f"  🔄 Total Trades: <code>{m['total_trades']}</code>",
    ]

    # Last 3 trades
    if trades:
        lines.append("")
        lines.append("📋 <b>Últimas Operaciones</b>")
        for t in trades[-3:]:
            pnl = t.get("pnl_percent", 0)
            pnl_emoji = "🟢" if pnl >= 0 else "🔴"
            lines.append(
                f"  {pnl_emoji} <code>${t['entry_price']:,.2f}</code> → <code>${t['exit_price']:,.2f}</code> ({pnl:+.2f}%)"
            )

    lines.extend([
        "",
        "⚡ <i>Oráculo de Trading Pro</i>",
        f"<i>{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</i>",
    ])

    await sender.send_message("\n".join(lines), parse_mode="HTML")


# ============================================================
# TELEGRAM POLLING (receive commands)
# ============================================================

async def poll_telegram_updates(sender: TelegramSender, config: dict):
    """Poll for new messages/commands from Telegram."""
    global last_update_id

    try:
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://api.telegram.org/bot{config['BOT_TOKEN']}/getUpdates",
                params={
                    "offset": last_update_id + 1,
                    "timeout": 5,
                    "allowed_updates": json.dumps(["message"]),
                },
            )
            resp.raise_for_status()
            data = resp.json()

            if not data.get("ok"):
                return

            for update in data.get("result", []):
                update_id = update.get("update_id", 0)
                if update_id > last_update_id:
                    last_update_id = update_id

                message = update.get("message", {})
                text = message.get("text", "")
                chat_id = str(message.get("chat", {}).get("id", ""))

                # Only respond to the configured chat_id
                if chat_id == config["CHAT_ID"] and text.startswith("/"):
                    print(f"  [CMD] Received command: {text}")
                    await handle_command(sender, text, chat_id)

    except Exception as e:
        # Silently handle polling errors (network issues, etc.)
        if "timed out" not in str(e).lower():
            print(f"  [POLL] Error polling updates: {e}")


# ============================================================
# PRICE ALERTS
# ============================================================

def format_price_alert_message(alert: dict, current_price: float) -> str:
    symbol = alert.get("symbol", "???")
    target = alert.get("targetPrice", 0)
    condition = alert.get("condition", "above")

    direction_emoji = "📈" if condition == "above" else "📉"
    condition_text = "supero" if condition == "above" else "cayo por debajo de"

    lines = [
        f"🚨 <b>ALERTA DE PRECIO ACTIVADA</b>",
        f"",
        f"🪙 <b>{symbol}</b>",
        f"{direction_emoji} El precio {condition_text} <code>${target:,.2f}</code>",
        f"💰 Precio actual: <code>${current_price:,.2f}</code>",
        f"",
        f"⚡ <i>Oraculo de Trading Pro</i>",
        f"<i>{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</i>",
    ]
    return "\n".join(lines)


async def check_price_alerts(sender: TelegramSender):
    global triggered_price_alerts
    alerts = load_price_alerts()
    if not alerts:
        return

    active_alerts = [a for a in alerts if not a.get("triggered", False)]
    if not active_alerts:
        return

    symbols_needed = list(set(a.get("symbol", "").upper() for a in active_alerts))
    price_cache: Dict[str, float] = {}

    for sym in symbols_needed:
        if not sym:
            continue
        try:
            ticker = await fetch_ticker(sym)
            if ticker:
                price_cache[sym] = ticker["price"]
        except Exception as e:
            print(f"  [WARN] Error fetching price for {sym}: {e}")

    any_triggered = False
    for alert in alerts:
        if alert.get("triggered", False):
            continue
        alert_id = alert.get("id", "")
        symbol = alert.get("symbol", "").upper()
        target_price = alert.get("targetPrice", 0)
        condition = alert.get("condition", "above")

        current_price = price_cache.get(symbol)
        if current_price is None:
            continue

        is_triggered = False
        if condition == "above" and current_price >= target_price:
            is_triggered = True
        elif condition == "below" and current_price <= target_price:
            is_triggered = True

        if is_triggered and alert_id not in triggered_price_alerts:
            msg = format_price_alert_message(alert, current_price)
            success = await sender.send_message(msg, parse_mode="HTML")
            if success:
                triggered_price_alerts.add(alert_id)
                alert["triggered"] = True
                any_triggered = True
                print(f"  [ALERT] Price alert triggered: {symbol} {condition} ${target_price:,.2f} (current: ${current_price:,.2f})")

    if any_triggered:
        save_price_alerts(alerts)


# ============================================================
# SIGNAL ALERTS
# ============================================================

async def check_signal_alerts(sender: TelegramSender, config: dict):
    global sent_signals
    from services.analyzer import run_analysis

    has_changes = False
    for symbol in config["WATCHLIST"]:
        if not is_supported(symbol):
            continue
        try:
            result = await run_analysis(symbol, config["TIMEFRAME"], config["RISK_MODE"])
            if not result:
                continue

            signal = result["signal"]
            score = result["quantScore"]
            price = result["currentPrice"]
            change = result["priceChange24h"]

            is_actionable = signal in ("Compra Fuerte", "Venta Fuerte", "Compra", "Venta")
            is_new = sent_signals.get(symbol) != signal

            if is_actionable and is_new:
                msg = format_signal_alert(
                    symbol=symbol, name=result["name"], signal=signal, score=score,
                    price=price, change_24h=change, timeframe=config["TIMEFRAME"],
                    mode=config["RISK_MODE"],
                    optimal_entry=result["actionableData"]["optimalEntry"],
                    take_profit=result["actionableData"]["takeProfit"],
                    stop_loss=result["actionableData"]["stopLoss"],
                )
                success = await sender.send_message(msg, parse_mode="HTML")
                if success:
                    sent_signals[symbol] = signal
                    has_changes = True
                    print(f"  [SENT] Signal alert sent for {symbol}: {signal}")

                    # Save to signal history
                    try:
                        history = load_json_file(HISTORY_FILE, [])
                        if not isinstance(history, list):
                            history = []
                        history.append({
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "symbol": symbol,
                            "signal": signal,
                            "quantScore": score,
                            "price": price,
                        })
                        save_json_file(HISTORY_FILE, history)
                    except Exception as e:
                        print(f"  [ERR] Could not save history: {e}")
            else:
                if sent_signals.get(symbol) != signal:
                    sent_signals[symbol] = signal
                    has_changes = True
        except Exception as e:
            print(f"  [ERR] Error analyzing {symbol}: {e}")

    if has_changes:
        save_sent_signals(sent_signals)


# ============================================================
# ACTUARIAL ALERTS
# ============================================================

async def check_actuarial_risk(sender: TelegramSender, config: dict):
    from services.binance_client import fetch_klines
    from services.actuarial_models import ActuarialEngine
    
    # Check top 3 from watchlist to avoid API spam
    top_coins = config["WATCHLIST"][:3]
    has_alerted = False

    for symbol in top_coins:
        if not is_supported(symbol):
            continue
        try:
            df = await fetch_klines(symbol, "1D", 365)
            if df is None or df.empty or len(df) < 100:
                continue
            engine = ActuarialEngine(df)
            report = engine.generate_full_actuarial_report()
            if not report.get("dataAvailable"):
                continue
                
            risk = report["riskMetrics"]
            mc = report["monteCarlo7D"]
            jp = mc.get("jump_params", {})
            
            # Triggers for extreme tail risk
            var_trigger = risk["var95"] < -7.0
            jump_trigger = jp.get("lambda", 0) > 0.05
            
            if var_trigger or jump_trigger:
                current_price = float(df['close'].iloc[-1])
                lines = [
                    f"⚠️ <b>ALERTA DE RIESGO ACTUARIAL — {_escape_html(symbol)}</b>",
                    f"",
                    f"💰 Precio actual: <code>${current_price:,.2f}</code>",
                    f"El modelo <i>Merton Jump-Diffusion</i> detectó anomalías de riesgo extremo en la cola:",
                    f""
                ]
                if var_trigger:
                    lines.append(f"🔴 <b>VaR 95% Crítico</b>: <code>{risk['var95']:.2f}%</code> diario")
                if jump_trigger:
                    lines.append(f"⚡ <b>Alta prob. de salto (Tail Risk)</b>: λ = <code>{jp['lambda']:.4f}</code>")
                
                lines.extend([
                    "",
                    f"🛡️ <i>Recomendación: Reduce exposición direccional o ajusta Stop Loss.</i>",
                    f"<i>Usa /riesgo {_escape_html(symbol)} para análisis completo.</i>"
                ])
                await sender.send_message("\n".join(lines), parse_mode="HTML")
                has_alerted = True
                
        except Exception as e:
            print(f"  [ERR] Error in actuarial check for {symbol}: {e}")
            
    if has_alerted:
        print("[INFO] Actuarial risk alerts sent.")


async def send_periodic_summary(sender: TelegramSender, config: dict):
    global last_summary_time
    if (time.time() - last_summary_time) / 3600 < 6:
        return

    from services.analyzer import run_analysis
    entries = []
    for symbol in config["WATCHLIST"]:
        if not is_supported(symbol):
            continue
        try:
            result = await run_analysis(symbol, config["TIMEFRAME"], config["RISK_MODE"])
            if result:
                entries.append({
                    "symbol": symbol, "price": result["currentPrice"],
                    "change": result["priceChange24h"], "score": result["quantScore"],
                    "signal": result["signal"],
                })
        except Exception:
            continue

    if entries:
        msg = format_watchlist_summary(entries)
        await sender.send_message(msg, parse_mode="HTML")
        last_summary_time = time.time()
        print("[INFO] Watchlist summary sent")


# ============================================================
# DECOUPLED CONCURRENT LOOPS
# ============================================================

async def command_polling_loop():
    """Poll for Telegram commands every 2 seconds."""
    global bot_status, last_check_time
    print("[INIT] Starting Telegram command polling (every 2s)...")

    while True:
        try:
            config = get_config()
            if not config["BOT_TOKEN"] or not config["CHAT_ID"]:
                await asyncio.sleep(10)
                continue

            sender = TelegramSender(config["BOT_TOKEN"], config["CHAT_ID"])

            # Test connection on first run
            if bot_status == "idle":
                if not await sender.test_connection():
                    bot_status = "error"
                    await asyncio.sleep(30)
                    continue
                bot_status = "running"
                print("[BOT] Command polling connected to Telegram.")

            await poll_telegram_updates(sender, config)
            await asyncio.sleep(2)
        except Exception as e:
            print(f"[BOT-ERR] Error in command polling: {e}")
            await asyncio.sleep(5)


async def price_alerts_loop():
    global bot_status, last_check_time
    print("[INIT] Starting Price Alerts background task (every 15s)...")
    while True:
        try:
            config = get_config()
            if not config["BOT_TOKEN"] or not config["CHAT_ID"]:
                bot_status = "idle"
                await asyncio.sleep(10)
                continue

            sender = TelegramSender(config["BOT_TOKEN"], config["CHAT_ID"])
            await check_price_alerts(sender)

            last_check_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
            if bot_status != "error":
                bot_status = "running"

            await asyncio.sleep(15)
        except Exception as e:
            print(f"[BOT-ERR] Error in price alerts loop: {e}")
            bot_status = "error"
            await asyncio.sleep(30)


async def signal_alerts_loop():
    global bot_status
    print("[INIT] Starting Watchlist Signal Alerts background task...")
    while True:
        try:
            config = get_config()
            if not config["BOT_TOKEN"] or not config["CHAT_ID"]:
                await asyncio.sleep(15)
                continue

            sender = TelegramSender(config["BOT_TOKEN"], config["CHAT_ID"])
            await check_signal_alerts(sender, config)

            if bot_status != "error":
                bot_status = "running"

            # Wait for CHECK_INTERVAL (in minutes)
            interval_mins = max(1, config["CHECK_INTERVAL"])
            await asyncio.sleep(interval_mins * 60)
        except Exception as e:
            print(f"[BOT-ERR] Error in signal alerts loop: {e}")
            bot_status = "error"
            await asyncio.sleep(60)


async def periodic_summary_loop():
    while True:
        try:
            config = get_config()
            if not config["BOT_TOKEN"] or not config["CHAT_ID"]:
                await asyncio.sleep(30)
                continue

            sender = TelegramSender(config["BOT_TOKEN"], config["CHAT_ID"])
            await send_periodic_summary(sender, config)

            # Check every 10 minutes if we need to send periodic summary
            await asyncio.sleep(600)
        except Exception as e:
            print(f"[BOT-ERR] Error in periodic summary loop: {e}")
            await asyncio.sleep(300)


async def actuarial_alerts_loop():
    print("[INIT] Starting Actuarial Alerts background task...")
    while True:
        try:
            config = get_config()
            if not config["BOT_TOKEN"] or not config["CHAT_ID"]:
                await asyncio.sleep(60)
                continue
            
            sender = TelegramSender(config["BOT_TOKEN"], config["CHAT_ID"])
            await check_actuarial_risk(sender, config)
            
            # Run check every 12 hours (43200 seconds)
            await asyncio.sleep(43200)
        except Exception as e:
            print(f"[BOT-ERR] Error in actuarial alerts loop: {e}")
            await asyncio.sleep(300)


async def start_bot_loop():
    global bot_status
    print("[INIT] Bot loop starting (symbols already initialized by main.py)...")

    # Ensure symbols are loaded (guard in case bot runs standalone)
    if not BINANCE_PAIR_MAP:
        print("[INIT] Loading Binance symbols for Bot (standalone mode)...")
        await init_binance_symbols()

    bot_status = "idle"

    # Run all loops concurrently (including the new command polling)
    await asyncio.gather(
        command_polling_loop(),
        price_alerts_loop(),
        signal_alerts_loop(),
        periodic_summary_loop(),
        actuarial_alerts_loop(),
    )


if __name__ == "__main__":
    try:
        asyncio.run(start_bot_loop())
    except KeyboardInterrupt:
        print("\n[BYE] Bot detenido.")
