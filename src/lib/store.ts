import { create } from 'zustand';
import type { LivePriceData } from '@/lib/api';

export interface Toast {
  id: string;
  title: string;
  message?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

interface AppState {
  livePrices: Record<string, LivePriceData>;
  setPrice: (symbol: string, data: LivePriceData) => void;
  setMultiplePrices: (prices: Record<string, LivePriceData>) => void;
  
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  livePrices: {},
  setPrice: (symbol, data) => set((state) => ({
    livePrices: { ...state.livePrices, [symbol]: data }
  })),
  setMultiplePrices: (prices) => set((state) => ({
    livePrices: { ...state.livePrices, ...prices }
  })),
  
  toasts: [],
  addToast: (toast) => set((state) => {
    const id = Math.random().toString(36).substring(2, 9);
    return { toasts: [...state.toasts, { ...toast, id }] };
  }),
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  })),
}));
