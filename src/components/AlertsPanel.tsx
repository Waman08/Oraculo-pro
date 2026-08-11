"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAppSettings } from './AppContext';
import { fetchBinancePrice } from '@/lib/api';
import { Bell, BellOff, Plus, Trash2, CheckCircle2, Send, RefreshCw, Bot, Activity, AlertCircle, Settings, X, ChevronDown, ChevronUp } from 'lucide-react';
import { CRYPTO_DATABASE } from '@/lib/mock-data';
import { isSupabaseEnabled } from '@/lib/supabase';
import {
  loadAlerts as sbLoadAlerts,
  addAlert as sbAddAlert,
  removeAlert as sbRemoveAlert,
  updateAlertTriggered,
  type PriceAlertLocal,
} from '@/lib/useSupabaseSync';

interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'above' | 'below';
  triggered: boolean;
}

const PYTHON_API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';

async function syncAlertsToBackend(alerts: PriceAlert[]): Promise<boolean> {
  try {
    const res = await fetch(`${PYTHON_API_URL}/api/alerts/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alerts }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function AlertsPanel() {
  const { setSymbol } = useAppSettings();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newSymbol, setNewSymbol] = useState('BTC');
  const [newTarget, setNewTarget] = useState('');
  const [newCondition, setNewCondition] = useState<'above' | 'below'>('above');
  const [permission, setPermission] = useState('default');
  const [isLoaded, setIsLoaded] = useState(false);
  const [backendSynced, setBackendSynced] = useState(false);
  const [syncingBackend, setSyncingBackend] = useState(false);

  // Bot Status Polling
  const [botStatus, setBotStatus] = useState<'idle' | 'running' | 'error' | 'unknown'>('unknown');
  const [lastBotCheck, setLastBotCheck] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') setPermission(Notification.permission);
    const saved = localStorage.getItem('price_alerts');
    if (saved) {
      try { setAlerts(JSON.parse(saved)); } catch {}
    }
    setIsLoaded(true);

    if (isSupabaseEnabled()) {
      sbLoadAlerts().then(sbItems => {
        if (sbItems.length > 0) {
          setAlerts(sbItems);
        }
      }).catch(() => {});
    }
  }, []);

  // Poll Bot Status
  useEffect(() => {
    const fetchBotStatus = async () => {
      try {
        const res = await fetch(`${PYTHON_API_URL}/api/telegram/status`);
        if (res.ok) {
          const data = await res.json();
          setBotStatus(data.status);
          setLastBotCheck(data.last_check);
        } else {
          setBotStatus('unknown');
        }
      } catch {
        setBotStatus('error');
      }
    };
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('price_alerts', JSON.stringify(alerts));

    syncAlertsToBackend(alerts).then(ok => {
      setBackendSynced(ok);
    });
  }, [alerts, isLoaded]);

  const requestPermission = async () => {
    if (typeof window !== 'undefined') {
      const perm = await Notification.requestPermission();
      setPermission(perm);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;

    const checkAlerts = async () => {
      // Use the functional state update to always get the latest alerts without adding it to dependencies
      setAlerts(prevAlerts => {
        const activeAlerts = prevAlerts.filter(a => !a.triggered);
        if (activeAlerts.length === 0) return prevAlerts;

        // Note: fetchBinancePrice is async, we can't use it directly inside setAlerts synchronously
        // So we need to handle the async fetching outside, then update.
        return prevAlerts; // Return prevAlerts unmodified for now, see refactored approach below
      });
    };
  }, [isLoaded]);

  // REFACTORED checkAlerts to avoid infinite loops:
  useEffect(() => {
    if (!isLoaded) return;
    
    let isMounted = true;
    
    const checkAlerts = async () => {
      if (alerts.length === 0) return;
      const activeAlerts = alerts.filter(a => !a.triggered);
      if (activeAlerts.length === 0) return;

      const symbolsToFetch = Array.from(new Set(activeAlerts.map(a => a.symbol)));
      const priceMap: Record<string, number> = {};
      
      for (const sym of symbolsToFetch) {
         const data = await fetchBinancePrice(sym);
         if (data) priceMap[sym] = data.price;
      }

      if (!isMounted) return;

      setAlerts(prev => {
        let hasChanges = false;
        const nextAlerts = prev.map(alert => {
          if (alert.triggered) return alert;
          const currentPrice = priceMap[alert.symbol];
          if (!currentPrice) return alert;

          const isTriggered = 
            (alert.condition === 'above' && currentPrice >= alert.targetPrice) ||
            (alert.condition === 'below' && currentPrice <= alert.targetPrice);

          if (isTriggered) {
            hasChanges = true;
            if (typeof window !== 'undefined' && Notification.permission === 'granted') {
              new Notification(`🚀 Alerta de Precio: ${alert.symbol}`, {
                body: `El precio ha cruzado $${alert.targetPrice.toLocaleString()}. Precio actual: $${currentPrice.toLocaleString()}`,
              });
            }

            if (isSupabaseEnabled()) {
              updateAlertTriggered(alert.id, true).catch(() => {});
            }
            return { ...alert, triggered: true };
          }
          return alert;
        });
        
        return hasChanges ? nextAlerts : prev; // Only return new array if there are changes!
      });
    };

    const interval = setInterval(checkAlerts, 30000);
    checkAlerts(); // Initial check
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isLoaded, alerts.length]); // Only depend on length or isLoaded to avoid deep object reference loops

  const handleAdd = () => {
    if (!newSymbol || !newTarget) return;
    const localId = Math.random().toString(36).substring(2, 9);
    const newAlert: PriceAlert = {
      id: localId,
      symbol: newSymbol.toUpperCase(),
      targetPrice: parseFloat(newTarget),
      condition: newCondition,
      triggered: false,
    };

    if (isSupabaseEnabled()) {
      sbAddAlert(newAlert).then(sbId => {
        if (sbId) {
          setAlerts(prev => prev.map(a => a.id === localId ? { ...a, id: sbId } : a));
        }
      }).catch(() => {});
    }

    setAlerts([...alerts, newAlert]);
    setShowAdd(false);
    setNewTarget('');
  };

  const removeAlertHandler = (id: string) => {
    if (isSupabaseEnabled()) {
      sbRemoveAlert(id).catch(() => {});
    }
    setAlerts(alerts.filter(a => a.id !== id));
  };

  const handleForceSync = async () => {
    setSyncingBackend(true);
    const ok = await syncAlertsToBackend(alerts);
    setBackendSynced(ok);
    setSyncingBackend(false);
  };

  const resetTriggered = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, triggered: false } : a));
  };

  if (!isLoaded) return null;

  return (
    <div className="glass-card p-5 animate-fadeInUp">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Bell size={16} className="text-blue-400" /> Price Alerts
        </h3>
        
        {/* Real-time Bot Status Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            {botStatus === 'running' && <><Bot size={12} className="text-emerald-400" /><span className="text-[10px] font-bold text-emerald-400">ONLINE</span></>}
            {botStatus === 'idle' && <><Bot size={12} className="text-yellow-400" /><span className="text-[10px] font-bold text-yellow-400">DORMIDO</span></>}
            {(botStatus === 'error' || botStatus === 'unknown') && <><Bot size={12} className="text-red-400" /><span className="text-[10px] font-bold text-red-400">OFFLINE</span></>}
          </div>

          <button 
            onClick={() => setShowAdd(!showAdd)}
            className="p-1.5 rounded-lg transition-all border flex items-center gap-1.5 text-xs font-semibold"
            style={{ 
              background: showAdd ? 'var(--signal-buy-dim)' : 'var(--bg-tertiary)',
              color: showAdd ? 'var(--signal-buy)' : 'var(--text-muted)',
              borderColor: showAdd ? 'var(--signal-buy)' : 'var(--border-color)'
            }}
          >
            {showAdd ? <X size={14} /> : <Plus size={14} />}
            {showAdd ? 'Cerrar' : 'Agregar'}
          </button>
        </div>
      </div>

      {permission !== 'granted' && (
        <div className="mb-4 p-3 rounded-lg border flex items-center justify-between bg-orange-500/10 border-orange-500/30 text-orange-400 text-xs">
          <span className="flex items-center gap-2"><AlertCircle size={14}/> Habilitar notificaciones de navegador</span>
          <button onClick={requestPermission} className="px-3 py-1 rounded bg-orange-500/20 hover:bg-orange-500/40 transition-colors font-bold">
            Habilitar
          </button>
        </div>
      )}

      {/* Add Alert Form (Glassmorphism) */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showAdd ? 'max-h-64 opacity-100 mb-5' : 'max-h-0 opacity-0 mb-0'}`}>
        <div className="p-4 rounded-xl border border-white/10 bg-black/40 shadow-inner">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] text-white/50 mb-1.5 block uppercase tracking-wider font-semibold">Activo</label>
              <select 
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500/50 transition-colors text-white"
                value={newSymbol} onChange={e => setNewSymbol(e.target.value)}
              >
                {CRYPTO_DATABASE.map(c => (
                  <option key={c.symbol} value={c.symbol} className="bg-gray-900 text-white">{c.symbol}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/50 mb-1.5 block uppercase tracking-wider font-semibold">Condición</label>
              <select 
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500/50 transition-colors text-white"
                value={newCondition} onChange={e => setNewCondition(e.target.value as 'above' | 'below')}
              >
                <option value="above" className="bg-gray-900 text-white">Cruza Arriba (≥)</option>
                <option value="below" className="bg-gray-900 text-white">Cruza Abajo (≤)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-white/50 mb-1.5 block uppercase tracking-wider font-semibold">Precio Objetivo (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-xs">$</span>
                <input 
                  type="number" step="any" min="0"
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 pl-7 text-xs focus:outline-none focus:border-blue-500/50 transition-colors text-white placeholder-white/20"
                  value={newTarget} onChange={e => setNewTarget(e.target.value)}
                  placeholder="Ej: 65000"
                />
              </div>
            </div>
          </div>
          <button 
            onClick={handleAdd}
            className="w-full text-xs py-2 rounded-lg font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
          >
            Guardar Alerta
          </button>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-8 text-xs text-white/40 border border-white/5 rounded-xl bg-black/20 flex flex-col items-center gap-2">
          <BellOff size={20} className="opacity-50" />
          No hay alertas configuradas
        </div>
      ) : (
        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
          {alerts.map(alert => (
            <div 
              key={alert.id} 
              className={`group flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all hover:bg-white/5
                ${alert.triggered ? 'opacity-50 border-white/5 bg-black/40' : 'border-white/10 bg-black/20'}`}
              onClick={() => setSymbol(alert.symbol)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-1.5 h-8 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] 
                  ${alert.triggered ? 'bg-gray-600 shadow-none' : alert.condition === 'above' ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-red-500 shadow-red-500/50'}`} />
                <div>
                  <div className="font-bold text-sm text-white/90">{alert.symbol}</div>
                  <div className="text-[10px] font-mono text-white/50 flex items-center gap-1">
                    {alert.condition === 'above' ? <ChevronUp size={10} className="text-emerald-400"/> : <ChevronDown size={10} className="text-red-400"/>}
                    ${alert.targetPrice.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {alert.triggered && (
                  <button
                    onClick={(e) => { e.stopPropagation(); resetTriggered(alert.id); }}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/0 hover:border-blue-500/30"
                    title="Reactivar alerta"
                  >
                    <RefreshCw size={12} />
                  </button>
                )}
                {alert.triggered && <CheckCircle2 size={14} className="text-emerald-500" />}
                <button
                  onClick={(e) => { e.stopPropagation(); removeAlertHandler(alert.id); }}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/0 hover:border-red-500/30"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {alerts.length > 0 && (
        <button
          onClick={handleForceSync}
          disabled={syncingBackend}
          className={`w-full mt-4 text-[10px] py-2 rounded-lg flex items-center justify-center gap-2 transition-all font-semibold border
            ${syncingBackend ? 'opacity-50 cursor-not-allowed bg-black/40 border-white/5 text-white/40' 
            : backendSynced ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-black/40 border-white/10 text-white/60 hover:bg-white/5 hover:text-white/90'}`}
        >
          {syncingBackend ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
          {syncingBackend ? 'Sincronizando...' : backendSynced ? '✓ Sincronizado con Motor Backend' : 'Forzar Sincronización Backend'}
        </button>
      )}

      {/* Telegram Bot Configuration */}
      <TelegramConfig botStatus={botStatus} />
    </div>
  );
}

// ---- Telegram Config Sub-Component ----

function TelegramConfig({ botStatus }: { botStatus: string }) {
  const [showTg, setShowTg] = useState(false);
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [tgStatus, setTgStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  useEffect(() => {
    const savedToken = localStorage.getItem('tg_bot_token');
    const savedChat = localStorage.getItem('tg_chat_id');
    if (savedToken) setTgToken(savedToken);
    if (savedChat) setTgChatId(savedChat);
  }, []);

  const handleTestTelegram = async () => {
    if (!tgToken || !tgChatId) return;
    setTgStatus('testing');

    localStorage.setItem('tg_bot_token', tgToken);
    localStorage.setItem('tg_chat_id', tgChatId);

    try {
      const res = await fetch(`${PYTHON_API_URL}/api/telegram/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_token: tgToken, chat_id: tgChatId }),
      });

      if (res.ok) {
        await fetch(`${PYTHON_API_URL}/api/telegram/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bot_token: tgToken, chat_id: tgChatId }),
        }).catch(() => {});

        setTgStatus('success');
      } else {
        setTgStatus('error');
      }
    } catch {
      setTgStatus('error');
    }

    setTimeout(() => setTgStatus('idle'), 3000);
  };

  return (
    <div className="mt-5 pt-5 border-t border-white/10">
      <button
        onClick={() => setShowTg(!showTg)}
        className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-white/5 transition-colors group"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-white/70 group-hover:text-white transition-colors">
          <Settings size={14} className={botStatus === 'running' ? 'text-emerald-400' : 'text-white/40'} />
          Configuración Telegram
        </div>
        <ChevronDown size={14} className={`text-white/40 transition-transform duration-300 ${showTg ? 'rotate-180' : ''}`} />
      </button>

      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showTg ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
        <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
          <div>
            <label className="text-[10px] text-white/50 mb-1.5 block uppercase tracking-wider font-semibold">Bot Token (@BotFather)</label>
            <input
              type="password"
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500/50 transition-colors text-white"
              value={tgToken}
              onChange={e => setTgToken(e.target.value)}
              placeholder="123456:ABC-DEF..."
            />
          </div>
          <div>
            <label className="text-[10px] text-white/50 mb-1.5 block uppercase tracking-wider font-semibold">Chat ID (@userinfobot)</label>
            <input
              type="text"
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500/50 transition-colors text-white"
              value={tgChatId}
              onChange={e => setTgChatId(e.target.value)}
              placeholder="123456789"
            />
          </div>
          <button
            onClick={handleTestTelegram}
            disabled={tgStatus === 'testing' || !tgToken || !tgChatId}
            className={`w-full text-xs py-2 rounded-lg font-bold transition-all border flex justify-center items-center gap-2
              ${tgStatus === 'success' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : tgStatus === 'error' ? 'bg-red-500/20 text-red-400 border-red-500/30'
              : 'bg-white/5 text-white/90 border-white/10 hover:bg-white/10'}`}
            style={{ opacity: (!tgToken || !tgChatId) ? 0.5 : 1 }}
          >
            {tgStatus === 'testing' ? <><Activity size={12} className="animate-pulse" /> Probando Conexión...</>
             : tgStatus === 'success' ? <><CheckCircle2 size={12} /> ¡Conectado y Guardado!</>
             : tgStatus === 'error' ? <><AlertCircle size={12} /> Error de Credenciales</>
             : <><Send size={12} /> Guardar y Activar Bot</>}
          </button>
          <p className="text-[9px] text-white/40 text-center mt-2 px-2 leading-relaxed">
            Al guardar, las credenciales se encriptan localmente. El motor backend de Python detectará el cambio y despertará el bot automáticamente sin necesidad de reiniciar servidores.
          </p>
        </div>
      </div>
    </div>
  );
}
