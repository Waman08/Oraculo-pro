"use client";

import { useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { FileImage, FileText } from 'lucide-react';
import { useLocale, useAppSettings } from './AppContext';
import { exportInstitutionalPDF } from '@/lib/pdfReportGenerator';

export default function ExportReport({ data }: { data: any | null }) {
  const { t } = useLocale();
  const { symbol } = useAppSettings();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'pdf' | 'png') => {
    setIsExporting(true);
    
    try {
      if (format === 'pdf' && data) {
        exportInstitutionalPDF(data, symbol);
      } else {
        const element = document.getElementById('dashboard-export-area');
        if (!element) throw new Error("Dashboard not found");

        const isLight = document.documentElement.getAttribute('data-theme') === 'light';

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          backgroundColor: isLight ? '#f8fafc' : '#0f172a',
        });

        if (format === 'png') {
          const link = document.createElement('a');
          link.download = `Oracle_Report_${symbol}_${new Date().toISOString().split('T')[0]}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        }
      }
    } catch (error) {
      console.error("Export failed", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex gap-2 justify-end mb-4 animate-fadeInUp">
      <button 
        onClick={() => handleExport('png')}
        disabled={isExporting}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded transition-colors disabled:opacity-50"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
      >
        <FileImage size={14} /> {t('export.png')}
      </button>
      <button 
        onClick={() => handleExport('pdf')}
        disabled={isExporting || !data}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded transition-colors disabled:opacity-50"
        style={{ background: 'var(--accent-gold)', color: '#000' }}
      >
        <FileText size={14} /> {isExporting ? t('general.loading') : t('export.pdf')}
      </button>
    </div>
  );
}
