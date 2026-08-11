// ============================================================
// SCORING UTILS — Umbrales y señales compartidos
// Extraído para evitar dependencia circular mock-data <-> ml-engine
// ============================================================

import type { RiskMode, Signal } from '@/types';

// ---- Umbrales por Modo de Riesgo ----

interface RiskThresholds {
  buyStrong: number;
  buy: number;
  sell: number;
  sellStrong: number;
}

export const THRESHOLDS: Record<RiskMode, RiskThresholds> = {
  Seguro: { buyStrong: 15, buy: 30, sell: 55, sellStrong: 70 },
  Balanceado: { buyStrong: 20, buy: 40, sell: 60, sellStrong: 80 },
  Agresivo: { buyStrong: 30, buy: 45, sell: 70, sellStrong: 85 },
};

// ---- Señal desde Score ----

export function getSignalFromScore(score: number, mode: RiskMode): Signal {
  const t = THRESHOLDS[mode];
  if (score <= t.buyStrong) return 'Compra Fuerte';
  if (score <= t.buy) return 'Compra';
  if (score >= t.sellStrong) return 'Venta Fuerte';
  if (score >= t.sell) return 'Venta';
  return 'Mantener';
}
