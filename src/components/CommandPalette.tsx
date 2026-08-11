"use client";

import { useState, useEffect, useRef } from 'react';
import { useAppSettings } from './AppContext';
import { Search, Calculator, Code, BarChart2 } from 'lucide-react';
import { BINANCE_PAIR_MAP } from '@/lib/api';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { setSymbol, setMode, setTimeframe } = useAppSettings();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const pairs = Object.keys(BINANCE_PAIR_MAP);
  const filteredPairs = pairs.filter(p => p.toLowerCase().includes(search.toLowerCase())).slice(0, 5);

  const handleSelectSymbol = (sym: string) => {
    setSymbol(sym);
    setIsOpen(false);
    setSearch('');
  };

  const handleSelectMode = (mode: any) => {
    setMode(mode);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      
      <div className="relative w-full max-w-xl glass-card rounded-xl overflow-hidden shadow-2xl border border-[rgba(255,255,255,0.1)] animate-fadeInUp">
        <div className="flex items-center px-4 py-3 border-b border-[rgba(255,255,255,0.05)]">
          <Search size={20} style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-lg px-3 py-1"
            style={{ color: 'var(--text-primary)' }}
            placeholder="Type a command or search a symbol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd className="text-xs px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)]" style={{ color: 'var(--text-muted)' }}>ESC</kbd>
        </div>

        <div className="max-h-[300px] overflow-y-auto py-2">
          {search.length > 0 && (
            <div className="px-2 mb-2">
              <div className="text-xs font-bold uppercase tracking-wider px-3 py-2 mb-1" style={{ color: 'var(--text-muted)' }}>Symbols</div>
              {filteredPairs.map(sym => (
                <button
                  key={sym}
                  onClick={() => handleSelectSymbol(sym)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-3"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <BarChart2 size={16} style={{ color: 'var(--accent-gold)' }} />
                  {sym}
                </button>
              ))}
              {filteredPairs.length === 0 && (
                <div className="px-3 py-2 text-sm italic" style={{ color: 'var(--text-muted)' }}>No symbols found matching "{search}"</div>
              )}
            </div>
          )}

          {search.length === 0 && (
            <div className="px-2">
              <div className="text-xs font-bold uppercase tracking-wider px-3 py-2 mb-1" style={{ color: 'var(--text-muted)' }}>Quick Actions</div>
              <button onClick={() => handleSelectMode('aggressivo')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
                <Code size={16} style={{ color: 'var(--signal-buy)' }} /> Switch to Aggressive Mode
              </button>
              <button onClick={() => handleSelectMode('seguro')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
                <Calculator size={16} style={{ color: 'var(--signal-warning)' }} /> Switch to Safe Mode
              </button>
              <button onClick={() => setTimeframe('4H')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
                <Search size={16} style={{ color: '#818CF8' }} /> Change Timeframe to 4H
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
