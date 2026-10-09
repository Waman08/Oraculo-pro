"use client";

import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  title: string;
  description: string;
  howToUse?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export default function InfoTooltip({ title, description, howToUse, placement = 'top' }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const placementClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div 
      className="relative inline-flex items-center ml-1.5"
      ref={containerRef}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onClick={() => setIsVisible(!isVisible)}
    >
      <HelpCircle size={14} className="text-gray-400 hover:text-[var(--accent-gold)] cursor-help transition-colors" />
      
      {isVisible && (
        <div className={`absolute z-50 w-64 p-3 rounded-xl bg-[#0F172A]/95 border border-white/10 shadow-2xl backdrop-blur-md text-xs animate-fadeIn ${placementClasses[placement]}`}>
          <h4 className="font-bold text-[var(--accent-gold)] mb-1">{title}</h4>
          <p className="text-gray-300 leading-relaxed">{description}</p>
          {howToUse && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <span className="font-semibold text-gray-400 text-[10px] uppercase tracking-wider block mb-1">Cómo interpretarlo</span>
              <p className="text-gray-200">{howToUse}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}