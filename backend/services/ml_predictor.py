import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from typing import Dict, Any

class CryptoPredictor:
    """
    Lightweight ML Predictor using RandomForest.
    In a real environment, this model would be pre-trained and saved using joblib.
    For this implementation, we train it dynamically on the fly using the last N candles
    to predict the probability of the NEXT candle closing higher.
    """
    def __init__(self, n_estimators=50, max_depth=5):
        self.model = RandomForestClassifier(
            n_estimators=n_estimators, 
            max_depth=max_depth, 
            random_state=42,
            n_jobs=-1
        )
        self.is_trained = False

    def _prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Extract features for the model."""
        features = pd.DataFrame(index=df.index)
        
        # Price action features
        features['returns'] = df['close'].pct_change()
        features['volatility'] = df['close'].rolling(10).std()
        
        # We need indicator data, but to keep it simple and independent,
        # we calculate some quick features here or use raw OHLCV
        features['body'] = (df['close'] - df['open']) / df['open']
        features['upper_shadow'] = (df['high'] - df[['open', 'close']].max(axis=1)) / df['open']
        features['lower_shadow'] = (df[['open', 'close']].min(axis=1) - df['low']) / df['open']
        
        # Volume features
        if 'volume' in df.columns:
            features['vol_change'] = df['volume'].pct_change()
            features['vol_ma_ratio'] = df['volume'] / df['volume'].rolling(10).mean()
            
        # Indicator Features (giving the ML model "vision")
        import pandas_ta as ta
        try:
            features['rsi'] = ta.rsi(df['close'], length=14)
            macd = ta.macd(df['close'])
            if macd is not None and not macd.empty:
                features['macd_hist'] = macd.iloc[:, 1] # Histogram
            else:
                features['macd_hist'] = 0.0
            
            # EMA Distance (Trend indicator)
            ema50 = ta.ema(df['close'], length=50)
            features['ema_dist'] = (df['close'] - ema50) / ema50
        except Exception:
            # Fallback if pandas-ta fails for any reason
            features['rsi'] = 50.0
            features['macd_hist'] = 0.0
            features['ema_dist'] = 0.0
            
        # Lags
        for i in range(1, 4):
            features[f'return_lag_{i}'] = features['returns'].shift(i)
            
        return features

    def train(self, df: pd.DataFrame):
        """Train the model to predict the next candle direction."""
        if len(df) < 100:
            return False
            
        features = self._prepare_features(df)
        
        # Target: 1 if next close > current close, else 0
        target = (df['close'].shift(-1) > df['close']).astype(int)
        
        # Drop NaNs (from shifts/rolling)
        valid_idx = features.dropna().index
        
        # Exclude the very last row for training because its target is NaN (we don't know the future yet)
        valid_idx = valid_idx[:-1]
        
        X = features.loc[valid_idx]
        y = target.loc[valid_idx]
        
        if len(X) < 50:
            return False
            
        self.model.fit(X, y)
        self.is_trained = True
        return True

    def predict(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Predict the probability for the current (next) candle."""
        if not self.is_trained or len(df) < 20:
            return {"prediction": "neutral", "confidence": 50.0, "probabilities": {"up": 0.5, "down": 0.5}}
            
        features = self._prepare_features(df)
        
        # Get the latest row for prediction
        latest_features = features.iloc[[-1]]
        
        # If there are NaNs in the latest row (e.g. not enough history), return neutral
        if latest_features.isna().any().any():
            return {"prediction": "neutral", "confidence": 50.0, "probabilities": {"up": 0.5, "down": 0.5}}
            
        probs = self.model.predict_proba(latest_features)[0]
        # In scikit-learn, classes_ are sorted, so [0] is class 0 (down), [1] is class 1 (up)
        # However, check classes_ to be sure
        classes = list(self.model.classes_)
        
        if 1 in classes:
            idx_up = classes.index(1)
            prob_up = probs[idx_up]
        else:
            prob_up = 0.0
            
        prob_down = 1.0 - prob_up
        
        prediction = "up" if prob_up > 0.55 else "down" if prob_down > 0.55 else "sideways"
        confidence = max(prob_up, prob_down) * 100
        
        return {
            "prediction": prediction,
            "confidence": round(confidence, 2),
            "probabilities": {
                "up": round(prob_up, 2),
                "down": round(prob_down, 2),
                "sideways": round(1.0 - (prob_up if prediction == "up" else prob_down), 2) if prediction == "sideways" else 0.0
            }
        }

def predict_direction(df: pd.DataFrame) -> Dict[str, Any]:
    """Helper function to train and predict on the fly."""
    try:
        # Create a local instance to avoid race conditions in async requests
        local_predictor = CryptoPredictor()
        local_predictor.train(df)
        return local_predictor.predict(df)
    except Exception as e:
        print(f"[ML] Error in prediction: {e}")
        return {"prediction": "neutral", "confidence": 50.0, "probabilities": {"up": 0.5, "down": 0.5}}
