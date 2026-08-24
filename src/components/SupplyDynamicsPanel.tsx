"use client";

import React from 'react';
import type { SupplyData } from '@/types';

interface SupplyDynamicsPanelProps {
  supplyData?: SupplyData;
}

export default function SupplyDynamicsPanel({ supplyData }: SupplyDynamicsPanelProps) {
  if (!supplyData) {
    return (
      <div className="glass-card p-4 animate-fadeInUp flex flex-col justify-center items-center h-full border border-[var(--border-color)]">
        <span className="text-2xl mb-2 opacity-50">📊</span>
        <span className="text-xs text-[var(--text-muted)]">Supply Data no disponible</span>
      </div>
    );
  }

  const formatLargeNumber = (val: number | null | undefined) => {
    if (val === undefined || val === null || isNaN(val)) return '0.00';
    if (val > 1e9) return `${(val / 1e9).toFixed(2)}B`;
    if (val > 1e6) return `${(val / 1e6).toFixed(2)}M`;
    if (val > 1e3) return `${(val / 1e3).toFixed(2)}K`;
    return val.toLocaleString();
  };

  const getDilutionColor = (risk: string) => {
    switch (risk) {
      case 'critical': return '#EF4444'; // red
      case 'high': return '#FB923C'; // orange
      case 'medium': return '#EAB308'; // yellow
      case 'low': return '#22C55E'; // green
      case 'none': return '#10B981'; // emerald
      default: return 'var(--text-primary)';
    }
  };

  const dilutionColor = getDilutionColor(supplyData.dilutionRisk);
  const circRatio = typeof supplyData.circulatingRatio === 'number' ? supplyData.circulatingRatio : 0;
  const pendingInflation = typeof supplyData.pendingInflationPct === 'number' ? supplyData.pendingInflationPct : 0;
  const fdvMcapRatio = typeof supplyData.fdvMcapRatio === 'number' ? supplyData.fdvMcapRatio : 1;

  return (
    <div className="glass-card p-4 animate-fadeInUp flex flex-col justify-between h-full border border-[var(--border-color)]">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
            📊 Supply Dynamics
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[rgba(255,255,255,0.05)] border border-[var(--border-color)] text-[var(--text-secondary)]">
            {supplyData.source}
          </span>
        </div>

        <div className="space-y-4">
          {/* Market Cap & FDV */}
          <div className="indicator-card p-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-[var(--text-secondary)] block mb-1">Market Cap</span>
                <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
                  ${formatLargeNumber(supplyData.marketCap)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-secondary)] block mb-1">FDV</span>
                <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
                  ${formatLargeNumber(supplyData.fdv)}
                </span>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-[var(--text-muted)] flex justify-between">
              <span>FDV / MCap Ratio:</span>
              <span className="font-mono text-[var(--text-primary)]">{fdvMcapRatio.toFixed(2)}x</span>
            </div>
          </div>

          {/* Circulating Supply Progress */}
          <div className="indicator-card p-3">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] text-[var(--text-secondary)]">Circulating Supply</span>
              <span className="text-xs font-bold font-mono text-[var(--text-primary)]">
                {circRatio.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 w-full bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden mb-2">
              <div 
                className="h-full rounded-full transition-all duration-1000" 
                style={{ width: `${circRatio}%`, background: 'var(--accent-primary, #3B82F6)' }} 
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)]">
              <span>{formatLargeNumber(supplyData.circulatingSupply)}</span>
              <span>{formatLargeNumber(supplyData.totalSupply)} Total</span>
            </div>
          </div>

          {/* Dilution Risk */}
          <div className="indicator-card p-3 flex items-center justify-between border-l-4" style={{ borderLeftColor: dilutionColor }}>
            <div>
              <span className="text-[10px] text-[var(--text-secondary)] block mb-1">Riesgo de Dilución</span>
              <span className="text-xs font-bold uppercase" style={{ color: dilutionColor }}>
                {supplyData.dilutionLabel}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[var(--text-secondary)] block mb-1">Inflación Pendiente</span>
              <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
                {pendingInflation > 0 ? '+' : ''}{pendingInflation.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
