import { NextResponse } from 'next/server';

export const revalidate = 300; // cache 5 minutes (F&G doesn't change often)

export async function GET() {
  try {
    const response = await fetch('https://api.alternative.me/fng/?limit=1', {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Fear & Greed API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      throw new Error('No data from Fear & Greed API');
    }

    const entry = data.data[0];
    const value = parseInt(entry.value, 10);
    const classification = entry.value_classification;

    // Map English classification to Spanish
    let labelES: string;
    switch (classification) {
      case 'Extreme Fear': labelES = 'Miedo Extremo'; break;
      case 'Fear': labelES = 'Miedo'; break;
      case 'Neutral': labelES = 'Neutral'; break;
      case 'Greed': labelES = 'Codicia'; break;
      case 'Extreme Greed': labelES = 'Codicia Extrema'; break;
      default: labelES = 'Neutral';
    }

    return NextResponse.json({
      value,
      classification,
      classificationES: labelES,
      timestamp: entry.timestamp,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Fear & Greed proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Fear & Greed Index' },
      { status: 502 }
    );
  }
}
