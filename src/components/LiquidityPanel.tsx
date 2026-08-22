"use client";

import { useLocale } from './AppContext';
import { Droplet, Activity, Users, Flame } from 'lucide-react';
import type { LiquidityData } from '@/types';

interface LiquidityPanelProps {
  liquidity?: LiquidityData;
}

export default function LiquidityPanel({ liquidity }: LiquidityPanelProps) {
  const { t } = useLocale();

  if (!liquidity) {
    return (
      <div className="glass-card p-5 animate-fadeInUp flex flex-col justify-center items-center h-full border border-[var(--border-color)]">
        <Droplet size={24} className="mb-2 opacity-50" />
        <span className="text-xs text-[var(--text-muted)]">Liquidez no disponible</span>
      </div>
    );
  }

  // Format Open Interest to Millions/Billions
  const formatOI = (val: number) => {
    if (val > 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val > 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
  };

  const isCrowdedLong = liquidity.lsRatio > 2.0;
  const isCrowdedShort = liquidity.lsRatio < 0.6;
  const crowdStatus = isCrowdedLong ? "Peligro: Longs Masivos" : isCrowdedShort ? "Posible Short Squeeze" : "Mercado Balanceado";
  const crowdColor = isCrowdedLong ? "var(--signal-sell)" : isCrowdedShort ? "var(--signal-buy)" : "var(--text-primary)";

  return (
    <div className="glass-card p-5 animate-fadeInUp flex flex-col justify-between h-full border border-[rgba(59,130,246,0.15)] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[rgba(59,130,246,0.05)] to-transparent pointer-events-none" />
      
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
            <Droplet size={14} className="text-blue-400" />
            {t('liquidity.title') || 'Liquidez & Derivados'}
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[rgba(59,130,246,0.1)] text-blue-400 border border-[rgba(59,130,246,0.2)]">
            BINANCE FUTURES
          </span>
        </div>

        <div className="space-y-4 relative z-10">
          
          {/* Open Interest */}
          <div className="indicator-card p-3" style={{ borderLeft: '3px solid #3B82F6' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                <Activity size={14} className="text-blue-400" />
                Interés Abierto (OI)
              </span>
              <span className="text-xs font-bold font-mono text-[var(--text-primary)]">
                {formatOI(liquidity.openInterestUSD)}
              </span>
            </div>
            <div className="text-[10px] text-[var(--text-muted)]">
              Capital fresco apostando en el mercado de futuros.
            </div>
          </div>

          {/* Long/Short Ratio */}
          <div className="indicator-card p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                <Users size={14} className="text-purple-400" />
                Long / Short Ratio (Top Traders)
              </span>
              <span className="text-xs font-bold font-mono" style={{ color: crowdColor }}>
                {liquidity.lsRatio.toFixed(2)}
              </span>
            </div>
            
            <div className="flex h-2 w-full rounded-full overflow-hidden mb-2">
              <div style={{ width: `${liquidity.longRatio * 100}%`, background: 'var(--signal-buy)' }} />
              <div style={{ width: `${liquidity.shortRatio * 100}%`, background: 'var(--signal-sell)' }} />
            </div>
            
            <div className="flex justify-between text-[10px] font-bold font-mono">
              <span className="text-[var(--signal-buy)]">L: {(liquidity.longRatio * 100).toFixed(1)}%</span>
              <span className="text-[var(--signal-sell)]">S: {(liquidity.shortRatio * 100).toFixed(1)}%</span>
            </div>
          </div>

          {/* Crowding Status */}
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border-color)]">
            <Flame size={14} style={{ color: crowdColor }} />
            <span className="text-[11px] font-bold" style={{ color: crowdColor }}>
              {crowdStatus}
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
