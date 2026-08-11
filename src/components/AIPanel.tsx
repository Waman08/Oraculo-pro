import React from 'react';
import { MarketAnalysis } from '@/types';
import { Brain, TrendingUp, AlertTriangle, Activity } from 'lucide-react';
import { useLocale } from './AppContext';

export default function AIPanel({ data }: { data: MarketAnalysis }) {
  const { t } = useLocale();

  const predictionStr = data.ml?.prediction?.prediction;
  const confidence = data.ml?.prediction?.confidence;
  const isAnomaly = data.ml?.volume_anomaly?.anomaly;

  const patterns = data.candlestickPatterns || {};
  const div = data.divergences || {};

  return (
    <div className="glass-card p-5 animate-fadeInUp h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Brain size={20} style={{ color: '#818CF8' }} />
        <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>AI & ML Analysis</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="rounded-lg p-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
          <div className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <TrendingUp size={12} /> ML Prediction
          </div>
          <div className="text-lg font-bold" style={{ color: predictionStr === 'Bullish' || (typeof predictionStr === 'number' && predictionStr > data.currentPrice) ? 'var(--signal-buy)' : 'var(--signal-sell)' }}>
            {predictionStr ? (typeof predictionStr === 'number' ? `$${predictionStr.toFixed(2)}` : predictionStr) : 'N/A'}
          </div>
          {confidence && (
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Confidence: {(confidence * 100).toFixed(0)}%</div>
          )}
        </div>
        <div className="rounded-lg p-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
          <div className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <Activity size={12} /> Volume Anomaly
          </div>
          <div className="text-lg font-bold" style={{ color: isAnomaly ? 'var(--signal-warning)' : 'var(--signal-buy)' }}>
            {isAnomaly ? 'DETECTED' : 'NORMAL'}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        <div>
          <div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Patterns</div>
          {Object.keys(patterns).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {Object.entries(patterns).map(([pattern, value]: any) => (
                <span key={pattern} className="px-2 py-1 text-xs rounded font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                  {pattern.replace(/_/g, ' ')} {value > 0 ? '🟢' : value < 0 ? '🔴' : '⚪'}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No significant patterns detected.</div>
          )}
        </div>

        <div>
          <div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Divergences</div>
          <div className="space-y-2">
             <div className="flex justify-between items-center p-2 rounded" style={{ background: 'var(--bg-tertiary)' }}>
               <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>RSI Divergence</span>
               <span className="text-xs font-bold" style={{ color: div.rsi_bullish ? 'var(--signal-buy)' : div.rsi_bearish ? 'var(--signal-sell)' : 'var(--text-muted)' }}>
                 {div.rsi_bullish ? 'Bullish' : div.rsi_bearish ? 'Bearish' : 'None'}
               </span>
             </div>
             <div className="flex justify-between items-center p-2 rounded" style={{ background: 'var(--bg-tertiary)' }}>
               <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>MACD Divergence</span>
               <span className="text-xs font-bold" style={{ color: div.macd_bullish ? 'var(--signal-buy)' : div.macd_bearish ? 'var(--signal-sell)' : 'var(--text-muted)' }}>
                 {div.macd_bullish ? 'Bullish' : div.macd_bearish ? 'Bearish' : 'None'}
               </span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
