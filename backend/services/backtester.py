import pandas as pd
import pandas_ta as ta
import numpy as np

def run_backtest(df: pd.DataFrame, initial_balance: float = 10000.0, mode: str = "Balanceado", fee_rate: float = 0.001) -> dict:
    if df is None or df.empty or len(df) < 50:
        return {"error": "Not enough data for backtesting."}
        
    df = df.copy()
    
    # Calculate Indicators
    df['rsi'] = ta.rsi(df['close'], length=14)
    df['ema_short'] = ta.ema(df['close'], length=9)
    df['ema_long'] = ta.ema(df['close'], length=21)
    
    macd = ta.macd(df['close'])
    if macd is not None and not macd.empty:
        df['macd'] = macd.iloc[:, 0]
        df['macd_signal'] = macd.iloc[:, 2]
    else:
        df['macd'] = 0
        df['macd_signal'] = 0

    df = df.fillna(0)

    # Risk mode thresholds
    buy_threshold = 55
    sell_threshold = 45
    if mode == "Agresivo":
        buy_threshold = 50
        sell_threshold = 50
    elif mode == "Conservador":
        buy_threshold = 65
        sell_threshold = 35

    df['rsi_score'] = np.where(df['rsi'] > 0, 100 - df['rsi'].clip(0, 100), 50)
    df['macd_bull'] = (df['macd'] > df['macd_signal']).astype(int) * 100
    df['ema_bull'] = (df['ema_short'] > df['ema_long']).astype(int) * 100
    
    df['quant_score_proxy'] = (df['rsi_score'] * 0.4) + (df['macd_bull'] * 0.3) + (df['ema_bull'] * 0.3)

    df['signal'] = 0
    df.loc[df['quant_score_proxy'] >= buy_threshold, 'signal'] = 1
    df.loc[df['quant_score_proxy'] <= sell_threshold, 'signal'] = -1

    # Shift to prevent lookahead bias
    df['position'] = df['signal'].shift(1).fillna(0)
    
    # Simulate trades
    balance = initial_balance
    tokens = 0
    in_position = False
    entry_price = 0
    entry_time = None
    
    trades = []
    equity_curve = []
    bh_equity_curve = []
    markers = []
    
    initial_price = df.iloc[0]['open']
    if initial_price == 0: initial_price = 1
    bh_tokens = initial_balance / initial_price

    for index, row in df.iterrows():
        price = row['open']
        if price == 0: continue
            
        current_date = index.isoformat() if hasattr(index, 'isoformat') else str(index)
        
        # Check signal changes
        pos = row['position']
        
        if pos == 1 and not in_position:
            # Buy
            fee = balance * fee_rate
            tokens = (balance - fee) / price
            balance = 0
            in_position = True
            entry_price = price
            entry_time = current_date
            
            markers.append({
                "time": current_date,
                "position": "belowBar",
                "color": "#22C55E",
                "shape": "arrowUp",
                "text": "Buy"
            })
            
        elif pos == -1 and in_position:
            # Sell
            gross = tokens * price
            fee = gross * fee_rate
            balance = gross - fee
            
            pnl_pct = ((balance - (entry_price * tokens)) / (entry_price * tokens)) * 100 if (entry_price * tokens) > 0 else 0
            trades.append({
                "entryDate": entry_time,
                "entryPrice": entry_price,
                "exitDate": current_date,
                "exitPrice": price,
                "pnlPct": pnl_pct,
                "duration": 0 # We can calculate later if needed
            })
            
            tokens = 0
            in_position = False
            
            markers.append({
                "time": current_date,
                "position": "aboveBar",
                "color": "#EF4444",
                "shape": "arrowDown",
                "text": "Sell"
            })
            
        # Record equity
        current_equity = balance + (tokens * price)
        equity_curve.append({"time": current_date, "value": current_equity})
        
        bh_equity = bh_tokens * price
        bh_equity_curve.append({"time": current_date, "value": bh_equity})

    # Close open position at end
    if in_position:
        last_price = df.iloc[-1]['close']
        gross = tokens * last_price
        fee = gross * fee_rate
        balance = gross - fee
        current_equity = balance
        pnl_pct = ((balance - (entry_price * tokens)) / (entry_price * tokens)) * 100 if (entry_price * tokens) > 0 else 0
        trades.append({
            "entryDate": entry_time,
            "entryPrice": entry_price,
            "exitDate": df.index[-1].isoformat() if hasattr(df.index[-1], 'isoformat') else str(df.index[-1]),
            "exitPrice": last_price,
            "pnlPct": pnl_pct,
            "duration": 0
        })

    # Calculate metrics
    final_equity = current_equity
    net_return_pct = ((final_equity - initial_balance) / initial_balance) * 100
    
    total_trades = len(trades)
    winning_trades = [t for t in trades if t['pnlPct'] > 0]
    win_rate = (len(winning_trades) / total_trades * 100) if total_trades > 0 else 0
    
    gross_profit = sum(t['pnlPct'] for t in winning_trades)
    gross_loss = abs(sum(t['pnlPct'] for t in trades if t['pnlPct'] < 0))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else (gross_profit if gross_profit > 0 else 0)
    
    # Drawdown
    equity_series = pd.Series([x["value"] for x in equity_curve])
    peak = equity_series.cummax()
    drawdown = (peak - equity_series) / peak * 100
    max_drawdown = drawdown.max() if not drawdown.empty else 0
    
    # Sharpe (approximate, daily returns)
    returns = equity_series.pct_change().dropna()
    sharpe = 0
    sortino = 0
    if not returns.empty and returns.std() != 0:
        sharpe = (returns.mean() / returns.std()) * np.sqrt(365)
        downside = returns[returns < 0]
        if not downside.empty and downside.std() != 0:
            sortino = (returns.mean() / downside.std()) * np.sqrt(365)
            
    # CAGR approximation
    days = (df.index[-1] - df.index[0]).days if len(df) > 1 else 1
    if days == 0: days = 1
    cagr = ((final_equity / initial_balance) ** (365.0 / days) - 1) * 100 if final_equity > 0 else 0

    return {
        "metrics": {
            "netReturn": net_return_pct,
            "cagr": cagr,
            "sharpe": sharpe,
            "sortino": sortino,
            "maxDrawdown": max_drawdown,
            "winRate": win_rate,
            "profitFactor": profit_factor,
            "totalTrades": total_trades,
            "totalFees": initial_balance * fee_rate * total_trades * 2 # rough approx
        },
        "equityCurve": equity_curve,
        "bhEquityCurve": bh_equity_curve,
        "markers": markers,
        "trades": trades
    }
