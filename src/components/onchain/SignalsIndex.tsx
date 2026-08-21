"use client";

import GaugeWidget from './GaugeWidget';
import { RefreshCw } from 'lucide-react';

export interface SignalsData {
  signalsIndex: number;
  sopr: number;
  mvrv: number;
  realizedPrice: number;
  supplyInactivePL: number;
  supplySpentPL: number;
  supplySpentProfitLP: number;
  profitInactiveSupply: number;
  profitSpentSupply: number;
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
          {symbol} Signals Index
        </h2>
        <button className="p-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] transition-colors">
          <RefreshCw size={18} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      <div className="flex flex-col gap-8">
        {/* Top Row: Master + 3 Med */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end justify-items-center">
          <div className="md:col-span-1">
            <GaugeWidget value={signalsData.signalsIndex} label="Signals Index" size="lg" />
          </div>
          <div className="md:col-span-3 grid grid-cols-3 gap-4 w-full">
            <GaugeWidget value={signalsData.sopr} label="SOPR" size="md" />
            <GaugeWidget value={signalsData.mvrv} label="MVRV" size="md" />
            <GaugeWidget value={signalsData.realizedPrice} label="Realized Price" size="md" />
          </div>
        </div>

        {/* Bottom Row: 5 Small */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 justify-items-center bg-[var(--bg-tertiary)] p-4 rounded-xl border border-[var(--border-color)]">
          <GaugeWidget value={signalsData.supplyInactivePL} label="Supply Inactive P/L" size="sm" />
          <GaugeWidget value={signalsData.supplySpentPL} label="Supply Spent P/L" size="sm" />
          <GaugeWidget value={signalsData.supplySpentProfitLP} label="Supply Spent Profit L/P" size="sm" />
          <GaugeWidget value={signalsData.profitInactiveSupply} label="Profit Inactive Supply" size="sm" />
          <GaugeWidget value={signalsData.profitSpentSupply} label="Profit Spent Supply" size="sm" />
        </div>
      </div>
    </div>
  );
}
