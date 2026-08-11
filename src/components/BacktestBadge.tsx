"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAppSettings, useLocale } from './AppContext';
import { fetchKlines } from '@/lib/api';
import { runBacktest, BacktestResult } from '@/lib/backtester';
import { Activity, Play, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';

export default function BacktestBadge() {
  const { symbol, mode } = useAppSettings();
  const { t } = useLocale();
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRun = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch 6 months of daily data (180 days)
      const klines = await fetchKlines(symbol, '1d', 180);
      if (klines) {
        const res = runBacktest(symbol, klines, mode);
        setResult(res);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [symbol, mode]);

  useEffect(() => {
    handleRun();
  }, [handleRun]);

  if (loading || !result) {
    return (
      <div className="glass-card p-4 animate-pulse flex gap-4 items-center">
        <Activity className="opacity-50" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/4 shimmer-bg rounded" />
          <div className="h-3 w-1/2 shimmer-bg rounded" />
        </div>
      </div>
    );
  }

  const isProfitable = result.netProfit > 0;
  const beatsHold = result.netProfit > result.buyHoldReturn;

  return (
    <div className="glass-card p-4 animate-fadeInUp" style={{ borderLeft: `3px solid ${isProfitable ? 'var(--signal-buy)' : 'var(--signal-sell)'}` }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <Activity size={16} /> {t('backtest.title')} (180d) — {t(`mode.${mode === 'Seguro' ? 'safe' : mode === 'Agresivo' ? 'aggressive' : 'balanced'}`)}
        </h3>
        <div className="text-[10px] px-2 py-0.5 rounded font-bold" style={{
          background: beatsHold ? 'var(--signal-buy-dim)' : 'var(--bg-tertiary)',
          color: beatsHold ? 'var(--signal-buy)' : 'var(--text-muted)'
        }}>
          {beatsHold ? t('backtest.beatsHold') : t('backtest.underperforms')}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{t('backtest.winRate')}</div>
          <div className="font-mono font-bold text-sm" style={{ color: result.winRate > 50 ? 'var(--signal-buy)' : 'var(--text-primary)' }}>
            {result.winRate.toFixed(1)}%
          </div>
          <div className="text-[9px] opacity-70">{result.totalTrades} {t('backtest.trades')}</div>
        </div>

        <div>
          <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{t('backtest.profitFactor')}</div>
          <div className="font-mono font-bold text-sm" style={{ color: result.profitFactor > 1.5 ? 'var(--signal-buy)' : result.profitFactor > 1 ? 'var(--text-primary)' : 'var(--signal-sell)' }}>
            {result.profitFactor.toFixed(2)}
          </div>
          <div className="text-[9px] opacity-70">{t('backtest.grossWinLoss')}</div>
        </div>

        <div>
          <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{t('backtest.netProfit')}</div>
          <div className="font-mono font-bold text-sm flex items-center gap-1" style={{ color: isProfitable ? 'var(--signal-buy)' : 'var(--signal-sell)' }}>
            {isProfitable ? '+' : ''}{result.netProfit.toFixed(1)}%
          </div>
          <div className="text-[9px] opacity-70">vs B&H: {result.buyHoldReturn >= 0 ? '+' : ''}{result.buyHoldReturn.toFixed(1)}%</div>
        </div>

        <div>
          <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{t('backtest.maxDrawdown')}</div>
          <div className="font-mono font-bold text-sm" style={{ color: result.maxDrawdown < 20 ? 'var(--text-primary)' : 'var(--signal-sell)' }}>
            -{result.maxDrawdown.toFixed(1)}%
          </div>
          <div className="text-[9px] opacity-70">{t('backtest.peakToTrough')}</div>
        </div>
      </div>
    </div>
  );
}
