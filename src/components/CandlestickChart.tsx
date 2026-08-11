"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { fetchKlines } from '@/lib/api';
import { useAppSettings } from './AppContext';
import { useAppStore } from '@/lib/store';

interface CandlestickChartProps {
  symbol: string;
}

export default function CandlestickChart({ symbol }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  
  const [loading, setLoading] = useState(true);
  const { timeframe } = useAppSettings();

  // Convert timeframe to Binance interval
  const getInterval = (tf: string) => {
    switch(tf) {
      case '1S': return '1w';
      case '1D': return '1d';
      case '4H': return '4h';
      case '1H': return '1h';
      case '15M': return '15m';
      default: return '1d';
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid' as any, color: 'transparent' },
        textColor: '#94A3B8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 0,
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      autoSize: true,
    });
    
    chartRef.current = chart;

    // Add Candlestick Series
    const candlestickSeries = (chart as any).addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });
    seriesRef.current = candlestickSeries;

    // Add Volume Series
    const volumeSeries = (chart as any).addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', 
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // Fetch and Set Data
    const loadData = async () => {
      setLoading(true);
      const interval = getInterval(timeframe);
      const klines = await fetchKlines(symbol, interval, 200);
      
      if (klines && klines.length > 0) {
        const cData = klines.map((k: any) => ({
          time: (k[0] / 1000) as Time,
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
        }));
        
        const vData = klines.map((k: any) => ({
          time: (k[0] / 1000) as Time,
          value: parseFloat(k[5]),
          color: parseFloat(k[4]) >= parseFloat(k[1]) ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
        }));

        candlestickSeries.setData(cData);
        volumeSeries.setData(vData);
      }
      setLoading(false);
    };

    loadData();

    // Resize Observer
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [symbol, timeframe]);

  return (
    <div className="w-full h-full relative min-h-[280px] h-[350px] glass-card overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-gold"></div>
        </div>
      )}
      {!loading && (!seriesRef.current || chartContainerRef.current?.childNodes.length === 0) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 z-10 backdrop-blur-sm text-[#94A3B8]">
          <div className="text-4xl mb-2">📊</div>
          <div className="text-sm font-semibold">Datos del gráfico no disponibles</div>
          <div className="text-xs opacity-60">No se pudieron cargar velas de este activo</div>
        </div>
      )}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
         <div className="font-bold text-lg">{symbol}</div>
         <div className="text-sm text-gray-400 bg-black/40 px-2 py-1 rounded">{timeframe}</div>
      </div>
      <div className="absolute inset-0 pt-14 pb-4 px-4">
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
