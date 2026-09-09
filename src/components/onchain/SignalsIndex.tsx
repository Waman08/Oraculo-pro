"use client";

import GaugeWidget from './GaugeWidget';
import { RefreshCw } from 'lucide-react';

export interface SignalsData {
  signalsIndex: number;
  whaleAccumulation: number;
  leverageRatio: number;
  smartMoneyFlow: number;
  momentumScore: number;
  trendStrength: number;
  volatilityIndex: number;
  buyingPressure: number;
  sellingPressure: number;
}

interface SignalsIndexProps {
  signalsData: SignalsData;
  symbol: string;
}

export default function SignalsIndex({ signalsData, symbol }: SignalsIndexProps) {
  return (
    <div className="glass-card p-6 animate-fadeInUp">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-[var(--border-color)]">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {symbol} Quant Signals Index
        </h2>
        <button className="p-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] transition-colors">
          <RefreshCw size={18} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      <div className="flex flex-col gap-8">
        {/* Top Row: Master + 3 Med */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end justify-items-center">
          <div className="md:col-span-1">
            <GaugeWidget value={signalsData.signalsIndex} label="Quant Index" size="lg" />
          </div>
          <div className="md:col-span-3 grid grid-cols-3 gap-4 w-full">
            <GaugeWidget value={signalsData.whaleAccumulation} label="Whale Accumulation" size="md" />
            <GaugeWidget value={signalsData.leverageRatio} label="Leverage Ratio" size="md" />
            <GaugeWidget value={signalsData.smartMoneyFlow} label="Smart Money Flow" size="md" />
          </div>
        </div>

        {/* Bottom Row: 5 Small */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 justify-items-center bg-[var(--bg-tertiary)] p-4 rounded-xl border border-[var(--border-color)]">
          <GaugeWidget value={signalsData.momentumScore} label="Momentum" size="sm" />
          <GaugeWidget value={signalsData.trendStrength} label="Trend Strength" size="sm" />
          <GaugeWidget value={signalsData.volatilityIndex} label="Volatility" size="sm" />
          <GaugeWidget value={signalsData.buyingPressure} label="Buy Pressure" size="sm" />
          <GaugeWidget value={signalsData.sellingPressure} label="Sell Pressure" size="sm" />
        </div>
      </div>
    </div>
  );
}
