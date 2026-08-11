"use client";

import type { SentimentData, MacroData } from '@/types';
import { useLocale } from './AppContext';
import { Brain, Bitcoin, DollarSign, BarChart3 } from 'lucide-react';

interface SentimentPanelProps {
  sentiment: SentimentData;
  macro: MacroData;
}

export default function SentimentPanel({ sentiment, macro }: SentimentPanelProps) {
  const { t } = useLocale();

  return (
    <div className="glass-card p-5 animate-fadeInUp">
      <h3 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
        {t('sentiment.title')}
      </h3>

      <div className="space-y-5">
        {/* Fear & Greed Gauge */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Brain size={14} style={{ color: '#F59E0B' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {t('sentiment.fearGreed')}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Mini circular gauge */}
            <div className="relative">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle
                  cx="40" cy="40" r="32"
                  fill="none"
                  stroke="var(--border-color)"
                  strokeWidth="6"
                />
                <circle
                  cx="40" cy="40" r="32"
                  fill="none"
                  stroke={getFearGreedColor(sentiment.fearGreedIndex)}
                  strokeWidth="6"
                  strokeDasharray={`${(sentiment.fearGreedIndex / 100) * 201} 201`}
                  strokeLinecap="round"
                  transform="rotate(-90 40 40)"
                  style={{ transition: 'stroke-dasharray 1s ease-out' }}
                />
                <text
                  x="40" y="38" textAnchor="middle"
                  fill={getFearGreedColor(sentiment.fearGreedIndex)}
                  fontSize="18" fontWeight="900"
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                  {sentiment.fearGreedIndex}
                </text>
                <text
                  x="40" y="52" textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize="6" fontWeight="500"
                >
                  / 100
                </text>
              </svg>
            </div>

            <div className="flex-1">
              <div
                className="text-sm font-bold mb-1"
                style={{ color: getFearGreedColor(sentiment.fearGreedIndex) }}
              >
                {getFearGreedTranslated(sentiment.fearGreedLabel, t)}
              </div>

              {/* Bar */}
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${sentiment.fearGreedIndex}%`,
                    background: `linear-gradient(90deg, #10B981, #F59E0B, #EF4444)`,
                  }}
                />
              </div>

              <div className="flex justify-between mt-1">
                <span className="text-[10px]" style={{ color: 'var(--signal-buy)' }}>{t('sentiment.extremeFear')}</span>
                <span className="text-[10px]" style={{ color: 'var(--signal-sell)' }}>{t('sentiment.extremeGreed')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Altcoin Season */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bitcoin size={14} style={{ color: '#F7931A' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {t('sentiment.altcoinSeason')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{
                background: sentiment.altcoinSeasonIndex < 25 ? '#F7931A22' :
                             sentiment.altcoinSeasonIndex > 75 ? 'var(--signal-buy-dim)' : 'rgba(148,163,184,0.1)',
                color: sentiment.altcoinSeasonIndex < 25 ? '#F7931A' :
                       sentiment.altcoinSeasonIndex > 75 ? 'var(--signal-buy)' : 'var(--text-muted)',
              }}
            >
              {sentiment.altcoinSeasonIndex < 25 ? '₿' : sentiment.altcoinSeasonIndex > 75 ? '🔷' : '⚖️'}{' '}
              {getAltSeasonTranslated(sentiment.altcoinSeasonLabel, t)}
            </div>

            <div className="flex-1">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${sentiment.altcoinSeasonIndex}%`,
                    background: sentiment.altcoinSeasonIndex < 25 ? '#F7931A' :
                               sentiment.altcoinSeasonIndex > 75 ? 'var(--signal-buy)' : 'var(--text-muted)',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px]" style={{ color: '#F7931A' }}>BTC</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sentiment.altcoinSeasonIndex}</span>
                <span className="text-[10px]" style={{ color: 'var(--signal-buy)' }}>ALT</span>
              </div>
            </div>
          </div>
        </div>

        {/* Macro Indicators */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} style={{ color: '#8B5CF6' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {t('macro.title')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="indicator-card indicator-card--neutral p-3">
              <div className="flex items-center gap-1 mb-1">
                <DollarSign size={11} style={{ color: 'var(--text-muted)' }} />
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>DXY</span>
              </div>
              <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {macro.dxy}
              </div>
              <div
                className="text-[10px] font-semibold"
                style={{ color: macro.dxyTrend === 'Alcista' ? 'var(--signal-sell)' : 'var(--signal-buy)' }}
              >
                {macro.dxyTrend === 'Alcista' ? '▲' : macro.dxyTrend === 'Bajista' ? '▼' : '●'}{' '}
                {getMacroTrendTranslated(macro.dxyTrend, t)}
              </div>
            </div>

            <div className="indicator-card indicator-card--neutral p-3">
              <div className="flex items-center gap-1 mb-1">
                <BarChart3 size={11} style={{ color: 'var(--text-muted)' }} />
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>M2</span>
              </div>
              <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                ${macro.m2Global}T
              </div>
              <div
                className="text-[10px] font-semibold"
                style={{ color: macro.m2Trend === 'Expansión' ? 'var(--signal-buy)' : 'var(--signal-sell)' }}
              >
                {macro.m2Trend === 'Expansión' ? '▲' : '▼'}{' '}
                {getM2TrendTranslated(macro.m2Trend, t)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getFearGreedColor(value: number): string {
  if (value <= 20) return '#10B981';
  if (value <= 40) return '#34D399';
  if (value <= 60) return '#F59E0B';
  if (value <= 80) return '#FB923C';
  return '#EF4444';
}

function getFearGreedTranslated(label: string, t: (k: string) => string): string {
  switch (label) {
    case 'Miedo Extremo': return t('sentiment.extremeFear');
    case 'Miedo': return t('sentiment.fear');
    case 'Neutral': return t('sentiment.neutral');
    case 'Codicia': return t('sentiment.greed');
    case 'Codicia Extrema': return t('sentiment.extremeGreed');
    default: return label;
  }
}

function getAltSeasonTranslated(label: string, t: (k: string) => string): string {
  switch (label) {
    case 'Bitcoin Season': return t('sentiment.btcSeason');
    case 'Altcoin Season': return t('sentiment.altSeason');
    default: return t('sentiment.neutral');
  }
}

function getMacroTrendTranslated(trend: string, t: (k: string) => string): string {
  switch (trend) {
    case 'Alcista': return t('macro.bullish');
    case 'Bajista': return t('macro.bearish');
    default: return t('macro.sideways');
  }
}

function getM2TrendTranslated(trend: string, t: (k: string) => string): string {
  switch (trend) {
    case 'Expansión': return t('macro.expansion');
    case 'Contracción': return t('macro.contraction');
    default: return t('macro.sideways');
  }
}
