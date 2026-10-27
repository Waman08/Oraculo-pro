// ============================================================
// i18n — Sistema de Internacionalización ES/EN Completo
// ============================================================

export type Locale = 'es' | 'en';

export function translateSignal(signal: string, locale: Locale): string {
  if (!signal) return '';
  const clean = signal.trim();

  if (locale === 'en') {
    if (clean === 'Compra Fuerte' || clean === 'COMPRA FUERTE') return 'Strong Buy';
    if (clean === 'Compra' || clean === 'COMPRA') return 'Buy';
    if (clean === 'Mantener' || clean === 'MANTENER' || clean === 'Neutral' || clean === 'NEUTRAL') return 'Hold';
    if (clean === 'Venta' || clean === 'VENTA') return 'Sell';
    if (clean === 'Venta Fuerte' || clean === 'VENTA FUERTE') return 'Strong Sell';
    return clean;
  }

  // locale === 'es'
  if (clean === 'Strong Buy' || clean === 'STRONG BUY') return 'Compra Fuerte';
  if (clean === 'Buy' || clean === 'BUY') return 'Compra';
  if (clean === 'Hold' || clean === 'HOLD') return 'Mantener';
  if (clean === 'Sell' || clean === 'SELL') return 'Venta';
  if (clean === 'Strong Sell' || clean === 'STRONG SELL') return 'Venta Fuerte';
  return clean;
}

export const translations: Record<Locale, Record<string, string>> = {
  es: {
    // Header
    'app.title': 'Oráculo de Trading Pro',
    'app.subtitle': 'Motor de análisis cuantitativo con inteligencia artificial',

    // Navigation
    'nav.analysis': 'Análisis',
    'nav.screener': 'Screener Top 100',

    // Controls
    'controls.search': 'Buscar Cripto...',
    'controls.mode': 'Modo',
    'controls.theme': 'Tema',
    'controls.language': 'Idioma',
    'controls.timeframe': 'Temporalidad',

    // Risk Modes
    'mode.safe': 'Seguro',
    'mode.balanced': 'Balanceado',
    'mode.aggressive': 'Agresivo',

    // Timeframes
    'tf.1S': '1 Semanal',
    'tf.1D': '1 Diario',
    'tf.4H': '4 Horas',
    'tf.1H': '1 Hora',
    'tf.15M': '15 Min',
    'timeframe': 'Temporalidad',

    // Radar MTF & Alignment
    'mtfRadar': 'Radar MTF',
    'bullishAlignment': 'Alineación Fractal Alcista',
    'bearishAlignment': 'Alineación Fractal Bajista',
    'mixedAlignment': 'Tendencia Mixta',
    'syncingEngine': 'Sincronizando motor cuantitativo...',
    'syncMobile': 'Sincronizar Móvil',
    'syncMobileTooltip': 'Sincronizar cuenta anónima con teléfono móvil o PC',
    'mtfPillTooltip': 'Cambiar gráfico y análisis a',
    'shareSignal': 'Compartir Señal',
    'shareSignalTooltip': 'Compartir tarjeta gráfica en redes',

    // Signals
    'signal.strongBuy': 'Compra Fuerte',
    'signal.buy': 'Compra',
    'signal.hold': 'Mantener',
    'signal.sell': 'Venta',
    'signal.strongSell': 'Venta Fuerte',

    // Direct Signal Keys
    'Compra Fuerte': 'Compra Fuerte',
    'Compra': 'Compra',
    'Mantener': 'Mantener',
    'Neutral': 'Neutral',
    'Venta': 'Venta',
    'Venta Fuerte': 'Venta Fuerte',
    'Strong Buy': 'Compra Fuerte',
    'Buy': 'Compra',
    'Hold': 'Mantener',
    'Sell': 'Venta',
    'Strong Sell': 'Venta Fuerte',

    // Pestañas Principales (Tabs)
    'tabTerminal': 'Terminal',
    'tabOnChain': 'On-Chain & Oferta',
    'tabActuarial': 'Riesgo Actuarial',
    'tabPortfolio': 'Portafolio & Alertas',
    'tab.risk': 'Riesgo',
    'tab.portfolioShort': 'Portafolio',
    'tab.sync': 'Sincronizar',

    // Score
    'score.title': 'Score del Oráculo',
    'score.breakdown': 'Desglose del Score',

    // Indicators
    'indicators.title': 'Indicadores Técnicos',
    'indicators.momentum': 'Momentum',
    'indicators.trend': 'Tendencia',
    'indicators.volatility': 'Volatilidad',

    // Sentiment
    'sentiment.title': 'Sentimiento del Mercado',
    'sentiment.fearGreed': 'Índice Miedo y Codicia',
    'sentiment.altcoinSeason': 'Temporada Altcoin',
    'sentiment.extremeFear': 'Miedo Extremo',
    'sentiment.fear': 'Miedo',
    'sentiment.neutral': 'Neutral',
    'sentiment.greed': 'Codicia',
    'sentiment.extremeGreed': 'Codicia Extrema',
    'sentiment.btcSeason': 'Temporada Bitcoin',
    'sentiment.altSeason': 'Temporada Altcoin',

    // On-Chain
    'onchain.title': 'Métricas On-Chain',
    'onchain.intelligence': 'Inteligencia On-Chain',
    'onchain.mvrv': 'MVRV Z-Score',
    'onchain.puell': 'Puell Multiple',
    'onchain.exchangeFlow': 'Flujo de Exchanges',
    'onchain.minerPrice': 'Costo de Minería BTC',
    'onchain.accumulation': 'Acumulación',
    'onchain.distribution': 'Distribución',
    'onchain.catFundamentals': 'Fundamentos de Red',
    'onchain.catSupply': 'Dinámica de Oferta',
    'onchain.catProtocol': 'DeFi & Protocolos L2',
    'onchain.catSignals': 'Índice de Señales',
    'onchain.catStablecoins': 'Stablecoins & Liquidez',
    'onchain.l2Title': 'Ecosistema Layer 2 & Liquidez Institucional',
    'onchain.l2Badge': 'Bitcoin Modular & DeFi',
    'onchain.l2Desc': 'Métricas de liquidez fuera de la capa base (L2), protocolos de restaking y colateralización en finanzas descentralizadas.',
    'onchain.l2Tvl': 'TVL en Bitcoin L2 & Staking',
    'onchain.wbtcSupply': 'Suministro wBTC en DeFi',
    'onchain.marketDominance': 'Dominancia de Liquidez Global',
    'onchain.lightningTitle': 'Lightning Network',
    'onchain.lightningDesc': 'Canales de micropagos instantáneos y alta frecuencia',
    'onchain.babylonTitle': 'Babylon Protocol',
    'onchain.babylonDesc': 'Staking nativo de BTC para seguridad compartida PoS',
    'onchain.stacksTitle': 'Stacks (sBTC)',
    'onchain.stacksDesc': 'Contratos inteligentes y DeFi programable sobre BTC',
    'onchain.wbtcCollateral': 'Principal colateral de reserva en Aave, Sky (MakerDAO), Compound y Uniswap v3.',
    'onchain.dominanceDesc': 'Activo de reserva con dominancia superior al 58% frente al mercado global y stablecoins.',
    'onchain.activeAddresses': 'Direcciones Activas (24h)',
    'onchain.txCount24h': 'Transacciones (24h)',
    'onchain.hashrate': 'Hashrate Estimado',
    'onchain.avgFee': 'Comisión Media USD',

    // DCA
    'dca.title': 'Niveles DCA',
    'dca.buyLevels': 'Zonas DCA de Compra',
    'dca.sellLevels': 'Take Profits Escalonados',
    'dca.currentPrice': 'Precio Actual',
    'dca.optimalEntry': 'Entrada Óptima',
    'dca.takeProfit': 'Take Profit',
    'dca.stopLoss': 'Stop Loss',
    'dca.neutral': 'Mercado en zona neutral — sin niveles DCA activos',

    // Actionable & Risk
    'action.title': 'Panel de Acción',
    'action.risk': 'Riesgo estimado',
    'action.macroRisk': 'Riesgo Macro',

    // Actuarial & Position Sizing
    'actuarial.positionSizing': 'Position Sizing (Grado Institucional)',
    'actuarial.recommendedSize': 'Tamaño Recomendado',
    'actuarial.portfolioPct': '% del Portafolio',
    'actuarial.maxRisk': 'Pérdida Máxima Tolerable (VaR 95%)',
    'actuarial.sizingDesc': 'Basado en el Criterio de Fractional Kelly (crecimiento compuesto) y limitado por el Value at Risk (VaR 95%) del modelo estocástico.',
    'actuarial.title': 'Análisis Actuarial de Riesgo',
    'actuarial.liveBinance': 'Cálculo Empírico en Vivo (180D Binance)',
    'actuarial.estimatedMode': 'Modo Estimado',
    'actuarial.varTitle': 'Value at Risk (VaR 95%)',
    'actuarial.daily': 'Diario',
    'actuarial.cvarTitle': 'Expected Shortfall (CVaR)',
    'actuarial.annualVol': 'Volatilidad Anualizada',
    'actuarial.monteCarloTitle': 'Monte Carlo 7D (Cono Estocástico)',
    'actuarial.currentPrice': 'Actual',
    'actuarial.p10Bear': 'p10 (Bear)',
    'actuarial.p50Base': 'p50 (Base)',
    'actuarial.p90Bull': 'p90 (Bull)',
    'actuarial.markovTitle': 'Régimen de Markov (Probabilidades)',
    'actuarial.dominant': 'Dominante',
    'actuarial.bullish': 'Alcista',
    'actuarial.bearish': 'Bajista',
    'actuarial.sideways': 'Lateral',
    'actuarial.sizingTitle': 'Dimensionamiento Actuarial de Posición (Kelly & VaR)',
    'actuarial.capitalLabel': 'Capital de Cartera ($ USD)',
    'actuarial.riskLabel': 'Riesgo Máximo por Trade (%)',
    'actuarial.suggestedSize': 'Tamaño de Posición Sugerido ($ USD)',
    'actuarial.allocationPct': '% de la Cartera a Asignar',
    'actuarial.estimatedLoss': 'Pérdida Máxima Estimada (VaR $)',
    'actuarial.halfKelly': 'Fracción Half-Kelly',
    'actuarial.winRateEst': 'Win Rate Estimado',
    'actuarial.sizingExpl': 'El tamaño sugerido combina el Criterio de Half-Kelly (maximización geométrica de capital según el Quant Score) con el límite estricto de VaR 95% para preservar tu cartera contra caídas extremas.',

    // Screener
    'screener.title': 'Screener Top 100',
    'screener.subtitle': 'Escaneo automático de las principales criptomonedas',
    'screener.rank': '#',
    'screener.crypto': 'Cripto',
    'screener.price': 'Precio',
    'screener.change': 'Cambio 24h',
    'screener.24h': 'Var. 24h',
    'screener.symbol': 'Símbolo',
    'liquidity.title': 'Liquidez & Derivados',
    'screener.rsi': 'RSI',
    'screener.score': 'Score',
    'screener.signal': 'Señal',
    'screener.volume': 'Volumen 24h',
    'screener.all': 'Todas',

    // Macro
    'macro.title': 'Datos Macro',
    'macro.dxy': 'Índice del Dólar (DXY)',
    'macro.m2': 'Liquidez Global M2',
    'macro.bullish': 'Alcista',
    'macro.bearish': 'Bajista',
    'macro.sideways': 'Lateral',
    'macro.expansion': 'Expansión',
    'macro.contraction': 'Contracción',

    // Smart Money
    'smartmoney.title': 'Smart Money',
    'smartmoney.poc': 'Point of Control (POC)',
    'smartmoney.orderBlocks': 'Order Blocks',
    'smartmoney.fvg': 'Fair Value Gaps',
    'smartmoney.bullish': 'Alcista',
    'smartmoney.bearish': 'Bajista',
    'smartmoney.demand': 'Demanda',
    'smartmoney.supply': 'Oferta',
    'smartmoney.strength': 'Fuerza',
    'smartmoney.status': 'ESTADO',
    'smartmoney.mitigated': 'MITIGADO',
    'smartmoney.open': 'ABIERTO',
    'smartmoney.keySupport': 'Soporte Clave',
    'smartmoney.keyResistance': 'Resistencia Clave',

    // General
    'general.loading': 'Cargando análisis...',
    'general.from': 'desde actual',
    'general.weight': 'peso',
    'general.livePrice': '🟢 Precio en vivo',
    'general.mockPrice': '⚠️ Precio simulado',
    'general.noFilter': 'No se encontraron criptos con este filtro',

    // Macro Risk Messages
    'macrorisk.floor': 'Zona de suelo histórico — máxima oportunidad de acumulación.',
    'macrorisk.weak': 'Mercado debilitado — posible suelo formándose, vigilar volumen.',
    'macrorisk.sideways': 'Mercado indeciso — consolidación lateral, sin dirección clara.',
    'macrorisk.hot': 'Mercado caliente — considerar tomar ganancias parciales.',
    'macrorisk.euphoria': 'Euforia extrema — altísimo riesgo de corrección inminente.',

    // On-Chain Zone Labels
    'onchain.undervalued': 'Infravalorado',
    'onchain.overvalued': 'Sobrevalorado',
    'onchain.capitulation': 'Capitulación',
    'onchain.euphoria': 'Euforia',

    // Footer
    'footer.title': 'Oráculo de Trading Pro — Motor de Análisis Cuantitativo v1.0',
    'footer.disclaimer': 'No constituye asesoría financiera.',

    // Portfolio Tracker
    'portfolio.title': 'Portfolio',
    'portfolio.add': 'Agregar',
    'portfolio.asset': 'Activo',
    'portfolio.amount': 'Cantidad',
    'portfolio.entryPrice': 'Precio de Entrada (USD)',
    'portfolio.cancel': 'Cancelar',
    'portfolio.save': 'Guardar',
    'portfolio.totalBalance': 'Balance Total',
    'portfolio.unrealizedPnl': 'P&L No Realizado',
    'portfolio.empty': 'Sin activos en el portfolio. Hacé clic en Agregar.',
    'portfolio.avg': 'Prom',

    // Watchlist
    'watchlist.title': 'Watchlist',
    'watchlist.empty': 'Sin activos en la watchlist',
    'watchlist.search': 'Buscar...',

    // Backtest
    'backtest.title': 'Backtest',
    'backtest.winRate': 'Win Rate',
    'backtest.profitFactor': 'Factor de Ganancia',
    'backtest.netProfit': 'Ganancia Neta',
    'backtest.maxDrawdown': 'Caída Máxima',
    'backtest.trades': 'operaciones',
    'backtest.grossWinLoss': 'Gan. Bruta/Pérd.',
    'backtest.peakToTrough': 'Pico a valle',
    'backtest.beatsHold': '🌟 Supera Buy & Hold',
    'backtest.underperforms': 'Bajo rendimiento vs B&H',
    'backtest.timeRange': 'Rango Temporal',
    'backtest.riskMode': 'Régimen de Riesgo',
    'backtest.run': 'Ejecutar Backtest',
    'backtest.empty': 'Configura los parámetros y haz clic en Ejecutar',
    'backtest.strategy': 'Estrategia Cuantitativa',
    'backtest.netReturn': 'Retorno Neto',
    'backtest.cagr': 'CAGR',
    'backtest.totalFees': 'Comisiones Pagadas',
    'backtest.history': 'Historial de Operaciones',
    'backtest.days30': '30 días',
    'backtest.days90': '90 días',
    'backtest.days180': '180 días',
    'backtest.days365': '1 año',
    'backtest.entryDate': 'Fecha Entrada',
    'backtest.entryPrice': 'Precio Entrada',
    'backtest.exitDate': 'Fecha Salida',
    'backtest.exitPrice': 'Precio Salida',
    'backtest.netPnl': 'PnL Neto',
    'backtest.feeRate': 'Comisión (%)',

    // MiniChart & Overlays
    'chart.title': 'Gráfico',
    'chart.noData': 'Sin datos de gráfico disponibles',
    'chart.noDataSub': 'No se pudieron cargar velas de este activo',
    'chart.emas': 'EMAs (20/50/200)',
    'chart.dcaLevels': 'Niveles DCA',
    'chart.bollingerBands': 'Bandas Bollinger',

    // Export Buttons
    'export.png': 'Exportar PNG',
    'export.pdf': 'Exportar PDF',
    'exportPng': 'Exportar PNG',
    'exportPdf': 'Exportar PDF',

    // Data Source
    'source.binance': 'BINANCE',
    'source.coingecko': 'COINGECKO',
    'source.mock': 'SIMULADO',

    // Toasts
    'toast.localMode': 'Modo Local Activo',
    'toast.localModeDesc': 'Servidor Python no disponible. Usando datos guardados / motor algorítmico.',
    'toast.aiUpdated': 'Análisis IA Actualizado',
    'toast.aiUpdatedDesc': 'Nuevos datos cuantitativos disponibles para',
    'toast.deviceSynced': '¡Dispositivo Sincronizado!',
    'toast.deviceSyncedDesc': 'Tu cuenta y portafolio se han vinculado con éxito',

    // ==========================================
    // Tooltips Educativos (Bilingüe)
    // ==========================================
    'tooltip.howToUse': 'CÓMO INTERPRETARLO',

    'tooltip.quantScore.title': 'Quant Score Maestro (0 a 100)',
    'tooltip.quantScore.desc': 'Puntaje algorítmico que combina fuerza de tendencia, volumen, sentimiento y derivados en una sola nota.',
    'tooltip.quantScore.how': '0 a 45: Zona de Venta / Cautela. 45 a 55: Mercado Neutral. 55 a 100: Zona de Compra / Oportunidad.',

    'tooltip.mtfBullish.title': 'Alineación Fractal Alcista',
    'tooltip.mtfBullish.desc': 'Al menos 3 de las 4 temporalidades (15m, 1h, 4h, 1d) están en confluencia compradora (EMA 20 > EMA 50 y RSI positivo). La confluencia fractal aumenta drásticamente la probabilidad de continuación de la tendencia.',
    'tooltip.mtfBullish.how': 'Busca entradas a favor del flujo institucional mayor en retrocesos hacia soportes o EMAs en temporalidades de 15m o 1h.',

    'tooltip.mtfBearish.title': 'Alineación Fractal Bajista',
    'tooltip.mtfBearish.desc': 'Al menos 3 de las 4 temporalidades (15m, 1h, 4h, 1d) están en confluencia vendedora bajo sus medias móviles. La presión de oferta domina en múltiples horizontes temporales.',
    'tooltip.mtfBearish.how': 'Evita compras contra tendencia y considera operaciones en corto o toma de beneficios preventivos.',

    'tooltip.rsi.title': 'RSI (14)',
    'tooltip.rsi.desc': 'Mide la velocidad y cambio de los movimientos de precio para detectar sobrecompra y sobreventa.',
    'tooltip.rsi.how': 'Menor a 30 = Sobreventa (posible rebote alcista). Mayor a 70 = Sobrecompra (posible corrección).',

    'tooltip.macd.title': 'MACD',
    'tooltip.macd.desc': 'Indica cambios en el impulso del mercado cuando la línea rápida cruza la señal.',
    'tooltip.macd.how': 'Cruce alcista por encima de cero confirma impulso comprador; cruce bajista advierte debilidad.',

    'tooltip.supertrend.title': 'Tendencia (Supertrend / EMAs)',
    'tooltip.supertrend.desc': 'Indica la dirección dominante de la tendencia y niveles dinámicos de stop.',
    'tooltip.supertrend.how': 'Verde = Tendencia Alcista (mantener largos). Rojo = Tendencia Bajista (precaución o cortos).',

    'tooltip.orderBlocks.title': 'Order Blocks (Bloques Institucionales)',
    'tooltip.orderBlocks.desc': 'Zonas de alta liquidez donde las instituciones financieras ejecutaron grandes órdenes antes de un movimiento fuerte.',
    'tooltip.orderBlocks.how': 'Actúan como zonas magnéticas de soporte/resistencia institucional de alta probabilidad.',

    'tooltip.fvg.title': 'Fair Value Gaps (FVG - Desbalances)',
    'tooltip.fvg.desc': 'Desbalances de liquidez generados por movimientos impulsivos rápidos que el mercado tiende a rellenar.',
    'tooltip.fvg.how': 'Espera a que el precio entre al 50% del FVG para buscar confirmaciones de giro.',

    'tooltip.dca.title': 'Escalera DCA Cuantitativa',
    'tooltip.dca.desc': 'Distribución matemática de órdenes de compra/venta para reducir el riesgo de timing.',
    'tooltip.dca.how': 'Ejecuta compras fraccionadas en niveles inferiores para mejorar el precio promedio sin intentar adivinar el suelo.',

    'tooltip.var95.title': 'Value at Risk (VaR 95%)',
    'tooltip.var95.desc': 'Pérdida máxima esperada en un horizonte temporal con un 95% de confianza estadística.',
    'tooltip.var95.how': 'Si el VaR diario es $250, hay 95% de probabilidad de que tu pérdida no exceda ese monto en un día normal.',

    'tooltip.monteCarlo.title': 'Simulación Monte Carlo (7D)',
    'tooltip.monteCarlo.desc': 'Proyección matemática de 1.000 escenarios futuros posibles usando volatilidad histórica y deriva estocástica.',
    'tooltip.monteCarlo.how': 'El rango central muestra el intervalo de precios más probable (P10 - P90) para los próximos 7 días.',

    'tooltip.kelly.title': 'Position Sizing (Criterio de Kelly)',
    'tooltip.kelly.desc': 'Fórmula actuarial que calcula el tamaño óptimo de capital por operación para maximizar el crecimiento geométrico sin riesgo de ruina.',
    'tooltip.kelly.how': 'Aplica una fracción conservadora (Half Kelly) ajustada a la volatilidad y la probabilidad de acierto del modelo.',

    // ==========================================
    // Modal: ShareCardModal
    // ==========================================
    'shareCard.title': 'Generador de Share Card',
    'shareCard.subtitle': 'ANÁLISIS CUANTITATIVO',
    'shareCard.confluences': 'Confluencias 🔥',
    'shareCard.tradeSetup': 'Setup Operativo 🎯',
    'shareCard.volume': 'Volumen',
    'shareCard.trend': 'Tendencia',
    'shareCard.entry': 'Entry',
    'shareCard.target': 'Target',
    'shareCard.stop': 'Stop',
    'shareCard.disclaimer': 'oraculo-pro.vercel.app • Análisis no financiero',
    'shareCard.copyImage': 'Copiar Imagen',
    'shareCard.copied': '¡Imagen copiada al portapapeles!',
    'shareCard.copyError': 'Error al copiar imagen',
    'shareCard.downloadPng': 'Descargar PNG',
    'shareCard.shareTelegram': 'Compartir Telegram',
    'shareCard.telegramText': 'Oráculo Pro',

    // ==========================================
    // Modal: SyncDeviceModal
    // ==========================================
    'syncModal.title': 'Sincronizar Dispositivos',
    'syncModal.subtitle': 'Conecta tu PC y Móvil PWA sin necesidad de usuario ni contraseña',
    'syncModal.banner': 'Tu sesión anónima almacena de forma segura tu Portafolio, Watchlist, Alertas y cuenta demo de Paper Trading. Al sincronizar, ambos dispositivos compartirán los mismos datos en tiempo real.',
    'syncModal.thisDevice': 'Este Dispositivo (Código Actual)',
    'syncModal.active': 'Activo',
    'syncModal.loading': 'Cargando...',
    'syncModal.copyCode': 'Copiar Código',
    'syncModal.codeCopied': '¡Código Copiado!',
    'syncModal.copyLink': 'Copiar Enlace Directo',
    'syncModal.linkCopied': '¡Enlace Copiado!',
    'syncModal.instantScan': 'Escaneo instantáneo desde Móvil',
    'syncModal.scanDesc': 'Apunta con la cámara de tu smartphone a este código QR para abrir Oráculo Pro directamente en tu móvil y sincronizar tu cuenta sin escribir nada.',
    'syncModal.linkOther': 'Vincular con otro Dispositivo',
    'syncModal.linkOtherDesc': 'Si ya tienes una cuenta en tu teléfono u otra PC, pega aquí su código o el enlace recibido:',
    'syncModal.placeholder': 'Ej: sess_a1b2c3d4... o pega el enlace completo',
    'syncModal.linking': 'Vinculando...',
    'syncModal.linkBtn': 'Vincular Dispositivo',
    'syncModal.linkingStatus': 'Vinculando sesión y sincronizando datos...',
    'syncModal.errEmpty': 'Por favor ingresa un código de sesión o el enlace recibido.',
    'syncModal.errSame': 'Este código ya pertenece a la sesión activa en este dispositivo.',
    'syncModal.errInvalid': 'Formato de código inválido. Debe comenzar con sess_ o ser un enlace de sincronización.',
    'syncModal.errFailed': 'Error al vincular el dispositivo. Verifica el código e intenta de nuevo.',
    'syncModal.close': 'Cerrar modal',
  },
  en: {
    // Header
    'app.title': 'Trading Oracle Pro',
    'app.subtitle': 'Quantitative analysis engine powered by artificial intelligence',

    // Navigation
    'nav.analysis': 'Analysis',
    'nav.screener': 'Screener Top 100',

    // Controls
    'controls.search': 'Search Crypto...',
    'controls.mode': 'Mode',
    'controls.theme': 'Theme',
    'controls.language': 'Language',
    'controls.timeframe': 'Timeframe',

    // Risk Modes
    'mode.safe': 'Safe',
    'mode.balanced': 'Balanced',
    'mode.aggressive': 'Aggressive',

    // Timeframes
    'tf.1S': '1 Weekly',
    'tf.1D': '1 Daily',
    'tf.4H': '4 Hours',
    'tf.1H': '1 Hour',
    'tf.15M': '15 Min',
    'timeframe': 'Timeframe',

    // Radar MTF & Alignment
    'mtfRadar': 'MTF Radar',
    'bullishAlignment': 'Bullish Fractal Alignment',
    'bearishAlignment': 'Bearish Fractal Alignment',
    'mixedAlignment': 'Mixed Trend',
    'syncingEngine': 'Syncing quantitative engine...',
    'syncMobile': 'Sync Mobile',
    'syncMobileTooltip': 'Sync anonymous session with mobile phone or PC',
    'mtfPillTooltip': 'Switch chart and analysis to',
    'shareSignal': 'Share Signal',
    'shareSignalTooltip': 'Share signal card on social media',

    // Signals
    'signal.strongBuy': 'Strong Buy',
    'signal.buy': 'Buy',
    'signal.hold': 'Hold',
    'signal.sell': 'Sell',
    'signal.strongSell': 'Strong Sell',

    // Direct Signal Keys
    'Compra Fuerte': 'Strong Buy',
    'Compra': 'Buy',
    'Mantener': 'Hold',
    'Neutral': 'Neutral',
    'Venta': 'Sell',
    'Venta Fuerte': 'Strong Sell',
    'Strong Buy': 'Strong Buy',
    'Buy': 'Buy',
    'Hold': 'Hold',
    'Sell': 'Sell',
    'Strong Sell': 'Strong Sell',

    // Pestañas Principales (Tabs)
    'tabTerminal': 'Terminal',
    'tabOnChain': 'On-Chain & Supply',
    'tabActuarial': 'Actuarial Risk',
    'tabPortfolio': 'Portfolio & Alerts',
    'tab.risk': 'Risk',
    'tab.portfolioShort': 'Portfolio',
    'tab.sync': 'Sync',

    // Score
    'score.title': 'Oracle Score',
    'score.breakdown': 'Score Breakdown',

    // Indicators
    'indicators.title': 'Technical Indicators',
    'indicators.momentum': 'Momentum',
    'indicators.trend': 'Trend',
    'indicators.volatility': 'Volatility',

    // Sentiment
    'sentiment.title': 'Market Sentiment',
    'sentiment.fearGreed': 'Fear & Greed Index',
    'sentiment.altcoinSeason': 'Altcoin Season',
    'sentiment.extremeFear': 'Extreme Fear',
    'sentiment.fear': 'Fear',
    'sentiment.neutral': 'Neutral',
    'sentiment.greed': 'Greed',
    'sentiment.extremeGreed': 'Extreme Greed',
    'sentiment.btcSeason': 'Bitcoin Season',
    'sentiment.altSeason': 'Altcoin Season',

    // On-Chain
    'onchain.title': 'On-Chain Metrics',
    'onchain.intelligence': 'On-Chain Intelligence',
    'onchain.mvrv': 'MVRV Z-Score',
    'onchain.puell': 'Puell Multiple',
    'onchain.exchangeFlow': 'Exchange Flow',
    'onchain.minerPrice': 'BTC Mining Cost',
    'onchain.accumulation': 'Accumulation',
    'onchain.distribution': 'Distribution',
    'onchain.catFundamentals': 'Network Fundamentals',
    'onchain.catSupply': 'Supply Dynamics',
    'onchain.catProtocol': 'DeFi & Layer 2',
    'onchain.catSignals': 'Signals Index',
    'onchain.catStablecoins': 'Stablecoins & Liquidity',
    'onchain.l2Title': 'Layer 2 Ecosystem & Institutional Liquidity',
    'onchain.l2Badge': 'Bitcoin Modular & DeFi',
    'onchain.l2Desc': 'Liquidity metrics beyond base layer (L2), staking protocols with Bitcoin finality, and DeFi collateralization.',
    'onchain.l2Tvl': 'Bitcoin L2 & Staking TVL',
    'onchain.wbtcSupply': 'wBTC Supply in DeFi',
    'onchain.marketDominance': 'Global Liquidity Dominance',
    'onchain.lightningTitle': 'Lightning Network',
    'onchain.lightningDesc': 'Instant micro-payment channels & high-frequency routing',
    'onchain.babylonTitle': 'Babylon Protocol',
    'onchain.babylonDesc': 'Native BTC staking for shared PoS network security',
    'onchain.stacksTitle': 'Stacks (sBTC)',
    'onchain.stacksDesc': 'Smart contracts and programmable DeFi secured by Bitcoin',
    'onchain.wbtcCollateral': 'Premier collateral asset across Aave, Sky (MakerDAO), Compound and Uniswap v3.',
    'onchain.dominanceDesc': 'Reserve currency asset commanding over 58% liquidity dominance vs altcoins and stablecoins.',
    'onchain.activeAddresses': 'Active Addresses (24h)',
    'onchain.txCount24h': 'Transactions (24h)',
    'onchain.hashrate': 'Estimated Hashrate',
    'onchain.avgFee': 'Average Fee USD',

    // DCA
    'dca.title': 'DCA Levels',
    'dca.buyLevels': 'DCA Buy Zones',
    'dca.sellLevels': 'Scaled Take Profits',
    'dca.currentPrice': 'Current Price',
    'dca.optimalEntry': 'Optimal Entry',
    'dca.takeProfit': 'Take Profit',
    'dca.stopLoss': 'Stop Loss',
    'dca.neutral': 'Market in neutral zone — no active DCA levels',

    // Actionable & Risk
    'action.title': 'Action Panel',
    'action.risk': 'Estimated risk',
    'action.macroRisk': 'Macro Risk',

    // Actuarial & Position Sizing
    'actuarial.positionSizing': 'Position Sizing (Institutional Grade)',
    'actuarial.recommendedSize': 'Recommended Size',
    'actuarial.portfolioPct': '% of Portfolio',
    'actuarial.maxRisk': 'Max Tolerable Loss (VaR 95%)',
    'actuarial.sizingDesc': 'Based on the Fractional Kelly Criterion (compound growth) capped by stochastic Value at Risk (VaR 95%).',
    'actuarial.title': 'Actuarial Risk Analysis',
    'actuarial.liveBinance': 'Live Empirical Calculation (180D Binance)',
    'actuarial.estimatedMode': 'Estimated Mode',
    'actuarial.varTitle': 'Value at Risk (VaR 95%)',
    'actuarial.daily': 'Daily',
    'actuarial.cvarTitle': 'Expected Shortfall (CVaR)',
    'actuarial.annualVol': 'Annualized Volatility',
    'actuarial.monteCarloTitle': 'Monte Carlo 7D (Stochastic Cone)',
    'actuarial.currentPrice': 'Current',
    'actuarial.p10Bear': 'p10 (Bear)',
    'actuarial.p50Base': 'p50 (Base)',
    'actuarial.p90Bull': 'p90 (Bull)',
    'actuarial.markovTitle': 'Markov Regime (Probabilities)',
    'actuarial.dominant': 'Dominant',
    'actuarial.bullish': 'Bullish',
    'actuarial.bearish': 'Bearish',
    'actuarial.sideways': 'Sideways',
    'actuarial.sizingTitle': 'Actuarial Position Sizing (Kelly & VaR)',
    'actuarial.capitalLabel': 'Portfolio Capital ($ USD)',
    'actuarial.riskLabel': 'Max Risk per Trade (%)',
    'actuarial.suggestedSize': 'Suggested Position Size ($ USD)',
    'actuarial.allocationPct': '% Portfolio Allocation',
    'actuarial.estimatedLoss': 'Estimated Max Loss (VaR $)',
    'actuarial.halfKelly': 'Half-Kelly Fraction',
    'actuarial.winRateEst': 'Estimated Win Rate',
    'actuarial.sizingExpl': 'The suggested size combines the Half-Kelly Criterion (geometric wealth growth tailored to Quant Score) with a strict VaR 95% threshold to safeguard capital against tail risk.',

    // Screener
    'screener.title': 'Top 100 Screener',
    'screener.subtitle': 'Automatic scanning of major cryptocurrencies',
    'screener.rank': '#',
    'screener.crypto': 'Crypto',
    'screener.price': 'Price',
    'screener.change': '24h Change',
    'screener.24h': '24h Change',
    'screener.symbol': 'Symbol',
    'liquidity.title': 'Liquidity & Derivatives',
    'screener.rsi': 'RSI',
    'screener.score': 'Score',
    'screener.signal': 'Signal',
    'screener.volume': '24h Volume',
    'screener.all': 'All',

    // Macro
    'macro.title': 'Macro Data',
    'macro.dxy': 'Dollar Index (DXY)',
    'macro.m2': 'Global M2 Liquidity',
    'macro.bullish': 'Bullish',
    'macro.bearish': 'Bearish',
    'macro.sideways': 'Sideways',
    'macro.expansion': 'Expansion',
    'macro.contraction': 'Contraction',

    // Smart Money
    'smartmoney.title': 'Smart Money',
    'smartmoney.poc': 'Point of Control (POC)',
    'smartmoney.orderBlocks': 'Order Blocks',
    'smartmoney.fvg': 'Fair Value Gaps',
    'smartmoney.bullish': 'Bullish',
    'smartmoney.bearish': 'Bearish',
    'smartmoney.demand': 'Demand',
    'smartmoney.supply': 'Supply',
    'smartmoney.strength': 'Strength',
    'smartmoney.status': 'STATUS',
    'smartmoney.mitigated': 'MITIGATED',
    'smartmoney.open': 'OPEN',
    'smartmoney.keySupport': 'Key Support',
    'smartmoney.keyResistance': 'Key Resistance',

    // General
    'general.loading': 'Loading analysis...',
    'general.from': 'from current',
    'general.weight': 'weight',
    'general.livePrice': '🟢 Live price',
    'general.mockPrice': '⚠️ Simulated price',
    'general.noFilter': 'No cryptos found with this filter',

    // Macro Risk Messages
    'macrorisk.floor': 'Historical floor zone — maximum accumulation opportunity.',
    'macrorisk.weak': 'Weakened market — possible floor forming, watch volume.',
    'macrorisk.sideways': 'Undecided market — sideways consolidation, no clear direction.',
    'macrorisk.hot': 'Hot market — consider taking partial profits.',
    'macrorisk.euphoria': 'Extreme euphoria — very high risk of imminent correction.',

    // On-Chain Zone Labels
    'onchain.undervalued': 'Undervalued',
    'onchain.overvalued': 'Overvalued',
    'onchain.capitulation': 'Capitulation',
    'onchain.euphoria': 'Euphoria',

    // Footer
    'footer.title': 'Trading Oracle Pro — Quantitative Analysis Engine v1.0',
    'footer.disclaimer': 'Not financial advice.',

    // Portfolio Tracker
    'portfolio.title': 'Portfolio',
    'portfolio.add': 'Add',
    'portfolio.asset': 'Asset',
    'portfolio.amount': 'Amount',
    'portfolio.entryPrice': 'Entry Price (USD)',
    'portfolio.cancel': 'Cancel',
    'portfolio.save': 'Save',
    'portfolio.totalBalance': 'Total Balance',
    'portfolio.unrealizedPnl': 'Unrealized P&L',
    'portfolio.empty': 'No assets in portfolio yet. Click Add.',
    'portfolio.avg': 'Avg',

    // Watchlist
    'watchlist.title': 'Watchlist',
    'watchlist.empty': 'No assets in watchlist',
    'watchlist.search': 'Search...',

    // Backtest
    'backtest.title': 'Backtest',
    'backtest.winRate': 'Win Rate',
    'backtest.profitFactor': 'Profit Factor',
    'backtest.netProfit': 'Net Profit',
    'backtest.maxDrawdown': 'Max Drawdown',
    'backtest.trades': 'trades',
    'backtest.grossWinLoss': 'Gross Win/Loss',
    'backtest.peakToTrough': 'Peak-to-trough',
    'backtest.beatsHold': '🌟 Beats Buy & Hold',
    'backtest.underperforms': 'Underperforms B&H',
    'backtest.timeRange': 'Time Range',
    'backtest.riskMode': 'Risk Mode',
    'backtest.run': 'Run Backtest',
    'backtest.empty': 'Configure parameters and click Run',
    'backtest.strategy': 'Quantitative Strategy',
    'backtest.netReturn': 'Net Return',
    'backtest.cagr': 'CAGR',
    'backtest.totalFees': 'Fees Paid',
    'backtest.history': 'Trade History',
    'backtest.days30': '30 days',
    'backtest.days90': '90 days',
    'backtest.days180': '180 days',
    'backtest.days365': '1 year',
    'backtest.entryDate': 'Entry Date',
    'backtest.entryPrice': 'Entry Price',
    'backtest.exitDate': 'Exit Date',
    'backtest.exitPrice': 'Exit Price',
    'backtest.netPnl': 'Net PnL',
    'backtest.feeRate': 'Fee Rate (%)',

    // MiniChart & Overlays
    'chart.title': 'Chart',
    'chart.noData': 'No chart data available',
    'chart.noDataSub': 'Could not load candles for this asset',
    'chart.emas': 'EMAs (20/50/200)',
    'chart.dcaLevels': 'DCA Levels',
    'chart.bollingerBands': 'Bollinger Bands',

    // Export Buttons
    'export.png': 'Export PNG',
    'export.pdf': 'Export PDF',
    'exportPng': 'Export PNG',
    'exportPdf': 'Export PDF',

    // Data Source
    'source.binance': 'BINANCE',
    'source.coingecko': 'COINGECKO',
    'source.mock': 'SIMULATED',

    // Toasts
    'toast.localMode': 'Local Mode Active',
    'toast.localModeDesc': 'Python server unavailable. Using cached data / algorithmic engine.',
    'toast.aiUpdated': 'AI Analysis Updated',
    'toast.aiUpdatedDesc': 'New quantitative data available for',
    'toast.deviceSynced': 'Device Synced!',
    'toast.deviceSyncedDesc': 'Your account and portfolio have been linked successfully',

    // ==========================================
    // Educational Tooltips (Bilingual)
    // ==========================================
    'tooltip.howToUse': 'HOW TO INTERPRET',

    'tooltip.quantScore.title': 'Master Quant Score (0 to 100)',
    'tooltip.quantScore.desc': 'Algorithmic score combining trend strength, volume, sentiment, and derivatives into a single score.',
    'tooltip.quantScore.how': '0 to 45: Sell / Caution Zone. 45 to 55: Neutral Market. 55 to 100: Buy / Opportunity Zone.',

    'tooltip.mtfBullish.title': 'Bullish Fractal Alignment',
    'tooltip.mtfBullish.desc': 'At least 3 of 4 timeframes (15m, 1h, 4h, 1d) are in bullish confluence (EMA 20 > EMA 50 and positive RSI). Fractal confluence dramatically increases trend continuation probability.',
    'tooltip.mtfBullish.how': 'Look for entries favoring major institutional flow on pullbacks to support levels or EMAs on 15m or 1h timeframes.',

    'tooltip.mtfBearish.title': 'Bearish Fractal Alignment',
    'tooltip.mtfBearish.desc': 'At least 3 of 4 timeframes (15m, 1h, 4h, 1d) are in bearish confluence below their moving averages. Supply pressure dominates across multiple time horizons.',
    'tooltip.mtfBearish.how': 'Avoid counter-trend longs and consider short setups or defensive profit taking.',

    'tooltip.rsi.title': 'RSI (14)',
    'tooltip.rsi.desc': 'Measures the speed and change of price movements to identify overbought and oversold conditions.',
    'tooltip.rsi.how': 'Below 30 = Oversold (potential bullish bounce). Above 70 = Overbought (potential pullback).',

    'tooltip.macd.title': 'MACD',
    'tooltip.macd.desc': 'Shows changes in market momentum when the fast line crosses the signal line.',
    'tooltip.macd.how': 'Bullish cross above zero confirms buying momentum; bearish cross warns of weakness.',

    'tooltip.supertrend.title': 'Trend (Supertrend / EMAs)',
    'tooltip.supertrend.desc': 'Indicates dominant trend direction and dynamic trailing stop levels.',
    'tooltip.supertrend.how': 'Green = Bullish Trend (maintain longs). Red = Bearish Trend (caution or shorts).',

    'tooltip.orderBlocks.title': 'Order Blocks (Institutional Blocks)',
    'tooltip.orderBlocks.desc': 'High-liquidity zones where institutional players executed major orders prior to a strong expansion.',
    'tooltip.orderBlocks.how': 'They act as high-probability institutional support/resistance magnets.',

    'tooltip.fvg.title': 'Fair Value Gaps (FVG - Imbalances)',
    'tooltip.fvg.desc': 'Liquidity imbalances generated by fast impulsive moves that price tends to revisit and fill.',
    'tooltip.fvg.how': 'Wait for price to test 50% of the FVG for reversal confirmation.',

    'tooltip.dca.title': 'Quantitative DCA Ladder',
    'tooltip.dca.desc': 'Mathematical distribution of buy/sell orders to minimize market timing risk.',
    'tooltip.dca.how': 'Execute tiered bids at lower levels to optimize average entry price without catching falling knives.',

    'tooltip.var95.title': 'Value at Risk (VaR 95%)',
    'tooltip.var95.desc': 'Maximum expected loss over a specific horizon with a 95% statistical confidence level.',
    'tooltip.var95.how': 'If daily VaR is $250, there is a 95% probability daily loss will not exceed that amount under normal conditions.',

    'tooltip.monteCarlo.title': 'Monte Carlo Simulation (7D)',
    'tooltip.monteCarlo.desc': 'Mathematical projection of 1,000 possible future price paths based on historical volatility and drift.',
    'tooltip.monteCarlo.how': 'The central cone shows the most probable price interval (P10 - P90) over the next 7 days.',

    'tooltip.kelly.title': 'Kelly Criterion Position Sizing',
    'tooltip.kelly.desc': 'Actuarial formula calculating optimal trade capital allocation to maximize geometric growth without risk of ruin.',
    'tooltip.kelly.how': 'Uses a conservative fractional Kelly sizing adjusted for volatility and model win rate.',

    // ==========================================
    // Modal: ShareCardModal
    // ==========================================
    'shareCard.title': 'Share Card Generator',
    'shareCard.subtitle': 'QUANTITATIVE ANALYSIS',
    'shareCard.confluences': 'Confluences 🔥',
    'shareCard.tradeSetup': 'Trade Setup 🎯',
    'shareCard.volume': 'Volume',
    'shareCard.trend': 'Trend',
    'shareCard.entry': 'Entry',
    'shareCard.target': 'Target',
    'shareCard.stop': 'Stop',
    'shareCard.disclaimer': 'oraculo-pro.vercel.app • Non-financial analysis',
    'shareCard.copyImage': 'Copy Image',
    'shareCard.copied': 'Image copied to clipboard!',
    'shareCard.copyError': 'Error copying image',
    'shareCard.downloadPng': 'Download PNG',
    'shareCard.shareTelegram': 'Share on Telegram',
    'shareCard.telegramText': 'Trading Oracle Pro',

    // ==========================================
    // Modal: SyncDeviceModal
    // ==========================================
    'syncModal.title': 'Sync Devices',
    'syncModal.subtitle': 'Connect your PC and PWA Mobile without username or password',
    'syncModal.banner': 'Your anonymous session securely stores your Portfolio, Watchlist, Alerts, and Paper Trading demo account. When synced, both devices share live data.',
    'syncModal.thisDevice': 'This Device (Current Code)',
    'syncModal.active': 'Active',
    'syncModal.loading': 'Loading...',
    'syncModal.copyCode': 'Copy Code',
    'syncModal.codeCopied': 'Code Copied!',
    'syncModal.copyLink': 'Copy Direct Link',
    'syncModal.linkCopied': 'Link Copied!',
    'syncModal.instantScan': 'Instant scan from Mobile',
    'syncModal.scanDesc': 'Point your smartphone camera at this QR code to open Trading Oracle Pro on your phone and sync instantly without typing.',
    'syncModal.linkOther': 'Link with another Device',
    'syncModal.linkOtherDesc': 'If you already have an account on your phone or PC, paste its code or sync link here:',
    'syncModal.placeholder': 'E.g. sess_a1b2c3d4... or paste the full link',
    'syncModal.linking': 'Linking...',
    'syncModal.linkBtn': 'Link Device',
    'syncModal.linkingStatus': 'Linking session and syncing data...',
    'syncModal.errEmpty': 'Please enter a session code or the received link.',
    'syncModal.errSame': 'This code already belongs to the active session on this device.',
    'syncModal.errInvalid': 'Invalid code format. Must start with sess_ or be a valid sync link.',
    'syncModal.errFailed': 'Failed to link device. Please check the code and try again.',
    'syncModal.close': 'Close modal',
  },
};

export function t(key: string, locale: Locale): string {
  if (!key) return '';
  const translated = translations[locale]?.[key];
  if (translated !== undefined) return translated;

  // Dynamic signal fallback
  const signalTrans = translateSignal(key, locale);
  if (signalTrans !== key) return signalTrans;

  return key;
}
