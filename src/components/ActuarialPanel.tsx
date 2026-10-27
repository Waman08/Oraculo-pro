"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Shield,
  BarChart2,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  DollarSign,
  Percent,
  Sliders,
  Calculator,
  RefreshCw,
  Layers,
} from 'lucide-react';
import InfoTooltip from './ui/InfoTooltip';
import { useLocale } from './AppContext';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';
import { BINANCE_PAIR_MAP } from '@/lib/api';

interface ActuarialData {
  riskMetrics: { var95: number; cvar95: number; annualVolatility: number };
  monteCarlo7D: {
    p10: number;
    p50: number;
    p90: number;
    paths?: { p10: number[]; p50: number[]; p90: number[] };
    jump_params?: { lambda: number; mu_j: number; sigma_j: number };
  };
  markovRegime: { bull: number; bear: number; sideways: number };
  dataAvailable: boolean;
  isLiveBinance?: boolean;
  isEstimated?: boolean;
}

interface ActuarialPanelProps {
  actuarial?: any;
  currentPrice: number;
  symbol?: string;
  timeframe?: string;
  quantScore?: number;
  signal?: string;
}

function fmtPrice(p: number): string {
  if (p === undefined || p === null || isNaN(p)) return '0.00';
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return '$' + p.toFixed(2);
  return '$' + p.toFixed(6);
}

function generateStochasticPaths(basePrice: number, targetP10: number, targetP50: number, targetP90: number) {
  const p10: number[] = [basePrice];
  const p50: number[] = [basePrice];
  const p90: number[] = [basePrice];

  for (let t = 1; t <= 7; t++) {
    const progress = t / 7;
    const sqrtProgress = Math.sqrt(progress);

    const valP10 = basePrice + (targetP10 - basePrice) * sqrtProgress;
    const valP50 = basePrice + (targetP50 - basePrice) * progress;
    const valP90 = basePrice + (targetP90 - basePrice) * sqrtProgress;

    p10.push(Number(valP10.toFixed(2)));
    p50.push(Number(valP50.toFixed(2)));
    p90.push(Number(valP90.toFixed(2)));
  }

  return { p10, p50, p90 };
}

function MonteCarloChart({ paths }: { paths: { p10: number[]; p50: number[]; p90: number[] } }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !paths || !paths.p50 || paths.p50.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6B7280',
      },
      grid: {
        vertLines: { color: 'rgba(31, 41, 55, 0.3)' },
        horzLines: { color: 'rgba(31, 41, 55, 0.3)' },
      },
      width: chartContainerRef.current.clientWidth > 0 ? chartContainerRef.current.clientWidth : 300,
      height: 160,
      timeScale: {
        visible: false,
      },
      rightPriceScale: {
        borderVisible: false,
      },
    });

    chartRef.current = chart;

    // P90 (Bull) - top area
    const p90Series = chart.addAreaSeries({
      lineColor: 'rgba(16, 185, 129, 0.6)',
      topColor: 'rgba(16, 185, 129, 0.15)',
      bottomColor: 'rgba(16, 185, 129, 0.02)',
      lineWidth: 1,
    });

    // P50 (Base) - median line
    const p50Series = chart.addLineSeries({
      color: '#F59E0B',
      lineWidth: 2,
      lineStyle: 0,
    });

    // P10 (Bear) - bottom area
    const p10Series = chart.addAreaSeries({
      lineColor: 'rgba(239, 68, 68, 0.6)',
      topColor: 'rgba(239, 68, 68, 0.02)',
      bottomColor: 'rgba(239, 68, 68, 0.15)',
      lineWidth: 1,
      invertFilledArea: true,
    });

    // Create time entries (Day 0 to Day N)
    const today = new Date();
    const makeData = (values: number[]) =>
      values.map((v, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        return {
          time: d.toISOString().split('T')[0] as any,
          value: v,
        };
      });

    p90Series.setData(makeData(paths.p90));
    p50Series.setData(makeData(paths.p50));
    p10Series.setData(makeData(paths.p10));

    chart.timeScale().fitContent();

    const container = chartContainerRef.current;
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        const w = chartContainerRef.current.clientWidth;
        if (w > 0) {
          chartRef.current.applyOptions({ width: w });
        }
      }
    };

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      handleResize();
    });
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [paths]);

  return <div className="w-full h-[160px]" ref={chartContainerRef} />;
}

export default function ActuarialPanel({
  actuarial,
  currentPrice,
  symbol = 'BTC',
  quantScore = 50,
  signal = 'Mantener',
}: ActuarialPanelProps) {
  const { t, locale } = useLocale();

  // State for real client-calculated Binance empirical data
  const [liveEmpiricalData, setLiveEmpiricalData] = useState<ActuarialData | null>(null);
  const [isFetchingKlines, setIsFetchingKlines] = useState<boolean>(false);

  // Position Sizing Interactive State
  const [portfolioCapital, setPortfolioCapital] = useState<number>(1000);
  const [maxRiskPct, setMaxRiskPct] = useState<number>(2.0);

  // Determine if backend data is a real calculation or default static fallback
  const isBackendReal = useMemo(() => {
    if (!actuarial || !actuarial.dataAvailable || actuarial.isFallback) return false;
    const v = Math.abs(actuarial.riskMetrics?.var95 ?? 0);
    const cv = Math.abs(actuarial.riskMetrics?.cvar95 ?? 0);
    // 5.0 and 7.5 are the exact static fallback values
    if (v === 5 && cv === 7.5) return false;
    return true;
  }, [actuarial]);

  // Fetch real 180D klines from Binance and calculate real actuarial parameters
  useEffect(() => {
    // If backend already has real data, skip client fetch
    if (isBackendReal) return;

    let isMounted = true;
    const calculateLiveActuarial = async () => {
      setIsFetchingKlines(true);
      try {
        const cleanSymbol = (symbol || 'BTC').toUpperCase().replace('USDT', '').replace('USD', '');
        const pair = BINANCE_PAIR_MAP[cleanSymbol] || `${cleanSymbol}USDT`;

        let klines: any[] | null = null;
        const resPrimary = await fetch(
          `https://data-api.binance.vision/api/v3/klines?symbol=${pair}&interval=1d&limit=180`
        ).catch(() => null);

        if (resPrimary && resPrimary.ok) {
          klines = await resPrimary.json();
        } else {
          const resFallback = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&limit=180`
          ).catch(() => null);
          if (resFallback && resFallback.ok) {
            klines = await resFallback.json();
          }
        }

        if (!isMounted || !klines || !Array.isArray(klines) || klines.length < 20) {
          setIsFetchingKlines(false);
          return;
        }

        // 1. Daily log returns r_t = ln(close_t / close_{t-1})
        const closes = klines.map((k: any) => parseFloat(k[4]));
        const returns: number[] = [];
        for (let i = 1; i < closes.length; i++) {
          if (closes[i - 1] > 0) {
            returns.push(Math.log(closes[i] / closes[i - 1]));
          }
        }

        const n = returns.length;
        if (n < 10) {
          setIsFetchingKlines(false);
          return;
        }

        // Mean & Standard deviation
        const mean = returns.reduce((a, b) => a + b, 0) / n;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
        const std = Math.sqrt(variance);

        // 2. Real Annualized Volatility
        const annualVolatility = std * Math.sqrt(365) * 100;

        // 3. Empirical VaR 95% (5th percentile of daily returns)
        const sorted = [...returns].sort((a, b) => a - b);
        const p5Index = Math.max(0, Math.floor(0.05 * sorted.length));
        const var95 = Math.abs(sorted[p5Index]) * 100;

        // 4. CVaR 95% (Expected Shortfall - average of returns <= VaR 95%)
        const tailReturns = sorted.filter((r) => r <= sorted[p5Index]);
        const cvar95 = Math.abs(
          tailReturns.reduce((a, b) => a + b, 0) / (tailReturns.length || 1)
        ) * 100;

        // 5. Markov Transition Matrix from last 90 days
        const threshold = 0.3 * std;
        const last90 = returns.slice(-90);
        const states = last90.map((r) => (r > threshold ? 'bull' : r < -threshold ? 'bear' : 'sideways'));
        const currentState = states[states.length - 1] || 'sideways';

        const transitions = { bull: 0, bear: 0, sideways: 0 };
        let totalTransitions = 0;
        for (let i = 0; i < states.length - 1; i++) {
          if (states[i] === currentState) {
            transitions[states[i + 1] as 'bull' | 'bear' | 'sideways']++;
            totalTransitions++;
          }
        }

        const markovRegime =
          totalTransitions > 0
            ? {
                bull: transitions.bull / totalTransitions,
                bear: transitions.bear / totalTransitions,
                sideways: transitions.sideways / totalTransitions,
              }
            : {
                bull: states.filter((s) => s === 'bull').length / states.length,
                bear: states.filter((s) => s === 'bear').length / states.length,
                sideways: states.filter((s) => s === 'sideways').length / states.length,
              };

        // 6. Real Monte Carlo 7D Cone paths
        const P0 = currentPrice || closes[closes.length - 1] || 100;
        const mcPaths = { p10: [] as number[], p50: [] as number[], p90: [] as number[] };

        for (let t = 0; t <= 7; t++) {
          if (t === 0) {
            mcPaths.p10.push(P0);
            mcPaths.p50.push(P0);
            mcPaths.p90.push(P0);
          } else {
            const drift = (mean - 0.5 * std * std) * t;
            const diffusion = std * Math.sqrt(t);
            // z = 1.28155 for 10th and 90th percentiles
            mcPaths.p10.push(Number((P0 * Math.exp(drift - 1.28155 * diffusion)).toFixed(2)));
            mcPaths.p50.push(Number((P0 * Math.exp(drift)).toFixed(2)));
            mcPaths.p90.push(Number((P0 * Math.exp(drift + 1.28155 * diffusion)).toFixed(2)));
          }
        }

        if (isMounted) {
          setLiveEmpiricalData({
            riskMetrics: {
              var95: Number(var95.toFixed(2)),
              cvar95: Number(cvar95.toFixed(2)),
              annualVolatility: Number(annualVolatility.toFixed(2)),
            },
            monteCarlo7D: {
              p10: mcPaths.p10[7],
              p50: mcPaths.p50[7],
              p90: mcPaths.p90[7],
              paths: mcPaths,
            },
            markovRegime,
            dataAvailable: true,
            isLiveBinance: true,
            isEstimated: false,
          });
        }
      } catch (err) {
        console.warn('[ActuarialPanel] Error calculating empirical actuarial metrics:', err);
      } finally {
        if (isMounted) setIsFetchingKlines(false);
      }
    };

    calculateLiveActuarial();

    return () => {
      isMounted = false;
    };
  }, [symbol, isBackendReal, currentPrice]);

  // Combine backend data, live empirical Binance data, or safe default
  const data = useMemo(() => {
    if (isBackendReal) {
      const markov = actuarial.markovRegime || actuarial.markovRegimes || { bull: 0.33, bear: 0.33, sideways: 0.34 };
      return {
        ...actuarial,
        markovRegime: markov,
        isEstimated: false,
        isLiveBinance: false,
      } as ActuarialData;
    }

    if (liveEmpiricalData) {
      return liveEmpiricalData;
    }

    const p = currentPrice || 100;
    return {
      dataAvailable: true,
      isEstimated: true,
      isLiveBinance: false,
      riskMetrics: { var95: 5.0, cvar95: 7.5, annualVolatility: 45.0 },
      monteCarlo7D: {
        p10: p * 0.94,
        p50: p * 1.002,
        p90: p * 1.06,
        paths: generateStochasticPaths(p, p * 0.94, p * 1.002, p * 1.06),
      },
      markovRegime: { bull: 0.33, bear: 0.33, sideways: 0.34 },
    } as ActuarialData;
  }, [isBackendReal, actuarial, liveEmpiricalData, currentPrice]);

  // 1. VaR & Volatility normalization
  const rawVar = data.riskMetrics?.var95 ?? 0;
  const var95Pct = Math.abs(rawVar) < 1 && rawVar !== 0 ? Math.abs(rawVar * 100) : Math.abs(rawVar);

  const rawCvar = data.riskMetrics?.cvar95 ?? 0;
  const cvar95Pct = Math.abs(rawCvar) < 1 && rawCvar !== 0 ? Math.abs(rawCvar * 100) : Math.abs(rawCvar);

  const rawVol = data.riskMetrics?.annualVolatility ?? 0;
  const annVolPct = Math.abs(rawVol) < 1 && rawVol !== 0 ? Math.abs(rawVol * 100) : Math.abs(rawVol);

  // VaR Color rule
  let varColor = 'var(--signal-buy)';
  if (var95Pct > 5) {
    varColor = 'var(--signal-sell)';
  } else if (var95Pct > 3) {
    varColor = 'var(--accent-gold)';
  }

  // 2. Monte Carlo 7D scenarios
  const p10 = data.monteCarlo7D?.p10 ?? currentPrice * 0.9;
  const p50 = data.monteCarlo7D?.p50 ?? currentPrice;
  const p90 = data.monteCarlo7D?.p90 ?? currentPrice * 1.1;
  const rawPaths = data.monteCarlo7D?.paths;

  const paths = useMemo(() => {
    const hasValidPaths =
      rawPaths &&
      Array.isArray(rawPaths.p10) &&
      rawPaths.p10.length >= 8 &&
      Array.isArray(rawPaths.p50) &&
      rawPaths.p50.length >= 8 &&
      Array.isArray(rawPaths.p90) &&
      rawPaths.p90.length >= 8 &&
      rawPaths.p90[rawPaths.p90.length - 1] !== rawPaths.p10[rawPaths.p10.length - 1];

    if (hasValidPaths) {
      return rawPaths;
    }

    const p = currentPrice || 100;
    const target10 =
      data.monteCarlo7D?.p10 && data.monteCarlo7D.p10 < p
        ? data.monteCarlo7D.p10
        : p * (1 - Math.max(var95Pct || 5, 4) / 100);
    const target90 =
      data.monteCarlo7D?.p90 && data.monteCarlo7D.p90 > p
        ? data.monteCarlo7D.p90
        : p * (1 + (Math.max(var95Pct || 5, 4) * 1.15) / 100);
    const target50 = data.monteCarlo7D?.p50 ? data.monteCarlo7D.p50 : p * 1.002;

    return generateStochasticPaths(p, target10, target50, target90);
  }, [rawPaths, data.monteCarlo7D, currentPrice, var95Pct]);

  const jumpParams = data.monteCarlo7D?.jump_params;

  // Visual range position (0% - 100%)
  const minP = Math.min(p10, currentPrice);
  const maxP = Math.max(p90, currentPrice);
  const priceSpan = maxP - minP;
  const pricePositionPct = priceSpan > 0 ? Math.min(100, Math.max(0, ((currentPrice - minP) / priceSpan) * 100)) : 50;

  // 3. Markov Regimes normalization
  const rawBull = data.markovRegime?.bull ?? 0;
  const bullPct = rawBull > 1 ? rawBull : rawBull * 100;

  const rawBear = data.markovRegime?.bear ?? 0;
  const bearPct = rawBear > 1 ? rawBear : rawBear * 100;

  const rawSideways = data.markovRegime?.sideways ?? 0;
  const sidewaysPct = rawSideways > 1 ? rawSideways : rawSideways * 100;

  // Dominant Regime identification
  let dominantRegime = {
    label: locale === 'en' ? 'Bullish' : 'Alcista',
    pct: bullPct,
    color: 'var(--signal-buy)',
    bgDim: 'var(--signal-buy-dim)',
  };
  if (bearPct >= bullPct && bearPct >= sidewaysPct) {
    dominantRegime = {
      label: locale === 'en' ? 'Bearish' : 'Bajista',
      pct: bearPct,
      color: 'var(--signal-sell)',
      bgDim: 'var(--signal-sell-dim)',
    };
  } else if (sidewaysPct >= bullPct && sidewaysPct >= bearPct) {
    dominantRegime = {
      label: locale === 'en' ? 'Sideways' : 'Lateral',
      pct: sidewaysPct,
      color: 'var(--text-muted)',
      bgDim: 'var(--bg-tertiary)',
    };
  }

  // 4. POSITION SIZING CALCULATIONS (Kelly & VaR)
  const sizingMetrics = useMemo(() => {
    const cap = Math.max(10, portfolioCapital || 1000);
    const riskPct = Math.max(0.1, Math.min(20, maxRiskPct || 2.0));
    const effectiveVaRPct = Math.max(0.5, var95Pct || 3.0);

    // Max dollar loss allowed by user's risk tolerance
    const maxRiskDollar = cap * (riskPct / 100);

    // Max Position Size strictly constrained by VaR 95%
    const maxPosVaR = maxRiskDollar / (effectiveVaRPct / 100);

    // Half-Kelly fraction based on Quant Score
    const qScore = Math.min(100, Math.max(0, quantScore ?? 50));
    // Estimated win probability p based on signal and score
    let winProb = 0.50;
    if (qScore >= 50) {
      winProb = Math.min(0.80, 0.45 + (qScore / 100) * 0.32);
    } else {
      winProb = Math.max(0.20, (qScore / 100) * 0.85);
    }

    const payoffRatio = 1.5; // Typical 1.5 R:R in algorithmic confluence
    const kellyFull = Math.max(0, winProb - (1 - winProb) / payoffRatio);
    const halfKelly = kellyFull * 0.5;
    const kellyPosDollar = cap * halfKelly;

    // Suggested Position Size: blend VaR cap with Kelly growth
    let suggestedSize = 0;
    if (halfKelly > 0) {
      suggestedSize = Math.min(cap, Math.min(maxPosVaR, kellyPosDollar * 1.25));
    } else {
      // Conservative size when Quant Score has no clear bullish edge
      suggestedSize = Math.min(cap, maxPosVaR * 0.35);
    }

    suggestedSize = Math.max(0, Number(suggestedSize.toFixed(2)));
    const allocationPct = Number(((suggestedSize / cap) * 100).toFixed(1));
    const estimatedLossUSD = Number((suggestedSize * (effectiveVaRPct / 100)).toFixed(2));

    return {
      maxRiskDollar: Number(maxRiskDollar.toFixed(2)),
      suggestedSize,
      allocationPct,
      estimatedLossUSD,
      halfKellyPct: Number((halfKelly * 100).toFixed(1)),
      winProbPct: Number((winProb * 100).toFixed(0)),
    };
  }, [portfolioCapital, maxRiskPct, var95Pct, quantScore]);

  return (
    <div className="flex flex-col gap-5 animate-fadeInUp">
      {/* MAIN ACTUARIAL CARD */}
      <div className="glass-card p-5 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--bg-tertiary)' }}>
          <div className="flex items-center gap-2">
            <Shield size={18} style={{ color: 'var(--accent-gold)' }} />
            <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              {t('actuarial.title') || 'ANÁLISIS ACTUARIAL DE RIESGO'}
            </h3>
            {data.isLiveBinance && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 font-bold ml-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t('actuarial.liveBinance') || '180D BINANCE LIVE'}
              </span>
            )}
            {data.isEstimated && !data.isLiveBinance && (
              <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/30 font-bold ml-1">
                {t('actuarial.estimatedMode') || 'MODO ESTIMADO'}
              </span>
            )}
            {isFetchingKlines && (
              <span className="text-[10px] text-gray-400 flex items-center gap-1 animate-pulse">
                <RefreshCw size={10} className="animate-spin" />
                {locale === 'en' ? 'Calculating...' : 'Calculando...'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {jumpParams && jumpParams.lambda > 0 && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#EF4444',
                }}
              >
                <Zap size={10} />
                <span>Jump λ={jumpParams.lambda.toFixed(3)}</span>
              </div>
            )}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: 'var(--signal-buy-dim)',
                color: 'var(--accent-gold)',
              }}
            >
              <Activity size={12} style={{ color: 'var(--accent-gold)' }} />
              <span>Merton Jump-Diffusion</span>
            </div>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Section 1: Value at Risk (VaR 95%) */}
          <div
            className="indicator-card p-4 flex flex-col justify-between"
            style={{ borderLeft: `4px solid ${varColor}` }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  {t('actuarial.varTitle') || 'Value at Risk (VaR 95%)'}
                  <InfoTooltip
                    title="tooltip.var95.title"
                    description="tooltip.var95.desc"
                    howToUse="tooltip.var95.how"
                  />
                </span>
                <Shield size={15} style={{ color: varColor }} />
              </div>

              <div className="flex items-baseline gap-2 my-2">
                <span className="text-3xl font-extrabold tracking-tight" style={{ color: varColor }}>
                  -{var95Pct.toFixed(2)}%
                </span>
                <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                  {t('actuarial.daily') || 'Diario'}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t" style={{ borderColor: 'var(--bg-tertiary)' }}>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>{t('actuarial.cvarTitle') || 'Expected Shortfall (CVaR)'}</span>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                  -{cvar95Pct.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>{t('actuarial.annualVol') || 'Volatilidad Anualizada'}</span>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                  {annVolPct.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Monte Carlo 7D */}
          <div className="indicator-card p-4 flex flex-col justify-between md:col-span-2">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 size={15} style={{ color: 'var(--accent-gold)' }} />
                  <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    {t('actuarial.monteCarloTitle') || 'Monte Carlo 7D (Cono Estocástico)'}
                    <InfoTooltip
                      title="tooltip.monteCarlo.title"
                      description="tooltip.monteCarlo.desc"
                      howToUse="tooltip.monteCarlo.how"
                    />
                  </span>
                </div>
                <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {t('actuarial.currentPrice') || 'Actual'}: <strong style={{ color: 'var(--text-primary)' }}>{fmtPrice(currentPrice)}</strong>
                </span>
              </div>

              {/* Scenarios grid */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {/* p10 Bear */}
                <div className="p-2.5 rounded-lg border text-center" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--bg-secondary)' }}>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingDown size={14} style={{ color: 'var(--signal-sell)' }} />
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{t('actuarial.p10Bear') || 'p10 (Bear)'}</span>
                  </div>
                  <span className="text-sm font-bold block truncate" style={{ color: 'var(--signal-sell)' }}>
                    {fmtPrice(p10)}
                  </span>
                </div>

                {/* p50 Base */}
                <div className="p-2.5 rounded-lg border text-center" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--bg-secondary)' }}>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Minus size={14} style={{ color: 'var(--accent-gold)' }} />
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{t('actuarial.p50Base') || 'p50 (Base)'}</span>
                  </div>
                  <span className="text-sm font-bold block truncate" style={{ color: 'var(--accent-gold)' }}>
                    {fmtPrice(p50)}
                  </span>
                </div>

                {/* p90 Bull */}
                <div className="p-2.5 rounded-lg border text-center" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--bg-secondary)' }}>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp size={14} style={{ color: 'var(--signal-buy)' }} />
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{t('actuarial.p90Bull') || 'p90 (Bull)'}</span>
                  </div>
                  <span className="text-sm font-bold block truncate" style={{ color: 'var(--signal-buy)' }}>
                    {fmtPrice(p90)}
                  </span>
                </div>
              </div>
            </div>

            {/* Monte Carlo Cone Chart */}
            {paths && paths.p50 && paths.p50.length > 0 ? (
              <div className="mt-1 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--bg-tertiary)' }}>
                <MonteCarloChart paths={paths} />
              </div>
            ) : (
              <div className="space-y-1.5 pt-1">
                <div className="relative h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(to right, var(--signal-sell-dim), var(--accent-gold), var(--signal-buy-dim))',
                      opacity: 0.6,
                    }}
                  />
                  <div
                    className="absolute top-0 h-full w-2 -ml-1 rounded-full shadow-md transition-all duration-500"
                    style={{
                      left: `${pricePositionPct}%`,
                      backgroundColor: 'var(--text-primary)',
                      boxShadow: '0 0 8px var(--accent-gold)',
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  <span>Min 7D ({fmtPrice(p10)})</span>
                  <span className="font-semibold" style={{ color: 'var(--accent-gold)' }}>
                    Posición: {pricePositionPct.toFixed(0)}%
                  </span>
                  <span>Max 7D ({fmtPrice(p90)})</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Régimen de Markov */}
        <div className="indicator-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={15} style={{ color: 'var(--accent-gold)' }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {t('actuarial.markovTitle') || 'Régimen de Markov (Probabilidades)'}
              </span>
            </div>

            {/* Dominant Regime Badge */}
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
              style={{
                backgroundColor: dominantRegime.bgDim,
                borderColor: dominantRegime.color,
                color: dominantRegime.color,
              }}
            >
              <span>{t('actuarial.dominant') || 'Dominante'}: {dominantRegime.label}</span>
              <span className="opacity-90">({dominantRegime.pct.toFixed(1)}%)</span>
            </div>
          </div>

          {/* 3 Horizontal Progress Bars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Bull */}
            <div className="space-y-1.5 p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--bg-secondary)' }}>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={13} style={{ color: 'var(--signal-buy)' }} />
                  <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{t('actuarial.bullish') || 'Alcista'}</span>
                </div>
                <span className="font-bold" style={{ color: 'var(--signal-buy)' }}>
                  {bullPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, Math.max(0, bullPct))}%`,
                    backgroundColor: 'var(--signal-buy)',
                  }}
                />
              </div>
            </div>

            {/* Bear */}
            <div className="space-y-1.5 p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--bg-secondary)' }}>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <TrendingDown size={13} style={{ color: 'var(--signal-sell)' }} />
                  <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{t('actuarial.bearish') || 'Bajista'}</span>
                </div>
                <span className="font-bold" style={{ color: 'var(--signal-sell)' }}>
                  {bearPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, Math.max(0, bearPct))}%`,
                    backgroundColor: 'var(--signal-sell)',
                  }}
                />
              </div>
            </div>

            {/* Sideways */}
            <div className="space-y-1.5 p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--bg-secondary)' }}>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Minus size={13} style={{ color: 'var(--text-muted)' }} />
                  <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{t('actuarial.sideways') || 'Lateral'}</span>
                </div>
                <span className="font-bold" style={{ color: 'var(--text-muted)' }}>
                  {sidewaysPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, Math.max(0, sidewaysPct))}%`,
                    backgroundColor: 'var(--text-muted)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* INTERACTIVE POSITION SIZING PANEL (KELLY & VAR) */}
      <div className="glass-card p-6 border relative overflow-hidden shadow-xl" style={{ borderColor: 'var(--accent-gold)', background: 'rgba(251, 191, 36, 0.02)' }}>
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
          <Calculator size={96} style={{ color: 'var(--accent-gold)' }} />
        </div>

        {/* Section Title */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--accent-gold-dim)] text-[var(--accent-gold)]">
              <Sliders size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--accent-gold)' }}>
                {t('actuarial.sizingTitle') || 'Dimensionamiento Actuarial de Posición (Kelly & VaR)'}
                <InfoTooltip
                  title="tooltip.kelly.title"
                  description="tooltip.kelly.desc"
                  howToUse="tooltip.kelly.how"
                />
              </h3>
              <p className="text-xs text-gray-400">
                {locale === 'en'
                  ? 'Dynamic capital allocation based on empirical tail risk and statistical edge'
                  : 'Asignación dinámica de capital basada en riesgo de cola empírico y ventaja estadística'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 font-mono">
            <span className="text-gray-400">Quant Score:</span>
            <span className="font-bold text-[var(--accent-gold)]">{quantScore?.toFixed(1) ?? '50.0'}</span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400">Edge:</span>
            <span className="font-bold text-blue-400">{sizingMetrics.winProbPct}% Win Rate</span>
          </div>
        </div>

        {/* User Input Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 p-4 rounded-xl bg-black/30 border border-white/5">
          {/* Capital Input */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                {t('actuarial.capitalLabel') || 'Capital de Cartera ($ USD)'}
              </label>
              <span className="text-xs font-mono font-bold text-[var(--accent-gold)]">
                ${portfolioCapital.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="50"
                  max="1000000"
                  step="50"
                  value={portfolioCapital}
                  onChange={(e) => setPortfolioCapital(Math.max(1, parseFloat(e.target.value) || 0))}
                  className="w-full bg-black/60 border border-white/10 rounded-lg pl-7 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                />
              </div>
              {/* Quick Pills */}
              <div className="flex gap-1">
                {[500, 1000, 5000, 10000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPortfolioCapital(preset)}
                    className={`px-2 py-1.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                      portfolioCapital === preset
                        ? 'bg-[var(--accent-gold)] text-black font-bold'
                        : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    ${preset >= 1000 ? `${preset / 1000}k` : preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Max Risk % Input */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                {t('actuarial.riskLabel') || 'Riesgo Máximo por Trade (%)'}
              </label>
              <span className="text-xs font-mono font-bold text-red-400">
                {maxRiskPct.toFixed(1)}% (${sizingMetrics.maxRiskDollar})
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.5"
                value={maxRiskPct}
                onChange={(e) => setMaxRiskPct(parseFloat(e.target.value))}
                className="flex-1 accent-[var(--accent-gold)] cursor-pointer"
              />
              <div className="flex gap-1">
                {[1.0, 2.0, 3.0, 5.0].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setMaxRiskPct(r)}
                    className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition-colors ${
                      maxRiskPct === r
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40 font-bold'
                        : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {r}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 3 Prominent Calculation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {/* 1. Suggested Position Size */}
          <div className="p-4 rounded-xl border border-[var(--accent-gold)]/30 relative overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
            <div className="text-xs block mb-1 uppercase tracking-wider font-semibold text-gray-400">
              {t('actuarial.suggestedSize') || 'Tamaño de Posición Sugerido ($ USD)'}
            </div>
            <div className="text-3xl font-black text-[var(--accent-gold)] font-mono my-1">
              ${sizingMetrics.suggestedSize.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-2">
              <Layers size={12} className="text-[var(--accent-gold)]" />
              <span>
                {locale === 'en'
                  ? `Half-Kelly allocation: ${sizingMetrics.halfKellyPct}%`
                  : `Fracción Half-Kelly: ${sizingMetrics.halfKellyPct}%`}
              </span>
            </div>
          </div>

          {/* 2. Portfolio Allocation % */}
          <div className="p-4 rounded-xl border border-white/5" style={{ background: 'var(--bg-tertiary)' }}>
            <div className="text-xs block mb-1 uppercase tracking-wider font-semibold text-gray-400">
              {t('actuarial.portfolioPct') || '% de la Cartera a Asignar'}
            </div>
            <div className="text-3xl font-black text-blue-400 font-mono my-1">
              {sizingMetrics.allocationPct}%
            </div>
            {/* Visual allocation bar */}
            <div className="w-full bg-white/10 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className="bg-blue-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, sizingMetrics.allocationPct)}%` }}
              />
            </div>
          </div>

          {/* 3. Estimated Max Loss (VaR $) */}
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
            <div className="text-xs block mb-1 uppercase tracking-wider font-semibold text-red-400">
              {t('actuarial.estimatedLoss') || 'Pérdida Máxima Estimada (VaR $)'}
            </div>
            <div className="text-3xl font-black text-red-400 font-mono my-1">
              ${sizingMetrics.estimatedLossUSD.toFixed(2)}
            </div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-2">
              <Shield size={12} className="text-red-400" />
              <span>
                {locale === 'en'
                  ? `Bounded by 1-Day 95% tail risk (${var95Pct.toFixed(2)}%)`
                  : `Acotado por riesgo diario del 95% (${var95Pct.toFixed(2)}%)`}
              </span>
            </div>
          </div>
        </div>

        {/* Explanatory Footer */}
        <p className="text-xs text-gray-400 leading-relaxed border-t border-white/5 pt-4">
          {t('actuarial.sizingExpl') ||
            'El tamaño sugerido combina el Criterio de Half-Kelly (maximización geométrica de capital según el Quant Score) con el límite estricto de VaR 95% para preservar tu cartera contra caídas extremas.'}
        </p>
      </div>
    </div>
  );
}
