import pandas as pd
import numpy as np
import pandas_ta as ta

def calculate_drawdown(equity_curve):
    peak = equity_curve.expanding(min_periods=1).max()
    drawdown = (equity_curve - peak) / peak
    return drawdown.min()

def run_backtest(df: pd.DataFrame, initial_balance: float = 10000.0) -> dict:
    """
    Run a simulated trading strategy (EMA 9 and EMA 21 Crossover).
    
    Returns a dictionary with professional metrics:
    - Total Return
    - Max Drawdown
    - Win Rate
    - Sharpe Ratio
    - Trade History
    """
    if df is None or df.empty or len(df) < 21:
        return {
            "error": "Not enough data for backtesting."
        }
        
    df = df.copy()

    # Calculate indicators
    df['ema_short'] = ta.ema(df['close'], length=9)
    df['ema_long'] = ta.ema(df['close'], length=21)

    # Generate signals
    df['signal'] = 0
    # Buy when short EMA crosses above long EMA
    df.loc[df['ema_short'] > df['ema_long'], 'signal'] = 1
    # Sell when short EMA crosses below long EMA
    df.loc[df['ema_short'] < df['ema_long'], 'signal'] = -1

    # To avoid look-ahead bias, we trade on the next open after a signal change
    df['position'] = df['signal'].shift(1)
    # Forward fill positions to stay in the trade
    df['position'] = df['position'].replace(0, pd.NA).ffill()
    df['position'] = df['position'].fillna(0)

    # Calculate returns
    df['log_ret'] = np.log(df['close'] / df['close'].shift(1))
    df['strategy_ret'] = df['position'] * df['log_ret']
    
    # Calculate cumulative equity
    df['strategy_ret'] = df['strategy_ret'].astype(float)
    df['equity_curve'] = initial_balance * np.exp(df['strategy_ret'].cumsum())
    
    # Extract trades
    trades = []
    in_position = False
    entry_price = 0.0
    entry_time = None

    for idx, row in df.iterrows():
        # Detect buy
        if row['position'] == 1 and not in_position:
            in_position = True
            entry_price = row['open']
            entry_time = idx
        
        # Detect sell or close position
        elif row['position'] <= 0 and in_position:
            in_position = False
            exit_price = row['open']
            exit_time = idx
            
            pnl = (exit_price - entry_price) / entry_price
            trades.append({
                "entry_time": entry_time.strftime('%Y-%m-%d %H:%M:%S'),
                "exit_time": exit_time.strftime('%Y-%m-%d %H:%M:%S'),
                "entry_price": float(entry_price),
                "exit_price": float(exit_price),
                "pnl_percent": float(pnl * 100)
            })

    # Close open position at the end
    if in_position:
        exit_price = df.iloc[-1]['close']
        exit_time = df.index[-1]
        pnl = (exit_price - entry_price) / entry_price
        trades.append({
            "entry_time": entry_time.strftime('%Y-%m-%d %H:%M:%S'),
            "exit_time": exit_time.strftime('%Y-%m-%d %H:%M:%S'),
            "entry_price": float(entry_price),
            "exit_price": float(exit_price),
            "pnl_percent": float(pnl * 100)
        })

    # Calculate metrics
    if not trades:
        win_rate = 0.0
    else:
        winning_trades = sum(1 for t in trades if t['pnl_percent'] > 0)
        win_rate = winning_trades / len(trades)

    final_balance = float(df['equity_curve'].iloc[-1])
    total_return = (final_balance - initial_balance) / initial_balance
    
    max_drawdown = float(calculate_drawdown(df['equity_curve']))
    
    # Sharpe Ratio (annualized, assuming daily data for simplicity in scaling factor, 
    # but we'll use a standard calculation over the strategy returns)
    risk_free_rate = 0.0
    daily_returns = np.exp(df['strategy_ret'].dropna()) - 1
    if pd.notna(daily_returns.std()) and daily_returns.std() != 0:
        # standard 365 trading days for crypto daily timeframe scaling
        sharpe_ratio = float((daily_returns.mean() - risk_free_rate) / daily_returns.std() * np.sqrt(365))
    else:
        sharpe_ratio = 0.0

    return {
        "metrics": {
            "total_return_percent": round(total_return * 100, 2),
            "max_drawdown_percent": round(max_drawdown * 100, 2),
            "win_rate_percent": round(win_rate * 100, 2),
            "sharpe_ratio": round(sharpe_ratio, 2),
            "initial_balance": initial_balance,
            "final_balance": round(final_balance, 2),
            "total_trades": len(trades)
        },
        "trades": trades
    }
