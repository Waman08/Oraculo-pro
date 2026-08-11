import random
import time

TOKENS = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE"]
EXCHANGES = ["Binance", "Coinbase", "Kraken", "OKX", "Bybit", "Unknown Wallet"]

async def get_recent_whale_movements(limit: int = 5):
    """
    Simulates fetching recent large transactions (Whale movements > $1M).
    """
    movements = []
    for _ in range(limit):
        token = random.choice(TOKENS)
        amount_usd = random.uniform(1_000_000, 50_000_000)
        
        # Rough price estimation to get token amount
        prices = {"BTC": 65000, "ETH": 3500, "SOL": 150, "XRP": 0.6, "ADA": 0.45, "DOGE": 0.15}
        token_price = prices.get(token, 1.0)
        token_amount = amount_usd / token_price
        
        from_entity = random.choice(EXCHANGES)
        to_entity = random.choice(EXCHANGES)
        while from_entity == to_entity:
            to_entity = random.choice(EXCHANGES)
            
        movements.append({
            "id": f"tx_{random.randint(100000, 999999)}",
            "token": token,
            "amount_tokens": round(token_amount, 2),
            "amount_usd": round(amount_usd, 2),
            "from_address": from_entity,
            "to_address": to_entity,
            "timestamp": int(time.time()) - random.randint(10, 3600),
        })
        
    # Sort by timestamp descending
    movements.sort(key=lambda x: x["timestamp"], reverse=True)
    return movements
