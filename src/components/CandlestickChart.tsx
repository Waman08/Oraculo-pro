"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, Time, LineStyle, IPriceLine } from 'lightweight-charts';
import { fetchKlines } from '@/lib/api';
import { useAppSettings } from './AppContext';
import { useAppStore } from '@/lib/store';
import { ActionableData } from '@/types';

interface CandlestickChartProps {
  symbol: string;
  actionableData?: ActionableData;
}

export default function CandlestickChart({ symbol, actionableData }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const lastCandleRef = useRef<any>(null);
  
  const [loading, setLoading] = useState(true);
  const { timeframe } = useAppSettings();
  const livePrice = useAppStore(state => state.livePrices[symbol]?.price);

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

  // 1. Initialise Chart and fetch historical data (Depends on symbol, timeframe)
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid' as any, color: 'transparent' },
        textColor: '#94A3B8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: { mode: 0 },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)', timeVisible: true },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
      autoSize: true,
    });
    
    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });
    seriesRef.current = candlestickSeries;

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '', 
    });
    chart.priceScale('').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      const interval = getInterval(timeframe);
      const klines = await fetchKlines(symbol, interval, 200);
      
      if (!isMounted) return;
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
        lastCandleRef.current = cData[cData.length - 1];
      }
      setLoading(false);
    };

    loadData();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLinesRef.current = [];
    };
  }, [symbol, timeframe]);

  // 2. Update Price Lines when actionableData changes without destroying chart
  useEffect(() => {
    if (!seriesRef.current || !actionableData) return;

    // Clear old lines
    priceLinesRef.current.forEach(line => seriesRef.current?.removePriceLine(line));
    priceLinesRef.current = [];

    if (actionableData.optimalEntry) {
      const line = seriesRef.current.createPriceLine({
        price: actionableData.optimalEntry,
        color: '#3B82F6',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Entry',
      });
      priceLinesRef.current.push(line);
    }
    if (actionableData.takeProfit) {
      const line = seriesRef.current.createPriceLine({
        price: actionableData.takeProfit,
        color: '#10B981',
        lineWidth: 2,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: 'TP',
      });
      priceLinesRef.current.push(line);
    }
    if (actionableData.stopLoss) {
      const line = seriesRef.current.createPriceLine({
        price: actionableData.stopLoss,
        color: '#EF4444',
        lineWidth: 2,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: 'SL',
      });
      priceLinesRef.current.push(line);
    }
  }, [actionableData]);

  // 3. Update last candle live using websocket/livePrice updates
  useEffect(() => {
    if (livePrice && seriesRef.current && lastCandleRef.current) {
      const currentLast = lastCandleRef.current;
      const updatedCandle = {
        ...currentLast,
        close: livePrice,
        high: Math.max(currentLast.high, livePrice),
        low: Math.min(currentLast.low, livePrice)
      };
      seriesRef.current.update(updatedCandle);
      lastCandleRef.current = updatedCandle;
    }
  }, [livePrice]);

  return (
    <div className="w-full h-full relative min-h-[280px] h-[350px] glass-card overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-gold"></div>
        </div>
      )}
      {!loading && (!seriesRef.current || chartContainerRef.current?.childNodes.length === 0) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 z-10 backdrop-blur-sm text-[#94A3B8]">
          <div className="text-4xl mb-2">??</div>
          <div className="text-sm font-semibold">Datos del gráfico no disponibles</div>
          <div className="text-xs opacity-60">No se pudieron cargar velas de este activo</div>
        </div>
      )}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 pointer-events-none">
         <div className="flex items-center gap-3">
           <div className="font-bold text-lg">{symbol}</div>
           <div className="text-sm text-gray-400 bg-black/40 px-2 py-1 rounded">{timeframe}</div>
         </div>
         {actionableData && (
           <div className="flex items-center gap-2 text-[10px] mt-1 opacity-70">
             <span style={{ color: '#3B82F6' }}>Entry: ${actionableData.optimalEntry}</span>
             <span style={{ color: '#10B981' }}>TP: ${actionableData.takeProfit}</span>
             <span style={{ color: '#EF4444' }}>SL: ${actionableData.stopLoss}</span>
           </div>
         )}
      </div>
      <div className="absolute inset-0 pt-16 pb-4 px-4">
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}

