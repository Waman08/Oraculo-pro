import json
from pathlib import Path
from typing import Dict, List, Any, Set
from services.supabase_client import supabase

async def load_price_alerts() -> List[dict]:
    if not supabase: return []
    try:
        res = supabase.table('price_alerts').select('*').execute()
        return res.data if res.data else []
    except Exception:
        return []

async def save_price_alerts(alerts: List[dict]):
    pass # Managed individually via upserts now

async def mark_alert_triggered(alert_id: str):
    if not supabase: return
    try:
        supabase.table('price_alerts').update({'triggered': True}).eq('id', alert_id).execute()
    except Exception as e:
        print(f"Error updating alert {alert_id}: {e}")

async def load_bot_watchlist(session_id: str = "default") -> List[str]:
    if not supabase: return ["BTC", "ETH", "SOL"]
    try:
        res = supabase.table('watchlist_items').select('symbol').eq('session_id', session_id).execute()
        return [row['symbol'] for row in res.data] if res.data else ["BTC", "ETH", "SOL"]
    except Exception:
        return ["BTC", "ETH", "SOL"]

async def save_bot_watchlist(session_id: str, symbols: List[str]):
    if not supabase: return
    try:
        # Clear existing
        supabase.table('watchlist_items').delete().eq('session_id', session_id).execute()
        # Insert new
        if symbols:
            data = [{'session_id': session_id, 'symbol': s} for s in symbols]
            supabase.table('watchlist_items').insert(data).execute()
    except Exception as e:
        print(f"Error saving watchlist: {e}")

async def load_bot_config(session_id: str = "default") -> Dict:
    default_config = {"risk_mode": "Balanceado", "timeframe": "1D", "chat_id": ""}
    if not supabase: return default_config
    try:
        res = supabase.table('telegram_config').select('*').eq('session_id', session_id).execute()
        if res.data and len(res.data) > 0:
            row = res.data[0]
            default_config["chat_id"] = row.get("chat_id", "")
            return default_config
    except Exception:
        pass
    return default_config

async def save_bot_config(session_id: str, config: Dict):
    if not supabase: return
    try:
        supabase.table('telegram_config').upsert({
            'session_id': session_id,
            'chat_id': config.get('chat_id', ''),
        }, on_conflict='session_id').execute()
    except Exception:
        pass

async def get_chat_id_for_session(session_id: str) -> str:
    if not supabase: return ""
    try:
        res = supabase.table('telegram_config').select('chat_id').eq('session_id', session_id).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]['chat_id']
    except Exception:
        pass
    return ""

async def record_signal_history(symbol: str, signal: str, score: float, price: float, timeframe: str, risk_mode: str):
    if not supabase: return
    try:
        supabase.table('signal_history').insert({
            'symbol': symbol,
            'signal': signal,
            'score': score,
            'price': price,
            'timeframe': timeframe,
            'risk_mode': risk_mode
        }).execute()
    except Exception as e:
        print(f"Error recording signal: {e}")
