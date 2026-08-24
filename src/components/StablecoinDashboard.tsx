"use client";

import React from 'react';
import type { StablecoinAnalysis } from '@/types';

interface StablecoinDashboardProps {
  stablecoinData?: StablecoinAnalysis;
}

export default function StablecoinDashboard({ stablecoinData }: StablecoinDashboardProps) {
  if (!stablecoinData) {
    return (
      <div className="glass-card p-4 animate-fadeInUp flex flex-col justify-center items-center h-full border border-[var(--border-color)]">
        <span className="text-2xl mb-2 opacity-50">💵</span>
        <span className="text-xs text-[var(--text-muted)]">Liquidez no disponible</span>
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

  const overview = stablecoinData.overview;
  const flows = stablecoinData.flows;
  const ssr = stablecoinData.ssr;
  const topChains = stablecoinData.topChains || [];

  return (
    <div className="glass-card p-4 animate-fadeInUp flex flex-col justify-between h-full border border-[var(--border-color)]">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
            💵 Stablecoins & Liquidez
          </h3>
          <span className="text-xs font-bold font-mono text-[var(--text-primary)]">
            ${formatLargeNumber(overview.totalMcap)}
          </span>
        </div>

        <div className="space-y-4">
          {/* SSR Gauge */}
          {ssr && (
            <div className="indicator-card p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-[var(--text-secondary)]">Stablecoin Supply Ratio (SSR)</span>
                <span className={`text-xs font-bold ${ssr.signal.includes('Compra') ? 'text-[#10B981]' : ssr.signal.includes('Venta') ? 'text-[#EF4444]' : 'text-[var(--text-primary)]'}`}>
                  {ssr.signal}
                </span>
              </div>
              <div className="flex justify-between items-end mt-1">
                <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
                  {typeof ssr.ssr === 'number' ? ssr.ssr.toFixed(2) : '0.00'}
                </span>
              </div>
            </div>
          )}

          {/* Flows 7D */}
          {flows && (flows.usdt || flows.usdc) && (
            <div className="indicator-card p-3">
              <span className="text-[10px] text-[var(--text-secondary)] block mb-2">Flujos 7D</span>
              <div className="grid grid-cols-2 gap-2">
                {flows.usdt && (
                  <div className="p-2 bg-[rgba(255,255,255,0.03)] rounded border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-muted)] mb-1">USDT</div>
                    <div className={`text-xs font-bold font-mono flex items-center gap-1 ${flows.usdt.change7dPct >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {flows.usdt.change7dPct >= 0 ? '▲' : '▼'} {typeof flows.usdt.change7dPct === 'number' ? Math.abs(flows.usdt.change7dPct).toFixed(2) : '0.00'}%
                    </div>
                  </div>
                )}
                {flows.usdc && (
                  <div className="p-2 bg-[rgba(255,255,255,0.03)] rounded border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-muted)] mb-1">USDC</div>
                    <div className={`text-xs font-bold font-mono flex items-center gap-1 ${flows.usdc.change7dPct >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {flows.usdc.change7dPct >= 0 ? '▲' : '▼'} {typeof flows.usdc.change7dPct === 'number' ? Math.abs(flows.usdc.change7dPct).toFixed(2) : '0.00'}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top Chains */}
          {topChains.length > 0 && (
            <div className="indicator-card p-3">
              <span className="text-[10px] text-[var(--text-secondary)] block mb-3">Top Chains por Liquidez</span>
              <div className="space-y-2">
                {topChains.slice(0, 5).map((chainData, idx) => {
                  const maxVal = topChains[0]?.totalUSD || 1;
                  const percent = Math.min(100, Math.max(0, (chainData.totalUSD / maxVal) * 100));
                  return (
                    <div key={idx} className="relative">
                      <div className="flex justify-between text-[10px] font-mono mb-1 z-10 relative">
                        <span className="text-[var(--text-primary)] capitalize">{chainData.chain}</span>
                        <span className="text-[var(--text-muted)]">${formatLargeNumber(chainData.totalUSD)}</span>
                      </div>
                      <div className="h-1 w-full bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-blue-500 opacity-70" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
