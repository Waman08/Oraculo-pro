"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';
import { useLocale } from '../AppContext';

interface InfoTooltipProps {
  title: string;
  description: string;
  howToUse?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export default function InfoTooltip({ title, description, howToUse }: InfoTooltipProps) {
  const { t, locale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    placeAbove: true,
  });

  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const tooltipWidth = 260;

    // Check if there is enough space above (requires ~160px)
    const placeAbove = rect.top >= 170;
    const top = placeAbove ? rect.top - 10 : rect.bottom + 10;

    // Center horizontally on the icon, clamped to viewport bounds
    let left = rect.left + rect.width / 2;
    const padding = 16;
    if (left - tooltipWidth / 2 < padding) {
      left = padding + tooltipWidth / 2;
    } else if (left + tooltipWidth / 2 > window.innerWidth - padding) {
      left = window.innerWidth - padding - tooltipWidth / 2;
    }

    setCoords({ top, left, placeAbove });
  };

  const handleOpen = () => {
    updatePosition();
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const displayTitle = t(title);
  const displayDescription = t(description);
  const displayHowToUse = howToUse ? t(howToUse) : undefined;
  const howToInterpretLabel = t('tooltip.howToUse') || (locale === 'en' ? 'HOW TO INTERPRET' : 'CÓMO INTERPRETARLO');

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        className="inline-flex items-center justify-center ml-1.5 p-0.5 text-gray-400 hover:text-[var(--accent-gold)] cursor-help transition-colors rounded-full focus:outline-none"
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) handleClose();
          else handleOpen();
        }}
        aria-label={`${locale === 'en' ? 'Help' : 'Ayuda'}: ${displayTitle}`}
      >
        <HelpCircle size={14} />
      </button>

      {mounted && isOpen && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            transform: coords.placeAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            zIndex: 99999,
          }}
          className="w-64 p-3 rounded-xl bg-[#0F172A]/95 border border-white/10 shadow-2xl backdrop-blur-md text-xs text-left animate-fadeIn pointer-events-none select-none"
        >
          <h4 className="font-bold text-[var(--accent-gold)] mb-1">{displayTitle}</h4>
          <p className="text-gray-300 leading-relaxed">{displayDescription}</p>
          {displayHowToUse && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <span className="font-semibold text-gray-400 text-[10px] uppercase tracking-wider block mb-1">
                {howToInterpretLabel}
              </span>
              <p className="text-gray-200">{displayHowToUse}</p>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
