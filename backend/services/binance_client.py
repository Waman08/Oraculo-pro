# ============================================================
# BINANCE CLIENT — Fetch OHLCV klines and ticker data
# ============================================================

import json

import httpx
import pandas as pd
from typing import Optional, Dict, Tuple

# Symbol → Binance pair mapping (Will be populated dynamically)
BINANCE_PAIR_MAP: Dict[str, str] = {}
REVERSE_PAIR_MAP: Dict[str, str] = {}

# Timeframe map from frontend to Binance intervals
TIMEFRAME_MAP = {
    "1S": "1w", "1W": "1w", "1w": "1w",
    "1D": "1d", "1d": "1d",
    "4H": "4h", "4h": "4h",
    "1H": "1h", "1h": "1h",
    "15M": "15m", "15m": "15m",
}

# Crypto name lookup
CRYPTO_NAMES: Dict[str, str] = {
    "BTC": "Bitcoin", "ETH": "Ethereum", "BNB": "BNB", "SOL": "Solana",
    "XRP": "Ripple", "ADA": "Cardano", "AVAX": "Avalanche", "DOT": "Polkadot",
    "LINK": "Chainlink", "MATIC": "Polygon", "UNI": "Uniswap", "ATOM": "Cosmos",
    "FIL": "Filecoin", "APT": "Aptos", "ARB": "Arbitrum", "OP": "Optimism",
    "INJ": "Injective", "SUI": "Sui", "NEAR": "NEAR Protocol", "DOGE": "Dogecoin",
    "SHIB": "Shiba Inu", "PEPE": "Pepe", "WIF": "dogwifhat", "FLOKI": "Floki",
    "BONK": "Bonk", "AAVE": "Aave", "MKR": "Maker", "CRV": "Curve DAO",
    "LDO": "Lido DAO", "RENDER": "Render", "FET": "Fetch.AI", "RNDR": "Render Token",
    "TAO": "Bittensor", "IMX": "Immutable", "GALA": "Gala", "AXS": "Axie Infinity",
    "SAND": "The Sandbox", "MANA": "Decentraland", "FLOW": "Flow",
    "EIGEN": "EigenLayer", "SEI": "Sei", "STRK": "Starknet", "TIA": "Celestia",
    "ALGO": "Algorand", "VET": "VeChain", "HBAR": "Hedera", "FTM": "Fantom",
    "RUNE": "THORChain", "DYDX": "dYdX", "SNX": "Synthetix",
}

BASE_URL = "https://data-api.binance.vision/api/v3"

async def init_binance_symbols():
    """
    Fetch all active USDT pairs from Binance and populate the mappings dynamically.
    """
    global BINANCE_PAIR_MAP, REVERSE_PAIR_MAP
    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            resp = await client.get(f"{BASE_URL}/exchangeInfo")
            resp.raise_for_status()
            data = resp.json()
            
            new_map = {}
            for s in data.get("symbols", []):
                # Only use active USDT pairs
                if s["status"] == "TRADING" and s["quoteAsset"] == "USDT":
                    # Avoid leveraged tokens (like BTCUP, BTCDOWN) if we want, but let's keep it simple
                    base = s["baseAsset"]
                    symbol = s["symbol"]
                    new_map[base] = symbol
            
            if new_map:
                BINANCE_PAIR_MAP.clear()
                BINANCE_PAIR_MAP.update(new_map)
                REVERSE_PAIR_MAP.clear()
                REVERSE_PAIR_MAP.update({v: k for k, v in BINANCE_PAIR_MAP.items()})
                print(f"[OK] Binance symbols loaded: {len(BINANCE_PAIR_MAP)} pairs found.")
    except Exception as e:
        print(f"[ERROR] Failed to fetch Binance symbols: {e}")


async def fetch_klines(
    symbol: str,
    timeframe: str = "1D",
    limit: int = 250,
) -> Optional[pd.DataFrame]:
    """
    Fetch OHLCV klines from Binance and return as a DataFrame.
    Returns None if the symbol is not supported or the request fails.
    """
    pair = BINANCE_PAIR_MAP.get(symbol.upper())
    if not pair:
        return None

    interval = TIMEFRAME_MAP.get(timeframe, "1d")

    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            resp = await client.get(
                f"{BASE_URL}/klines",
                params={"symbol": pair, "interval": interval, "limit": limit},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        print(f"[Binance] Error fetching klines for {symbol}: {e}")
        return None

    if not data:
        return None

    df = pd.DataFrame(data, columns=[
        "open_time", "open", "high", "low", "close", "volume",
        "close_time", "quote_volume", "trades", "taker_buy_base",
        "taker_buy_quote", "ignore",
    ])

    # Convert to numeric
    for col in ["open", "high", "low", "close", "volume", "quote_volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms")
    df.set_index("open_time", inplace=True)

    return df


async def fetch_dexscreener_ticker(symbol: str) -> Optional[Dict]:
    """
    Fetch live price from DexScreener for non-Binance tokens.
    Supports contract address search or simple token symbol search.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            resp = await client.get(
                "https://api.dexscreener.com/latest/dex/search",
                params={"q": symbol},
            )
            resp.raise_for_status()
            data = resp.json()
            pairs = data.get("pairs", [])
            if not pairs:
                return None
            
            # Find the best matching pair
            # If symbol is a contract address, any pair is fine
            is_contract = symbol.startswith("0x") or len(symbol) > 25
            
            best_pair = None
            if is_contract:
                best_pair = pairs[0]
            else:
                # Find pair where baseToken symbol matches
                for p in pairs:
                    if p.get("baseToken", {}).get("symbol", "").upper() == symbol.upper():
                        best_pair = p
                        break
                if not best_pair:
                    best_pair = pairs[0]  # Fallback to first search result
            
            price_usd = float(best_pair.get("priceUsd", 0))
            change_24h = float(best_pair.get("priceChange", {}).get("h24", 0) or 0)
            volume_24h = float(best_pair.get("volume", {}).get("h24", 0) or 0)
            
            return {
                "price": price_usd,
                "priceChange24h": change_24h,
                "volume24h": volume_24h,
                "source": "dexscreener",
            }
    except Exception as e:
        print(f"[DexScreener] Error fetching price for {symbol}: {e}")
        return None


async def fetch_ticker(symbol: str) -> Optional[Dict]:
    """
    Fetch 24hr ticker data for a single symbol.
    Returns dict with price, priceChange24h, volume24h or None.
    Attempts Binance first, then falls back to DexScreener.
    """
    symbol_upper = symbol.upper()
    pair = BINANCE_PAIR_MAP.get(symbol_upper)
    if pair:
        try:
            async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
                resp = await client.get(
                    f"{BASE_URL}/ticker/24hr",
                    params={"symbol": pair},
                )
                resp.raise_for_status()
                data = resp.json()
            return {
                "price": float(data["lastPrice"]),
                "priceChange24h": float(data["priceChangePercent"]),
                "volume24h": float(data["quoteVolume"]),
                "source": "binance",
            }
        except Exception:
            pass

    # Fallback to DexScreener
    return await fetch_dexscreener_ticker(symbol_upper)


async def fetch_all_tickers() -> Dict[str, Dict]:
    """
    Fetch 24hr ticker data for ALL supported symbols in one batch request.
    Fetches all tickers from Binance and filters locally to avoid URL length limits.
    Returns dict mapping our symbol -> {price, priceChange24h, volume24h}.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            # Fetch ALL tickers (no symbols param) to avoid URL length issues with 1000+ pairs
            resp = await client.get(f"{BASE_URL}/ticker/24hr")
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        print(f"[Binance] Error fetching all tickers: {e}")
        return {}

    result = {}
    for ticker in data:
        sym = REVERSE_PAIR_MAP.get(ticker["symbol"])
        if sym:
            try:
                result[sym] = {
                    "price": float(ticker["lastPrice"]),
                    "priceChange24h": float(ticker["priceChangePercent"]),
                    "volume24h": float(ticker["quoteVolume"]),
                }
            except (ValueError, TypeError, KeyError):
                continue

    return result


def is_supported(symbol: str) -> bool:
    return symbol.upper() in BINANCE_PAIR_MAP


def get_name(symbol: str) -> str:
    return CRYPTO_NAMES.get(symbol.upper(), symbol.upper())
