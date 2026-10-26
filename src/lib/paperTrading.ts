import { getSupabase } from './supabase';

const PYTHON_API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';

export interface PaperAccount {
  id?: string;
  session_id: string;
  initial_balance: number;
  cash_balance: number;
  equity: number;
  updated_at?: string;
}

export interface PaperPosition {
  id: string;
  session_id: string;
  symbol: string;
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT';
  entry_price: number;
  amount: number;
  total_usd: number;
  leverage?: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  status: 'OPEN' | 'CLOSED';
  exit_price?: number | null;
  exit_reason?: string | null;
  pnl_usd?: number | null;
  pnl_pct?: number | null;
  opened_at: string;
  closed_at?: string | null;
}

export interface PaperMetrics {
  totalTrades: number;
  winRate: number;
  profitFactor: string | number;
  sharpeRatio: number;
  totalReturnPct: number;
  maxDrawdown: number;
}

export interface PaperSummary {
  account: PaperAccount;
  equity: number;
  metrics: PaperMetrics;
  openPositions: PaperPosition[];
  closedPositions: PaperPosition[];
}

const LOCAL_STORAGE_PREFIX = 'oracle_paper_';

export function getDefaultPaperData(sessionId: string): PaperSummary {
  return {
    account: {
      session_id: sessionId,
      initial_balance: 10000,
      cash_balance: 10000,
      equity: 10000,
    },
    equity: 10000,
    metrics: {
      totalTrades: 0,
      winRate: 0,
      profitFactor: '0.00',
      sharpeRatio: 0,
      totalReturnPct: 0.0,
      maxDrawdown: 0.0,
    },
    openPositions: [],
    closedPositions: [],
  };
}

/**
 * Carga el resumen de la cuenta de Paper Trading con fallback en cascada:
 * 1. Intenta backend Python con timeout de 2s.
 * 2. Si falla, consulta Supabase (paper_accounts y paper_positions).
 * 3. Si falla o no está configurado, usa localStorage con cuenta inicial de $10.000.
 */
export async function getPaperSummary(sessionId: string): Promise<PaperSummary> {
  // 1. Intentar Backend Python (máximo 2 segundos)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${PYTHON_API_URL}/api/paper/status?session_id=${sessionId}`, {
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (res && res.ok) {
      const data = await res.json();
      if (data && typeof data.equity === 'number') {
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_PREFIX + sessionId, JSON.stringify(data));
        }
        return data;
      }
    }
  } catch {
    // Continuar al fallback de Supabase / localStorage
  }

  // 2. Intentar Supabase Client
  const supabase = getSupabase();
  if (supabase) {
    try {
      // Buscar o crear cuenta
      let { data: account, error: accErr } = await supabase
        .from('paper_accounts')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (!account && !accErr) {
        const { data: newAcc } = await supabase
          .from('paper_accounts')
          .insert({
            session_id: sessionId,
            initial_balance: 10000,
            cash_balance: 10000,
            equity: 10000,
          })
          .select()
          .maybeSingle();
        if (newAcc) account = newAcc;
      }

      if (account) {
        const { data: positions } = await supabase
          .from('paper_positions')
          .select('*')
          .eq('session_id', sessionId)
          .order('opened_at', { ascending: false });

        const openPositions: PaperPosition[] = [];
        const closedPositions: PaperPosition[] = [];
        let runningEquity = Number(account.cash_balance) || 10000;

        (positions || []).forEach((p: any) => {
          if (p.status === 'OPEN') {
            openPositions.push(p);
            runningEquity += Number(p.total_usd) || 0;
          } else {
            closedPositions.push(p);
          }
        });

        // Calcular métricas
        const totalTrades = closedPositions.length;
        const wins = closedPositions.filter((p) => Number(p.pnl_usd || 0) > 0).length;
        const winRate = totalTrades > 0 ? Number(((wins / totalTrades) * 100).toFixed(1)) : 0;

        const grossProfit = closedPositions
          .filter((p) => Number(p.pnl_usd || 0) > 0)
          .reduce((sum, p) => sum + Number(p.pnl_usd || 0), 0);
        const grossLoss = Math.abs(
          closedPositions
            .filter((p) => Number(p.pnl_usd || 0) < 0)
            .reduce((sum, p) => sum + Number(p.pnl_usd || 0), 0)
        );
        const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? '999.00' : '0.00';

        const initBal = Number(account.initial_balance) || 10000;
        const totalReturnPct = Number((((runningEquity - initBal) / initBal) * 100).toFixed(2));

        const summary: PaperSummary = {
          account: {
            session_id: sessionId,
            initial_balance: initBal,
            cash_balance: Number(account.cash_balance) || 10000,
            equity: runningEquity,
          },
          equity: runningEquity,
          metrics: {
            totalTrades,
            winRate,
            profitFactor,
            sharpeRatio: 0,
            totalReturnPct,
            maxDrawdown: 0,
          },
          openPositions,
          closedPositions,
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_PREFIX + sessionId, JSON.stringify(summary));
        }
        return summary;
      }
    } catch (e) {
      console.warn('[PaperTrading] Error consultando Supabase, usando localStorage:', e);
    }
  }

  // 3. Fallback a LocalStorage
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_STORAGE_PREFIX + sessionId);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.equity === 'number') {
          return parsed;
        }
      } catch {
        // Ignorar error de parsing
      }
    }
  }

  // 4. Default: Cuenta limpia de $10.000
  const defaultData = getDefaultPaperData(sessionId);
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_PREFIX + sessionId, JSON.stringify(defaultData));
  }
  return defaultData;
}

/**
 * Cierra una posición abierta en el simulador.
 */
export async function closePaperPosition(
  sessionId: string,
  positionId: string,
  exitPrice: number,
  exitReason: string = 'MANUAL'
): Promise<PaperSummary> {
  // Intentar backend
  try {
    const res = await fetch(`${PYTHON_API_URL}/api/paper/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        position_id: positionId,
        exit_price: exitPrice,
        reason: exitReason,
      }),
    }).catch(() => null);

    if (res && res.ok) {
      return await getPaperSummary(sessionId);
    }
  } catch {
    // Continuar localmente
  }

  // Si falló el backend, actualizar localmente / Supabase
  const supabase = getSupabase();
  const summary = await getPaperSummary(sessionId);
  const posIndex = summary.openPositions.findIndex((p) => p.id === positionId);

  if (posIndex !== -1) {
    const pos = summary.openPositions[posIndex];
    const isLong = pos.side === 'BUY' || pos.side === 'LONG';
    const pnlUsd = isLong
      ? (exitPrice - pos.entry_price) * pos.amount
      : (pos.entry_price - exitPrice) * pos.amount;
    const pnlPct = (pnlUsd / pos.total_usd) * 100;

    const closedPos: PaperPosition = {
      ...pos,
      status: 'CLOSED',
      exit_price: exitPrice,
      exit_reason: exitReason,
      pnl_usd: Number(pnlUsd.toFixed(2)),
      pnl_pct: Number(pnlPct.toFixed(2)),
      closed_at: new Date().toISOString(),
    };

    summary.openPositions.splice(posIndex, 1);
    summary.closedPositions.push(closedPos);
    summary.account.cash_balance = Number((summary.account.cash_balance + pos.total_usd + pnlUsd).toFixed(2));
    summary.equity = summary.account.cash_balance;

    // Actualizar métricas
    const totalTrades = summary.closedPositions.length;
    const wins = summary.closedPositions.filter((p) => Number(p.pnl_usd || 0) > 0).length;
    summary.metrics.winRate = totalTrades > 0 ? Number(((wins / totalTrades) * 100).toFixed(1)) : 0;
    summary.metrics.totalReturnPct = Number(
      (((summary.equity - summary.account.initial_balance) / summary.account.initial_balance) * 100).toFixed(2)
    );

    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_PREFIX + sessionId, JSON.stringify(summary));
    }

    if (supabase) {
      try {
        await supabase
          .from('paper_positions')
          .update({
            status: 'CLOSED',
            exit_price: exitPrice,
            exit_reason: exitReason,
            pnl_usd: pnlUsd,
            pnl_pct: pnlPct,
            closed_at: new Date().toISOString(),
          })
          .eq('id', positionId);

        await supabase
          .from('paper_accounts')
          .update({
            cash_balance: summary.account.cash_balance,
            equity: summary.equity,
          })
          .eq('session_id', sessionId);
      } catch {
        // Ignorar
      }
    }
  }

  return summary;
}

/**
 * Reinicia la cuenta demo a $10.000.00
 */
export async function resetPaperAccount(sessionId: string): Promise<PaperSummary> {
  const fresh = getDefaultPaperData(sessionId);

  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_PREFIX + sessionId, JSON.stringify(fresh));
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from('paper_positions').delete().eq('session_id', sessionId);
      await supabase
        .from('paper_accounts')
        .update({
          cash_balance: 10000,
          equity: 10000,
          initial_balance: 10000,
        })
        .eq('session_id', sessionId);
    } catch {
      // Ignorar
    }
  }

  return fresh;
}
