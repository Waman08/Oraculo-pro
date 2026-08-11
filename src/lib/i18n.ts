// ============================================================
// i18n — Sistema de Internacionalización ES/EN
// ============================================================

export type Locale = 'es' | 'en';

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

    // Signals
    'signal.strongBuy': 'Compra Fuerte',
    'signal.buy': 'Compra',
    'signal.hold': 'Mantener',
    'signal.sell': 'Venta',
    'signal.strongSell': 'Venta Fuerte',

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
    'onchain.mvrv': 'MVRV Z-Score',
    'onchain.puell': 'Puell Multiple',
    'onchain.exchangeFlow': 'Flujo de Exchanges',
    'onchain.minerPrice': 'Costo de Minería BTC',
    'onchain.accumulation': 'Acumulación',
    'onchain.distribution': 'Distribución',

    // DCA
    'dca.title': 'Niveles DCA',
    'dca.buyLevels': 'Zonas DCA de Compra',
    'dca.sellLevels': 'Take Profits Escalonados',
    'dca.currentPrice': 'Precio Actual',
    'dca.optimalEntry': 'Entrada Óptima',
    'dca.takeProfit': 'Take Profit',
    'dca.stopLoss': 'Stop Loss',

    // Actionable
    'action.title': 'Panel de Acción',
    'action.risk': 'Riesgo estimado',
    'action.macroRisk': 'Riesgo Macro',

    // Screener
    'screener.title': 'Screener Top 100',
    'screener.subtitle': 'Escaneo automático de las principales criptomonedas',
    'screener.rank': '#',
    'screener.crypto': 'Cripto',
    'screener.price': 'Precio',
    'screener.change': 'Cambio 24h',
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

    // DCA neutral
    'dca.neutral': 'Mercado en zona neutral — sin niveles DCA activos',

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

    // MiniChart
    'chart.title': 'Gráfico',
    'chart.noData': 'Sin datos de gráfico disponibles',

    // Export
    'export.png': 'Exportar PNG',
    'export.pdf': 'Exportar PDF',

    // Data Source
    'source.binance': 'BINANCE',
    'source.coingecko': 'COINGECKO',
    'source.mock': 'SIMULADO',
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

    // Signals
    'signal.strongBuy': 'Strong Buy',
    'signal.buy': 'Buy',
    'signal.hold': 'Hold',
    'signal.sell': 'Sell',
    'signal.strongSell': 'Strong Sell',

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
    'onchain.mvrv': 'MVRV Z-Score',
    'onchain.puell': 'Puell Multiple',
    'onchain.exchangeFlow': 'Exchange Flow',
    'onchain.minerPrice': 'BTC Mining Cost',
    'onchain.accumulation': 'Accumulation',
    'onchain.distribution': 'Distribution',

    // DCA
    'dca.title': 'DCA Levels',
    'dca.buyLevels': 'DCA Buy Zones',
    'dca.sellLevels': 'Scaled Take Profits',
    'dca.currentPrice': 'Current Price',
    'dca.optimalEntry': 'Optimal Entry',
    'dca.takeProfit': 'Take Profit',
    'dca.stopLoss': 'Stop Loss',

    // Actionable
    'action.title': 'Action Panel',
    'action.risk': 'Estimated risk',
    'action.macroRisk': 'Macro Risk',

    // Screener
    'screener.title': 'Top 100 Screener',
    'screener.subtitle': 'Automatic scanning of major cryptocurrencies',
    'screener.rank': '#',
    'screener.crypto': 'Crypto',
    'screener.price': 'Price',
    'screener.change': '24h Change',
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

    // DCA neutral
    'dca.neutral': 'Market in neutral zone — no active DCA levels',

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

    // MiniChart
    'chart.title': 'Chart',
    'chart.noData': 'No chart data available',

    // Export
    'export.png': 'Export PNG',
    'export.pdf': 'Export PDF',

    // Data Source
    'source.binance': 'BINANCE',
    'source.coingecko': 'COINGECKO',
    'source.mock': 'SIMULATED',
  },
};

export function t(key: string, locale: Locale): string {
  return translations[locale]?.[key] ?? key;
}
