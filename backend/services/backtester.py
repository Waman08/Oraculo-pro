import pandas as pd
import numpy as np
import pandas_ta as ta
from typing import Dict, Any

def calculate_drawdown(equity_curve):
    peak = equity_curve.expanding(min_periods=1).max()
    drawdown = (equity_curve - peak) / peak
    return drawdown.min()

def run_backtest(df: pd.DataFrame, initial_balance: float = 10000.0) -> dict:
    """
    Simulación histórica utilizando una aproximación del Quant Score del Oráculo.
    Limitado a los últimos 90 días (3 meses) para eficiencia en tiempo real.
    """
    if df is None or df.empty or len(df) < 50:
        return {"error": "Not enough data for backtesting."}
        
    df = df.copy()
    
    # Calcular Indicadores (Aproximación Vectorizada del Quant Score)
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

    # Llenar nulos
    df = df.fillna(0)

    # Limitar a los últimos 100 periodos para mayor velocidad Y DESPUÉS de calcular indicadores
    if len(df) > 100:
        df = df.iloc[-100:].copy()

    df = df.fillna(0)

    # Generar Señales (Score Proxy > 60 = Compra, < 40 = Venta)
    # 1. RSI Score (0 a 100)
    # 2. MACD Trend (Bullish = 1, Bearish = 0)
    # 3. EMA Trend (Bullish = 1, Bearish = 0)
    
    df['rsi_score'] = df['rsi'].clip(0, 100)
    df['macd_bull'] = (df['macd'] > df['macd_signal']).astype(int) * 100
    df['ema_bull'] = (df['ema_short'] > df['ema_long']).astype(int) * 100
    
    # Quant Score Proxy (Promedio ponderado simple)
    df['quant_score_proxy'] = (df['rsi_score'] * 0.4) + (df['macd_bull'] * 0.3) + (df['ema_bull'] * 0.3)

    # Reglas de Entrada/Salida
    df['signal'] = 0
    df.loc[df['quant_score_proxy'] > 60, 'signal'] = 1
    df.loc[df['quant_score_proxy'] < 40, 'signal'] = -1

    # Operar en la próxima vela para evitar look-ahead bias
    df['position'] = df['signal'].shift(1)
    df['position'] = df['position'].replace(0, pd.NA).ffill().fillna(0)

    # Calcular retornos y equity curve
    df['log_ret'] = np.log(df['close'] / df['close'].shift(1)).fillna(0)
    df['strategy_ret'] = df['position'] * df['log_ret']
    
    df['strategy_ret'] = df['strategy_ret'].astype(float)
    df['equity_curve'] = initial_balance * np.exp(df['strategy_ret'].cumsum())
    
    # Extraer Serie Temporal de la Curva de Capital (para Lightweight Charts)
    equity_series = []
    for date, row in df.iterrows():
        # date puede ser string o datetime
        ts = date if isinstance(date, str) else date.strftime('%Y-%m-%d')
        equity_series.append({
            "time": ts,
            "value": round(float(row['equity_curve']), 2)
        })
    
    # Extraer Operaciones (Trades)
    trades = []
    in_position = False
    entry_price = 0.0
    entry_time = None

    for idx, row in df.iterrows():
        ts_str = idx if isinstance(idx, str) else idx.strftime('%Y-%m-%d %H:%M:%S')
        
        if row['position'] == 1 and not in_position:
            in_position = True
            entry_price = row['open']
            entry_time = ts_str
        elif row['position'] <= 0 and in_position:
            in_position = False
            exit_price = row['open']
            exit_time = ts_str
            
            if entry_price > 0:
                pnl = (exit_price - entry_price) / entry_price
                trades.append({
                    "entry_time": entry_time,
                    "exit_time": exit_time,
                    "entry_price": float(entry_price),
                    "exit_price": float(exit_price),
                    "pnl_percent": float(pnl * 100)
                })

    # Cerrar posición al final si quedó abierta
    if in_position and entry_price > 0:
        exit_price = df.iloc[-1]['close']
        ts_str = df.index[-1] if isinstance(df.index[-1], str) else df.index[-1].strftime('%Y-%m-%d %H:%M:%S')
        pnl = (exit_price - entry_price) / entry_price
        trades.append({
            "entry_time": entry_time,
            "exit_time": ts_str,
            "entry_price": float(entry_price),
            "exit_price": float(exit_price),
            "pnl_percent": float(pnl * 100)
        })

    # Calcular Métricas
    win_rate = 0.0
    if trades:
        winning_trades = sum(1 for t in trades if t['pnl_percent'] > 0)
        win_rate = winning_trades / len(trades)

    final_balance = float(df['equity_curve'].iloc[-1])
    total_return = (final_balance - initial_balance) / initial_balance
    max_drawdown = float(calculate_drawdown(df['equity_curve']))
    
    # Sharpe Ratio
    daily_returns = np.exp(df['strategy_ret'].replace(0, np.nan).dropna()) - 1
    if len(daily_returns) > 0 and pd.notna(daily_returns.std()) and daily_returns.std() != 0:
        sharpe_ratio = float((daily_returns.mean()) / daily_returns.std() * np.sqrt(365))
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
        "trades": trades,
        "equity_curve": equity_series
    }
