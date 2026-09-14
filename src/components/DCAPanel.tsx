"use client";

import React, { useState, useMemo } from 'react';
import type { ActionableData } from '@/types';
import { useLocale } from './AppContext';
import { 
  ArrowDown, ArrowUp, 
  Calculator, Copy, Check, DollarSign, PieChart, Activity
} from 'lucide-react';

interface DCAPanelProps {
  actionableData: ActionableData;
  currentPrice: number;
}

type AllocationStrategy = 'equitable' | 'pyramidal' | 'atr';

export default function DCAPanel({ actionableData, currentPrice }: DCAPanelProps) {
  const { t } = useLocale();
  const [totalCapital, setTotalCapital] = useState<number>(1000);
  const [strategy, setStrategy] = useState<AllocationStrategy>('pyramidal');
  const [copiedLevel, setCopiedLevel] = useState<number | null>(null);

  if (!actionableData) return null;
  const { dcaLevels = [], optimalEntry, takeProfit, stopLoss, riskLevel } = actionableData;
  const isBuying = dcaLevels.length > 0 && dcaLevels[0].type === 'compra';

  const themeColor = isBuying ? 'var(--signal-buy)' : 'var(--signal-sell)';
  const themeDim = isBuying ? 'var(--signal-buy-dim)' : 'var(--signal-sell-dim)';

  // Calculate DCA Rows
  const dcaRows = useMemo(() => {
    if (!dcaLevels || dcaLevels.length === 0) return [];
    const n = dcaLevels.length;
    let weights = new Array(n).fill(0);

    if (strategy === 'equitable') {
      weights = weights.map(() => 1 / n);
    } else if (strategy === 'pyramidal') {
      let sum = 0;
      for (let i = 0; i < n; i++) {
        weights[i] = Math.pow(2, i);
        sum += weights[i];
      }
      weights = weights.map(w => w / sum);
    } else if (strategy === 'atr') {
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const dist = Math.abs(dcaLevels[i].percentFromCurrent) || 0.1;
        weights[i] = 1 / dist;
        sum += weights[i];
      }
      weights = weights.map(w => w / sum);
    }

    return dcaLevels.map((level, i) => {
      const capital = totalCapital * weights[i];
      const tokens = capital / level.price;
      return {
        ...level,
        weight: weights[i],
        capital,
        tokens
      };
    });
  }, [dcaLevels, totalCapital, strategy]);

  // Calculate Global Metrics
  const metrics = useMemo(() => {
    if (!dcaRows.length || !takeProfit) return null;
    const totalTokens = dcaRows.reduce((acc, row) => acc + row.tokens, 0);
    const dcaAverage = totalTokens > 0 ? (totalCapital / totalTokens) : currentPrice;
    const improvement = Math.abs((currentPrice - dcaAverage) / currentPrice) * 100;
    const tpDist = isBuying ? (takeProfit - dcaAverage) : (dcaAverage - takeProfit);
    const tpReturnPercent = (tpDist / dcaAverage) * 100;
    const tpReturnUsd = totalTokens * tpDist;

    return { totalTokens, dcaAverage, improvement, tpReturnPercent, tpReturnUsd };
  }, [dcaRows, totalCapital, currentPrice, takeProfit, isBuying]);

  const handleCopy = (level: any, idx: number) => {
    const text = `Nivel ${level.level}: $${level.capital.toFixed(2)} USD a precio ${level.price}`;
    navigator.clipboard.writeText(text);
    setCopiedLevel(idx);
    setTimeout(() => setCopiedLevel(null), 2000);
  };

  const PRESETS = [250, 500, 1000, 5000];

  return (
    <div className="glass-card p-5 animate-fadeInUp">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <Calculator size={16} style={{ color: themeColor }} />
          Calculadora DCA Pro
        </h3>
        <span className="text-xs px-2 py-1 rounded-full font-bold uppercase" style={{ background: themeDim, color: themeColor }}>
          {isBuying ? 'Long / Compra' : 'Short / Venta'}
        </span>
      </div>

      {dcaLevels.length > 0 ? (
        <>
          {/* Controls */}
          <div className="bg-black/30 rounded-xl p-4 mb-5 border border-white/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Capital Input */}
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-muted)' }}>Capital a Destinar (USD)</label>
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="number"
                      value={totalCapital}
                      onChange={(e) => setTotalCapital(Number(e.target.value) || 0)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {PRESETS.map(p => (
                    <button 
                      key={p}
                      onClick={() => setTotalCapital(p)}
                      className={`flex-1 py-1 rounded text-xs font-bold transition-all ${totalCapital === p ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
                    >
                      ${p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Strategy Selector */}
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-muted)' }}>Estrategia de Asignación</label>
                <div className="grid gap-2">
                  <button 
                    onClick={() => setStrategy('pyramidal')}
                    className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all border ${strategy === 'pyramidal' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-white/5 hover:bg-white/5 text-gray-400'}`}
                  >
                    <PieChart size={14} /> <span className="font-semibold text-left flex-1">Piramidal (Martingala Suave)</span>
                  </button>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setStrategy('equitable')}
                      className={`flex-1 flex items-center justify-center gap-1 p-2 rounded-lg text-xs transition-all border ${strategy === 'equitable' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-white/5 hover:bg-white/5 text-gray-400'}`}
                    >
                      Equitativo
                    </button>
                    <button 
                      onClick={() => setStrategy('atr')}
                      className={`flex-1 flex items-center justify-center gap-1 p-2 rounded-lg text-xs transition-all border ${strategy === 'atr' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-white/5 hover:bg-white/5 text-gray-400'}`}
                    >
                      Distancia ATR
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Metrics Summary */}
          {metrics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <div className="bg-black/20 rounded-lg p-3 border-l-2" style={{ borderColor: themeColor }}>
                <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Precio Promedio DCA</div>
                <div className="text-lg font-bold" style={{ color: themeColor }}>${formatPrice(metrics.dcaAverage)}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--signal-buy)' }}>
                  Mejora {metrics.improvement.toFixed(2)}%
                </div>
              </div>
              <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Total Tokens</div>
                <div className="text-lg font-bold text-white">{metrics.totalTokens.toFixed(4)}</div>
                <div className="text-xs text-gray-500 mt-1">Monedas acumuladas</div>
              </div>
              <div className="bg-black/20 rounded-lg p-3 border-l-2" style={{ borderColor: '#3B82F6' }}>
                <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Retorno al TP</div>
                <div className="text-lg font-bold text-blue-400">+${formatPrice(metrics.tpReturnUsd)}</div>
                <div className="text-xs text-blue-500/70 mt-1">+{metrics.tpReturnPercent.toFixed(2)}% ROI Neto</div>
              </div>
              <div className="bg-black/20 rounded-lg p-3 border-l-2" style={{ borderColor: 'var(--signal-sell)' }}>
                <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Riesgo / Stop Loss</div>
                <div className="text-lg font-bold" style={{ color: 'var(--signal-sell)' }}>${formatPrice(stopLoss)}</div>
                <div className="text-xs text-red-500/70 mt-1">Pérdida max controlada</div>
              </div>
            </div>
          )}

          {/* Order Ladder */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold mb-3 flex items-center gap-2" style={{ color: themeColor }}>
              {isBuying ? <ArrowDown size={14} /> : <ArrowUp size={14} />} Escalera de Órdenes Límite
            </h4>
            
            <div className="stagger-children">
              {dcaRows.map((row, idx) => (
                <div 
                  key={idx} 
                  className="group flex flex-wrap sm:flex-nowrap items-center gap-3 py-2 px-3 rounded-lg transition-all border border-white/5 hover:border-white/20 bg-black/30"
                  style={{
                    borderLeft: `3px solid ${themeColor}`,
                    opacity: 1 - (dcaRows.length - 1 - idx) * -0.05, 
                  }}
                >
                  {/* Level Badge */}
                  <div className="w-7 h-7 rounded bg-white/5 flex items-center justify-center font-bold text-xs" style={{ color: themeColor }}>
                    L{row.level}
                  </div>
                  
                  {/* Price */}
                  <div className="flex-1 min-w-[100px]">
                    <div className="text-[10px] text-gray-500 mb-0.5">Precio de Orden</div>
                    <div className="text-sm font-bold text-white">${formatPrice(row.price)}</div>
                  </div>

                  {/* Distance */}
                  <div className="w-16">
                    <div className="text-[10px] text-gray-500 mb-0.5">Distancia</div>
                    <div className="text-xs font-mono px-1 py-0.5 rounded text-center" style={{ background: themeDim, color: themeColor }}>
                      {row.percentFromCurrent > 0 ? '+' : ''}{row.percentFromCurrent}%
                    </div>
                  </div>

                  {/* Capital */}
                  <div className="flex-1 min-w-[80px]">
                    <div className="text-[10px] text-gray-500 mb-0.5">Inversión</div>
                    <div className="text-sm font-bold text-white flex items-center gap-1">
                      <DollarSign size={12} className="text-gray-400" />
                      {row.capital.toFixed(2)}
                      <span className="text-[10px] text-gray-500 ml-1">({(row.weight * 100).toFixed(0)}%)</span>
                    </div>
                  </div>

                  {/* Tokens */}
                  <div className="flex-1 min-w-[80px] hidden sm:block">
                    <div className="text-[10px] text-gray-500 mb-0.5">Tokens</div>
                    <div className="text-xs font-semibold text-gray-300">{row.tokens.toFixed(4)}</div>
                  </div>

                  {/* Actions */}
                  <div>
                    <button 
                      onClick={() => handleCopy(row, idx)}
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-gray-400 hover:text-white"
                      title="Copiar parámetros de orden"
                    >
                      {copiedLevel === idx ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8 bg-black/20 rounded-xl border border-white/5">
          <Activity size={32} className="mx-auto mb-3 text-gray-600" />
          <div className="text-sm font-bold text-gray-400 mb-1">Sin niveles DCA activos</div>
          <div className="text-xs text-gray-500 max-w-xs mx-auto">
            El activo no presenta estructura para acumulación o distribución en este momento.
          </div>
        </div>
      )}
    </div>
  );
}

function formatPrice(price: number): string {
  if (price === undefined || price === null || isNaN(price)) return '0.00';
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(8);
}
