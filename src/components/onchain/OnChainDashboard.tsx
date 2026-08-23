"use client";

import { useState, useEffect } from 'react';
import { BarChart3, Box, DollarSign, Building2, TrendingUp, BellRing, CircleDollarSign } from 'lucide-react';
import SignalsIndex from './SignalsIndex';
import dynamic from 'next/dynamic';

const OnChainChart = dynamic(() => import('../charts/OnChainChart'), { 
  ssr: false,
  loading: () => <div className="h-[400px] w-full flex items-center justify-center glass-card animate-pulse"><div className="text-[var(--text-muted)]">Cargando gráfico...</div></div>
});
const PYTHON_API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';

async function fetchOnChainData(symbol: string): Promise<any> {
  try {
    const res = await fetch(`${PYTHON_API_URL}/api/onchain/${symbol}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { 
    return null; 
  }
}

interface OnChainDashboardProps {
  symbol: string;
  onSymbolChange?: (symbol: string) => void;
}

const CATEGORIES = [
  { id: 'fundamentals', label: 'Fundamentals', icon: BarChart3 },
  { id: 'supply', label: 'Supply Dynamics', icon: Box },
  { id: 'profitloss', label: 'Profit & Loss', icon: DollarSign },
  { id: 'exchanges', label: 'Exchanges', icon: Building2 },
  { id: 'indicators', label: 'Indicators', icon: TrendingUp },
  { id: 'signals', label: 'Signals Index', icon: BellRing },
  { id: 'stablecoins', label: 'Stablecoins', icon: CircleDollarSign },
];

export default function OnChainDashboard({ symbol, onSymbolChange }: OnChainDashboardProps) {
  const [activeCategory, setActiveCategory] = useState('signals');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    
    // Simulate fetching or use actual API if running
    fetchOnChainData(symbol).then(res => {
      if (!mounted) return;
      if (res) {
        setData(res);
      }
      setLoading(false);
    });
    
    return () => { mounted = false; };
  }, [symbol]);

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full min-h-[600px] animate-fadeInUp">
      {/* Sidebar */}
      <div className="md:w-[220px] flex-shrink-0 flex flex-col gap-2">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm border ${
                isActive 
                  ? 'bg-[var(--bg-secondary)] border-[var(--accent-gold)] text-[var(--accent-gold)]' 
                  : 'bg-transparent border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon size={18} />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {loading ? (
          <div className="glass-card w-full h-full min-h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-gold)]"></div>
          </div>
        ) : !data ? (
          <div className="glass-card p-8 text-center h-full flex flex-col items-center justify-center">
            <p className="text-[var(--text-muted)]">Datos on-chain requieren el backend de análisis activo.</p>
          </div>
        ) : (
          <div className="w-full">
            {/* SIGNALS (DEFAULT) */}
            {activeCategory === 'signals' && (
              <SignalsIndex signalsData={data.subSignals || data.signals || {}} symbol={symbol} />
            )}

            {/* FUNDAMENTALS */}
            {activeCategory === 'fundamentals' && (
              <div className="glass-card p-6">
                <h2 className="text-xl font-bold mb-6 text-[var(--text-primary)]">Fundamentals</h2>
                {data.metrics?.fundamentals ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="indicator-card p-4">
                      <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Active Addresses</span>
                      <div className="text-2xl font-black text-[var(--text-primary)] mt-2">
                        {data.metrics.fundamentals.activeAddresses?.toLocaleString()}
                      </div>
                      {Array.isArray(data.metrics.fundamentals.history) && (
                        <div className="mt-4">
                          <OnChainChart 
                            data={data.metrics.fundamentals.history.map((h: any) => ({ time: h.time, value: h.activeAddresses }))} 
                            symbol={symbol} title="Active Addresses (90d)" type="Line" color="#3b82f6" 
                          />
                        </div>
                      )}
                    </div>
                    <div className="indicator-card p-4">
                      <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Transactions</span>
                      <div className="text-2xl font-black text-[var(--text-primary)] mt-2">
                        {data.metrics.fundamentals.txCount?.toLocaleString()}
                      </div>
                      {Array.isArray(data.metrics.fundamentals.history) && (
                        <div className="mt-4">
                          <OnChainChart 
                            data={data.metrics.fundamentals.history.map((h: any) => ({ time: h.time, value: h.txCount }))} 
                            symbol={symbol} title="Transaction Count (90d)" type="Histogram" color="#f5b041" 
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[var(--text-muted)]">No fundamentals data available for {symbol}.</p>
                )}
              </div>
            )}

            {/* PROFIT & LOSS */}
            {activeCategory === 'profitloss' && (
              <div className="flex flex-col gap-6">
                {Array.isArray(data.metrics?.realizedPrice?.history) ? (
                  <OnChainChart 
                    data={data.metrics.realizedPrice.history}
                    symbol={symbol}
                    title="Realized Price"
                    type="Line"
                    color="#f59e0b"
                  />
                ) : (
                  <div className="glass-card p-8 text-center text-[var(--text-muted)]">Realized Price data unavailable for {symbol}.</div>
                )}

                {Array.isArray(data.metrics?.sopr?.history) ? (
                  <OnChainChart 
                    data={data.metrics.sopr.history}
                    symbol={symbol}
                    title="Spent Output Profit Ratio (SOPR)"
                    type="Area"
                    color="#f43f5e"
                    baseline={1.0}
                  />
                ) : (
                  <div className="glass-card p-8 text-center text-[var(--text-muted)]">SOPR data unavailable for {symbol}.</div>
                )}
              </div>
            )}

            {/* EXCHANGES */}
            {activeCategory === 'exchanges' && (
              <div className="flex flex-col gap-6">
                {Array.isArray(data.metrics?.exchangeFlows?.history) ? (
                  <OnChainChart 
                    data={data.metrics.exchangeFlows.history}
                    symbol={symbol}
                    title="Net Exchange Flows (BTC)"
                    type="Histogram"
                  />
                ) : (
                  <div className="glass-card p-8 text-center text-[var(--text-muted)]">Exchange flow data unavailable for {symbol}.</div>
                )}
              </div>
            )}

            {/* INDICATORS */}
            {activeCategory === 'indicators' && (
              <div className="flex flex-col gap-6">
                {Array.isArray(data.metrics?.mvrv?.history) ? (
                  <OnChainChart 
                    data={data.metrics.mvrv.history}
                    symbol={symbol}
                    title="MVRV Z-Score / Ratio"
                    type="Area"
                    color="#0ea5e9"
                  />
                ) : (
                  <div className="glass-card p-8 text-center text-[var(--text-muted)]">MVRV data unavailable for {symbol}.</div>
                )}
                
                {Array.isArray(data.metrics?.puellMultiple?.history) ? (
                  <OnChainChart 
                    data={data.metrics.puellMultiple.history}
                    symbol={symbol}
                    title="Puell Multiple"
                    type="Area"
                    color="#ec4899"
                  />
                ) : (
                  <div className="glass-card p-8 text-center text-[var(--text-muted)]">Puell Multiple data unavailable for {symbol}.</div>
                )}
              </div>
            )}

            {/* Coming Soon Fallback for others */}
            {activeCategory !== 'signals' && activeCategory !== 'fundamentals' && activeCategory !== 'profitloss' && activeCategory !== 'exchanges' && activeCategory !== 'indicators' && (
              <div className="glass-card w-full min-h-[400px] flex flex-col items-center justify-center text-center p-8">
                <Box size={48} className="mb-4 text-[var(--text-muted)] opacity-50" />
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Coming Soon</h2>
                <p className="text-[var(--text-secondary)] max-w-md">
                  The {CATEGORIES.find(c => c.id === activeCategory)?.label} module is currently under development. Data visualization for this category will be available in a future update.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
