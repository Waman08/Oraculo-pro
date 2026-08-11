'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { BacktestResult } from '@/types';
import { TrendingUp, TrendingDown, Percent, Activity } from 'lucide-react';

interface BacktestChartProps {
  data: BacktestResult;
}

export function BacktestChart({ data }: BacktestChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data.equity_curve || data.equity_curve.length === 0) return;

    // Destroy existing chart if any
    if (chartRef.current) {
      chartRef.current.remove();
    }

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    // Initialize chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: 'rgba(31, 41, 55, 0.4)' },
        horzLines: { color: 'rgba(31, 41, 55, 0.4)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 250,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
      },
      rightPriceScale: {
        borderVisible: false,
      }
    });

    chartRef.current = chart;

    // Add Equity Area Series
    const series = chart.addAreaSeries({
      lineColor: '#10B981', // Emerald 500
      topColor: 'rgba(16, 185, 129, 0.3)',
      bottomColor: 'rgba(16, 185, 129, 0.05)',
      lineWidth: 2,
    });
    
    seriesRef.current = series;

    // Process and sort data
    const sortedData = [...data.equity_curve].sort((a, b) => {
        return new Date(a.time).getTime() - new Date(b.time).getTime();
    });

    // Remove duplicates by time
    const uniqueData = [];
    const seenTimes = new Set();
    for (const item of sortedData) {
        if (!seenTimes.has(item.time)) {
            uniqueData.push({
                time: item.time as any, 
                value: item.value
            });
            seenTimes.add(item.time);
        }
    }

    if (uniqueData.length > 0) {
        series.setData(uniqueData);
        chart.timeScale().fitContent();
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data]);

  const { metrics } = data;
  const isProfitable = metrics.total_return_percent >= 0;

  return (
    <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5 mt-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          Rendimiento Histórico (Backtest - 90 días)
        </h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${isProfitable ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
          {isProfitable ? '+' : ''}{metrics.total_return_percent}%
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <Percent className="w-3 h-3" /> Win Rate
          </p>
          <p className="text-lg font-bold text-gray-100">{metrics.win_rate_percent}%</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-red-400" /> Max Drawdown
          </p>
          <p className="text-lg font-bold text-red-400">{metrics.max_drawdown_percent}%</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
          <p className="text-xs text-gray-500 mb-1">Ratio de Sharpe</p>
          <p className={`text-lg font-bold ${metrics.sharpe_ratio >= 1 ? 'text-emerald-400' : 'text-gray-100'}`}>
            {metrics.sharpe_ratio}
          </p>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
          <p className="text-xs text-gray-500 mb-1">Trades Realizados</p>
          <p className="text-lg font-bold text-indigo-400">{metrics.total_trades}</p>
        </div>
      </div>

      {data.equity_curve && data.equity_curve.length > 0 ? (
        <div className="relative h-[250px] w-full" ref={chartContainerRef} />
      ) : (
        <div className="h-[250px] w-full flex items-center justify-center text-gray-500">
          No hay suficientes datos históricos para generar la gráfica.
        </div>
      )}
    </div>
  );
}
