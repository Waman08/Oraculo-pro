"use client";

import { useMemo } from 'react';
import { Search } from 'lucide-react';

interface GaugeWidgetProps {
  value: number; // 0-100
  label: string;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  onDetailsClick?: () => void;
}

const SIZE_MAP = {
  sm: { width: 80, height: 45, radius: 35, stroke: 6, font: 10, needle: 25 },
  md: { width: 120, height: 70, radius: 50, stroke: 8, font: 14, needle: 38 },
  lg: { width: 180, height: 100, radius: 75, stroke: 12, font: 20, needle: 58 },
};

export default function GaugeWidget({ value, label, size = 'md', showValue = true, onDetailsClick }: GaugeWidgetProps) {
  const dims = SIZE_MAP[size];
  const centerX = dims.width / 2;
  const centerY = dims.height - 5;
  
  const gaugeData = useMemo(() => {
    // Semicircle: -180 to 0 degrees
    const scoreAngle = -180 + (Math.max(0, Math.min(100, value)) / 100) * 180;
    const needleAngle = (scoreAngle * Math.PI) / 180;
    const needleX = centerX + dims.needle * Math.cos(needleAngle);
    const needleY = centerY + dims.needle * Math.sin(needleAngle);
    
    let color: string;
    if (value <= 25) color = '#ef4444'; // Red
    else if (value <= 40) color = '#f97316'; // Orange
    else if (value <= 60) color = '#eab308'; // Yellow
    else if (value <= 75) color = '#22c55e'; // Light Green
    else color = '#16a34a'; // Dark Green
    
    return { needleX, needleY, color };
  }, [value, centerX, centerY, dims]);

  // bg arc path
  const bgPath = `M ${centerX - dims.radius} ${centerY} A ${dims.radius} ${dims.radius} 0 0 1 ${centerX + dims.radius} ${centerY}`;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width={dims.width} height={dims.height} viewBox={`0 0 ${dims.width} ${dims.height}`}>
          <defs>
            <linearGradient id={`gradient-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="25%" stopColor="#f97316" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="75%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
            <filter id="shadow">
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Track background */}
          <path
            d={bgPath}
            fill="none"
            stroke="var(--bg-tertiary)"
            strokeWidth={dims.stroke}
            strokeLinecap="round"
          />

          {/* Gradient Track */}
          <path
            d={bgPath}
            fill="none"
            stroke={`url(#gradient-${size})`}
            strokeWidth={dims.stroke}
            strokeLinecap="round"
            opacity={0.8}
          />

          {/* Needle */}
          <line
            x1={centerX}
            y1={centerY}
            x2={gaugeData.needleX}
            y2={gaugeData.needleY}
            stroke="var(--text-primary)"
            strokeWidth={size === 'sm' ? 2 : 3}
            strokeLinecap="round"
            filter="url(#shadow)"
          />
          <circle cx={centerX} cy={centerY} r={size === 'sm' ? 3 : 5} fill="var(--text-primary)" />
          <circle cx={centerX} cy={centerY} r={size === 'sm' ? 1.5 : 2} fill="var(--bg-primary)" />
        </svg>
      </div>

      <div className="flex flex-col items-center mt-2 w-full text-center">
        {showValue && (
          <span className="font-bold mb-1" style={{ fontSize: `${dims.font}px`, color: gaugeData.color }}>
            {value.toFixed(1)}
          </span>
        )}
        <div className="flex items-center justify-center gap-1">
          <span className="text-xs font-medium text-center leading-tight" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </span>
          {onDetailsClick && (
            <button 
              onClick={onDetailsClick}
              className="p-1 rounded-full hover:bg-[rgba(255,255,255,0.1)] transition-colors"
            >
              <Search size={10} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
