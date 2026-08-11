import os
from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from typing import List, Dict, Any

from services.analyzer import run_analysis
from services.binance_client import fetch_all_tickers

router = APIRouter(prefix="/v1", tags=["Public API"])

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

# Mocked API keys for Demo (In production, these would be in DB/Supabase)
VALID_API_KEYS = {
    "demo_pro_key": "pro",
    "demo_elite_key": "elite",
}

def get_api_key(api_key_header: str = Security(API_KEY_HEADER)):
    if api_key_header in VALID_API_KEYS:
        return api_key_header
    raise HTTPException(status_code=403, detail="Invalid API Key. Upgrade to Pro/Elite tier.")


@router.get("/analyze")
async def public_analyze(symbol: str, timeframe: str = "1h", api_key: str = Depends(get_api_key)):
    """
    Get full quantitative analysis and ML predictions for a symbol.
    Requires Pro/Elite API Key.
    """
    try:
        res = await run_analysis(symbol, timeframe, "Balanceado")
        if not res:
            raise HTTPException(status_code=404, detail="Symbol not found or data error")
        return {
            "status": "success",
            "symbol": symbol,
            "data": res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/screener")
async def public_screener(api_key: str = Depends(get_api_key)):
    """
    Get market screener data for top crypto pairs.
    """
    tickers = await fetch_all_tickers()
    if not tickers:
        raise HTTPException(status_code=500, detail="Failed to fetch market data")
    
    # Just returning a simplified mock summary for API speed
    # In production, we'd run mini-analysis on all
    summary = []
    for t in list(tickers.values())[:20]:  # Limit to 20 for public API demo
        summary.append({
            "symbol": t.get("symbol"),
            "price": t.get("lastPrice"),
            "change24h": t.get("priceChangePercent")
        })
    return {
        "status": "success",
        "market": summary
    }

@router.get("/signals")
async def public_signals(api_key: str = Depends(get_api_key)):
    """
    Get active buy/sell signals for the market.
    """
    return {
        "status": "success",
        "message": "Public signals endpoint is under development."
    }
