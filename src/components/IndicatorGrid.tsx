"use client";

import type { ScoreBreakdown } from '@/types';
import { useLocale } from './AppContext';
import { TrendingUp, Zap, Brain, Link2 } from 'lucide-react';

interface IndicatorGridProps {
  breakdown: ScoreBreakdown;
}

const CATEGORY_ICONS = {
  momentum: Zap,
  trend: TrendingUp,
  sentiment: Brain,
  onChain: Link2,
};

const CATEGORY_KEYS = {
  momentum: 'indicators.momentum',
  trend: 'indicators.trend',
  sentiment: 'sentiment.title',
  onChain: 'onchain.title',
};

const CATEGORY_COLORS = {
  momentum: '#8B5CF6',
  trend: '#3B82F6',
  sentiment: '#F59E0B',
  onChain: '#10B981',
};

export default function IndicatorGrid({ breakdown }: IndicatorGridProps) {
  const { t } = useLocale();

  const categories = [
    { key: 'momentum' as const, data: breakdown.momentum },
    { key: 'trend' as const, data: breakdown.trend },
    { key: 'sentiment' as const, data: breakdown.sentiment },
    { key: 'onChain' as const, data: breakdown.onChain },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        {t('score.breakdown')}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
        {categories.map(({ key, data }) => {
          const Icon = CATEGORY_ICONS[key];
          const color = CATEGORY_COLORS[key];

          return (
            <div key={key} className="glass-card p-4">
              {/* Category Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${color}20` }}
                  >
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      {t(CATEGORY_KEYS[key])}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {(typeof data.weight === 'number' && !isNaN(data.weight)) ? (data.weight * 100).toFixed(0) : '0'}% {t('general.weight')}
                    </div>
                  </div>
                </div>
                <div
                  className="text-lg font-black"
                  style={{ color: getScoreColor(data.score) }}
                >
                  {(typeof data.score === 'number' && !isNaN(data.score)) ? data.score.toFixed(1) : '0.0'}
                </div>
              </div>

              {/* Progress bar */}
              <div className="progress-bar mb-3">
                <div
                  className="progress-bar__fill"
                  style={{
                    width: `${data.score}%`,
                    background: `linear-gradient(90deg, ${color}, ${color}88)`,
                  }}
                />
              </div>

              {/* Individual indicators */}
              <div className="space-y-2">
                {data.details.map((ind, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          background: ind.signal === 'bullish'
                            ? 'var(--signal-buy)'
                            : ind.signal === 'bearish'
                            ? 'var(--signal-sell)'
                            : 'var(--signal-neutral)',
                        }}
                      />
                      <span style={{ color: 'var(--text-secondary)' }}>{ind.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                        {typeof ind.value === 'number' && !isNaN(ind.value) ? ind.value.toFixed(2) : ind.value}
                      </span>
                      <span
                        className="font-bold text-xs px-2 py-0.5 rounded"
                        style={{
                          color: ind.signal === 'bullish'
                            ? 'var(--signal-buy)'
                            : ind.signal === 'bearish'
                            ? 'var(--signal-sell)'
                            : 'var(--signal-neutral)',
                          background: ind.signal === 'bullish'
                            ? 'var(--signal-buy-dim)'
                            : ind.signal === 'bearish'
                            ? 'var(--signal-sell-dim)'
                            : 'rgba(148,163,184,0.1)',
                        }}
                      >
                        {ind.signal === 'bullish' ? '▲' : ind.signal === 'bearish' ? '▼' : '●'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score <= 30) return 'var(--signal-buy)';
  if (score >= 70) return 'var(--signal-sell)';
  return 'var(--text-secondary)';
}
