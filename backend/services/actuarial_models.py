import numpy as np
import pandas as pd
from typing import Dict, Any

class ActuarialEngine:
    """
    Motor Actuarial de Riesgo Financiero.
    Implementa modelos clásicos de matemática financiera y actuarial para 
    la medición de riesgo y simulación de trayectorias.
    """
    
    def __init__(self, df: pd.DataFrame):
        """
        :param df: DataFrame con datos OHLCV.
        """
        self.df = df
        # Calculamos los retornos logarítmicos continuos
        self.df['log_returns'] = np.log(self.df['close'] / self.df['close'].shift(1))
        self.returns = self.df['log_returns'].dropna()
        self.current_price = self.df['close'].iloc[-1]

    def calculate_var_cvar(self, confidence_level: float = 0.95) -> Dict[str, float]:
        """
        Calcula el Value at Risk (VaR) y Conditional VaR (Expected Shortfall) 
        histórico diario.
        :param confidence_level: Nivel de confianza (ej: 0.95 para 95%).
        """
        if len(self.returns) < 30:
            return {"var_pct": 0.0, "cvar_pct": 0.0}

        # Percentil para VaR
        alpha = 1 - confidence_level
        # VaR es el cuantil correspondiente en la distribución empírica de los retornos
        var_log_return = np.percentile(self.returns, alpha * 100)
        
        # Expected Shortfall (CVaR) es el promedio de los retornos peores que el VaR
        cvar_log_return = self.returns[self.returns <= var_log_return].mean()

        # Convertimos retornos logarítmicos a porcentajes aritméticos para la vista
        var_pct = (np.exp(var_log_return) - 1) * 100
        cvar_pct = (np.exp(cvar_log_return) - 1) * 100

        return {
            "var_pct": round(var_pct, 2),
            "cvar_pct": round(cvar_pct, 2)
        }

    def simulate_gbm_monte_carlo(self, days: int = 7, simulations: int = 1000) -> Dict[str, Any]:
        """
        Simulación de Monte Carlo mediante Movimiento Browniano Geométrico (GBM).
        :param days: Horizonte de proyección en días (ej: 7).
        :param simulations: Número de trayectorias a simular.
        :return: Precios proyectados (percentiles 10, 50, 90).
        """
        if len(self.returns) < 30:
            return {"p10": self.current_price, "p50": self.current_price, "p90": self.current_price}

        mu = self.returns.mean()
        sigma = self.returns.std()
        
        # Simulamos los retornos diarios para 'days' días y 'simulations' escenarios
        # dS/S = (mu + 0.5 * sigma^2) dt + sigma * dW
        drift = mu - (0.5 * sigma**2)
        
        Z = np.random.standard_normal((days, simulations))
        daily_returns = np.exp(drift + sigma * Z)
        
        # Generar trayectorias de precios
        price_paths = np.zeros_like(daily_returns)
        price_paths[0] = self.current_price * daily_returns[0]
        for t in range(1, days):
            price_paths[t] = price_paths[t-1] * daily_returns[t]
            
        final_prices = price_paths[-1]
        
        return {
            "p10": round(np.percentile(final_prices, 10), 2),
            "p50": round(np.percentile(final_prices, 50), 2),
            "p90": round(np.percentile(final_prices, 90), 2),
            "sigma_annualized": round(sigma * np.sqrt(365) * 100, 2)
        }

    def get_markov_regime_probabilities(self) -> Dict[str, float]:
        """
        Usa una Cadena de Markov de 3 estados (Bull, Bear, Sideways) sobre los últimos 30 días 
        para estimar la probabilidad del régimen actual.
        Para simplificar, clasificamos cada día empíricamente.
        """
        if len(self.returns) < 30:
            return {"bull": 0.33, "bear": 0.33, "sideways": 0.34}
            
        std = self.returns.std()
        states = []
        for r in self.returns[-30:]:
            if r > 0.5 * std:
                states.append('bull')
            elif r < -0.5 * std:
                states.append('bear')
            else:
                states.append('sideways')
                
        # Contamos transiciones
        transitions = {'bull': 0, 'bear': 0, 'sideways': 0}
        
        # Estado más reciente
        current_state = states[-1]
        
        # Para hacer una predicción simplificada, miramos la matriz de transición desde el estado actual
        total_transitions = 0
        for i in range(len(states)-1):
            if states[i] == current_state:
                next_state = states[i+1]
                transitions[next_state] += 1
                total_transitions += 1
                
        if total_transitions == 0:
            return {"bull": 0.33, "bear": 0.33, "sideways": 0.34}
            
        return {
            "bull": round(transitions['bull'] / total_transitions, 2),
            "bear": round(transitions['bear'] / total_transitions, 2),
            "sideways": round(transitions['sideways'] / total_transitions, 2)
        }
        
    def generate_full_actuarial_report(self) -> Dict[str, Any]:
        """Agrega todos los modelos en un reporte estructurado."""
        try:
            var_data = self.calculate_var_cvar(0.95)
            mc_data = self.simulate_gbm_monte_carlo(days=7, simulations=1000)
            markov_data = self.get_markov_regime_probabilities()
            
            return {
                "riskMetrics": {
                    "var95": var_data["var_pct"],
                    "cvar95": var_data["cvar_pct"],
                    "annualVolatility": mc_data["sigma_annualized"]
                },
                "monteCarlo7D": {
                    "p10": mc_data["p10"], # Bear case
                    "p50": mc_data["p50"], # Base case
                    "p90": mc_data["p90"]  # Bull case
                },
                "markovRegime": markov_data,
                "dataAvailable": True
            }
        except Exception as e:
            print(f"[ActuarialEngine] Error generando reporte: {e}")
            return {"dataAvailable": False}
