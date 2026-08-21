"use client";

import { useEffect, useRef } from 'react';
import { createChart, ColorType, ISeriesApi, SeriesType } from 'lightweight-charts';

export type ChartSeriesType = 'Line' | 'Area' | 'Histogram';

interface DataPoint {
  time: string;
  value: number;
}

interface OnChainChartProps {
  data: DataPoint[];
  symbol: string;
  title: string;
  type?: ChartSeriesType;
  color?: string;
  baseline?: number; // e.g. 1.0 for SOPR
  overlayPrice?: boolean; // Draw price behind the metric
}

export default function OnChainChart({
  data,
  symbol,
  title,
  type = 'Line',
  color = '#22c55e',
  baseline,
  overlayPrice = true
}: OnChainChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  
  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;
    
    // Sort and deduplicate data by time to prevent lightweight-charts errors
    const uniqueData = Array.from(new Map(data.map(item => [item.time, item])).values())
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af', // var(--text-muted)
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
    });

    chartRef.current = chart;

    let series;
    if (type === 'Area') {
      series = chart.addAreaSeries({
        lineColor: color,
        topColor: `${color}80`, // 50% opacity
        bottomColor: `${color}00`, // 0% opacity
        lineWidth: 2,
      });
    } else if (type === 'Histogram') {
      series = chart.addHistogramSeries({
        color: color,
      });
      // For histogram, map values to colors if needed (e.g. green for positive, red for negative)
      uniqueData.forEach((d: any) => {
        d.color = d.value >= 0 ? '#22c55e' : '#ef4444';
      });
    } else {
      series = chart.addLineSeries({
        color: color,
        lineWidth: 2,
      });
    }

    series.setData(uniqueData as any);
    seriesRef.current = series;

    // Add baseline if requested (like SOPR = 1.0)
    if (baseline !== undefined) {
      series.createPriceLine({
        price: baseline,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: 'Base',
      });
    }

    window.addEventListener('resize', handleResize);
    
    // Fit content
    chart.timeScale().fitContent();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [data, type, color, baseline]);

  return (
    <div className="glass-card p-6 w-full flex flex-col relative h-[400px]">
      <h3 className="text-lg font-bold mb-4 text-[var(--text-primary)]">{title}</h3>
      <div 
        ref={chartContainerRef} 
        className="flex-1 w-full"
      />
    </div>
  );
}
