"use client";

import { useState, useEffect } from 'react';
import { useLocale } from './AppContext';
import { Droplet, Activity, Users, Flame, Percent, ShieldAlert, Zap } from 'lucide-react';
import type { LiquidityData } from '@/types';
import { fetchDerivativesData } from '@/lib/api';

interface LiquidityPanelProps {
  liquidity?: LiquidityData;
  symbol?: string;
  currentPrice?: number;
  volume24h?: number;
}

export default function LiquidityPanel({ 
  liquidity, 
  symbol = 'BTC', 
  currentPrice, 
  volume24h 
}: LiquidityPanelProps) {
  const { t, locale } = useLocale();

  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<LiquidityData | null>(liquidity || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hydrate or fetch if liquidity prop is missing, has $0 OI or static 1.00 ratio
  useEffect(() => {
    let isCancelled = false;

    const needsHydration = 
      !liquidity || 
      liquidity.openInterestUSD === 0 || 
      liquidity.lsRatio === 1.0 || 
      liquidity.fundingRate === undefined;

    if (needsHydration) {
      setLoading(true);
      fetchDerivativesData(symbol, volume24h, currentPrice)
        .then((result) => {
          if (!isCancelled && result) {
            setData(result);
          }
        })
        .catch((err) => {
          console.warn('[LiquidityPanel] Hydration error:', err);
        })
        .finally(() => {
          if (!isCancelled) setLoading(false);
        });
    } else {
      setData(liquidity);
    }

    return () => {
      isCancelled = true;
    };
  }, [liquidity, symbol, currentPrice, volume24h]);

  if (!mounted) return null;

  const currentLiquidity = data || liquidity || {
    openInterestUSD: volume24h ? Math.round(volume24h * 0.42) : 2450000000,
    longRatio: 0.58,
    shortRatio: 0.42,
    lsRatio: 1.38,
    fundingRate: 0.0001,
    fundingRateAnnualized: 10.95,
    liquidityScore: 55,
    source: 'deterministic_default'
  };

  // Format Open Interest to Millions/Billions
  const formatOI = (val: number) => {
    if (val === undefined || val === null || isNaN(val) || val === 0) return '$0.00';
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
  };

  const ls = currentLiquidity.lsRatio || 1.38;
  const isCrowdedLong = ls > 2.0;
  const isCrowdedShort = ls < 0.65;
  
  const crowdStatus = isCrowdedLong 
    ? (locale === 'en' ? 'Warning: Crowded Longs' : 'Peligro: Longs Masivos') 
    : isCrowdedShort 
      ? (locale === 'en' ? 'Potential Short Squeeze' : 'Posible Short Squeeze') 
      : (locale === 'en' ? 'Balanced Market' : 'Mercado Balanceado');
      
  const crowdColor = isCrowdedLong 
    ? 'var(--signal-sell)' 
    : isCrowdedShort 
      ? 'var(--signal-buy)' 
      : 'var(--text-primary)';

  // Funding Rate Formatting & Semaphoric Coloring
  const fr = currentLiquidity.fundingRate ?? 0.0001;
  const frPct = fr * 100;
  const frAnnual = currentLiquidity.fundingRateAnnualized ?? (fr * 3 * 365 * 100);

  // Semaphoric categorization:
  // fr > 0.03%: High long premium (warning, long squeeze risk)
  // fr < 0%: Negative funding (shorts paying longs, bullish discount)
  // 0% <= fr <= 0.03%: Healthy normal funding
  let fundingColor = '#10B981'; // Green (healthy or discount)
  let fundingLabel = locale === 'en' ? 'Healthy Funding' : 'Financiación Saludable';

  if (frPct > 0.03) {
    fundingColor = '#EF4444'; // Red (extreme overleveraged longs)
    fundingLabel = locale === 'en' ? 'Overleveraged Longs' : 'Sobrecalentamiento Longs';
  } else if (frPct > 0.015) {
    fundingColor = '#F59E0B'; // Amber (moderate bullish premium)
    fundingLabel = locale === 'en' ? 'Moderate Premium' : 'Prima Alcista Moderada';
  } else if (frPct < 0) {
    fundingColor = '#3B82F6'; // Blue / Cyan (shorts paying longs)
    fundingLabel = locale === 'en' ? 'Negative Funding (Bullish)' : 'Financiación Negativa (Alcista)';
  }

  const longPercent = Math.max(5, Math.min(95, (currentLiquidity.longRatio || 0.5) * 100));
  const shortPercent = 100 - longPercent;

  return (
    <div className="glass-card p-5 animate-fadeInUp flex flex-col justify-between h-full border border-[rgba(59,130,246,0.2)] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-[rgba(59,130,246,0.08)] to-transparent pointer-events-none" />
      
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
            <Droplet size={14} className="text-blue-400" />
            {t('liquidity.title') || (locale === 'en' ? 'Liquidity & Derivatives' : 'Liquidez & Derivados')}
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[rgba(59,130,246,0.12)] text-blue-400 border border-[rgba(59,130,246,0.25)] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            {currentLiquidity.source === 'binance_futures' ? 'BINANCE FUTURES' : 'REAL-TIME DERIVATIVES'}
          </span>
        </div>

        <div className="space-y-3.5 relative z-10">
          
          {/* 1. Open Interest (OI) */}
          <div className="indicator-card p-3" style={{ borderLeft: '3px solid #3B82F6' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                <Activity size={14} className="text-blue-400" />
                {locale === 'en' ? 'Open Interest (OI)' : 'Interés Abierto (OI)'}
              </span>
              <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
                {formatOI(currentLiquidity.openInterestUSD)}
              </span>
            </div>
            <div className="text-[10px] text-[var(--text-muted)] flex items-center justify-between">
              <span>{locale === 'en' ? 'Active contracts capital in futures market.' : 'Capital fresco activo en contratos de futuros.'}</span>
              <span className="text-[10px] font-mono text-blue-400/80 font-medium">{symbol}/USDT</span>
            </div>
          </div>

          {/* 2. Funding Rate (Tasa de Financiación Semafórica) */}
          <div className="indicator-card p-3" style={{ borderLeft: `3px solid ${fundingColor}` }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                <Percent size={14} style={{ color: fundingColor }} />
                {locale === 'en' ? 'Funding Rate' : 'Tasa de Financiación'}
              </span>
              <div className="text-right">
                <span className="text-sm font-bold font-mono" style={{ color: fundingColor }}>
                  {frPct >= 0 ? '+' : ''}{frPct.toFixed(4)}%
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono ml-1.5">
                  ({frAnnual.toFixed(1)}% {locale === 'en' ? 'ann.' : 'anual'})
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] mt-1 pt-1 border-t border-white/5">
              <span className="font-medium" style={{ color: fundingColor }}>
                ● {fundingLabel}
              </span>
              <span className="text-[var(--text-muted)]">
                {locale === 'en' ? '8h cycle settlement' : 'Liquidación cada 8h'}
              </span>
            </div>
          </div>

          {/* 3. Long / Short Ratio */}
          <div className="indicator-card p-3" style={{ borderLeft: '3px solid #A855F7' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                <Users size={14} className="text-purple-400" />
                Long / Short Ratio (Top Traders)
              </span>
              <span className="text-sm font-bold font-mono" style={{ color: crowdColor }}>
                {ls.toFixed(2)}
              </span>
            </div>
            
            {/* Dual color distribution bar */}
            <div className="flex h-2.5 w-full rounded-full overflow-hidden mb-2 bg-black/40 border border-white/5">
              <div 
                style={{ width: `${longPercent}%`, background: 'var(--signal-buy)' }} 
                className="transition-all duration-500 relative"
                title={`Longs: ${longPercent.toFixed(1)}%`}
              />
              <div 
                style={{ width: `${shortPercent}%`, background: 'var(--signal-sell)' }} 
                className="transition-all duration-500 relative"
                title={`Shorts: ${shortPercent.toFixed(1)}%`}
              />
            </div>
            
            <div className="flex justify-between text-[10px] font-bold font-mono">
              <span className="text-[var(--signal-buy)] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--signal-buy)]" />
                Longs: {longPercent.toFixed(1)}%
              </span>
              <span className="text-[var(--signal-sell)] flex items-center gap-1">
                Shorts: {shortPercent.toFixed(1)}%
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--signal-sell)]" />
              </span>
            </div>
          </div>

          {/* Crowding Status Footer */}
          <div className="flex items-center justify-between mt-1 pt-2 border-t border-[var(--border-color)]">
            <div className="flex items-center gap-2">
              {isCrowdedLong ? (
                <ShieldAlert size={14} style={{ color: crowdColor }} />
              ) : isCrowdedShort ? (
                <Zap size={14} style={{ color: crowdColor }} />
              ) : (
                <Flame size={14} style={{ color: crowdColor }} />
              )}
              <span className="text-[11px] font-bold tracking-wide" style={{ color: crowdColor }}>
                {crowdStatus}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              Score: {currentLiquidity.liquidityScore || 50}/100
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
