"use client";

import Dashboard from '@/components/Dashboard';
import Screener from '@/components/Screener';
import { AppProvider, useAppSettings, useLocale, useTheme } from '@/components/AppContext';
import type { RiskMode, Timeframe } from '@/types';
import { Sun, Moon, Globe, Settings2, Cloud, HardDrive } from 'lucide-react';

function AppContent() {
  const { activeTab, setActiveTab, mode, setMode, timeframe, setTimeframe, cloudSynced } = useAppSettings();
  const { t, locale, toggleLocale } = useLocale();
  const { theme, toggleTheme } = useTheme();

  const timeframes: Timeframe[] = ['1S', '1D', '4H', '1H', '15M'];
  const modes: RiskMode[] = ['Seguro', 'Balanceado', 'Agresivo'];
  const modeKeys: Record<RiskMode, string> = {
    Seguro: 'mode.safe',
    Balanceado: 'mode.balanced',
    Agresivo: 'mode.aggressive',
  };

  return (
    <main
      className="min-h-screen p-4 flex flex-col items-center transition-colors"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-6 animate-fadeInUp">
          <h1
            className="text-3xl md:text-4xl font-black mb-1 tracking-tight"
            style={{ color: 'var(--accent-gold)' }}
          >
            {t('app.title')}
          </h1>
          <p className="text-xs md:text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('app.subtitle')}
          </p>
        </div>

        {/* Top Controls Bar */}
        <div
          className="glass-card p-3 mb-6 flex flex-wrap items-center justify-between gap-3 animate-fadeInUp"
          style={{ animationDelay: '0.1s' }}
        >
          {/* Left: Theme + Language */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="theme-toggle"
              title={t('controls.theme')}
              id="theme-toggle-btn"
            >
              <div className="theme-toggle__knob">
                {theme === 'dark' ? '🌙' : '☀️'}
              </div>
            </button>

            {/* Language Toggle */}
            <button
              onClick={toggleLocale}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
              }}
              id="language-toggle-btn"
            >
              <Globe size={13} />
              {locale === 'es' ? 'ES 🇪🇸' : 'EN 🇬🇧'}
            </button>

            {/* Cloud Sync Indicator */}
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
              style={{
                color: cloudSynced ? 'var(--signal-buy)' : 'var(--text-muted)',
                background: cloudSynced ? 'var(--signal-buy-dim)' : 'var(--bg-tertiary)',
                border: '1px solid ' + (cloudSynced ? 'rgba(16,185,129,0.2)' : 'var(--border-color)'),
              }}
              title={cloudSynced ? 'Synced to Supabase Cloud' : 'Local storage only'}
            >
              {cloudSynced ? <Cloud size={11} /> : <HardDrive size={11} />}
              {cloudSynced ? '☁️' : '💾'}
            </div>
          </div>

          {/* Center: Risk Mode */}
          <div className="flex items-center gap-2">
            <Settings2 size={13} style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              {t('controls.mode')}:
            </span>
            {modes.map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="text-xs font-semibold px-3 py-1 rounded-lg transition-all"
                style={{
                  background: mode === m ? 'var(--accent-gold-dim)' : 'transparent',
                  color: mode === m ? 'var(--accent-gold)' : 'var(--text-muted)',
                  border: `1px solid ${mode === m ? 'var(--accent-gold)' + '55' : 'transparent'}`,
                }}
                id={`mode-btn-${m}`}
              >
                {t(modeKeys[m])}
              </button>
            ))}
          </div>

          {/* Right: Timeframes (only in Analysis tab) */}
          {activeTab === 'analysis' && (
            <div className="flex items-center gap-1">
              {timeframes.map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`tab-button text-xs py-1 px-2 ${timeframe === tf ? 'tab-button--active' : ''}`}
                  id={`tf-btn-${tf}`}
                >
                  {tf}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center gap-3 mb-8 animate-fadeInUp" style={{ animationDelay: '0.15s' }}>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`tab-button ${activeTab === 'analysis' ? 'tab-button--active' : ''}`}
            id="tab-analysis"
          >
            📊 {t('nav.analysis')}
          </button>
          <button
            onClick={() => setActiveTab('screener')}
            className={`tab-button ${activeTab === 'screener' ? 'tab-button--active' : ''}`}
            id="tab-screener"
          >
            🌍 {t('nav.screener')}
          </button>
        </div>

        {/* Content */}
        <div key={activeTab} className="animate-fadeInUp">
          {activeTab === 'analysis' ? <Dashboard /> : <Screener />}
        </div>

        {/* Footer */}
        <footer className="text-center mt-12 mb-6 text-xs" style={{ color: 'var(--text-muted)' }}>
          <p>{t('footer.title')}</p>
          <p className="mt-1 opacity-60">
            {t('footer.disclaimer')}
          </p>
        </footer>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
