import { useAppStore } from './store';
import { BINANCE_PAIR_MAP, REVERSE_PAIR_MAP } from './api';

class WebSocketManager {
  private ws: WebSocket | null = null;
  private subscriptions: Set<string> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  
  // Throttle updates (Binance sends 1 per second anyway for @ticker)
  private lastUpdate: Record<string, number> = {};

  connect() {
    // Evitar múltiples conexiones en desarrollo
    if (typeof window === 'undefined') return;
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;

    this.ws = new WebSocket('wss://stream.binance.com:9443/ws');

    this.ws.onopen = () => {
      console.log('[WSS] Binance Connected');
      this.resubscribeAll();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.e === '24hrTicker') {
          const pair = data.s;
          const symbol = REVERSE_PAIR_MAP[pair];
          
          if (symbol) {
             const now = Date.now();
             // Throttle: solo actualizar si pasaron > 900ms desde el último
             if (!this.lastUpdate[symbol] || now - this.lastUpdate[symbol] > 900) {
               this.lastUpdate[symbol] = now;
               useAppStore.getState().setPrice(symbol, {
                 price: parseFloat(data.c),
                 priceChange24h: parseFloat(data.P),
                 volume24h: parseFloat(data.q),
                 source: 'binance',
               });
             }
          }
        }
      } catch (err) {
        console.error('[WSS] Error parsing message', err);
      }
    };

    this.ws.onclose = () => {
      console.log('[WSS] Binance Disconnected. Reconnecting in 3s...');
      this.ws = null;
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = (err) => {
      console.error('[WSS] Binance Error:', err);
      this.ws?.close();
    };
  }

  subscribe(symbol: string) {
    const sym = symbol.toUpperCase();
    const pair = BINANCE_PAIR_MAP[sym];
    if (!pair) return; // No soportado en Binance
    
    if (!this.subscriptions.has(sym)) {
      this.subscriptions.add(sym);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          method: 'SUBSCRIBE',
          params: [`${pair.toLowerCase()}@ticker`],
          id: Date.now()
        }));
      } else {
        this.connect(); // Ensure we are connected
      }
    }
  }

  unsubscribe(symbol: string) {
    const sym = symbol.toUpperCase();
    const pair = BINANCE_PAIR_MAP[sym];
    if (!pair) return;

    if (this.subscriptions.has(sym)) {
      this.subscriptions.delete(sym);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          method: 'UNSUBSCRIBE',
          params: [`${pair.toLowerCase()}@ticker`],
          id: Date.now()
        }));
      }
    }
  }

  private resubscribeAll() {
    if (this.subscriptions.size === 0 || this.ws?.readyState !== WebSocket.OPEN) return;
    
    const params = Array.from(this.subscriptions)
      .map(sym => {
        const pair = BINANCE_PAIR_MAP[sym];
        return pair ? `${pair.toLowerCase()}@ticker` : null;
      })
      .filter((p): p is string => p !== null);

    if (params.length === 0) return;

    // Chunk subscriptions into groups of 50
    for(let i=0; i < params.length; i+=50) {
       this.ws.send(JSON.stringify({
         method: 'SUBSCRIBE',
         params: params.slice(i, i+50),
         id: Date.now() + i
       }));
    }
  }
}

// Export singleton
export const wsManager = new WebSocketManager();
