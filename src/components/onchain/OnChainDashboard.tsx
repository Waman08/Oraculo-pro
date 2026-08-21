"use client";

import { useState, useEffect } from 'react';
import { BarChart3, Box, DollarSign, Building2, TrendingUp, BellRing, CircleDollarSign } from 'lucide-react';
import SignalsIndex from './SignalsIndex';

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
      } else {
        // Mock data fallback
        setData({
          signals: {
            signalsIndex: 78.5,
            sopr: 65,
            mvrv: 42,
            realizedPrice: 88,
            supplyInactivePL: 30,
            supplySpentPL: 45,
            supplySpentProfitLP: 60,
            profitInactiveSupply: 72,
            profitSpentSupply: 55,
          },
          fundamentals: {
            activeAddresses: { value: '1.2M', change: 5.4 },
            txCount: { value: '350K', change: -2.1 },
            fees: { value: '$2.5M', change: 12.8 }
          }
        });
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
        ) : (
          <div className="w-full">
            {activeCategory === 'signals' && data?.signals && (
              <SignalsIndex signalsData={data.signals} symbol={symbol} />
            )}

            {activeCategory === 'fundamentals' && data?.fundamentals && (
              <div className="glass-card p-6">
                <h2 className="text-xl font-bold mb-6 text-[var(--text-primary)]">Fundamentals</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {Object.entries(data.fundamentals).map(([key, val]: [string, any]) => (
                    <div key={key} className="indicator-card p-4 flex flex-col gap-2">
                      <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <div className="flex items-end justify-between">
                        <span className="text-2xl font-black text-[var(--text-primary)]">{val.value}</span>
                        <span className={`text-sm font-bold ${val.change >= 0 ? 'text-[var(--signal-buy)]' : 'text-[var(--signal-sell)]'}`}>
                          {val.change >= 0 ? '+' : ''}{val.change}%
                        </span>
                      </div>
                      <div className="h-8 mt-2 opacity-50 bg-[var(--bg-tertiary)] rounded-md border border-dashed border-[var(--border-color)] flex items-center justify-center">
                        <span className="text-[10px] text-[var(--text-muted)]">Sparkline</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Coming Soon Fallback */}
            {activeCategory !== 'signals' && activeCategory !== 'fundamentals' && (
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
