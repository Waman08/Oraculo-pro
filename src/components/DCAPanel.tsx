"use client";

import type { DCALevel, ActionableData } from '@/types';
import { useLocale } from './AppContext';
import { ArrowDown, ArrowUp, Target, Shield, TrendingUp } from 'lucide-react';

interface DCAPanelProps {
  actionableData: ActionableData;
  currentPrice: number;
}

export default function DCAPanel({ actionableData, currentPrice }: DCAPanelProps) {
  const { t } = useLocale();
  const { dcaLevels, optimalEntry, takeProfit, stopLoss, riskLevel } = actionableData;
  const isBuying = dcaLevels.length > 0 && dcaLevels[0].type === 'compra';

  return (
    <div className="glass-card p-5 animate-fadeInUp">
      <h3 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
        {t('dca.title')}
      </h3>

      {/* Key Levels */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="indicator-card indicator-card--bullish text-center">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            <Target size={12} className="inline mr-1" />
            {t('dca.optimalEntry')}
          </div>
          <div className="text-sm font-bold" style={{ color: 'var(--signal-buy)' }}>
            ${formatPrice(optimalEntry)}
          </div>
        </div>
        <div className="indicator-card text-center" style={{ borderLeft: '3px solid #3B82F6' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            <TrendingUp size={12} className="inline mr-1" />
            {t('dca.takeProfit')}
          </div>
          <div className="text-sm font-bold" style={{ color: '#3B82F6' }}>
            ${formatPrice(takeProfit)}
          </div>
        </div>
        <div className="indicator-card indicator-card--bearish text-center">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            <Shield size={12} className="inline mr-1" />
            {t('dca.stopLoss')}
          </div>
          <div className="text-sm font-bold" style={{ color: 'var(--signal-sell)' }}>
            ${formatPrice(stopLoss)}
          </div>
        </div>
      </div>

      {/* DCA Levels Ladder */}
      {dcaLevels.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold mb-3" style={{ color: isBuying ? 'var(--signal-buy)' : 'var(--signal-warning)' }}>
            {isBuying ? (
              <><ArrowDown size={12} className="inline mr-1" />{t('dca.buyLevels')}</>
            ) : (
              <><ArrowUp size={12} className="inline mr-1" />{t('dca.sellLevels')}</>
            )}
          </div>

          {/* Current Price Marker */}
          <div className="flex items-center gap-3 py-2 px-3 rounded-lg" style={{ background: 'var(--accent-gold-dim)' }}>
            <div className="w-3 h-3 rounded-full animate-pulseGlow" style={{ background: 'var(--accent-gold)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--accent-gold)' }}>
              {t('dca.currentPrice')}
            </span>
            <span className="ml-auto text-sm font-bold" style={{ color: 'var(--accent-gold)' }}>
              ${formatPrice(currentPrice)}
            </span>
          </div>

          {/* DCA Level Lines */}
          <div className="stagger-children">
            {dcaLevels.map((level, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors hover:opacity-80"
                style={{
                  background: isBuying ? 'var(--signal-buy-dim)' : 'var(--signal-sell-dim)',
                  borderLeft: `2px solid ${isBuying ? 'var(--signal-buy)' : 'var(--signal-sell)'}`,
                  opacity: 1 - idx * 0.12,
                }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: isBuying ? 'var(--signal-buy)' : 'var(--signal-sell)',
                    color: '#000',
                  }}
                >
                  {level.level}
                </div>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {level.label}
                </span>
                <span className="ml-auto text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  ${formatPrice(level.price)}
                </span>
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded"
                  style={{
                    color: isBuying ? 'var(--signal-buy)' : 'var(--signal-sell)',
                    background: isBuying ? 'var(--signal-buy-dim)' : 'var(--signal-sell-dim)',
                  }}
                >
                  {level.percentFromCurrent > 0 ? '+' : ''}{level.percentFromCurrent}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dcaLevels.length === 0 && (
        <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('dca.neutral')}
        </div>
      )}

      {/* Risk Bar */}
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between text-xs mb-2">
          <span style={{ color: 'var(--text-muted)' }}>{t('action.risk')}</span>
          <span className="font-bold" style={{ color: getRiskColor(riskLevel) }}>
            {riskLevel}/5
          </span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className="h-2 flex-1 rounded-sm transition-all"
              style={{
                background: i <= riskLevel ? getRiskColor(riskLevel) : 'var(--border-color)',
                opacity: i <= riskLevel ? 1 : 0.3,
              }}
            />
          ))}
        </div>
      </div>
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

function getRiskColor(level: number): string {
  if (level <= 1) return 'var(--signal-buy)';
  if (level <= 2) return '#34D399';
  if (level <= 3) return 'var(--accent-gold)';
  if (level <= 4) return 'var(--signal-warning)';
  return 'var(--signal-sell)';
}
