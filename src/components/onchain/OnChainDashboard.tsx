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
                <div className="space-y-6">
                  <div className="glass-card p-6">
                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-6">Network Fundamentals</h3>
                    {data.metrics?.fundamentals ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="indicator-card p-4">
                          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-2">Active Addresses</div>
                          <div className="text-2xl font-black text-[var(--text-primary)]">
                            {data.metrics.fundamentals.activeAddresses?.toLocaleString()}
                          </div>
                        </div>
                        <div className="indicator-card p-4">
                          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-2">24h Transactions</div>
                          <div className="text-2xl font-black text-[var(--text-primary)]">
                            {data.metrics.fundamentals.txCount?.toLocaleString()}
                          </div>
                        </div>
                        <div className="indicator-card p-4">
                          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-2">Hashrate (TH/s)</div>
                          <div className="text-2xl font-black text-[var(--text-primary)]">
                            {(data.metrics.fundamentals.hashRate / 1e12).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                        <div className="indicator-card p-4">
                          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-2">Avg Fee USD</div>
                          <div className="text-2xl font-black text-[var(--text-primary)]">
                            ${data.metrics.fundamentals.feesMeanUSD?.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-8 text-[var(--text-muted)]">Fundamentals data not available for this network.</div>
                    )}
                  </div>
                </div>
              )}

              {/* SUPPLY DYNAMICS */}
              {activeCategory === 'supply' && (
                <div className="space-y-6">
                  <div className="glass-card p-6">
                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-6">Tokenomics & Supply</h3>
                    {data.metrics?.supplyDynamics ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="indicator-card p-4">
                          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-2">Market Cap</div>
                          <div className="text-2xl font-black text-[var(--text-primary)]">
                            ${(data.metrics.supplyDynamics.marketCap / 1e9).toFixed(2)}B
                          </div>
                        </div>
                        <div className="indicator-card p-4">
                          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-2">Fully Diluted Val (FDV)</div>
                          <div className="text-2xl font-black text-[var(--text-primary)]">
                            ${(data.metrics.supplyDynamics.fdv / 1e9).toFixed(2)}B
                          </div>
                        </div>
                        <div className="indicator-card p-4">
                          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-2">FDV / Mcap Ratio</div>
                          <div className="text-2xl font-black text-[var(--signal-warning)]">
                            {data.metrics.supplyDynamics.fdvMcapRatio?.toFixed(2)}x
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] mt-1">
                            {">"} 1.5x signals high future inflation risk.
                          </div>
                        </div>
                        <div className="indicator-card p-4 md:col-span-3 mt-4">
                          <div className="text-sm font-bold text-[var(--text-primary)] mb-2">Circulating vs Total Supply</div>
                          <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-4 relative overflow-hidden">
                            <div 
                              className="bg-[var(--accent-gold)] h-full absolute left-0 top-0"
                              style={{ width: `${Math.min(100, (data.metrics.supplyDynamics.circulatingSupply / data.metrics.supplyDynamics.totalSupply) * 100)}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-xs text-[var(--text-muted)] mt-2">
                            <span>{data.metrics.supplyDynamics.circulatingSupply?.toLocaleString(undefined, { maximumFractionDigits: 0 })} Circulating</span>
                            <span>{data.metrics.supplyDynamics.totalSupply?.toLocaleString(undefined, { maximumFractionDigits: 0 })} Total</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-8 text-[var(--text-muted)]">Supply data not available.</div>
                    )}
                  </div>
                </div>
              )}

              {/* STABLECOINS */}
              {activeCategory === 'stablecoins' && (
                <div className="space-y-6">
                  <div className="glass-card p-6">
                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-6">Global Stablecoin Liquidity</h3>
                    {data.stablecoinMarket ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="indicator-card p-4">
                          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-2">Total Stablecoin Market Cap</div>
                          <div className="text-3xl font-black text-[var(--signal-buy)]">
                            ${(data.stablecoinMarket.totalMarketCap / 1e9).toFixed(1)}B
                          </div>
                        </div>
                        <div className="indicator-card p-4">
                          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-2">Top Stablecoin Dominance</div>
                          <div className="space-y-2 mt-4">
                            {data.stablecoinMarket.peggedAssets?.slice(0, 3).map((asset: any) => (
                              <div key={asset.symbol} className="flex justify-between items-center text-sm">
                                <span className="font-bold">{asset.symbol}</span>
                                <span className="text-[var(--text-secondary)]">${(asset.circulating / 1e9).toFixed(1)}B</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-8 text-[var(--text-muted)]">Stablecoin data not available.</div>
                    )}
                  </div>
                </div>
              )}

              {/* Coming Soon Fallback for others */}
              {activeCategory !== 'signals' && activeCategory !== 'fundamentals' && activeCategory !== 'supply' && activeCategory !== 'stablecoins' && (
                <div className="glass-card w-full min-h-[400px] flex flex-col items-center justify-center text-center p-8">
                  <Box size={48} className="mb-4 text-[var(--text-muted)] opacity-50" />
                  <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">No Disponible</h2>
                  <p className="text-[var(--text-secondary)] max-w-md">
                    Para visualizar datos como MVRV o SOPR, se requiere acceso a APIs de nodos privados o suscripciones institucionales (Glassnode/CryptoQuant) que ya no proveen tiers gratuitos.
                  </p>
                </div>
              )}
            </div>
        )}
      </div>
    </div>
  );
}
