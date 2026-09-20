import jsPDF from 'jspdf';

// Helper types
export interface MarketAnalysisData {
  symbol: string;
  currentPrice: number;
  priceChange24h?: number;
  priceChangePeriod?: number;
  quantScore: number;
  signal: string;
  indicators: any;
  sentiment: any;
  actionableData: any;
  actuarial?: any;
  onChain?: any;
  supplyDynamics?: any;
}

export function exportInstitutionalPDF(data: MarketAnalysisData, symbol: string) {
  // A4 = 210 x 297 mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const PAGE_WIDTH = 210;
  const PAGE_HEIGHT = 297;
  
  // Colors
  const BG_COLOR = '#0B0E14';
  const TEXT_WHITE = '#FFFFFF';
  const TEXT_GRAY = '#9CA3AF';
  const ACCENT_GOLD = '#F59E0B';
  const COLOR_BUY = '#10B981';
  const COLOR_SELL = '#EF4444';
  const BORDER_COLOR = '#1F2937';
  const BOX_BG = '#111827';
  
  // Background filler
  const fillBackground = () => {
    doc.setFillColor(BG_COLOR);
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');
  };

  const drawText = (text: string, x: number, y: number, size: number, color = TEXT_WHITE, style = 'normal', align: "left" | "center" | "right" = 'left') => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(text, x, y, { align });
  };
  
  const drawLine = (x1: number, y1: number, x2: number, y2: number, color = BORDER_COLOR) => {
    doc.setDrawColor(color);
    doc.setLineWidth(0.5);
    doc.line(x1, y1, x2, y2);
  };
  
  const drawBox = (x: number, y: number, w: number, h: number, fillColor = BOX_BG, strokeColor = BORDER_COLOR) => {
    doc.setFillColor(fillColor);
    doc.setDrawColor(strokeColor);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, w, h, 2, 2, 'FD');
  };

  // ==========================================
  // PAGE 1: Quant Profile & Execution
  // ==========================================
  fillBackground();
  
  // HEADER
  let currentY = 20;
  drawText("ORÁCULO DE TRADING PRO — QUANTITATIVE RESEARCH TEAR SHEET", PAGE_WIDTH / 2, currentY, 14, ACCENT_GOLD, 'bold', 'center');
  currentY += 6;
  drawText("Análisis Cuantitativo, On-Chain y Gestión de Riesgo Actuarial", PAGE_WIDTH / 2, currentY, 10, TEXT_GRAY, 'normal', 'center');
  currentY += 12;
  
  // PAIR INFO STRIP
  drawBox(15, currentY, 180, 15, '#171E2D');
  const dObj = new Date();
  const dateStr = dObj.toUTCString();
  const change = data.priceChangePeriod ?? data.priceChange24h ?? 0;
  const changeColor = change >= 0 ? COLOR_BUY : COLOR_SELL;
  
  drawText(`${symbol}`, 20, currentY + 10, 12, TEXT_WHITE, 'bold');
  drawText(`$${data.currentPrice.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:6})}`, 50, currentY + 10, 12, TEXT_WHITE, 'bold');
  drawText(`${change >= 0 ? '+' : ''}${change.toFixed(2)}%`, 90, currentY + 10, 12, changeColor, 'bold');
  drawText(`${dateStr}`, 190, currentY + 10, 10, TEXT_GRAY, 'normal', 'right');
  
  currentY += 25;
  
  // QUANT SCORE BOX
  drawBox(15, currentY, 180, 30);
  drawText("QUANT SCORE (0-100)", 20, currentY + 8, 9, TEXT_GRAY, 'bold');
  drawText(data.quantScore.toFixed(1), 20, currentY + 23, 28, TEXT_WHITE, 'bold');
  
  drawText("SEÑAL PRINCIPAL", 90, currentY + 8, 9, TEXT_GRAY, 'bold');
  const signalColor = data.quantScore >= 55 ? COLOR_BUY : data.quantScore < 45 ? COLOR_SELL : ACCENT_GOLD;
  drawText(data.signal.toUpperCase(), 90, currentY + 20, 16, signalColor, 'bold');
  
  drawText("RÉGIMEN / MODO", 150, currentY + 8, 9, TEXT_GRAY, 'bold');
  drawText("INSTITUCIONAL", 150, currentY + 20, 12, TEXT_WHITE, 'bold');
  
  currentY += 40;
  
  // FACTOR BREAKDOWN
  drawText("DESGLOSE DE FACTORES CUANTITATIVOS", 15, currentY, 12, ACCENT_GOLD, 'bold');
  currentY += 6;
  drawBox(15, currentY, 180, 50);
  
  // Table headers
  drawText("MÉTRICA", 20, currentY + 8, 9, TEXT_GRAY, 'bold');
  drawText("VALOR", 90, currentY + 8, 9, TEXT_GRAY, 'bold');
  drawText("INTERPRETACIÓN", 140, currentY + 8, 9, TEXT_GRAY, 'bold');
  drawLine(15, currentY + 12, 195, currentY + 12);
  
  const rsi = data.indicators?.rsi ?? 50;
  const mfi = data.indicators?.mfi ?? 50;
  const adx = data.indicators?.adx ?? 0;
  const fg = data.sentiment?.fearGreedIndex ?? 50;
  
  // Row 1: RSI
  drawText("RSI (14) / MFI", 20, currentY + 19, 10, TEXT_WHITE);
  drawText(`${rsi.toFixed(1)} / ${mfi.toFixed(1)}`, 90, currentY + 19, 10, TEXT_WHITE);
  drawText(rsi > 70 ? "Sobrecomprado" : rsi < 30 ? "Sobrevendido" : "Neutral", 140, currentY + 19, 10, rsi > 70 ? COLOR_SELL : rsi < 30 ? COLOR_BUY : TEXT_WHITE);
  
  // Row 2: Trend
  drawText("Tendencia ADX", 20, currentY + 28, 10, TEXT_WHITE);
  drawText(`${adx.toFixed(1)}`, 90, currentY + 28, 10, TEXT_WHITE);
  drawText(adx > 25 ? "Tendencia Fuerte" : "Sin Tendencia", 140, currentY + 28, 10, adx > 25 ? ACCENT_GOLD : TEXT_GRAY);
  
  // Row 3: Sentiment
  drawText("Fear & Greed Index", 20, currentY + 37, 10, TEXT_WHITE);
  drawText(`${fg}`, 90, currentY + 37, 10, TEXT_WHITE);
  drawText(data.sentiment?.fearGreedLabel || "Neutral", 140, currentY + 37, 10, fg > 70 ? COLOR_SELL : fg < 30 ? COLOR_BUY : TEXT_WHITE);
  
  // Row 4: Funding Rate
  const funding = data.onChain?.derivatives?.fundingRate ?? 0;
  drawText("Funding Rate (8H)", 20, currentY + 46, 10, TEXT_WHITE);
  drawText(`${funding.toFixed(4)}%`, 90, currentY + 46, 10, TEXT_WHITE);
  drawText(funding > 0.01 ? "Longs Pagando" : funding < -0.01 ? "Shorts Pagando" : "Equilibrado", 140, currentY + 46, 10, funding < -0.01 ? COLOR_BUY : TEXT_WHITE);
  
  currentY += 60;
  
  // ACTIONABLE SETUP
  drawText("PLAN OPERATIVO DE EJECUCIÓN", 15, currentY, 12, ACCENT_GOLD, 'bold');
  currentY += 6;
  drawBox(15, currentY, 180, 25);
  
  const setup = data.actionableData?.tradingSetup || {};
  const entry = setup.entry || data.currentPrice;
  const tp = setup.takeProfit || (data.currentPrice * 1.05);
  const sl = setup.stopLoss || (data.currentPrice * 0.95);
  const isLong = setup.side === 'LONG';
  
  drawText("LADO", 20, currentY + 8, 9, TEXT_GRAY, 'bold');
  drawText(isLong ? "LONG" : "SHORT", 20, currentY + 18, 14, isLong ? COLOR_BUY : COLOR_SELL, 'bold');
  
  drawText("ENTRADA IDEAL", 60, currentY + 8, 9, TEXT_GRAY, 'bold');
  drawText(`$${entry.toLocaleString()}`, 60, currentY + 18, 12, TEXT_WHITE, 'bold');
  
  drawText("TAKE PROFIT", 110, currentY + 8, 9, TEXT_GRAY, 'bold');
  drawText(`$${tp.toLocaleString()}`, 110, currentY + 18, 12, COLOR_BUY, 'bold');
  
  drawText("STOP LOSS", 160, currentY + 8, 9, TEXT_GRAY, 'bold');
  drawText(`$${sl.toLocaleString()}`, 160, currentY + 18, 12, COLOR_SELL, 'bold');
  
  currentY += 35;
  
  // DCA LADDER & POSITION SIZING
  drawText("ESCALERA DCA Y GESTIÓN DE RIESGO", 15, currentY, 12, ACCENT_GOLD, 'bold');
  currentY += 6;
  
  // Left: DCA
  drawBox(15, currentY, 85, 45);
  drawText("ZONAS DE RECOMPRA (DCA)", 20, currentY + 8, 9, TEXT_GRAY, 'bold');
  const dca = data.actionableData?.dcaLevels || [];
  let dcaY = currentY + 18;
  if (dca.length > 0) {
      dca.forEach((level: any, i: number) => {
          if (i > 2) return;
          drawText(`Nivel ${i+1}: $${level.price.toFixed(2)}`, 20, dcaY, 10, TEXT_WHITE);
          drawText(`(Caída: ${level.dropPct.toFixed(1)}%)`, 70, dcaY, 9, TEXT_GRAY, 'normal', 'right');
          dcaY += 10;
      });
  } else {
      drawText("Niveles DCA no calculados.", 20, dcaY, 10, TEXT_GRAY);
  }
  
  // Right: Position Sizing
  drawBox(110, currentY, 85, 45);
  drawText("POSITION SIZING (KELLY + VaR)", 115, currentY + 8, 9, TEXT_GRAY, 'bold');
  
  const ps = data.actionableData?.positionSizing || {};
  const recPct = ps.portfolioPct || 0;
  
  drawText("EXPOSICIÓN RECOMENDADA", 115, currentY + 18, 9, TEXT_WHITE);
  drawText(`${recPct}%`, 185, currentY + 18, 12, ACCENT_GOLD, 'bold', 'right');
  
  drawText("APALANCAMIENTO MAX", 115, currentY + 28, 9, TEXT_WHITE);
  drawText(`${ps.maxLeverage || 1}x`, 185, currentY + 28, 10, TEXT_WHITE, 'bold', 'right');
  
  drawText("MAX RIESGO (10K)", 115, currentY + 38, 9, TEXT_WHITE);
  drawText(`$${ps.maxRiskUSD || 0}`, 185, currentY + 38, 10, COLOR_SELL, 'bold', 'right');
  
  // FOOTER PG 1
  drawText("Documento generado algorítmicamente por Oráculo Pro. Prohibida su redistribución sin atribución. No constituye asesoría financiera.", PAGE_WIDTH/2, 285, 8, TEXT_GRAY, 'normal', 'center');

  // ==========================================
  // PAGE 2: Actuarial & On-Chain
  // ==========================================
  doc.addPage();
  fillBackground();
  currentY = 20;
  
  drawText(`REPORTE ACTUARIAL Y TOKENOMICS — ${symbol}`, PAGE_WIDTH / 2, currentY, 14, ACCENT_GOLD, 'bold', 'center');
  currentY += 12;
  
  // ACTUARIAL PROFILE
  drawText("PERFIL DE RIESGO ACTUARIAL", 15, currentY, 12, ACCENT_GOLD, 'bold');
  currentY += 6;
  
  drawBox(15, currentY, 180, 50);
  const act = data.actuarial || {};
  
  drawText("VaR 95% (1 Día)", 20, currentY + 10, 9, TEXT_GRAY, 'bold');
  drawText(`${(act.var_95 ?? 0).toFixed(2)}%`, 20, currentY + 20, 14, COLOR_SELL, 'bold');
  
  drawText("CVaR 95% (Expected Shortfall)", 85, currentY + 10, 9, TEXT_GRAY, 'bold');
  drawText(`${(act.cvar_95 ?? 0).toFixed(2)}%`, 85, currentY + 20, 14, COLOR_SELL, 'bold');
  
  drawText("Volatilidad Anual", 155, currentY + 10, 9, TEXT_GRAY, 'bold');
  drawText(`${(act.volatility_annualized ?? 0).toFixed(1)}%`, 155, currentY + 20, 14, TEXT_WHITE, 'bold');
  
  drawLine(15, currentY + 26, 195, currentY + 26);
  
  drawText("CADENAS DE MARKOV (Régimen de Mercado Probable)", 20, currentY + 34, 9, TEXT_GRAY, 'bold');
  const regimes = act.regime_probabilities || {};
  drawText(`Alcista: ${(regimes.bullish ?? 33.3).toFixed(1)}%`, 20, currentY + 44, 10, COLOR_BUY);
  drawText(`Lateral: ${(regimes.sideways ?? 33.3).toFixed(1)}%`, 85, currentY + 44, 10, ACCENT_GOLD);
  drawText(`Bajista: ${(regimes.bearish ?? 33.3).toFixed(1)}%`, 155, currentY + 44, 10, COLOR_SELL);
  
  currentY += 60;
  
  // MONTE CARLO PROJECTIONS
  drawText("PROYECCIONES MONTE CARLO (7 DÍAS)", 15, currentY, 12, ACCENT_GOLD, 'bold');
  currentY += 6;
  drawBox(15, currentY, 180, 30);
  
  const mc = act.monte_carlo_7d || {};
  drawText("Escenario Pesimista (P10)", 20, currentY + 10, 9, TEXT_GRAY, 'bold');
  drawText(`$${(mc.p10 ?? (data.currentPrice * 0.9)).toLocaleString(undefined, {maximumFractionDigits:4})}`, 20, currentY + 22, 14, COLOR_SELL, 'bold');
  
  drawText("Escenario Medio (P50)", 85, currentY + 10, 9, TEXT_GRAY, 'bold');
  drawText(`$${(mc.p50 ?? data.currentPrice).toLocaleString(undefined, {maximumFractionDigits:4})}`, 85, currentY + 22, 14, TEXT_WHITE, 'bold');
  
  drawText("Escenario Optimista (P90)", 155, currentY + 10, 9, TEXT_GRAY, 'bold');
  drawText(`$${(mc.p90 ?? (data.currentPrice * 1.1)).toLocaleString(undefined, {maximumFractionDigits:4})}`, 155, currentY + 22, 14, COLOR_BUY, 'bold');
  
  currentY += 45;
  
  // ON-CHAIN & SUPPLY
  drawText("TOKENOMICS Y SALUD ON-CHAIN", 15, currentY, 12, ACCENT_GOLD, 'bold');
  currentY += 6;
  drawBox(15, currentY, 180, 50);
  
  const supply = data.supplyDynamics || {};
  drawText("Market Cap (USD)", 20, currentY + 10, 9, TEXT_GRAY, 'bold');
  drawText(`$${((supply.marketCap ?? 0) / 1e6).toFixed(2)}M`, 20, currentY + 20, 11, TEXT_WHITE, 'bold');
  
  drawText("Fully Diluted Val. (FDV)", 85, currentY + 10, 9, TEXT_GRAY, 'bold');
  drawText(`$${((supply.fdv ?? 0) / 1e6).toFixed(2)}M`, 85, currentY + 20, 11, TEXT_WHITE, 'bold');
  
  drawText("Ratio Circulante", 155, currentY + 10, 9, TEXT_GRAY, 'bold');
  drawText(`${(supply.circulatingRatio ?? 100).toFixed(1)}%`, 155, currentY + 20, 11, TEXT_WHITE, 'bold');
  
  drawLine(15, currentY + 26, 195, currentY + 26);
  
  const defi = data.onChain?.defillama || {};
  const tvl = defi.tvl?.tvl || 0;
  
  drawText("Riesgo de Dilución", 20, currentY + 34, 9, TEXT_GRAY, 'bold');
  drawText(supply.dilutionLabel ?? "N/A", 20, currentY + 44, 10, supply.dilutionRisk === 'high' ? COLOR_SELL : supply.dilutionRisk === 'low' ? COLOR_BUY : TEXT_WHITE);
  
  drawText("TVL (Ecosistema)", 85, currentY + 34, 9, TEXT_GRAY, 'bold');
  drawText(tvl > 0 ? `$${(tvl / 1e6).toFixed(2)}M` : "N/A", 85, currentY + 44, 10, TEXT_WHITE);
  
  drawText("Mcap / TVL", 155, currentY + 34, 9, TEXT_GRAY, 'bold');
  const mcapTvl = (supply.marketCap && tvl) ? (supply.marketCap / tvl).toFixed(2) : "N/A";
  drawText(mcapTvl, 155, currentY + 44, 10, TEXT_WHITE);
  
  // FOOTER PG 2
  drawText("Documento generado algorítmicamente por Oráculo Pro. Prohibida su redistribución sin atribución. No constituye asesoría financiera.", PAGE_WIDTH/2, 285, 8, TEXT_GRAY, 'normal', 'center');

  // TRIGGER DOWNLOAD
  doc.save(`Oracle_Report_${symbol}_${dateStr.replace(/[:, ]/g, '_')}.pdf`);
}
