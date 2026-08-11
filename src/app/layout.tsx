import { ReactNode } from 'react';
import type { Viewport } from 'next';
import './globals.css';
import ToastContainer from '@/components/ToastContainer';
import CommandPalette from '@/components/CommandPalette';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata = {
  title: 'Oráculo de Trading Pro | Análisis Cuantitativo con IA',
  description: 'Plataforma de análisis cuantitativo con motor de Machine Learning para criptomonedas. Señales de compra/venta, niveles DCA, métricas On-Chain y sentimiento del mercado.',
  keywords: 'trading, criptomonedas, bitcoin, análisis técnico, machine learning, DCA, RSI, MACD',
  authors: [{ name: 'Trading Oracle Pro' }],
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="es" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="antialiased min-h-screen relative"
        style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
      >
        <div className="fixed inset-0 pointer-events-none z-[-1]" style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(129, 140, 248, 0.15), transparent 50%), radial-gradient(circle at 100% 100%, rgba(16, 185, 129, 0.05), transparent 50%), radial-gradient(circle at 0% 100%, rgba(239, 68, 68, 0.05), transparent 50%)'
        }} />
        {children}
        <ToastContainer />
        <CommandPalette />
      </body>
    </html>
  );
}
