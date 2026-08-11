"use client";

import React, { useEffect } from 'react';
import { useAppStore, type Toast } from '@/lib/store';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast, onRemove: () => void }) {
  useEffect(() => {
    const duration = toast.duration || 5000;
    const timer = setTimeout(() => {
      onRemove();
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.duration, onRemove]);

  const icons: Record<Toast['type'], React.ReactNode> = {
    success: <CheckCircle2 size={20} className="text-[#10B981]" />,
    error: <XCircle size={20} className="text-[#EF4444]" />,
    warning: <AlertTriangle size={20} className="text-[#F5B041]" />,
    info: <Info size={20} className="text-[#3B82F6]" />,
  };

  const borders: Record<Toast['type'], string> = {
    success: 'border-[#10B981]',
    error: 'border-[#EF4444]',
    warning: 'border-[#F5B041]',
    info: 'border-[#3B82F6]',
  };

  return (
    <div 
      className={`flex items-start gap-3 glass-card p-4 min-w-[300px] max-w-[400px] animate-slideInRight pointer-events-auto border-l-4 ${borders[toast.type]}`}
      style={{ background: 'var(--bg-secondary)' }}
    >
      <div className="flex-shrink-0 mt-0.5">
        {icons[toast.type]}
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{toast.title}</h4>
        {toast.message && (
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{toast.message}</p>
        )}
      </div>
      <button onClick={onRemove} className="opacity-50 hover:opacity-100 transition-opacity">
        <X size={16} style={{ color: 'var(--text-muted)' }} />
      </button>
    </div>
  );
}
