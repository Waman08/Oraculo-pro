"use client";

import { useMemo, useState, useEffect } from 'react';
import type { Signal } from '@/types';
import { useLocale } from './AppContext';

interface ScoreGaugeProps {
  score: number; // 0-100
  signal: Signal;
  size?: number;
}

const SIGNAL_KEY_MAP: Record<Signal, string> = {
  'Compra Fuerte': 'signal.strongBuy',
  'Compra': 'signal.buy',
  'Mantener': 'signal.hold',
  'Venta': 'signal.sell',
  'Venta Fuerte': 'signal.strongSell',
};

export default function ScoreGauge({ score, signal, size = 280 }: ScoreGaugeProps) {
  const { t } = useLocale();
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDisplayScore(score), 50);
    return () => clearTimeout(timer);
  }, [score]);

  const gaugeData = useMemo(() => {
    const radius = 100;
    const strokeWidth = 18;
    const centerX = 140;
    const centerY = 125;

    // Arc from -180° to 0° (semicircle)
    const startAngle = -180;
    const endAngle = 0;
    const scoreAngle = startAngle + (displayScore / 100) * (endAngle - startAngle);

    // Background arc path
    const bgPath = describeArc(centerX, centerY, radius, startAngle, endAngle);

    // Score arc path
    const scorePath = describeArc(centerX, centerY, radius, startAngle, scoreAngle);

    // Needle position
    const needleAngle = (scoreAngle * Math.PI) / 180;
    const needleLength = radius - 25;
    const needleX = centerX + needleLength * Math.cos(needleAngle);
    const needleY = centerY + needleLength * Math.sin(needleAngle);

    // Color based on score
    let color: string;
    if (score <= 20) { color = '#10B981'; }
    else if (score <= 40) { color = '#34D399'; }
    else if (score <= 60) { color = '#94A3B8'; }
    else if (score <= 80) { color = '#FB923C'; }
    else { color = '#EF4444'; }

    return { bgPath, scorePath, needleX, needleY, centerX, centerY, color, strokeWidth, scoreAngle };
  }, [displayScore, score]);

  return (
    <div className="flex flex-col items-center animate-scaleIn">
      <svg
        width={size}
        height={size * 0.68}
        viewBox="0 0 280 190"
        className="drop-shadow-lg"
      >
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="25%" stopColor="#34D399" />
            <stop offset="50%" stopColor="#94A3B8" />
            <stop offset="75%" stopColor="#FB923C" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="needleShadow">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor={gaugeData.color} floodOpacity="0.5" />
          </filter>
        </defs>

        {/* Background arc */}
        <path
          d={gaugeData.bgPath}
          fill="none"
          stroke="var(--border-color)"
          strokeWidth={gaugeData.strokeWidth}
          strokeLinecap="round"
        />

        {/* Colored gradient arc (faint) */}
        <path
          d={gaugeData.bgPath}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth={gaugeData.strokeWidth}
          strokeLinecap="round"
          opacity={0.3}
        />

        {/* Active score arc */}
        <path
          d={gaugeData.scorePath}
          fill="none"
          stroke={gaugeData.color}
          strokeWidth={gaugeData.strokeWidth}
          strokeLinecap="round"
          filter="url(#glow)"
          style={{ transition: 'all 1s ease-out' }}
        />

        {/* Zone labels */}
        <text x="32" y="138" fill="var(--signal-buy)" fontSize="9" fontWeight="600" textAnchor="middle">0</text>
        <text x="78" y="48" fill="#34D399" fontSize="8" fontWeight="500" textAnchor="middle">20</text>
        <text x="140" y="26" fill="var(--text-muted)" fontSize="8" fontWeight="500" textAnchor="middle">50</text>
        <text x="202" y="48" fill="#FB923C" fontSize="8" fontWeight="500" textAnchor="middle">80</text>
        <text x="248" y="138" fill="var(--signal-sell)" fontSize="9" fontWeight="600" textAnchor="middle">100</text>

        {/* Needle */}
        <line
          x1={gaugeData.centerX}
          y1={gaugeData.centerY}
          x2={gaugeData.needleX}
          y2={gaugeData.needleY}
          stroke={gaugeData.color}
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="url(#needleShadow)"
          style={{
            transition: 'all 1s ease-out',
            transformOrigin: `${gaugeData.centerX}px ${gaugeData.centerY}px`,
          }}
        />

        {/* Center dot */}
        <circle cx={gaugeData.centerX} cy={gaugeData.centerY} r="5" fill={gaugeData.color} />
        <circle cx={gaugeData.centerX} cy={gaugeData.centerY} r="2.5" fill="var(--bg-primary)" />

        {/* Score number — positioned well below the gauge arc with enough room */}
        <text
          x={gaugeData.centerX}
          y={gaugeData.centerY + 40}
          fill={gaugeData.color}
          fontSize="32"
          fontWeight="900"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          {score.toFixed(1)}
        </text>
      </svg>

      {/* Signal badge */}
      <div
        className={`signal-badge mt-1 ${getSignalBadgeClass(signal)}`}
        style={{ fontSize: '0.85rem', padding: '8px 20px' }}
      >
        {getSignalEmoji(signal)} {t(SIGNAL_KEY_MAP[signal])}
      </div>
    </div>
  );
}

// ---- Helpers ----

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

function getSignalBadgeClass(signal: Signal): string {
  switch (signal) {
    case 'Compra Fuerte': return 'signal-badge--compra-fuerte';
    case 'Compra': return 'signal-badge--compra';
    case 'Mantener': return 'signal-badge--mantener';
    case 'Venta': return 'signal-badge--venta';
    case 'Venta Fuerte': return 'signal-badge--venta-fuerte';
  }
}

function getSignalEmoji(signal: Signal): string {
  switch (signal) {
    case 'Compra Fuerte': return '🟢';
    case 'Compra': return '🟡';
    case 'Mantener': return '⚪';
    case 'Venta': return '🟠';
    case 'Venta Fuerte': return '🔴';
  }
}
