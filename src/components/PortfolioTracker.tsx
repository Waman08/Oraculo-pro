"use client";

import { useState, useEffect } from 'react';
import { useLocale, useAppSettings } from './AppContext';
import { fetchAllBinancePrices } from '@/lib/api';
import { Wallet, Plus, Trash2, ArrowUpRight, ArrowDownRight, PieChart } from 'lucide-react';
import { CRYPTO_DATABASE } from '@/lib/mock-data';
import { useAppStore } from '@/lib/store';
import { wsManager } from '@/lib/websocket-manager';
import { isSupabaseEnabled } from '@/lib/supabase';
import {
  loadPortfolio, addPortfolioItem, removePortfolioItem,
  type PortfolioItemLocal,
} from '@/lib/useSupabaseSync';

interface PortfolioItem {
  id: string;
  symbol: string;
  amount: number;
  entryPrice: number;
}

export default function PortfolioTracker() {
  const { t } = useLocale();
  const { setSymbol } = useAppSettings();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const { livePrices, setMultiplePrices } = useAppStore();
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Modals / forms state
  const [showAdd, setShowAdd] = useState(false);
  const [newSymbol, setNewSymbol] = useState('BTC');
  const [newAmount, setNewAmount] = useState('');
  const [newEntry, setNewEntry] = useState('');

  // Load from localStorage first, then overlay with Supabase
  useEffect(() => {
    const saved = localStorage.getItem('portfolio_items');
    if (saved) {
      try { setItems(JSON.parse(saved)); } catch {}
    }
    setIsLoaded(true);

    // Overlay with Supabase data
    if (isSupabaseEnabled()) {
      loadPortfolio().then(sbItems => {
        if (sbItems.length > 0) {
          setItems(sbItems);
        }
      }).catch(() => {});
    }
  }, []);

  // Save to localStorage and fetch prices
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('portfolio_items', JSON.stringify(items));
    
    // WebSockets: subscribe to all portfolio items
    items.forEach(item => wsManager.subscribe(item.symbol));
    wsManager.connect();
    
    // Fetch all prices in a single batch request (REST fallback / initial load)
    const fetchPrices = async () => {
      try {
        const allPrices = await fetchAllBinancePrices();
        const priceMap: Record<string, any> = {};
        allPrices.forEach((data, sym) => {
          priceMap[sym] = data;
        });
        if (Object.keys(priceMap).length > 0) {
          setMultiplePrices(priceMap);
        }
      } catch {
        // Keep existing prices
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [items, isLoaded]);

  const handleAdd = async () => {
    if (!newSymbol || !newAmount || !newEntry) return;
    const localId = Math.random().toString(36).substring(2, 9);
    const newItem: PortfolioItem = {
      id: localId,
      symbol: newSymbol.toUpperCase(),
      amount: parseFloat(newAmount),
      entryPrice: parseFloat(newEntry),
    };

    // Sync to Supabase in background, use returned ID if available
    if (isSupabaseEnabled()) {
      addPortfolioItem(newItem).then(sbId => {
        if (sbId) {
          setItems(prev => prev.map(i => i.id === localId ? { ...i, id: sbId } : i));
        }
      }).catch(() => {});
    }

    setItems([...items, newItem]);
    setShowAdd(false);
    setNewAmount('');
    setNewEntry('');
  };

  const handleRemove = (id: string) => {
    // Sync removal to Supabase in background
    if (isSupabaseEnabled()) {
      removePortfolioItem(id).catch(() => {});
    }
    setItems(items.filter(i => i.id !== id));
  };

  const totalValue = items.reduce((acc, item) => {
    const price = livePrices[item.symbol]?.price || item.entryPrice;
    return acc + (item.amount * price);
  }, 0);

  const totalCost = items.reduce((acc, item) => acc + (item.amount * item.entryPrice), 0);
  const totalPnL = totalValue - totalCost;
  const pnlPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  // Group by symbol for the pie chart / summary
  const grouped = items.reduce((acc, item) => {
    const price = livePrices[item.symbol]?.price || item.entryPrice;
    const value = item.amount * price;
    acc[item.symbol] = (acc[item.symbol] || 0) + value;
    return acc;
  }, {} as Record<string, number>);

  const sortedGroups = Object.entries(grouped).sort((a, b) => b[1] - a[1]);

  if (!isLoaded) return null;

  return (
    <div className="glass-card p-5 animate-fadeInUp">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <Wallet size={16} /> {t('portfolio.title')}
        </h3>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="p-1 rounded transition-colors hover:bg-white/5 text-xs flex items-center gap-1"
          style={{ color: 'var(--accent-gold)' }}
        >
          <Plus size={14} /> {t('portfolio.add')}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-4 p-3 rounded-lg border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-tertiary)' }}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">{t('portfolio.asset')}</label>
              <select 
                className="w-full bg-transparent border rounded p-1.5 text-xs focus:outline-none"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                value={newSymbol}
                onChange={e => setNewSymbol(e.target.value)}
              >
                {CRYPTO_DATABASE.map(c => (
                  <option key={c.symbol} value={c.symbol} style={{ color: 'black' }}>{c.symbol}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">{t('portfolio.amount')}</label>
              <input 
                type="number" step="any" min="0"
                className="w-full bg-transparent border rounded p-1.5 text-xs focus:outline-none"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                value={newAmount} onChange={e => setNewAmount(e.target.value)}
                placeholder="0.5"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-gray-500 mb-1 block">{t('portfolio.entryPrice')}</label>
              <input 
                type="number" step="any" min="0"
                className="w-full bg-transparent border rounded p-1.5 text-xs focus:outline-none"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                value={newEntry} onChange={e => setNewEntry(e.target.value)}
                placeholder="65000"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowAdd(false)}
              className="flex-1 text-xs py-1.5 border rounded"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
            >
              {t('portfolio.cancel')}
            </button>
            <button 
              onClick={handleAdd}
              className="flex-1 text-xs py-1.5 rounded font-bold"
              style={{ background: 'var(--accent-gold)', color: '#000' }}
            >
              {t('portfolio.save')}
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="flex justify-between items-end mb-4">
        <div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('portfolio.totalBalance')}</div>
          <div className="text-xl font-black">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="text-right">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('portfolio.unrealizedPnl')}</div>
          <div 
            className="text-sm font-bold flex items-center justify-end gap-1"
            style={{ color: totalPnL >= 0 ? 'var(--signal-buy)' : 'var(--signal-sell)' }}
          >
            {totalPnL >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            ${Math.abs(totalPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-[10px] ml-1 opacity-80">({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)</span>
          </div>
        </div>
      </div>

      {/* Visual Bar */}
      {totalValue > 0 && (
        <div className="h-2 w-full rounded-full flex overflow-hidden mb-4" style={{ background: 'var(--bg-tertiary)' }}>
          {sortedGroups.map(([sym, val], i) => {
            const colors = ['#F7931A', '#627EEA', '#14F195', '#E84142', '#00A3FF', '#8B5CF6'];
            const pct = (val / totalValue) * 100;
            return (
              <div 
                key={sym} 
                title={`${sym}: ${pct.toFixed(1)}%`}
                style={{ width: `${pct}%`, background: colors[i % colors.length] }} 
              />
            );
          })}
        </div>
      )}

      {/* Item List */}
      {items.length === 0 ? (
        <div className="text-center py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('portfolio.empty')}
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {items.map(item => {
            const currentPrice = livePrices[item.symbol]?.price || item.entryPrice;
            const value = item.amount * currentPrice;
            const pnl = value - (item.amount * item.entryPrice);
            const pnlPct = ((currentPrice - item.entryPrice) / item.entryPrice) * 100;
            
            return (
              <div 
                key={item.id} 
                className="group p-2 rounded border hover:bg-white/5 cursor-pointer relative"
                style={{ borderColor: 'var(--border-color)', background: 'var(--bg-tertiary)' }}
                onClick={() => setSymbol(item.symbol)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-sm flex items-baseline gap-1">
                      {item.symbol} 
                      <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>
                        {item.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {t('portfolio.avg')}: ${item.entryPrice.toLocaleString(undefined, {maximumFractionDigits: 4})}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    <div 
                      className="text-[10px] font-semibold"
                      style={{ color: pnl >= 0 ? 'var(--signal-buy)' : 'var(--signal-sell)' }}
                    >
                      {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(item.id);
                  }}
                  className="absolute -left-2 -top-2 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/10 text-red-500 hover:bg-red-500/20"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
