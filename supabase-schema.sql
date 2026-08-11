-- ============================================================
-- SUPABASE SCHEMA — Oráculo de Trading Pro
-- Ejecutar este SQL en el SQL Editor de Supabase Dashboard
-- ============================================================

-- Tabla de preferencias del usuario (anónimo por session_id)
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  theme TEXT DEFAULT 'dark',
  locale TEXT DEFAULT 'es',
  symbol TEXT DEFAULT 'BTC',
  risk_mode TEXT DEFAULT 'Balanceado',
  timeframe TEXT DEFAULT '1S',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de watchlist
CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, symbol)
);

-- Tabla de portfolio
CREATE TABLE IF NOT EXISTS portfolio_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  entry_price DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de alertas de precio
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  target_price DOUBLE PRECISION NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('above', 'below')),
  triggered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de historial de señales (para el bot de Telegram)
CREATE TABLE IF NOT EXISTS signal_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  signal TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  timeframe TEXT NOT NULL,
  risk_mode TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de configuración de Telegram
CREATE TABLE IF NOT EXISTS telegram_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  chat_id TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  alert_interval_minutes INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_watchlist_session ON watchlist_items(session_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_session ON portfolio_items(session_id);
CREATE INDEX IF NOT EXISTS idx_alerts_session ON price_alerts(session_id);
CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signal_history(symbol);
CREATE INDEX IF NOT EXISTS idx_signals_created ON signal_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_session ON telegram_config(session_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_config ENABLE ROW LEVEL SECURITY;

-- Policies: acceso abierto para anon (controlado por session_id en la app)
-- En producción con auth real, cambiar estas policies a auth.uid()

CREATE POLICY "anon_all_preferences" ON user_preferences FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_watchlist" ON watchlist_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_portfolio" ON portfolio_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_alerts" ON price_alerts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_signals" ON signal_history FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_telegram" ON telegram_config FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- FUNCIÓN: auto-actualizar updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_preferences_updated
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_telegram_updated
  BEFORE UPDATE ON telegram_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
