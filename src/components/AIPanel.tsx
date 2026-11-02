"use client";

import React from 'react';
import { MarketAnalysis } from '@/types';
import { Brain, TrendingUp, Activity } from 'lucide-react';
import { useLocale } from './AppContext';

export default function AIPanel({ data }: { data: MarketAnalysis }) {
  const { t, locale } = useLocale();

  const predictionStr = data.ml?.prediction?.prediction;
  const confidence = data.ml?.prediction?.confidence;
  const displayConfidence = confidence !== undefined && confidence !== null
    ? (Number(confidence) > 1 
        ? Math.min(99.9, Number(confidence)).toFixed(1) 
        : (Number(confidence) * 100).toFixed(1))
    : null;
  const isAnomaly = data.ml?.volume_anomaly?.anomaly;

  const patterns = data.candlestickPatterns || {};
  const div = data.divergences || {};

  const getPredictionDisplay = () => {
    if (!predictionStr) return 'N/A';
    if (typeof predictionStr === 'number') return `$${predictionStr.toFixed(2)}`;
    if (String(predictionStr).toLowerCase() === 'bullish') return locale === 'es' ? 'Alcista' : 'Bullish';
    if (String(predictionStr).toLowerCase() === 'bearish') return locale === 'es' ? 'Bajista' : 'Bearish';
    return String(predictionStr);
  };

  const getDivDisplay = (isBullish: boolean, isBearish: boolean) => {
    if (isBullish) return locale === 'es' ? 'Alcista' : 'Bullish';
    if (isBearish) return locale === 'es' ? 'Bajista' : 'Bearish';
    return t('ai.none') || (locale === 'es' ? 'Ninguna detectada' : 'None');
  };

  return (
    <div className="glass-card p-5 animate-fadeInUp h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Brain size={20} style={{ color: '#818CF8' }} />
        <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
          {t('ai.title') || (locale === 'es' ? 'Análisis IA & Machine Learning' : 'AI & ML Analysis')}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="rounded-lg p-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
          <div className="text-xs mb-1 flex items-center gap-1 font-medium" style={{ color: 'var(--text-muted)' }}>
            <TrendingUp size={12} /> {t('ai.prediction') || (locale === 'es' ? 'Predicción ML' : 'ML Prediction')}
          </div>
          <div className="text-lg font-bold" style={{ color: predictionStr === 'Bullish' || (typeof predictionStr === 'number' && predictionStr > data.currentPrice) ? 'var(--signal-buy)' : 'var(--signal-sell)' }}>
            {getPredictionDisplay()}
          </div>
          {displayConfidence && (
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {t('ai.confidence') || (locale === 'es' ? 'Confianza' : 'Confidence')}: {displayConfidence}%
            </div>
          )}
        </div>
        <div className="rounded-lg p-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
          <div className="text-xs mb-1 flex items-center gap-1 font-medium" style={{ color: 'var(--text-muted)' }}>
            <Activity size={12} /> {t('ai.anomaly') || (locale === 'es' ? 'Anomalía de Volumen Institucional' : 'Whale Volume Anomaly')}
          </div>
          <div className="text-lg font-bold" style={{ color: isAnomaly ? 'var(--signal-warning)' : 'var(--signal-buy)' }}>
            {isAnomaly 
              ? (t('ai.detected') || (locale === 'es' ? 'DETECTADA' : 'DETECTED')) 
              : (t('ai.normal') || 'NORMAL')}
          </div>
          {data.ml?.volume_anomaly?.description && (
             <div className="text-[10px] mt-1 leading-tight" style={{ color: 'var(--text-muted)' }}>
               {data.ml.volume_anomaly.description}
             </div>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4">
        <div>
          <div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {t('ai.patterns') || (locale === 'es' ? 'PATRONES DE VELAS' : 'PATTERNS')}
          </div>
          {Object.keys(patterns).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {Object.entries(patterns).map(([pattern, value]: any) => (
                <span key={pattern} className="px-2 py-1 text-xs rounded font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                  {pattern.replace(/_/g, ' ')} {value > 0 ? '🟢' : value < 0 ? '🔴' : '⚪'}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('ai.noPatterns') || (locale === 'es' ? 'Ningún patrón significativo detectado' : 'No significant patterns detected.')}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {t('ai.divergences') || (locale === 'es' ? 'DIVERGENCIAS' : 'DIVERGENCES')}
          </div>
          <div className="space-y-2">
             <div className="flex justify-between items-center p-2 rounded" style={{ background: 'var(--bg-tertiary)' }}>
               <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                 {t('ai.rsiDiv') || (locale === 'es' ? 'Divergencia RSI' : 'RSI Divergence')}
               </span>
               <span className="text-xs font-bold" style={{ color: div.rsi_bullish ? 'var(--signal-buy)' : div.rsi_bearish ? 'var(--signal-sell)' : 'var(--text-muted)' }}>
                 {getDivDisplay(!!div.rsi_bullish, !!div.rsi_bearish)}
               </span>
             </div>
             <div className="flex justify-between items-center p-2 rounded" style={{ background: 'var(--bg-tertiary)' }}>
               <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                 {t('ai.macdDiv') || (locale === 'es' ? 'Divergencia MACD' : 'MACD Divergence')}
               </span>
               <span className="text-xs font-bold" style={{ color: div.macd_bullish ? 'var(--signal-buy)' : div.macd_bearish ? 'var(--signal-sell)' : 'var(--text-muted)' }}>
                 {getDivDisplay(!!div.macd_bullish, !!div.macd_bearish)}
               </span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
