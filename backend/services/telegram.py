# ============================================================
# TELEGRAM HELPER — Send formatted messages via Telegram Bot API
# ============================================================

import httpx
from typing import Optional


class TelegramSender:
    """Helper class for sending messages via the Telegram Bot API."""

    def __init__(self, bot_token: str, chat_id: str):
        self.bot_token = bot_token
        self.chat_id = chat_id
        self.base_url = f"https://api.telegram.org/bot{bot_token}"

    async def send_message(self, text: str, parse_mode: str = "HTML") -> bool:
        """Send a text message to the configured chat.
        
        Uses HTML parse mode by default for robustness (no issues with
        special characters like _, *, etc. that break Markdown mode).
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{self.base_url}/sendMessage",
                    json={
                        "chat_id": self.chat_id,
                        "text": text,
                        "parse_mode": parse_mode,
                        "disable_web_page_preview": True,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                if not data.get("ok"):
                    print(f"[Telegram] API returned error: {data}")
                    return False
                return True
        except Exception as e:
            print(f"[Telegram] Error sending message: {e}")
            return False

    async def test_connection(self) -> bool:
        """Test if the bot token and chat_id are valid."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/getMe")
                resp.raise_for_status()
                data = resp.json()
                return data.get("ok", False)
        except Exception:
            return False


def _escape_html(text: str) -> str:
    """Escape special characters for Telegram HTML mode."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def format_signal_alert(
    symbol: str,
    name: str,
    signal: str,
    score: float,
    price: float,
    change_24h: float,
    timeframe: str,
    mode: str,
    optimal_entry: Optional[float] = None,
    take_profit: Optional[float] = None,
    stop_loss: Optional[float] = None,
) -> str:
    """
    Format a trading signal alert message with emojis and HTML formatting.
    Uses HTML parse mode for robustness with special characters.
    """
    # Signal emoji
    signal_emojis = {
        "Compra Fuerte": "🟢🟢",
        "Compra": "🟢",
        "Mantener": "⚪",
        "Venta": "🟠",
        "Venta Fuerte": "🔴🔴",
    }
    emoji = signal_emojis.get(signal, "⚪")

    # Direction arrow
    change_icon = "📈" if change_24h >= 0 else "📉"
    change_sign = "+" if change_24h >= 0 else ""

    safe_name = _escape_html(name)

    lines = [
        f"{emoji} <b>SEÑAL: {_escape_html(signal.upper())}</b>",
        f"",
        f"🪙 <b>{_escape_html(symbol)}</b> ({safe_name})",
        f"💰 Precio: <code>${price:,.2f}</code> {change_icon} {change_sign}{change_24h:.2f}%",
        f"📊 Score: <code>{score:.1f}/100</code>",
        f"⏱ Timeframe: <code>{_escape_html(timeframe)}</code> | Modo: <code>{_escape_html(mode)}</code>",
        f"",
    ]

    if optimal_entry:
        lines.append(f"🎯 Entrada Óptima: <code>${optimal_entry:,.2f}</code>")
    if take_profit:
        lines.append(f"✅ Take Profit: <code>${take_profit:,.2f}</code>")
    if stop_loss:
        lines.append(f"🛑 Stop Loss: <code>${stop_loss:,.2f}</code>")

    lines.extend([
        f"",
        f"⚡ <i>Oráculo de Trading Pro</i>",
        f"<i>{get_timestamp()}</i>",
    ])

    return "\n".join(lines)


def format_watchlist_summary(entries: list) -> str:
    """
    Format a watchlist summary report.
    entries: list of dicts with symbol, price, change, score, signal
    """
    lines = [
        "📋 <b>RESUMEN DE WATCHLIST</b>",
        "",
    ]

    for entry in entries:
        emoji = "🟢" if "Compra" in entry.get("signal", "") else (
            "🔴" if "Venta" in entry.get("signal", "") else "⚪"
        )
        change = entry.get("change", 0)
        change_sign = "+" if change >= 0 else ""
        sym = _escape_html(entry['symbol'])
        lines.append(
            f"{emoji} <b>{sym}</b> — <code>${entry['price']:,.2f}</code> "
            f"({change_sign}{change:.1f}%) — Score: <code>{entry['score']:.1f}</code>"
        )

    lines.extend([
        "",
        f"⚡ <i>Oráculo de Trading Pro</i>",
        f"<i>{get_timestamp()}</i>",
    ])

    return "\n".join(lines)


def format_price_alert(
    symbol: str,
    condition: str,
    target_price: float,
    current_price: float,
) -> str:
    """
    Format a price alert message for Telegram.
    """
    direction_emoji = "📈" if condition == "above" else "📉"
    condition_text = "superó" if condition == "above" else "cayó por debajo de"

    lines = [
        f"🚨 <b>ALERTA DE PRECIO ACTIVADA</b>",
        f"",
        f"🪙 <b>{_escape_html(symbol)}</b>",
        f"{direction_emoji} El precio {condition_text} <code>${target_price:,.2f}</code>",
        f"💰 Precio actual: <code>${current_price:,.2f}</code>",
        f"",
        f"⚡ <i>Oráculo de Trading Pro</i>",
        f"<i>{get_timestamp()}</i>",
    ]
    return "\n".join(lines)


def get_timestamp() -> str:
    from datetime import datetime
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
