import { NextResponse } from 'next/server';

export const revalidate = 30; // cache 30 seconds

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');       // CoinGecko ID (e.g., "hyperliquid")
  const ids = searchParams.get('ids');     // Comma-separated IDs for batch

  try {
    const coinIds = ids || id;
    if (!coinIds) {
      return NextResponse.json(
        { error: 'Missing id or ids parameter' },
        { status: 400 }
      );
    }

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinIds)}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API returned ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('CoinGecko proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from CoinGecko' },
      { status: 502 }
    );
  }
}
