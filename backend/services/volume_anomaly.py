import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from typing import Dict, Any

def detect_volume_anomaly(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Detect anomalous volume spikes using IsolationForest and Z-Score.
    Useful for detecting whale entries/exits.
    """
    if len(df) < 50 or 'volume' not in df.columns:
        return {"anomaly": False, "score": 0.0, "description": "Not enough data"}

    # Extract volume
    X = df[['volume']].values
    
    # Train IsolationForest
    iso = IsolationForest(contamination=0.05, random_state=42)
    iso.fit(X)
    
    # Predict for the last candle
    last_v = X[-1].reshape(1, -1)
    is_anomaly = iso.predict(last_v)[0] == -1
    score = iso.decision_function(last_v)[0]
    
    # Also calculate simple Z-Score for easier interpretation
    vol_mean = df['volume'].rolling(20).mean().iloc[-2]
    vol_std = df['volume'].rolling(20).std().iloc[-2]
    current_vol = df['volume'].iloc[-1]
    
    z_score = 0.0
    if vol_std > 0:
        z_score = (current_vol - vol_mean) / vol_std
        
    is_spike = z_score > 2.5
    
    if is_anomaly or is_spike:
        ratio = (current_vol / vol_mean) * 100 if vol_mean > 0 else 0
        desc = f"Volumen anormal detectado: {ratio:.0f}% sobre la media (Z-Score: {z_score:.1f})"
        return {"anomaly": True, "score": round(z_score, 2), "description": desc, "ratio": round(ratio, 2)}
        
    return {"anomaly": False, "score": round(z_score, 2), "description": "Volumen normal", "ratio": 100.0}
