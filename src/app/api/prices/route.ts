import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  const singleSymbol = searchParams.get('symbol');

  try {
    let url: string;

    if (singleSymbol) {
      // Single ticker
      url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${singleSymbol}USDT`;
    } else if (symbolsParam) {
      // Multiple tickers
      const symbols = symbolsParam.split(',').map(s => `"${s.trim().toUpperCase()}USDT"`);
      url = `https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols.join(',')}]`;
    } else {
      return NextResponse.json(
        { error: 'Missing symbols or symbol parameter' },
        { status: 400 }
      );
    }

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 15 },
    });

    if (!response.ok) {
      throw new Error(`Binance API returned ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('Binance proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices from Binance' },
      { status: 502 }
    );
  }
}
