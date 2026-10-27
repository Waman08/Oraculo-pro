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

// Math calculation helpers for Overlays
function calculateEMA(data: { time: Time; close: number }[], period: number) {
  if (!data || data.length < period) return [];
  const k = 2 / (period + 1);
  const emaData: { time: Time; value: number }[] = [];
  
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let prevEma = sum / period;
  emaData.push({ time: data[period - 1].time, value: Number(prevEma.toFixed(prevEma < 1 ? 6 : 2)) });

  for (let i = period; i < data.length; i++) {
    const currentEma = data[i].close * k + prevEma * (1 - k);
    emaData.push({ time: data[i].time, value: Number(currentEma.toFixed(currentEma < 1 ? 6 : 2)) });
    prevEma = currentEma;
  }
  return emaData;
}

function calculateBollingerBands(data: { time: Time; close: number }[], period: number = 20, multiplier: number = 2) {
  if (!data || data.length < period) return { upper: [], lower: [], middle: [] };
  const upper: { time: Time; value: number }[] = [];
  const lower: { time: Time; value: number }[] = [];
  const middle: { time: Time; value: number }[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    const mean = sum / period;

    let varianceSum = 0;
    for (let j = 0; j < period; j++) {
      const diff = data[i - j].close - mean;
      varianceSum += diff * diff;
    }
    const stdDev = Math.sqrt(varianceSum / period);

    const time = data[i].time;
    const decimals = mean < 1 ? 6 : 2;
    upper.push({ time, value: Number((mean + multiplier * stdDev).toFixed(decimals)) });
    lower.push({ time, value: Number((mean - multiplier * stdDev).toFixed(decimals)) });
    middle.push({ time, value: Number(mean.toFixed(decimals)) });
  }

  return { upper, lower, middle };
}

export default function CandlestickChart({ symbol, actionableData }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  
  // Overlay series refs
  const ema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMiddleSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // Price lines refs
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const dcaPriceLinesRef = useRef<IPriceLine[]>([]);
  const lastCandleRef = useRef<any>(null);
  
  const [loading, setLoading] = useState(true);
  
  // Overlay toggle states
  const [showEma, setShowEma] = useState<boolean>(true);
  const [showDca, setShowDca] = useState<boolean>(false);
  const [showBb, setShowBb] = useState<boolean>(false);

  const { timeframe, t } = useAppSettings();
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

    const container = chartContainerRef.current;
    const initialWidth = container.clientWidth > 0 ? container.clientWidth : 600;
    const initialHeight = container.clientHeight > 0 ? container.clientHeight : 350;

    const chart = createChart(container, {
      width: initialWidth,
      height: initialHeight,
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
    });
    
    chartRef.current = chart;

    // Candlestick Series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });
    seriesRef.current = candlestickSeries;

    // Volume Series
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '', 
    });
    chart.priceScale('').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    // EMA Lines
    const ema20 = chart.addLineSeries({
      color: '#3B82F6',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      title: 'EMA 20',
      visible: showEma,
    });
    ema20SeriesRef.current = ema20;

    const ema50 = chart.addLineSeries({
      color: '#F59E0B',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      title: 'EMA 50',
      visible: showEma,
    });
    ema50SeriesRef.current = ema50;

    const ema200 = chart.addLineSeries({
      color: '#A855F7',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      title: 'EMA 200',
      visible: showEma,
    });
    ema200SeriesRef.current = ema200;

    // Bollinger Bands Lines
    const bbUpper = chart.addLineSeries({
      color: '#06B6D4',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'BB Upper',
      visible: showBb,
    });
    bbUpperSeriesRef.current = bbUpper;

    const bbLower = chart.addLineSeries({
      color: '#06B6D4',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'BB Lower',
      visible: showBb,
    });
    bbLowerSeriesRef.current = bbLower;

    const bbMiddle = chart.addLineSeries({
      color: 'rgba(6, 182, 212, 0.45)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'BB Mid (SMA 20)',
      visible: showBb,
    });
    bbMiddleSeriesRef.current = bbMiddle;

    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      const interval = getInterval(timeframe);
      // Fetch 250 candles to ensure EMA 200 has enough historical warmup
      const klines = await fetchKlines(symbol, interval, 250);
      
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

        // Calculate and apply EMAs
        const ema20Data = calculateEMA(cData, 20);
        const ema50Data = calculateEMA(cData, 50);
        const ema200Data = calculateEMA(cData, 200);
        ema20.setData(ema20Data);
        ema50.setData(ema50Data);
        ema200.setData(ema200Data);

        // Calculate and apply Bollinger Bands
        const bbData = calculateBollingerBands(cData, 20, 2);
        bbUpper.setData(bbData.upper);
        bbLower.setData(bbData.lower);
        bbMiddle.setData(bbData.middle);

        lastCandleRef.current = cData[cData.length - 1];
        chart.timeScale().fitContent();
      }
      setLoading(false);
    };

    loadData();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const w = chartContainerRef.current.clientWidth;
        const h = chartContainerRef.current.clientHeight;
        if (w > 0) {
          chartRef.current.applyOptions({ 
            width: w, 
            ...(h > 0 ? { height: h } : {}) 
          });
        }
      }
    };

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      handleResize();
    });
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      ema20SeriesRef.current = null;
      ema50SeriesRef.current = null;
      ema200SeriesRef.current = null;
      bbUpperSeriesRef.current = null;
      bbLowerSeriesRef.current = null;
      bbMiddleSeriesRef.current = null;
      priceLinesRef.current = [];
      dcaPriceLinesRef.current = [];
    };
  }, [symbol, timeframe]);

  // 2. React to EMA toggle changes
  useEffect(() => {
    ema20SeriesRef.current?.applyOptions({ visible: showEma });
    ema50SeriesRef.current?.applyOptions({ visible: showEma });
    ema200SeriesRef.current?.applyOptions({ visible: showEma });
  }, [showEma]);

  // 3. React to Bollinger Bands toggle changes
  useEffect(() => {
    bbUpperSeriesRef.current?.applyOptions({ visible: showBb });
    bbLowerSeriesRef.current?.applyOptions({ visible: showBb });
    bbMiddleSeriesRef.current?.applyOptions({ visible: showBb });
  }, [showBb]);

  // 4. Update DCA Price Lines when showDca or actionableData changes
  useEffect(() => {
    if (!seriesRef.current) return;

    // Clear old DCA lines
    dcaPriceLinesRef.current.forEach(line => {
      try {
        seriesRef.current?.removePriceLine(line);
      } catch {}
    });
    dcaPriceLinesRef.current = [];

    if (showDca) {
      let levels: { level: number; price: number; label: string }[] = [];
      if (actionableData?.dcaLevels && actionableData.dcaLevels.length > 0) {
        levels = actionableData.dcaLevels
          .filter(l => l.price && l.price > 0)
          .map(l => ({ level: l.level, price: l.price, label: l.label }));
      } else {
        const base = actionableData?.optimalEntry || livePrice || 0;
        if (base > 0) {
          levels = [
            { level: 1, price: base * 0.985, label: 'L1 (-1.5%)' },
            { level: 2, price: base * 0.960, label: 'L2 (-4.0%)' },
            { level: 3, price: base * 0.930, label: 'L3 (-7.0%)' },
          ];
        }
      }

      const dcaColors = ['#10B981', '#06B6D4', '#F59E0B', '#A855F7'];
      levels.forEach((lvl, idx) => {
        const color = dcaColors[idx % dcaColors.length];
        const priceFormatted = lvl.price < 1 ? lvl.price.toFixed(4) : lvl.price.toFixed(2);
        const line = seriesRef.current!.createPriceLine({
          price: lvl.price,
          color: color,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `🎯 DCA L${lvl.level || idx + 1}: $${priceFormatted}`,
        });
        dcaPriceLinesRef.current.push(line);
      });
    }
  }, [showDca, actionableData, livePrice]);

  // 5. Update Base Actionable Price Lines (Entry, TP, SL) without destroying chart
  useEffect(() => {
    if (!seriesRef.current || !actionableData) return;

    // Clear old base lines
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

  // 6. Update last candle live using websocket/livePrice updates
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
    <div className="w-full relative h-[440px] min-h-[440px] glass-card overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-gold"></div>
        </div>
      )}
      {!loading && (!seriesRef.current || chartContainerRef.current?.childNodes.length === 0) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 z-10 backdrop-blur-sm text-[#94A3B8]">
          <div className="text-4xl mb-2">📊</div>
          <div className="text-sm font-semibold">{t('chart.noData')}</div>
          <div className="text-xs opacity-60">{t('chart.noDataSub')}</div>
        </div>
      )}

      {/* Top Header Controls Bar */}
      <div className="absolute top-3 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Symbol & Base Stats */}
        <div className="flex flex-col gap-1 pointer-events-auto">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="font-black text-base sm:text-lg tracking-wide text-white">{symbol}</span>
            <span className="text-xs font-semibold text-gray-300 bg-black/60 px-2 py-0.5 rounded border border-white/10 backdrop-blur-md">
              {timeframe}
            </span>
            {showEma && (
              <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono pl-2 border-l border-white/10">
                <span className="flex items-center gap-1 text-[#3B82F6]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]"></span>EMA 20
                </span>
                <span className="flex items-center gap-1 text-[#F59E0B]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]"></span>EMA 50
                </span>
                <span className="flex items-center gap-1 text-[#A855F7]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A855F7]"></span>EMA 200
                </span>
              </div>
            )}
          </div>
          {actionableData && (
            <div className="flex items-center gap-2 text-[10px] opacity-80 font-mono">
              <span className="text-[#3B82F6]">Entry: ${actionableData.optimalEntry}</span>
              <span className="text-[#10B981]">TP: ${actionableData.takeProfit}</span>
              <span className="text-[#EF4444]">SL: ${actionableData.stopLoss}</span>
            </div>
          )}
        </div>

        {/* Overlay Toggle Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          {/* EMA Toggle (Active by default) */}
          <button
            type="button"
            onClick={() => setShowEma(!showEma)}
            className={`text-xs px-2.5 py-1 rounded-lg backdrop-blur-md transition-all flex items-center gap-1.5 font-medium border ${
              showEma
                ? 'bg-[#3B82F6]/20 text-[#60A5FA] border-[#3B82F6]/50 shadow-[0_0_12px_rgba(59,130,246,0.25)]'
                : 'bg-black/50 text-gray-400 border-white/5 hover:text-white hover:bg-black/70'
            }`}
            title="Conmutar Medias Móviles Exponenciales (EMA 20, 50, 200)"
          >
            <span>📈</span>
            <span className="hidden xs:inline">EMAs</span>
            <span className="text-[10px] opacity-75 font-mono">(20/50/200)</span>
          </button>

          {/* DCA Levels Toggle */}
          <button
            type="button"
            onClick={() => setShowDca(!showDca)}
            className={`text-xs px-2.5 py-1 rounded-lg backdrop-blur-md transition-all flex items-center gap-1.5 font-medium border ${
              showDca
                ? 'bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] border-[var(--accent-gold)]/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'bg-black/50 text-gray-400 border-white/5 hover:text-white hover:bg-black/70'
            }`}
            title="Conmutar Niveles de Compra Escalonada DCA (L1, L2, L3)"
          >
            <span>🎯</span>
            <span>{t('chart.dcaLevels') || 'Niveles DCA'}</span>
          </button>

          {/* Bollinger Bands Toggle */}
          <button
            type="button"
            onClick={() => setShowBb(!showBb)}
            className={`text-xs px-2.5 py-1 rounded-lg backdrop-blur-md transition-all flex items-center gap-1.5 font-medium border ${
              showBb
                ? 'bg-[#06B6D4]/20 text-[#22D3EE] border-[#06B6D4]/50 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                : 'bg-black/50 text-gray-400 border-white/5 hover:text-white hover:bg-black/70'
            }`}
            title="Conmutar Bandas de Bollinger (SMA 20 ± 2 Desviaciones Estándar)"
          >
            <span>📊</span>
            <span>{t('chart.bollingerBands') || 'Bandas Bollinger'}</span>
          </button>
        </div>
      </div>

      <div className="absolute inset-0 pt-16 sm:pt-16 pb-4 px-4">
        <div ref={chartContainerRef} className="w-full h-full min-h-[350px]" />
      </div>
    </div>
  );
}
