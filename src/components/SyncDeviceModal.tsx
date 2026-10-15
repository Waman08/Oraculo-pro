"use client";

import React, { useState, useEffect } from 'react';
import { Smartphone, Laptop, QrCode, Copy, Check, Link2, RefreshCw, X, AlertCircle, ShieldCheck, ArrowRightLeft } from 'lucide-react';
import { getCurrentSessionId, linkDeviceSession, isValidSessionId } from '@/lib/supabase';
import { useAppSettings } from './AppContext';

interface SyncDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SyncDeviceModal({ isOpen, onClose }: SyncDeviceModalProps) {
  const { t } = useAppSettings();
  const [sessionId, setSessionId] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSessionId(getCurrentSessionId());
      setErrorMsg(null);
      setSuccessMsg(null);
      setInputCode('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://oraculo-pro.vercel.app';
  const syncLink = `${currentOrigin}/?sync_id=${sessionId}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(syncLink)}&bgcolor=0B0E14&color=F59E0B&margin=4`;

  const handleCopyCode = async () => {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      setErrorMsg(t('shareCard.copyError'));
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(syncLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setErrorMsg(t('shareCard.copyError'));
    }
  };

  const handleLinkDevice = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanInput = inputCode.trim();
    if (!cleanInput) {
      setErrorMsg(t('syncModal.errEmpty'));
      return;
    }

    if (cleanInput === sessionId || cleanInput === syncLink) {
      setErrorMsg(t('syncModal.errSame'));
      return;
    }

    if (!isValidSessionId(cleanInput)) {
      setErrorMsg(t('syncModal.errInvalid'));
      return;
    }

    setIsLinking(true);
    setSuccessMsg(t('syncModal.linkingStatus'));

    setTimeout(() => {
      const ok = linkDeviceSession(cleanInput, true);
      if (!ok) {
        setIsLinking(false);
        setErrorMsg(t('syncModal.errFailed'));
        setSuccessMsg(null);
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div 
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 shadow-2xl p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #0B0E14 0%, #111827 100%)' }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          title={t('syncModal.close')}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[var(--accent-gold)]">
            <Smartphone size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              {t('syncModal.title')} <ArrowRightLeft size={16} className="text-[var(--accent-gold)]" />
            </h2>
            <p className="text-xs text-gray-400">
              {t('syncModal.subtitle')}
            </p>
          </div>
        </div>

        {/* Informative Banner */}
        <div className="mt-4 mb-6 p-3 rounded-xl bg-white/5 border border-white/10 flex items-start gap-2.5 text-xs text-gray-300">
          <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
          <span>
            {t('syncModal.banner')}
          </span>
        </div>

        {/* SECTION 1: Export Current Device */}
        <div className="mb-6 p-4 rounded-xl bg-black/40 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-gold)] flex items-center gap-1.5">
              <Laptop size={14} /> {t('syncModal.thisDevice')}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
              {t('syncModal.active')}
            </span>
          </div>

          {/* Session ID display */}
          <div className="p-3 rounded-lg bg-black/60 border border-white/10 font-mono text-xs text-gray-300 break-all select-all mb-3 flex items-center justify-between gap-2">
            <span>{sessionId || t('syncModal.loading')}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={handleCopyCode}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all bg-white/10 hover:bg-white/20 text-white border border-white/10"
            >
              {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copiedCode ? t('syncModal.codeCopied') : t('syncModal.copyCode')}
            </button>

            <button
              onClick={handleCopyLink}
              className="flex-1 min-w-[160px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40"
            >
              {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Link2 size={14} />}
              {copiedLink ? t('syncModal.linkCopied') : t('syncModal.copyLink')}
            </button>
          </div>

          {/* QR Code Quick Scan for Mobile */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-3 border-t border-white/10">
            <div className="shrink-0 p-2 bg-[#0B0E14] border border-white/10 rounded-xl flex items-center justify-center shadow-lg">
              {sessionId ? (
                <img 
                  src={qrCodeUrl} 
                  alt={t('syncModal.instantScan')} 
                  className="w-28 h-28 object-contain rounded-lg"
                  loading="lazy"
                />
              ) : (
                <div className="w-28 h-28 flex items-center justify-center text-xs text-gray-500">
                  <QrCode size={32} />
                </div>
              )}
            </div>
            <div className="text-xs text-gray-400">
              <p className="font-semibold text-gray-200 mb-1 flex items-center gap-1.5">
                <QrCode size={13} className="text-[var(--accent-gold)]" /> {t('syncModal.instantScan')}
              </p>
              <p className="text-[11px] leading-relaxed">
                {t('syncModal.scanDesc')}
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 2: Import from another device */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/10">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5 mb-2">
            <Smartphone size={14} /> {t('syncModal.linkOther')}
          </span>
          <p className="text-xs text-gray-400 mb-3">
            {t('syncModal.linkOtherDesc')}
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder={t('syncModal.placeholder')}
              className="flex-1 px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500 transition-colors font-mono"
            />
            <button
              onClick={handleLinkDevice}
              disabled={isLinking || !inputCode.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/10 shrink-0"
            >
              <RefreshCw size={14} className={isLinking ? 'animate-spin' : ''} />
              {isLinking ? t('syncModal.linking') : t('syncModal.linkBtn')}
            </button>
          </div>

          {/* Error & Success Messages */}
          {errorMsg && (
            <div className="mt-3 p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-2 text-xs text-red-300 animate-fadeIn">
              <AlertCircle size={15} className="shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300 animate-fadeIn">
              <Check size={15} className="shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
