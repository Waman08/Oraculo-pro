"use client";

import type { SmartMoneyData } from '@/types';
import { useLocale } from './AppContext';
import { Target, Layers, TrendingUp, TrendingDown, Eye, CheckCircle2 } from 'lucide-react';

interface SmartMoneyPanelProps {
  smartMoney: SmartMoneyData;
  currentPrice: number;
}

export default function SmartMoneyPanel({ smartMoney, currentPrice }: SmartMoneyPanelProps) {
  const { t } = useLocale();

  const pocDiff = ((currentPrice - smartMoney.volumeProfilePOC) / smartMoney.volumeProfilePOC) * 100;
  const isAbovePoc = currentPrice > smartMoney.volumeProfilePOC;

  return (
    <div className="glass-card p-5 animate-fadeInUp flex flex-col justify-between h-full border border-[rgba(245,176,65,0.08)]">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            {t('smartmoney.title') || 'Smart Money'}
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[rgba(245,176,65,0.1)] text-[var(--accent-gold)] border border-[rgba(245,176,65,0.2)]">
            INSTITUTIONAL
          </span>
        </div>

        <div className="space-y-4">
          {/* Volume Profile POC */}
          <div className="indicator-card p-3 relative overflow-hidden group hover:border-[var(--accent-gold)]" style={{ borderLeft: '3px solid #8B5CF6' }}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[rgba(139,92,246,0.05)] to-transparent pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                <Target size={14} style={{ color: '#8B5CF6' }} className="animate-pulse" />
                <div>
                  <span className="text-xs font-semibold block" style={{ color: 'var(--text-secondary)' }}>
                    {t('smartmoney.poc') || 'Point of Control (POC)'}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {isAbovePoc ? 'Soporte Clave' : 'Resistencia Clave'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                  ${formatSMPrice(smartMoney.volumeProfilePOC)}
                </div>
                <div className="flex items-center gap-1.5 mt-1 justify-end">
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                    style={{
                      color: isAbovePoc ? 'var(--signal-buy)' : 'var(--signal-sell)',
                      background: isAbovePoc ? 'var(--signal-buy-dim)' : 'var(--signal-sell-dim)',
                    }}
                  >
                    {isAbovePoc ? '▲ Above' : '▼ Below'}
                  </span>
                  <span className="text-[10px] font-semibold font-mono" style={{ color: isAbovePoc ? 'var(--signal-buy)' : 'var(--signal-sell)' }}>
                    {pocDiff > 0 ? '+' : ''}{pocDiff.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Order Blocks */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Layers size={13} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                {t('smartmoney.orderBlocks') || 'Bloques de Órdenes (OB)'}
              </span>
            </div>

            <div className="space-y-2.5">
              {smartMoney.orderBlocks && smartMoney.orderBlocks.length > 0 ? (
                smartMoney.orderBlocks.map((ob, idx) => {
                  const isBullish = ob.type === 'bullish';
                  const color = isBullish ? 'var(--signal-buy)' : 'var(--signal-sell)';
                  const dimColor = isBullish ? 'var(--signal-buy-dim)' : 'var(--signal-sell-dim)';
                  const Icon = isBullish ? TrendingUp : TrendingDown;

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.08)] transition-all"
                      style={{ background: 'var(--bg-secondary)' }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded bg-[rgba(255,255,255,0.02)]">
                            <Icon size={12} style={{ color }} />
                          </span>
                          <span className="text-xs font-bold" style={{ color }}>
                            {isBullish ? t('smartmoney.bullish') || 'Bullish' : t('smartmoney.bearish') || 'Bearish'} OB
                          </span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-[rgba(255,255,255,0.05)] text-[var(--text-muted)]">
                          {isBullish ? 'Demanda' : 'Oferta'}
                        </span>
                      </div>

                      <div className="flex items-end justify-between">
                        <div className="text-xs font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                          ${formatSMPrice(ob.priceLow)} — ${formatSMPrice(ob.priceHigh)}
                        </div>
                        <div className="w-[80px] text-right">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-[8px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Fuerza</span>
                            <span className="text-[9px] font-bold font-mono" style={{ color }}>{ob.strength}%</span>
                          </div>
                          <div className="h-1 w-full bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{
                              width: `${ob.strength}%`,
                              background: color,
                            }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center p-4 text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] rounded-xl border border-[rgba(255,255,255,0.03)]">
                  No patterns detected
                </div>
              )}
            </div>
          </div>

          {/* Fair Value Gaps */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Layers size={13} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                {t('smartmoney.fvg') || 'Brechas de Valor Justo (FVG)'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {smartMoney.fairValueGaps && smartMoney.fairValueGaps.length > 0 ? (
                smartMoney.fairValueGaps.map((fvg, idx) => {
                  const isBullish = fvg.type === 'bullish';
                  const color = isBullish ? 'var(--signal-buy)' : 'var(--signal-sell)';

                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl border transition-all"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: `1px solid ${fvg.filled ? 'var(--border-color)' : color}`,
                        opacity: fvg.filled ? 0.4 : 1,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold" style={{ color }}>
                          {isBullish ? '🟢 BULLISH' : '🔴 BEARISH'}
                        </span>
                        {fvg.filled ? (
                          <CheckCircle2 size={10} style={{ color: 'var(--text-muted)' }} />
                        ) : (
                          <Eye size={10} style={{ color }} className="animate-pulse" />
                        )}
                      </div>
                      <div className="text-xs font-mono font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                        ${formatSMPrice(fvg.low)}—${formatSMPrice(fvg.high)}
                      </div>
                      <div className="flex items-center justify-between text-[8px] font-bold">
                        <span style={{ color: 'var(--text-muted)' }}>ESTADO</span>
                        <span style={{ color: fvg.filled ? 'var(--text-muted)' : color }}>
                          {fvg.filled ? 'MITIGADO' : 'ABIERTO'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-2 text-center p-4 text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] rounded-xl border border-[rgba(255,255,255,0.03)]">
                  No patterns detected
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatSMPrice(price: number): string {
  if (price === undefined || price === null || isNaN(price)) return '0.00';
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
}
