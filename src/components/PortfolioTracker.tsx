"use client";

import { useState, useEffect } from 'react';
import { useLocale, useAppSettings } from './AppContext';
import { fetchAllBinancePrices } from '@/lib/api';
import { Wallet, Plus, Trash2, ArrowUpRight, ArrowDownRight, PieChart, Activity, XCircle } from 'lucide-react';
import { CRYPTO_DATABASE } from '@/lib/mock-data';
import { useAppStore } from '@/lib/store';
import { wsManager } from '@/lib/websocket-manager';
import { isSupabaseEnabled } from '@/lib/supabase';
import {
  loadPortfolio, addPortfolioItem, removePortfolioItem,
  type PortfolioItemLocal,
} from '@/lib/useSupabaseSync';

const PYTHON_API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';

interface PortfolioItem {
  id: string;
  symbol: string;
  amount: number;
  entryPrice: number;
}

export default function PortfolioTracker() {
  const { t } = useLocale();
  const { setSymbol } = useAppSettings();
  
  // Real Portfolio State
  const [items, setItems] = useState<PortfolioItem[]>([]);
  
  // App State
  const { livePrices, setMultiplePrices } = useAppStore();
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'real' | 'paper'>('real');
  
  // Paper Trading State
  const [paperData, setPaperData] = useState<any>(null);
  const [paperLoading, setPaperLoading] = useState(false);
  
  // Modals / forms state
  const [showAdd, setShowAdd] = useState(false);
  const [newSymbol, setNewSymbol] = useState('BTC');
  const [newAmount, setNewAmount] = useState('');
  const [newEntry, setNewEntry] = useState('');

  // Load Real Portfolio
  useEffect(() => {
    const saved = localStorage.getItem('portfolio_items');
    if (saved) {
      try { setItems(JSON.parse(saved)); } catch {}
    }
    setIsLoaded(true);

    if (isSupabaseEnabled()) {
      loadPortfolio().then(sbItems => {
        if (sbItems.length > 0) setItems(sbItems);
      }).catch(() => {});
    }
  }, []);

  // Sync Real Portfolio Websockets
  useEffect(() => {
    if (!isLoaded || activeTab !== 'real') return;
    localStorage.setItem('portfolio_items', JSON.stringify(items));
    items.forEach(item => wsManager.subscribe(item.symbol));
    
    const fetchPrices = async () => {
      const symbols = Array.from(new Set(items.map(i => i.symbol)));
      if (symbols.length === 0) return;
      const prices = await fetchAllBinancePrices(symbols);
      setMultiplePrices(prices);
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [items, isLoaded, setMultiplePrices, activeTab]);
  
  // Load Paper Portfolio
  const loadPaperSummary = async () => {
    setPaperLoading(true);
    try {
      const res = await fetch(`${PYTHON_API_URL}/api/paper/summary?session_id=default_session`);
      if (res.ok) {
        const data = await res.json();
        setPaperData(data);
        
        // Subscribe to open positions
        if (data.openPositions) {
           data.openPositions.forEach((p: any) => wsManager.subscribe(p.symbol));
        }
      }
    } catch (err) {
      console.error(err);
    }
    setPaperLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'paper') {
      loadPaperSummary();
      const interval = setInterval(loadPaperSummary, 15000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const handleAddItem = async () => {
    if (!newSymbol || !newAmount || !newEntry) return;
    const newItem = {
      id: Date.now().toString(),
      symbol: newSymbol.toUpperCase(),
      amount: parseFloat(newAmount),
      entryPrice: parseFloat(newEntry)
    };
    setItems([...items, newItem]);
    if (isSupabaseEnabled()) {
      await addPortfolioItem(newItem);
    }
    setShowAdd(false);
    setNewAmount('');
    setNewEntry('');
  };

  const handleRemove = async (id: string) => {
    setItems(items.filter(i => i.id !== id));
    if (isSupabaseEnabled()) {
      await removePortfolioItem(id);
    }
  };

  const getLivePrice = (symbol: string) => {
    return livePrices[symbol]?.price || 0;
  };
  
  // Real Portfolio calculations
  const totalValue = items.reduce((acc, item) => acc + (item.amount * getLivePrice(item.symbol)), 0);
  const totalCost = items.reduce((acc, item) => acc + (item.amount * item.entryPrice), 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  
  // Paper Portfolio calculations
  const renderPaperPositions = () => {
    if (!paperData || !paperData.openPositions || paperData.openPositions.length === 0) {
      return (
        <div className="text-center p-8 text-gray-500 bg-white/5 rounded-xl border border-white/5 mt-4">
          No hay posiciones abiertas en el Simulador.
        </div>
      );
    }
    
    let liveEquity = paperData.account.cash_balance;

    return (
      <div className="mt-4">
        <h3 className="text-sm font-bold text-gray-300 mb-3">Posiciones Abiertas</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 uppercase text-gray-400">
              <tr>
                <th className="p-3 rounded-tl-lg">Activo</th>
                <th className="p-3">Lado</th>
                <th className="p-3">Entrada</th>
                <th className="p-3">Mercado</th>
                <th className="p-3">Tamaño</th>
                <th className="p-3 text-right">P&L Vivo</th>
                <th className="p-3 rounded-tr-lg"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paperData.openPositions.map((pos: any) => {
                const livePx = getLivePrice(pos.symbol) || pos.entry_price;
                const isLong = pos.side === 'BUY' || pos.side === 'LONG';
                const pnl = isLong 
                  ? (livePx - pos.entry_price) * pos.amount 
                  : (pos.entry_price - livePx) * pos.amount;
                const pnlPct = (pnl / pos.total_usd) * 100;
                
                liveEquity += pos.total_usd + pnl;

                return (
                  <tr key={pos.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 font-bold cursor-pointer" onClick={() => setSymbol(pos.symbol)}>{pos.symbol}</td>
                    <td className={`p-3 font-bold ${isLong ? 'text-green-400' : 'text-red-400'}`}>{pos.side}</td>
                    <td className="p-3 font-mono">${pos.entry_price.toFixed(2)}</td>
                    <td className="p-3 font-mono">${livePx.toFixed(2)}</td>
                    <td className="p-3">${pos.total_usd.toFixed(2)}</td>
                    <td className={`p-3 font-bold text-right ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnlPct.toFixed(2)}%)
                    </td>
                    <td className="p-3 text-right">
                      {/* En un caso real conectariamos esto al endpoint para cerrar */}
                      <button className="text-red-400 hover:text-red-300 bg-red-400/10 p-1.5 rounded" title="Cerrar al Mercado">
                        <XCircle size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeInUp h-full">
      {/* Selector de Portafolio */}
      <div className="flex bg-black/40 p-1 rounded-xl w-max">
        <button 
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'real' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          onClick={() => setActiveTab('real')}
        >
          Portafolio Real
        </button>
        <button 
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'paper' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
          onClick={() => setActiveTab('paper')}
        >
          Simulador Paper Trading ($10k)
        </button>
      </div>
      
      {activeTab === 'real' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 flex flex-col justify-center border-l-4" style={{ borderLeftColor: 'var(--accent-blue)' }}>
              <div className="flex items-center gap-2 mb-2 text-gray-400">
                <Wallet size={16} />
                <span className="text-sm font-bold uppercase">Balance Total</span>
              </div>
              <div className="text-3xl font-black">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>

            <div className="glass-card p-6 flex flex-col justify-center border-l-4" style={{ borderLeftColor: totalPnl >= 0 ? 'var(--signal-buy)' : 'var(--signal-sell)' }}>
              <div className="flex items-center gap-2 mb-2 text-gray-400">
                {totalPnl >= 0 ? <ArrowUpRight size={16} style={{ color: 'var(--signal-buy)' }} /> : <ArrowDownRight size={16} style={{ color: 'var(--signal-sell)' }} />}
                <span className="text-sm font-bold uppercase">Retorno Neto (USD)</span>
              </div>
              <div className="text-3xl font-black" style={{ color: totalPnl >= 0 ? 'var(--signal-buy)' : 'var(--signal-sell)' }}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="glass-card p-6 flex flex-col justify-center border-l-4" style={{ borderLeftColor: totalPnlPct >= 0 ? 'var(--signal-buy)' : 'var(--signal-sell)' }}>
              <div className="flex items-center gap-2 mb-2 text-gray-400">
                <PieChart size={16} />
                <span className="text-sm font-bold uppercase">Rendimiento (%)</span>
              </div>
              <div className="text-3xl font-black" style={{ color: totalPnlPct >= 0 ? 'var(--signal-buy)' : 'var(--signal-sell)' }}>
                {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="glass-card flex-1 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Mis Posiciones</h3>
              <button 
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors"
              >
                <Plus size={16} /> Añadir Activo
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 border border-dashed border-white/10 rounded-xl bg-white/5">
                <Wallet size={48} className="text-gray-500 mb-4" />
                <p className="text-gray-400 text-center max-w-sm">No tienes activos en tu portafolio real. Comienza añadiendo tus posiciones para hacer seguimiento en vivo.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-white/5">
                      <th className="pb-3">Activo</th>
                      <th className="pb-3 text-right">Cantidad</th>
                      <th className="pb-3 text-right">Precio Entrada</th>
                      <th className="pb-3 text-right">Precio Actual</th>
                      <th className="pb-3 text-right">Valor USD</th>
                      <th className="pb-3 text-right">P&L</th>
                      <th className="pb-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {items.map(item => {
                      const currentPx = getLivePrice(item.symbol);
                      const pnl = (currentPx - item.entryPrice) * item.amount;
                      const pnlPct = (currentPx - item.entryPrice) / item.entryPrice * 100;
                      
                      return (
                        <tr key={item.id} className="group hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setSymbol(item.symbol)}>
                          <td className="py-4 font-bold flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs text-blue-400">{item.symbol[0]}</div>
                            {item.symbol}
                          </td>
                          <td className="py-4 text-right font-mono">{item.amount.toLocaleString()}</td>
                          <td className="py-4 text-right font-mono">${item.entryPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}</td>
                          <td className="py-4 text-right font-mono">${currentPx.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}</td>
                          <td className="py-4 text-right font-bold">${(item.amount * currentPx).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          <td className={`py-4 text-right font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pnl >= 0 ? '+' : ''}${pnl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            <span className="text-xs block opacity-70">{pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%</span>
                          </td>
                          <td className="py-4 text-center">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleRemove(item.id); }}
                              className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Paper Trading Simulator Tab */
        <div className="flex flex-col gap-6 animate-fadeInUp">
          {!paperData ? (
             <div className="glass-card p-12 flex justify-center items-center">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
             </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-card p-4 border-l-4" style={{ borderLeftColor: 'var(--accent-purple)' }}>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Equity (Cuenta)</div>
                  <div className="text-2xl font-black">${paperData.equity.toFixed(2)}</div>
                </div>
                <div className="glass-card p-4 border-l-4" style={{ borderLeftColor: paperData.metrics.totalReturnPct >= 0 ? 'var(--signal-buy)' : 'var(--signal-sell)' }}>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Retorno (Simulador)</div>
                  <div className={`text-2xl font-black ${paperData.metrics.totalReturnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {paperData.metrics.totalReturnPct >= 0 ? '+' : ''}{paperData.metrics.totalReturnPct.toFixed(2)}%
                  </div>
                </div>
                <div className="glass-card p-4 border-l-4" style={{ borderLeftColor: 'var(--accent-blue)' }}>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Win Rate (Cerradas)</div>
                  <div className="text-2xl font-black text-blue-400">{paperData.metrics.winRate}%</div>
                </div>
                <div className="glass-card p-4 border-l-4 border-yellow-500">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Profit Factor</div>
                  <div className="text-2xl font-black text-yellow-500">{paperData.metrics.profitFactor}</div>
                </div>
              </div>
              
              <div className="glass-card p-6 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                       <Activity size={20} className="text-purple-400" />
                       Motor de Paper Trading
                    </h3>
                    <div className="text-xs bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full border border-purple-500/30">
                       Modo Auditoría de Señales
                    </div>
                 </div>
                 <p className="text-sm text-gray-400 mb-2">
                    Las posiciones aquí se ejecutan de forma automática cuando el Motor Cuantitativo dispara una alerta de <strong>Confluencia Alfa</strong>, o cuando decides tomar el trade desde el dashboard. Se aplica un fee taker del 0.075%.
                 </p>
                 
                 {renderPaperPositions()}
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-6">Añadir al Portafolio Real</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Símbolo</label>
                <select 
                  value={newSymbol} 
                  onChange={(e) => setNewSymbol(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                >
                  {CRYPTO_DATABASE.map(c => <option key={c.symbol} value={c.symbol}>{c.symbol} - {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Cantidad de Tokens</label>
                <input 
                  type="number" 
                  step="any"
                  placeholder="Ej: 0.5" 
                  value={newAmount} 
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Precio de Compra (USD)</label>
                <input 
                  type="number" 
                  step="any"
                  placeholder="Ej: 64500" 
                  value={newEntry} 
                  onChange={(e) => setNewEntry(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-4 mt-8">
                <button 
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleAddItem}
                  disabled={!newAmount || !newEntry}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-bold transition-colors"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
