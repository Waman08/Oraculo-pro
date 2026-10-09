import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Copy, Download, Share2, X, Send } from 'lucide-react';

interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any; // We'll pass displayData
}

export default function ShareCardModal({ isOpen, onClose, data }: ShareCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen || !data) return null;

  const isBuy = data.quantScore >= 50;
  const themeColor = isBuy ? '#22c55e' : '#ef4444';
  const signalText = isBuy ? (data.quantScore >= 75 ? 'COMPRA FUERTE' : 'COMPRA') : (data.quantScore <= 25 ? 'VENTA FUERTE' : 'VENTA');

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#0B0E14',
        logging: false,
        useCORS: true
      });
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `oraculo_${data.symbol}_${new Date().getTime()}.png`;
      link.href = url;
      link.click();
    } catch (err) {
      console.error('Failed to download image', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#0B0E14',
        logging: false,
        useCORS: true
      });
      canvas.toBlob(async (blob) => {
        if (blob) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          alert('¡Imagen copiada al portapapeles!');
        }
      });
    } catch (err) {
      console.error('Failed to copy image', err);
      alert('Error al copiar imagen');
    } finally {
      setIsExporting(false);
    }
  };

  const handleTelegramShare = () => {
    const text = `📊 Oráculo Pro: ${data.symbol}\nPrecio: $${data.currentPrice}\nSeñal: ${signalText} (Score: ${data.quantScore})\n\nOráculo Quant AI 🧠`;
    const url = `https://t.me/share/url?url=${encodeURIComponent('https://oraculo-pro.vercel.app')}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0F172A] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-white/10">
          <h2 className="text-lg font-bold flex items-center gap-2"><Share2 size={18} className="text-[var(--accent-gold)]"/> Generador de Share Card</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
        </div>

        {/* Content Area */}
        <div className="p-6 flex-1 flex flex-col items-center justify-center overflow-x-auto bg-[url('/grid-pattern.svg')] bg-center">
          
          {/* The Share Card (1200x630 aspect ratio simulation) */}
          <div 
            ref={cardRef}
            className="relative overflow-hidden w-full max-w-[800px] aspect-[1200/630] rounded-xl flex flex-col p-8 md:p-12"
            style={{ 
              background: 'linear-gradient(135deg, #0B0E14 0%, #1A2235 100%)',
              boxShadow: `0 0 50px ${themeColor}20 inset`,
              border: `1px solid ${themeColor}40`
            }}
          >
            {/* Background glowing orb */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 aspect-square rounded-full blur-[120px] opacity-20 pointer-events-none" style={{ background: themeColor }}></div>

            {/* Header */}
            <div className="flex justify-between items-start z-10">
              <div>
                <div className="text-[var(--accent-gold)] font-black tracking-widest text-sm md:text-base mb-1">ORÁCULO PRO</div>
                <div className="text-gray-400 font-medium text-xs md:text-sm tracking-widest">ANÁLISIS CUANTITATIVO</div>
              </div>
              <div className="text-right">
                <div className="text-white font-black text-2xl md:text-4xl">{data.symbol}</div>
                <div className="text-gray-300 font-mono text-lg md:text-xl">${data.currentPrice?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}</div>
              </div>
            </div>

            {/* Center Main Metric */}
            <div className="flex-1 flex items-center justify-center z-10 py-6">
              <div className="relative flex flex-col items-center justify-center">
                {/* SVG Ring */}
                <svg className="absolute w-[200px] h-[200px] md:w-[280px] md:h-[280px] -rotate-90">
                  <circle cx="50%" cy="50%" r="45%" stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="none" />
                  <circle cx="50%" cy="50%" r="45%" stroke={themeColor} strokeWidth="8" fill="none" strokeDasharray="1000" strokeDashoffset={`${1000 - (data.quantScore / 100) * 1000}`} style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
                </svg>
                
                <div className="text-6xl md:text-8xl font-black mb-2" style={{ color: themeColor, textShadow: `0 0 30px ${themeColor}80` }}>
                  {(typeof data.quantScore === 'number' && !isNaN(data.quantScore)) ? data.quantScore.toFixed(1) : '0.0'}
                </div>
                <div className="px-4 py-1.5 rounded-full font-black text-sm md:text-lg uppercase tracking-widest text-white border" style={{ background: `${themeColor}40`, borderColor: themeColor }}>
                  {signalText}
                </div>
              </div>
            </div>

            {/* Footer Metrics */}
            <div className="grid grid-cols-2 gap-4 z-10 w-full mt-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-4">
              <div>
                <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Confluencias 🔥</div>
                <div className="text-white text-sm font-medium space-y-1">
                  <div>RSI (14): <span className="font-mono text-[var(--accent-gold)]">{(data.indicators?.rsi || 0).toFixed(1)}</span></div>
                  <div>Volumen: <span className="font-mono text-[var(--accent-gold)]">{data.actionableData?.volatilityLevel || 'Normal'}</span></div>
                  <div>Tendencia: <span className="font-mono" style={{ color: themeColor }}>{data.indicators?.supertrend?.trend || 'Neutral'}</span></div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Setup Operativo 🎯</div>
                <div className="text-white text-sm font-medium space-y-1 flex flex-col items-end">
                  <div className="flex gap-4">
                    <span className="text-gray-400">Entry:</span>
                    <span className="font-mono">${(data.actionableData?.optimalEntry || data.currentPrice || 0).toLocaleString(undefined, {maximumFractionDigits: 6})}</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-green-400">Target:</span>
                    <span className="font-mono">${(data.actionableData?.takeProfit || 0).toLocaleString(undefined, {maximumFractionDigits: 6})}</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-red-400">Stop:</span>
                    <span className="font-mono">${(data.actionableData?.stopLoss || 0).toLocaleString(undefined, {maximumFractionDigits: 6})}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Watermark */}
            <div className="absolute bottom-4 left-12 md:left-14 text-gray-500 text-[10px] font-medium tracking-widest uppercase opacity-60 z-10">
              oraculo-pro.vercel.app • Análisis no financiero
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-black/40 border-t border-white/10 flex flex-wrap gap-4 justify-center">
          <button 
            onClick={handleCopy}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all disabled:opacity-50"
          >
            <Copy size={18} />
            📋 Copiar Imagen
          </button>
          
          <button 
            onClick={handleDownload}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all disabled:opacity-50"
          >
            <Download size={18} />
            ⬇️ Descargar PNG
          </button>
          
          <button 
            onClick={handleTelegramShare}
            className="flex items-center gap-2 px-6 py-3 bg-[#2AABEE] hover:bg-[#229ED9] text-white rounded-xl font-bold transition-all"
          >
            <Send size={18} />
            📱 Compartir Telegram
          </button>
        </div>
      </div>
    </div>
  );
}