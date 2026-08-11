"use client";

import React from 'react';
import { Shield, BarChart2, Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ActuarialData {
  riskMetrics: { var95: number; cvar95: number; annualVolatility: number };
  monteCarlo7D: { p10: number; p50: number; p90: number };
  markovRegime: { bull: number; bear: number; sideways: number };
  dataAvailable: boolean;
}

function fmtPrice(p: number): string {
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return '$' + p.toFixed(2);
  return '$' + p.toFixed(6);
}

export default function ActuarialPanel({ actuarial, currentPrice }: { actuarial: any; currentPrice: number }) {
  if (!actuarial || actuarial.dataAvailable === false) {
    return (
      <div className="glass-card p-5 animate-fadeInUp">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            ANÁLISIS ACTUARIAL DE RIESGO
          </h3>
        </div>
        <div
          className="flex flex-col items-center justify-center p-6 text-center border border-dashed rounded-xl h-full min-h-[140px]"
          style={{
            borderColor: 'var(--bg-tertiary)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <Activity size={24} style={{ color: 'var(--text-muted)' }} className="mb-2 opacity-50" />
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Datos insuficientes para el análisis actuarial
          </p>
        </div>
      </div>
    );
  }

  const data: ActuarialData = actuarial;

  // 1. VaR & Volatility normalization
  const rawVar = data.riskMetrics?.var95 ?? 0;
  const var95Pct = Math.abs(rawVar > 1 ? rawVar : rawVar * 100);

  const rawCvar = data.riskMetrics?.cvar95 ?? 0;
  const cvar95Pct = Math.abs(rawCvar > 1 ? rawCvar : rawCvar * 100);

  const rawVol = data.riskMetrics?.annualVolatility ?? 0;
  const annVolPct = Math.abs(rawVol > 1 ? rawVol : rawVol * 100);

  // VaR Color rule: red if loss > 5%, yellow if > 3%, green otherwise
  let varColor = 'var(--signal-buy)';
  if (var95Pct > 5) {
    varColor = 'var(--signal-sell)';
  } else if (var95Pct > 3) {
    varColor = 'var(--accent-gold)';
  }

  // 2. Monte Carlo 7D scenarios
  const p10 = data.monteCarlo7D?.p10 ?? currentPrice * 0.9;
  const p50 = data.monteCarlo7D?.p50 ?? currentPrice;
  const p90 = data.monteCarlo7D?.p90 ?? currentPrice * 1.1;

  // Visual range position (0% - 100%)
  const minP = Math.min(p10, currentPrice);
  const maxP = Math.max(p90, currentPrice);
  const priceSpan = maxP - minP;
  const pricePositionPct = priceSpan > 0 ? Math.min(100, Math.max(0, ((currentPrice - minP) / priceSpan) * 100)) : 50;

  // 3. Markov Regimes normalization
  const rawBull = data.markovRegime?.bull ?? 0;
  const bullPct = rawBull > 1 ? rawBull : rawBull * 100;

  const rawBear = data.markovRegime?.bear ?? 0;
  const bearPct = rawBear > 1 ? rawBear : rawBear * 100;

  const rawSideways = data.markovRegime?.sideways ?? 0;
  const sidewaysPct = rawSideways > 1 ? rawSideways : rawSideways * 100;

  // Dominant Regime identification
  let dominantRegime = { label: 'Alcista', pct: bullPct, color: 'var(--signal-buy)', bgDim: 'var(--signal-buy-dim)' };
  if (bearPct >= bullPct && bearPct >= sidewaysPct) {
    dominantRegime = { label: 'Bajista', pct: bearPct, color: 'var(--signal-sell)', bgDim: 'var(--signal-sell-dim)' };
  } else if (sidewaysPct >= bullPct && sidewaysPct >= bearPct) {
    dominantRegime = { label: 'Lateral', pct: sidewaysPct, color: 'var(--text-muted)', bgDim: 'var(--bg-tertiary)' };
  }

  return (
    <div className="glass-card p-5 animate-fadeInUp space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--bg-tertiary)' }}>
        <div className="flex items-center gap-2">
          <Shield size={18} style={{ color: 'var(--accent-gold)' }} />
          <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            ANÁLISIS ACTUARIAL DE RIESGO
          </h3>
        </div>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{
            backgroundColor: 'var(--signal-buy-dim)',
            color: 'var(--accent-gold)',
          }}
        >
          <Activity size={12} style={{ color: 'var(--accent-gold)' }} />
          <span>Modelo Cuantitativo</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Section 1: Value at Risk (VaR 95%) */}
        <div
          className="indicator-card p-4 flex flex-col justify-between"
          style={{ borderLeft: `4px solid ${varColor}` }}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Value at Risk (VaR 95%)
              </span>
              <Shield size={15} style={{ color: varColor }} />
            </div>

            <div className="flex items-baseline gap-2 my-2">
              <span className="text-3xl font-extrabold tracking-tight" style={{ color: varColor }}>
                -{var95Pct.toFixed(2)}%
              </span>
              <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                Diario
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t" style={{ borderColor: 'var(--bg-tertiary)' }}>
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>Expected Shortfall (CVaR)</span>
              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                -{cvar95Pct.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>Volatilidad Anualizada</span>
              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {annVolPct.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Monte Carlo 7D */}
        <div className="indicator-card p-4 flex flex-col justify-between md:col-span-2">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart2 size={15} style={{ color: 'var(--accent-gold)' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Monte Carlo 7D (Escenarios de Precio)
                </span>
              </div>
              <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                Actual: <strong style={{ color: 'var(--text-primary)' }}>{fmtPrice(currentPrice)}</strong>
              </span>
            </div>

            {/* Scenarios grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {/* p10 Bear */}
              <div className="p-2.5 rounded-lg border text-center" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--bg-secondary)' }}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingDown size={14} style={{ color: 'var(--signal-sell)' }} />
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>p10 (Bear)</span>
                </div>
                <span className="text-sm font-bold block truncate" style={{ color: 'var(--signal-sell)' }}>
                  {fmtPrice(p10)}
                </span>
              </div>

              {/* p50 Base */}
              <div className="p-2.5 rounded-lg border text-center" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--bg-secondary)' }}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Minus size={14} style={{ color: 'var(--accent-gold)' }} />
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>p50 (Base)</span>
                </div>
                <span className="text-sm font-bold block truncate" style={{ color: 'var(--accent-gold)' }}>
                  {fmtPrice(p50)}
                </span>
              </div>

              {/* p90 Bull */}
              <div className="p-2.5 rounded-lg border text-center" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--bg-secondary)' }}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp size={14} style={{ color: 'var(--signal-buy)' }} />
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>p90 (Bull)</span>
                </div>
                <span className="text-sm font-bold block truncate" style={{ color: 'var(--signal-buy)' }}>
                  {fmtPrice(p90)}
                </span>
              </div>
            </div>
          </div>

          {/* Visual Range Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="relative h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              {/* Range gradient background */}
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to right, var(--signal-sell-dim), var(--accent-gold), var(--signal-buy-dim))',
                  opacity: 0.6,
                }}
              />
              {/* Current Price Marker Pin */}
              <div
                className="absolute top-0 h-full w-2 -ml-1 rounded-full shadow-md transition-all duration-500"
                style={{
                  left: `${pricePositionPct}%`,
                  backgroundColor: 'var(--text-primary)',
                  boxShadow: '0 0 8px var(--accent-gold)',
                }}
              />
            </div>
            <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <span>Min 7D ({fmtPrice(p10)})</span>
              <span className="font-semibold" style={{ color: 'var(--accent-gold)' }}>
                Posición relativa: {pricePositionPct.toFixed(0)}%
              </span>
              <span>Max 7D ({fmtPrice(p90)})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Régimen de Markov */}
      <div className="indicator-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={15} style={{ color: 'var(--accent-gold)' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Régimen de Markov (Probabilidades)
            </span>
          </div>

          {/* Dominant Regime Badge */}
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
            style={{
              backgroundColor: dominantRegime.bgDim,
              borderColor: dominantRegime.color,
              color: dominantRegime.color,
            }}
          >
            <span>Dominante: {dominantRegime.label}</span>
            <span className="opacity-90">({dominantRegime.pct.toFixed(1)}%)</span>
          </div>
        </div>

        {/* 3 Horizontal Progress Bars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* Bull */}
          <div className="space-y-1.5 p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--bg-secondary)' }}>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={13} style={{ color: 'var(--signal-buy)' }} />
                <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Alcista</span>
              </div>
              <span className="font-bold" style={{ color: 'var(--signal-buy)' }}>
                {bullPct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, Math.max(0, bullPct))}%`,
                  backgroundColor: 'var(--signal-buy)',
                }}
              />
            </div>
          </div>

          {/* Bear */}
          <div className="space-y-1.5 p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--bg-secondary)' }}>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <TrendingDown size={13} style={{ color: 'var(--signal-sell)' }} />
                <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Bajista</span>
              </div>
              <span className="font-bold" style={{ color: 'var(--signal-sell)' }}>
                {bearPct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, Math.max(0, bearPct))}%`,
                  backgroundColor: 'var(--signal-sell)',
                }}
              />
            </div>
          </div>

          {/* Sideways */}
          <div className="space-y-1.5 p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--bg-secondary)' }}>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Minus size={13} style={{ color: 'var(--text-muted)' }} />
                <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Lateral</span>
              </div>
              <span className="font-bold" style={{ color: 'var(--text-muted)' }}>
                {sidewaysPct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, Math.max(0, sidewaysPct))}%`,
                  backgroundColor: 'var(--text-muted)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
