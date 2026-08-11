import random
from typing import Dict, Any

def analyze_social_sentiment(symbol: str, price_momentum: float) -> Dict[str, Any]:
    """
    Simulates NLP sentiment analysis from CryptoTwitter and Reddit.
    In a production environment, this would use Tweepy/PRAW and a FinBERT model.
    """
    # Simulate based on momentum to make it realistic
    base_score = 50 + (price_momentum * 10)  # price_momentum is expected between -5 and 5
    score = max(10, min(90, base_score + random.uniform(-10, 10)))
    
    if score > 65:
        label = "Bullish"
        topics = ["Accumulation", "Partnership", "Breakout"]
    elif score < 35:
        label = "Bearish"
        topics = ["FUD", "Selloff", "Regulation"]
    else:
        label = "Neutral"
        topics = ["Consolidation", "Wait and see", "Low volume"]
        
    mentions = random.randint(100, 5000)
    
    return {
        "score": round(score, 1),
        "label": label,
        "mentions_24h": mentions,
        "trending_topics": random.sample(topics, 2)
    }
