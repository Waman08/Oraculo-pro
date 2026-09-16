"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts';
import { fetchPythonBacktest } from '@/lib/api';
import { Play, TrendingUp, Shield, Activity, DollarSign, PieChart, Percent, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface BacktestChartProps {
  symbol: string;
}

export default function BacktestChart({ symbol }: BacktestChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<IChartApi | null>(null);
  const [strategySeries, setStrategySeries] = useState<ISeriesApi<"Line"> | null>(null);
  const [bhSeries, setBhSeries] = useState<ISeriesApi<"Line"> | null>(null);

  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState('1D');
  const [days, setDays] = useState(90);
  const [mode, setMode] = useState('Balanceado');
  const [feeRate, setFeeRate] = useState(0.1);
  
  const [results, setResults] = useState<any>(null);
  const [showTrades, setShowTrades] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    const newChart = createChart(chartContainerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#9CA3AF' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      height: 350
    });

    const sSeries = newChart.addLineSeries({
      color: '#3B82F6',
      lineWidth: 2,
      crosshairMarkerRadius: 4,
    });

    const bSeries = newChart.addLineSeries({
      color: '#6B7280',
      lineWidth: 1,
      lineStyle: 2, 
    });

    setChart(newChart);
    setStrategySeries(sSeries);
    setBhSeries(bSeries);

    const handleResize = () => {
      if (chartContainerRef.current) {
        newChart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      newChart.remove();
    };
  }, []);

  const runBacktest = async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const data = await fetchPythonBacktest(symbol, timeframe, mode, days, feeRate);
      if (data && !data.error) {
        setResults(data);
        
        if (strategySeries && data.equityCurve) {
          const eqData = data.equityCurve.map((d: any) => {
             const ts = new Date(d.time).getTime() / 1000;
             return { time: ts as any, value: d.value };
          }).filter((d: any) => !isNaN(d.time)).sort((a: any, b: any) => a.time - b.time);
          
          if (eqData.length > 0) strategySeries.setData(eqData);
          
          if (data.markers && data.markers.length > 0) {
             const formattedMarkers = data.markers.map((m: any) => ({
                time: (new Date(m.time).getTime() / 1000) as any,
                position: m.position,
                color: m.color,
                shape: m.shape,
                text: m.text
             })).filter((m: any) => !isNaN(m.time)).sort((a: any, b: any) => a.time - b.time);
             strategySeries.setMarkers(formattedMarkers);
          }
        }
        
        if (bhSeries && data.bhEquityCurve) {
          const bhData = data.bhEquityCurve.map((d: any) => {
             const ts = new Date(d.time).getTime() / 1000;
             return { time: ts as any, value: d.value };
          }).filter((d: any) => !isNaN(d.time)).sort((a: any, b: any) => a.time - b.time);
          
          if (bhData.length > 0) bhSeries.setData(bhData);
        }
        
        chart?.timeScale().fitContent();
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const m = results?.metrics;

  return (
    <div className="glass-card p-5 animate-fadeInUp flex flex-col gap-4">
      {/* Top Bar Controls */}
      <div className="bg-black/30 rounded-xl p-4 border border-white/5 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[120px]">
          <label className="text-xs font-semibold text-gray-400 mb-1 block">Rango Temporal</label>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-blue-500">
            <option value={30}>30 días</option>
            <option value={90}>90 días</option>
            <option value={180}>180 días</option>
            <option value={365}>1 año</option>
          </select>
        </div>
        
        <div className="flex-1 min-w-[100px]">
          <label className="text-xs font-semibold text-gray-400 mb-1 block">Temporalidad</label>
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="1H">1H</option>
            <option value="4H">4H</option>
            <option value="1D">1D</option>
          </select>
        </div>

        <div className="flex-1 min-w-[120px]">
          <label className="text-xs font-semibold text-gray-400 mb-1 block">Régimen Riesgo</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="Conservador">Conservador</option>
            <option value="Balanceado">Balanceado</option>
            <option value="Agresivo">Agresivo</option>
          </select>
        </div>

        <div className="w-[100px]">
          <label className="text-xs font-semibold text-gray-400 mb-1 block">Fee Rate (%)</label>
          <input type="number" step="0.01" value={feeRate} onChange={(e) => setFeeRate(Number(e.target.value))} className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-blue-500" />
        </div>

        <button 
          onClick={runBacktest} 
          disabled={loading || !symbol}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 h-[38px]"
        >
          {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Play size={16} />}
          Ejecutar Backtest
        </button>
      </div>

      {/* Chart Container */}
      <div className="relative w-full rounded-xl overflow-hidden border border-white/5 bg-black/20" style={{ height: 350 }}>
        <div ref={chartContainerRef} className="absolute inset-0" />
        {!results && !loading && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 font-semibold bg-black/40 backdrop-blur-sm z-10">
            Configura los parámetros y haz clic en Ejecutar
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs font-semibold">
        <div className="flex items-center gap-1 text-blue-400"><div className="w-3 h-0.5 bg-blue-500"></div> Estrategia Cuantitativa</div>
        <div className="flex items-center gap-1 text-gray-400"><div className="w-3 h-0.5 bg-gray-500 border-dashed"></div> Buy & Hold</div>
      </div>

      {/* Metrics Panel */}
      {m && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><TrendingUp size={12}/> Retorno Neto</div>
            <div className={`text-lg font-bold ${m.netReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>{m.netReturn >= 0 ? '+' : ''}{m.netReturn.toFixed(2)}%</div>
          </div>
          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Percent size={12}/> CAGR</div>
            <div className={`text-lg font-bold ${m.cagr >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{m.cagr >= 0 ? '+' : ''}{m.cagr.toFixed(2)}%</div>
          </div>
          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Activity size={12}/> Sharpe / Sortino</div>
            <div className="text-lg font-bold text-white">{m.sharpe.toFixed(2)} <span className="text-xs text-gray-500">/ {m.sortino.toFixed(2)}</span></div>
          </div>
          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Shield size={12}/> Max Drawdown</div>
            <div className="text-lg font-bold text-red-400">-{m.maxDrawdown.toFixed(2)}%</div>
          </div>
          
          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><PieChart size={12}/> Win Rate</div>
            <div className="text-lg font-bold text-green-400">{m.winRate.toFixed(1)}%</div>
          </div>
          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><AlertTriangle size={12}/> Profit Factor</div>
            <div className="text-lg font-bold text-white">{m.profitFactor.toFixed(2)}</div>
          </div>
          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={12}/> Operaciones</div>
            <div className="text-lg font-bold text-white">{m.totalTrades}</div>
          </div>
          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><DollarSign size={12}/> Comisiones Pagadas</div>
            <div className="text-lg font-bold text-gray-400">${m.totalFees.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Trades Table */}
      {results && results.trades && results.trades.length > 0 && (
        <div className="mt-2 bg-black/30 rounded-xl border border-white/5 overflow-hidden">
          <button 
            onClick={() => setShowTrades(!showTrades)}
            className="w-full flex items-center justify-between p-4 text-sm font-bold text-gray-300 hover:bg-white/5 transition-colors"
          >
            Historial de Operaciones ({results.trades.length})
            {showTrades ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {showTrades && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-400">
                <thead className="bg-white/5 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-2">Fecha Entrada</th>
                    <th className="px-4 py-2">Precio Entrada</th>
                    <th className="px-4 py-2">Fecha Salida</th>
                    <th className="px-4 py-2">Precio Salida</th>
                    <th className="px-4 py-2 text-right">PnL Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {results.trades.map((t: any, i: number) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-2">{new Date(t.entryDate).toLocaleString()}</td>
                      <td className="px-4 py-2 font-mono">${t.entryPrice.toFixed(4)}</td>
                      <td className="px-4 py-2">{new Date(t.exitDate).toLocaleString()}</td>
                      <td className="px-4 py-2 font-mono">${t.exitPrice.toFixed(4)}</td>
                      <td className={`px-4 py-2 font-bold text-right ${t.pnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
