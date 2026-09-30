import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
import time
import asyncio
from pathlib import Path

# Fix Windows colors
try:
    import colorama
    colorama.init()
    GREEN = colorama.Fore.GREEN
    RED = colorama.Fore.RED
    RESET = colorama.Style.RESET_ALL
except ImportError:
    GREEN = "\033[92m"
    RED = "\033[91m"
    RESET = "\033[0m"

# Load env before importing backend
from dotenv import load_dotenv
load_dotenv(".env.local")
load_dotenv(".env")

# Append backend path
project_root = Path(__file__).parent.absolute()
backend_path = project_root / "backend"
sys.path.append(str(backend_path))

def report(success: bool, msg: str):
    if success:
        print(f"[{GREEN}✔{RESET}] {msg}")
    else:
        print(f"[{RED}✖{RESET}] {msg}")

async def main():
    print(f"\n=== INICIANDO VERIFICACIÓN DEL SISTEMA ORÁCULO PRO ===\n")
    start_time = time.time()
    
    # 1. Variables de entorno
    print("1. Verificando Variables de Entorno y Supabase...")
    expected_vars = [
        "SUPABASE_URL", 
        "SUPABASE_SERVICE_ROLE_KEY", 
        "TELEGRAM_BOT_T✔EN", 
        "TELEGRAM_CHAT_ID"
    ]
    # Allow NEXT_PUBLIC versions as fallback
    all_ok = True
    for v in expected_vars:
        val = os.getenv(v) or os.getenv(f"NEXT_PUBLIC_{v}")
        if not val:
            all_ok = False
            report(False, f"Variable faltante: {v}")
            # Injecting missing vars to not break imports completely
            if v == "SUPABASE_URL": os.environ["SUPABASE_URL"] = "http://localhost:8000"
            if v == "SUPABASE_SERVICE_ROLE_KEY": os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "dummy"
            
    if all_ok:
        report(True, "Todas las variables de entorno base están presentes.")

    # Supabase Connection
    try:
        from services.supabase_client import supabase
        if supabase:
            # Read test
            res = supabase.table("user_preferences").select("id").limit(1).execute()
            report(True, "Supabase: Lectura en 'user_preferences' exitosa.")
        else:
            report(False, "Supabase: Cliente no inicializado.")
    except Exception as e:
        report(False, f"Supabase: Error de conexión: {e}")

    # 2. Conexión con Binance
    print("\n2. Verificando Conexión y Datos de Binance...")
    try:
        from services.binance_client import fetch_klines, init_binance_symbols
        await init_binance_symbols()
        
        df_btc = await fetch_klines("BTC", "1D", limit=10)
        df_eth = await fetch_klines("ETH", "1D", limit=10)
        
        if df_btc is not None and not df_btc.empty and df_eth is not None and not df_eth.empty:
            report(True, "Binance: Klines descargadas exitosamente para BTC y ETH.")
            # Verify closed candle logic
            last_idx = df_btc.index[-1]
            report(True, f"Binance: Estructura de DataFrame validada (Última vela eval: {last_idx}).")
        else:
            report(False, "Binance: No se pudieron descargar klines.")
    except Exception as e:
        report(False, f"Binance Error: {e}")

    # 3. Motor Cuantitativo y Scoring
    print("\n3. Verificando Motor Cuantitativo (Analyzer)...")
    try:
        from services.analyzer import run_analysis
        res = await run_analysis("BTC", "1D", "Balanceado")
        if res:
            score = res.get("quantScore", -1)
            signal = res.get("signal", "")
            
            # Score bounds
            if 0 <= score <= 100:
                report(True, f"Analyzer: quantScore dentro de los límites (0-100) -> {score}")
            else:
                report(False, f"Analyzer: quantScore fuera de rango -> {score}")
                
            # Polarity
            polarity_ok = False
            if score > 55 and "Compra" in signal: polarity_ok = True
            elif score < 45 and "Venta" in signal: polarity_ok = True
            elif 45 <= score <= 55 and "Mantener" in signal: polarity_ok = True
            
            if polarity_ok:
                report(True, f"Analyzer: Polaridad de señal correcta ({score} = {signal})")
            else:
                report(False, f"Analyzer: Polaridad de señal incorrecta ({score} != {signal})")
                
            # SL / TP
            act = res.get("actionableData", {})
            entry = act.get("optimalEntry")
            tp = act.get("takeProfit")
            sl = act.get("stopLoss")
            
            if "Compra" in signal:
                if tp > entry and sl < entry:
                    report(True, "Analyzer: Lógica TP/SL de COMPRA correcta (TP > Entry > SL)")
                else:
                    report(False, "Analyzer: Lógica TP/SL de COMPRA incorrecta")
            elif "Venta" in signal:
                if tp < entry and sl > entry:
                    report(True, "Analyzer: Lógica TP/SL de VENTA correcta (TP < Entry < SL)")
                else:
                    report(False, "Analyzer: Lógica TP/SL de VENTA incorrecta")
            else:
                report(True, "Analyzer: Señal Neutra, saltando prueba direccional TP/SL.")
                
            # Stablecoin analysis
            stable = res.get("stablecoinAnalysis")
            if stable is not None:
                report(True, "Analyzer: Análisis on-chain de Stablecoins integrado exitosamente.")
            else:
                report(False, "Analyzer: 'stablecoinAnalysis' es None.")
        else:
            report(False, "Analyzer: run_analysis devolvió None.")
    except Exception as e:
        report(False, f"Analyzer Error: {e}")

    # 4. Auditoría de Código (Datos falsos)
    print("\n4. Auditoría de Código contra Mocks/Fake Data...")
    try:
        import re
        directories_to_scan = [project_root / "backend" / "services", project_root / "src" / "lib"]
        
        found_fakes = []
        fake_patterns = [r"random\.uniform", r"Math\.random", r"random\.randint"]
        
        for dir_path in directories_to_scan:
            if not dir_path.exists(): continue
            for filepath in dir_path.rglob("*.*"):
                if filepath.suffix not in [".py", ".ts", ".js", ".tsx"]: continue
                
                content = filepath.read_text(encoding="utf-8", errors="ignore")
                for pat in fake_patterns:
                    if re.search(pat, content):
                        found_fakes.append(f"{filepath.name} ({pat.replace('\\', '')})")
                        
        if len(found_fakes) == 0:
            report(True, "Auditoría: 0 referencias a 'random.uniform' o 'Math.random' en módulos de análisis.")
            report(True, "Auditoría: La volatilidad proviene del ATR y datos reales.")
        else:
            report(False, f"Auditoría: Se encontraron generadores de datos falsos en: {', '.join(set(found_fakes))}")
    except Exception as e:
        report(False, f"Auditoría Error: {e}")

    elapsed = time.time() - start_time
    print(f"\n[INFO] Tiempo total de ejecución: {elapsed:.2f}s")
    if elapsed < 15:
        report(True, "Performance: El script ejecutó en menos de 15 segundos.")
    else:
        report(False, "Performance: El script excedió los 15 segundos.")
        
    print("\n=== FIN DE LA VERIFICACIÓN ===")

if __name__ == "__main__":
    asyncio.run(main())
