import asyncio
from typing import Optional, Dict, List, Any
from datetime import datetime, timezone
import math

from services.supabase_client import supabase

TAKER_FEE = 0.00075  # 0.075% Binance Taker Fee

async def get_or_create_portfolio(session_id: str) -> Dict[str, Any]:
    if not supabase:
        raise Exception("Supabase is not configured")
        
    res = supabase.table("paper_portfolio").select("*").eq("session_id", session_id).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]
        
    # Create new
    res = supabase.table("paper_portfolio").insert({
        "session_id": session_id,
        "initial_capital": 10000.0,
        "current_balance": 10000.0,
        "equity": 10000.0,
        "auto_paper_trading": False
    }).execute()
    return res.data[0]

async def update_auto_trading(session_id: str, auto_paper_trading: bool) -> bool:
    if not supabase: return False
    await get_or_create_portfolio(session_id)
    supabase.table("paper_portfolio").update({"auto_paper_trading": auto_paper_trading}).eq("session_id", session_id).execute()
    return True

async def open_paper_trade(
    session_id: str, 
    symbol: str, 
    side: str, 
    price: float, 
    amount_usd: float, 
    sl: float, 
    tp: float
) -> Dict[str, Any]:
    if not supabase:
        raise Exception("Supabase is not configured")
        
    # Validation
    if side not in ["LONG", "SHORT"]:
        raise ValueError("Side must be LONG or SHORT")
        
    portfolio = await get_or_create_portfolio(session_id)
    current_balance = float(portfolio.get("current_balance", 0.0))
    
    if amount_usd > current_balance:
        raise ValueError(f"Insufficient balance. Tried to use {amount_usd}, but balance is {current_balance}")
        
    # Calculate fee and actual investment
    fee_usd = amount_usd * TAKER_FEE
    net_investment = amount_usd - fee_usd
    amount_tokens = net_investment / price
    
    # Deduct balance
    new_balance = current_balance - amount_usd
    supabase.table("paper_portfolio").update({"current_balance": new_balance}).eq("session_id", session_id).execute()
    
    # Insert trade
    trade_data = {
        "session_id": session_id,
        "symbol": symbol.upper(),
        "side": side,
        "entry_price": price,
        "amount": amount_tokens,
        "total_usd": amount_usd,
        "stop_loss": sl,
        "take_profit": tp,
        "status": "OPEN",
        "opened_at": datetime.now(timezone.utc).isoformat()
    }
    
    res = supabase.table("paper_trades").insert(trade_data).execute()
    return res.data[0]

async def close_paper_trade(trade_id: str, exit_price: float, exit_reason: str) -> Dict[str, Any]:
    if not supabase:
        raise Exception("Supabase not configured")
        
    res = supabase.table("paper_trades").select("*").eq("id", trade_id).execute()
    if not res.data:
        raise ValueError("Trade not found")
        
    trade = res.data[0]
    if trade["status"] != "OPEN":
        raise ValueError("Trade is already closed")
        
    side = trade["side"]
    entry_price = float(trade["entry_price"])
    amount_tokens = float(trade["amount"])
    total_invested = float(trade["total_usd"])
    session_id = trade["session_id"]
    
    # Value at exit before fee
    gross_value_usd = amount_tokens * exit_price
    
    # Calculate PNL based on side
    if side == "LONG":
        pnl_gross = gross_value_usd - total_invested
    else: # SHORT
        # If short, we gain when price drops.
        price_diff = entry_price - exit_price
        pnl_gross = price_diff * amount_tokens
        
    # Exit fee
    exit_value_to_fee = amount_tokens * exit_price if side == "LONG" else total_invested # Approximation
    exit_fee = exit_value_to_fee * TAKER_FEE
    
    pnl_net = pnl_gross - exit_fee
    pnl_pct = (pnl_net / total_invested) * 100
    
    # Final capital returned to balance
    capital_returned = total_invested + pnl_net
    
    # Update trade
    close_data = {
        "status": exit_reason,
        "exit_price": exit_price,
        "pnl_usd": pnl_net,
        "pnl_pct": pnl_pct,
        "closed_at": datetime.now(timezone.utc).isoformat()
    }
    supabase.table("paper_trades").update(close_data).eq("id", trade_id).execute()
    
    # Update portfolio
    port_res = supabase.table("paper_portfolio").select("current_balance").eq("session_id", session_id).execute()
    if port_res.data:
        current_balance = float(port_res.data[0]["current_balance"])
        supabase.table("paper_portfolio").update({
            "current_balance": current_balance + capital_returned
        }).eq("session_id", session_id).execute()
        
    return {**trade, **close_data}

async def update_open_trades(current_prices: Dict[str, float]):
    if not supabase: return
    
    try:
        # Get all OPEN trades
        res = supabase.table("paper_trades").select("*").eq("status", "OPEN").execute()
        open_trades = res.data
        if not open_trades: return
        
        for trade in open_trades:
            symbol = trade["symbol"]
            current_price = current_prices.get(symbol)
            if not current_price: continue
            
            side = trade["side"]
            sl = float(trade["stop_loss"]) if trade.get("stop_loss") else None
            tp = float(trade["take_profit"]) if trade.get("take_profit") else None
            
            exit_reason = None
            if side == "LONG":
                if tp and current_price >= tp: exit_reason = "CLOSED_TP"
                elif sl and current_price <= sl: exit_reason = "CLOSED_SL"
            elif side == "SHORT":
                if tp and current_price <= tp: exit_reason = "CLOSED_TP"
                elif sl and current_price >= sl: exit_reason = "CLOSED_SL"
                
            if exit_reason:
                await close_paper_trade(trade["id"], current_price, exit_reason)
                print(f"[Paper Trading] Trade {trade['id']} closed due to {exit_reason} at {current_price}")
                
    except Exception as e:
        print(f"[Paper Trading] Error updating open trades: {e}")

async def get_performance_metrics(session_id: str) -> Dict[str, Any]:
    if not supabase: return {}
    
    portfolio = await get_or_create_portfolio(session_id)
    
    # Fetch all closed trades
    res = supabase.table("paper_trades").select("*").eq("session_id", session_id).not_.is_("closed_at", "null").execute()
    trades = res.data or []
    
    win_count = 0
    gross_profit = 0.0
    gross_loss = 0.0
    returns = []
    
    peak_balance = float(portfolio["initial_capital"])
    current_sim_balance = peak_balance
    max_drawdown = 0.0
    
    for t in trades:
        pnl = float(t.get("pnl_usd", 0.0))
        pnl_pct = float(t.get("pnl_pct", 0.0))
        returns.append(pnl_pct)
        
        current_sim_balance += pnl
        if current_sim_balance > peak_balance:
            peak_balance = current_sim_balance
        
        dd = (peak_balance - current_sim_balance) / peak_balance * 100
        if dd > max_drawdown:
            max_drawdown = dd
            
        if pnl > 0:
            win_count += 1
            gross_profit += pnl
        else:
            gross_loss += abs(pnl)
            
    total_trades = len(trades)
    win_rate = (win_count / total_trades * 100) if total_trades > 0 else 0.0
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (gross_profit if gross_profit > 0 else 0.0)
    
    # Sharpe Ratio Simplified (Avg Return / StdDev Return)
    sharpe_ratio = 0.0
    if len(returns) > 1:
        avg_ret = sum(returns) / len(returns)
        variance = sum((r - avg_ret)**2 for r in returns) / len(returns)
        std_dev = math.sqrt(variance)
        if std_dev > 0:
            # Assuming Risk Free Rate = 0 for simplified crypto
            sharpe_ratio = avg_ret / std_dev
            
    total_return_pct = ((float(portfolio["current_balance"]) - float(portfolio["initial_capital"])) / float(portfolio["initial_capital"])) * 100

    return {
        "total_trades": total_trades,
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "sharpe_ratio": sharpe_ratio,
        "total_return_pct": total_return_pct,
        "max_drawdown_pct": max_drawdown,
        "current_balance": float(portfolio["current_balance"]),
        "initial_capital": float(portfolio["initial_capital"])
    }

async def calculate_kelly_position_size(session_id: str, balance: float) -> float:
    metrics = await get_performance_metrics(session_id)
    if not metrics or metrics.get("total_trades", 0) < 5:
        return balance * 0.05  # 5% default for new accounts
        
    win_rate = metrics.get("win_rate", 50.0) / 100.0
    profit_factor = metrics.get("profit_factor", 1.5)
    
    if profit_factor <= 0: return balance * 0.01
    
    # Kelly Formula: K = W - ((1 - W) / R)
    kelly_pct = win_rate - ((1.0 - win_rate) / profit_factor)
    
    # Fractional Kelly (Half-Kelly)
    kelly_pct = kelly_pct * 0.5
    
    # Clamp between 1% and 15%
    kelly_pct = max(0.01, min(0.15, kelly_pct))
    
    return balance * kelly_pct
