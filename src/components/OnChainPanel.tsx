"use client";

import type { OnChainData } from '@/types';
import { useLocale } from './AppContext';
import { Link2, Pickaxe, ArrowLeftRight, Activity, Lock } from 'lucide-react';

interface OnChainPanelProps {
  onChain: OnChainData;
  symbol: string;
}

export default function OnChainPanel({ onChain, symbol }: OnChainPanelProps) {
  const { t } = useLocale();

  return (
    <div className="glass-card p-5 animate-fadeInUp">
      <h3 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
        {t('onchain.title')}
      </h3>

      <div className="space-y-4">
        {onChain.dataAvailable === false ? (
          <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed rounded-xl border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] h-full min-h-[150px]">
            <Activity size={24} style={{ color: 'var(--text-muted)' }} className="mb-2 opacity-50" />
            <h4 className="font-bold text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Datos no disponibles</h4>
            <p className="text-xs text-[var(--text-muted)]">
              No hay datos on-chain suficientes para esta moneda en este momento.
            </p>
          </div>
        ) : (
          <>
            {/* MVRV Z-Score */}
            <div className="indicator-card p-3" style={{
              borderLeft: `3px solid ${getMVRVColor(onChain.mvrvZScore ?? 0)}`
            }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity size={13} style={{ color: getMVRVColor(onChain.mvrvZScore ?? 0) }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {t('onchain.mvrv')} (Proxy)
                  </span>
                </div>
                <span className="text-lg font-black" style={{ color: getMVRVColor(onChain.mvrvZScore ?? 0) }}>
                  {(onChain.mvrvZScore ?? 0).toFixed(2)}
                </span>
              </div>

              {/* MVRV visual bar */}
              <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="absolute inset-0 flex">
                  <div style={{ width: '7%', background: 'rgba(16,185,129,0.3)' }} />
                  <div style={{ width: '33%', background: 'rgba(52,211,153,0.15)' }} />
                  <div style={{ width: '27%', background: 'rgba(148,163,184,0.1)' }} />
                  <div style={{ width: '20%', background: 'rgba(251,146,60,0.15)' }} />
                  <div style={{ width: '13%', background: 'rgba(239,68,68,0.3)' }} />
                </div>
                <div
                  className="absolute top-0 h-full w-1 rounded-full"
                  style={{
                    left: `${Math.min(100, Math.max(0, (((onChain.mvrvZScore ?? 0) + 0.5) / 8) * 100))}%`,
                    background: getMVRVColor(onChain.mvrvZScore ?? 0),
                    boxShadow: `0 0 6px ${getMVRVColor(onChain.mvrvZScore ?? 0)}`,
                    transition: 'left 0.8s ease-out',
                  }}
                />
              </div>
            </div>

            {/* Puell Multiple */}
            <div className="indicator-card p-3" style={{
              borderLeft: `3px solid ${getPuellColor(onChain.puellMultiple ?? 0)}`
            }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Pickaxe size={13} style={{ color: getPuellColor(onChain.puellMultiple ?? 0) }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {t('onchain.puell')}
                  </span>
                </div>
                <span className="text-lg font-black" style={{ color: getPuellColor(onChain.puellMultiple ?? 0) }}>
                  {(onChain.puellMultiple ?? 0).toFixed(2)}
                </span>
              </div>

              <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="absolute inset-0 flex">
                  <div style={{ width: '12.5%', background: 'rgba(16,185,129,0.3)' }} />
                  <div style={{ width: '37.5%', background: 'rgba(148,163,184,0.1)' }} />
                  <div style={{ width: '50%', background: 'rgba(239,68,68,0.15)' }} />
                </div>
                <div
                  className="absolute top-0 h-full w-1 rounded-full"
                  style={{
                    left: `${Math.min(100, Math.max(0, ((onChain.puellMultiple ?? 0) / 4) * 100))}%`,
                    background: getPuellColor(onChain.puellMultiple ?? 0),
                    boxShadow: `0 0 6px ${getPuellColor(onChain.puellMultiple ?? 0)}`,
                    transition: 'left 0.8s ease-out',
                  }}
                />
              </div>
            </div>

            {/* Hash Rate (BTC) */}
            {onChain.hashRate && (
              <div className="indicator-card indicator-card--neutral p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={13} style={{ color: 'var(--text-secondary)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      Hash Rate (EH/s)
                    </span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {onChain.hashRate.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Active Addresses */}
            {onChain.activeAddresses && (
              <div className="indicator-card indicator-card--neutral p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 size={13} style={{ color: 'var(--text-secondary)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      Direcciones Activas
                    </span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {onChain.activeAddresses.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* DeFi TVL */}
            {onChain.defiTvl && (
              <div className="indicator-card indicator-card--neutral p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock size={13} style={{ color: 'var(--text-secondary)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      TVL Global (DeFi)
                    </span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    ${(onChain.defiTvl / 1_000_000_000).toFixed(2)}B
                  </span>
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}

function getMVRVColor(zScore: number): string {
  if (zScore < 0) return '#10B981';
  if (zScore < 2) return '#34D399';
  if (zScore < 5) return '#F59E0B';
  return '#EF4444';
}

function getPuellColor(multiple: number): string {
  if (multiple < 0.5) return '#10B981';
  if (multiple < 1.5) return '#94A3B8';
  if (multiple < 3) return '#FB923C';
  return '#EF4444';
}

function getFlowColor(flow: number): string {
  if (flow < -1000) return '#10B981';
  if (flow < -500) return '#34D399';
  if (flow > 1000) return '#EF4444';
  if (flow > 500) return '#FB923C';
  return '#94A3B8';
}
