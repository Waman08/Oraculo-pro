
import time
import math
from typing import Dict, List, Optional
from datetime import datetime, timezone
from services.supabase_client import supabase

FEE_RATE = 0.00075  # 0.075% Binance VIP 0 taker fee

def get_or_create_account(session_id: str) -> dict:
    if not supabase:
        return {"error": "Supabase not configured"}
    
    res = supabase.table("paper_accounts").select("*").eq("session_id", session_id).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]
    
    # Create new
    new_acc = {
        "session_id": session_id,
        "initial_balance": 10000.0,
        "cash_balance": 10000.0,
        "equity": 10000.0
    }
    insert_res = supabase.table("paper_accounts").insert(new_acc).execute()
    return insert_res.data[0] if insert_res.data else new_acc

def execute_trade(session_id: str, symbol: str, side: str, price: float, size_usd: float, sl: float = None, tp: float = None) -> dict:
    if not supabase:
        return {"error": "Supabase not configured"}
    
    account = get_or_create_account(session_id)
    if "error" in account:
        return account
        
    cash = float(account["cash_balance"])
    
    if size_usd > cash:
        return {"error": "Insufficient balance"}
        
    fee = size_usd * FEE_RATE
    total_cost = size_usd + fee
    
    if total_cost > cash:
        size_usd = cash / (1 + FEE_RATE)
        fee = size_usd * FEE_RATE
        total_cost = size_usd + fee
        
    amount = size_usd / price
    
    new_cash = cash - total_cost
    
    # Insert position
    pos = {
        "session_id": session_id,
        "symbol": symbol.upper(),
        "side": side.upper(),
        "entry_price": price,
        "amount": amount,
        "total_usd": size_usd,
        "stop_loss": sl,
        "take_profit": tp,
        "status": "OPEN",
    }
    
    pos_res = supabase.table("paper_positions").insert(pos).execute()
    
    # Update account
    supabase.table("paper_accounts").update({"cash_balance": new_cash}).eq("session_id", session_id).execute()
    
    return {"success": True, "position": pos_res.data[0] if pos_res.data else pos, "new_balance": new_cash}

def close_position(pos_id: str, exit_price: float, reason: str = "MANUAL"):
    if not supabase:
        return
        
    pos_res = supabase.table("paper_positions").select("*").eq("id", pos_id).execute()
    if not pos_res.data:
        return
    
    pos = pos_res.data[0]
    if pos["status"] != "OPEN":
        return
        
    side = pos["side"]
    entry_price = float(pos["entry_price"])
    amount = float(pos["amount"])
    
    # Calculate PNL
    if side == "BUY":
        gross_pnl = (exit_price - entry_price) * amount
    else: # SELL/SHORT
        gross_pnl = (entry_price - exit_price) * amount
        
    exit_value = (entry_price * amount) + gross_pnl
    exit_fee = exit_value * FEE_RATE
    net_pnl = gross_pnl - exit_fee
    
    pnl_pct = (net_pnl / float(pos["total_usd"])) * 100
    
    # Update position
    update_data = {
        "status": f"CLOSED_{reason}" if reason != "MANUAL" else "CLOSED",
        "exit_price": exit_price,
        "pnl_usd": net_pnl,
        "pnl_pct": pnl_pct,
        "exit_reason": reason,
        "closed_at": datetime.now(timezone.utc).isoformat()
    }
    supabase.table("paper_positions").update(update_data).eq("id", pos_id).execute()
    
    # Update account balance
    acc_res = supabase.table("paper_accounts").select("*").eq("session_id", pos["session_id"]).execute()
    if acc_res.data:
        acc = acc_res.data[0]
        new_cash = float(acc["cash_balance"]) + exit_value - exit_fee
        supabase.table("paper_accounts").update({"cash_balance": new_cash}).eq("id", acc["id"]).execute()

def check_positions_against_ticks(current_prices: dict):
    if not supabase:
        return
        
    res = supabase.table("paper_positions").select("*").eq("status", "OPEN").execute()
    if not res.data:
        return
        
    for pos in res.data:
        symbol = pos["symbol"]
        if symbol not in current_prices:
            continue
            
        current_price = float(current_prices[symbol])
        side = pos["side"]
        sl = float(pos["stop_loss"]) if pos.get("stop_loss") else None
        tp = float(pos["take_profit"]) if pos.get("take_profit") else None
        
        if side == "BUY":
            if tp and current_price >= tp:
                close_position(pos["id"], tp, "TP")
            elif sl and current_price <= sl:
                close_position(pos["id"], sl, "SL")
        elif side == "SELL":
            if tp and current_price <= tp:
                close_position(pos["id"], tp, "TP")
            elif sl and current_price >= sl:
                close_position(pos["id"], sl, "SL")

def get_account_analytics(session_id: str) -> dict:
    if not supabase:
        return {"error": "Supabase not configured"}
        
    acc = get_or_create_account(session_id)
    cash = float(acc["cash_balance"])
    
    pos_res = supabase.table("paper_positions").select("*").eq("session_id", session_id).execute()
    positions = pos_res.data or []
    
    open_positions = []
    closed_positions = []
    
    equity = cash
    
    for p in positions:
        if p["status"] == "OPEN":
            # Just approximate without live price for the summary list, 
            # real equity should be updated via live websocket on the frontend
            open_positions.append(p)
            equity += float(p["total_usd"]) 
        else:
            closed_positions.append(p)
            
    # Calculate metrics on closed positions
    total_trades = len(closed_positions)
    wins = len([p for p in closed_positions if float(p.get("pnl_usd", 0)) > 0])
    win_rate = (wins / total_trades * 100) if total_trades > 0 else 0
    
    gross_profit = sum([float(p["pnl_usd"]) for p in closed_positions if float(p.get("pnl_usd", 0)) > 0])
    gross_loss = abs(sum([float(p["pnl_usd"]) for p in closed_positions if float(p.get("pnl_usd", 0)) < 0]))
    
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (999.0 if gross_profit > 0 else 0.0)
    
    # Calculate Max Drawdown
    peak = 10000.0
    max_dd = 0.0
    current_eq = 10000.0
    
    # Sort closed positions by closed_at
    closed_positions.sort(key=lambda x: x.get("closed_at", ""))
    returns = []
    
    for p in closed_positions:
        pnl = float(p.get("pnl_usd", 0))
        current_eq += pnl
        if current_eq > peak:
            peak = current_eq
        dd = (peak - current_eq) / peak * 100
        if dd > max_dd:
            max_dd = dd
            
        returns.append(pnl / (current_eq - pnl) if (current_eq - pnl) > 0 else 0)
        
    # Empirical Sharpe (approximate, Risk Free Rate = 0)
    if len(returns) > 1:
        mean_ret = sum(returns) / len(returns)
        var_ret = sum((r - mean_ret)**2 for r in returns) / (len(returns) - 1)
        std_ret = math.sqrt(var_ret)
        sharpe = (mean_ret / std_ret * math.sqrt(365)) if std_ret > 0 else 0.0
    else:
        sharpe = 0.0
        
    total_return_pct = ((current_eq - 10000.0) / 10000.0) * 100
    
    return {
        "account": acc,
        "equity": equity, # Base equity without live unrealized PnL (UI adds it)
        "metrics": {
            "totalTrades": total_trades,
            "winRate": round(win_rate, 2),
            "profitFactor": round(profit_factor, 2),
            "sharpeRatio": round(sharpe, 2),
            "totalReturnPct": round(total_return_pct, 2),
            "maxDrawdown": round(max_dd, 2)
        },
        "openPositions": open_positions,
        "closedPositions": closed_positions[-50:] # Last 50
    }
