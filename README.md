# 🔮 Oráculo de Trading Pro

Una plataforma avanzada e integral para inversores en criptomonedas, que combina Análisis Cuantitativo, On-Chain, Derivados de Binance, Modelos Actuariales de Riesgo (Monte Carlo y Cadenas de Markov) y un Bot de Telegram autónomo para alertas. Todo operando en tiempo real.

## 🏗 Arquitectura del Sistema

El sistema utiliza una arquitectura orientada a microservicios altamente escalable (Serverless).

- **Frontend (Next.js / React)**: Alojado en **Vercel**. Proporciona un dashboard reactivo, renderizado de gráficos estocásticos por WebGL y streaming de precios por WebSocket nativo de Binance.
- **Backend (FastAPI / Python)**: Alojado en **Render** (o en tu nube preferida). Se encarga de correr modelos de machine learning (pandas-ta, scikit-learn), análisis actuarial probabilístico y gestiona un bucle concurrente (AsyncIO) que ejecuta el bot de Telegram.
- **Base de Datos (Supabase / PostgreSQL)**: Actúa como la única fuente de verdad (Single Source of Truth) tanto para el frontend como para el backend. Mantiene preferencias, webhooks de Telegram, alertas de precio y el historial del bot, completamente libre de estado en disco.

## ⚙️ Guía de Instalación Paso a Paso

Sigue estos pasos para levantar el entorno de desarrollo local:

### Paso 1: Configurar la Base de Datos (Supabase)
1. Crea un nuevo proyecto en [Supabase](https://supabase.com/).
2. Dirígete a la pestaña **SQL Editor**.
3. Copia el contenido del archivo  + "" + supabase-schema.sql + "" +  que se encuentra en la raíz del repositorio y ejecútalo. Esto creará todas las tablas requeridas y configurará las políticas de seguridad (RLS).

### Paso 2: Variables de Entorno
1. Copia el archivo de ejemplo para crear tu configuración local:
    + "`" + ash
   cp .env.example .env.local
    + "`" + 
2. Rellena  + "" + .env.local + "" +  con tus URLs, las API keys correspondientes de Supabase y tu token de Telegram.

### Paso 3: Instalación y Arranque del Backend (Python)
Abre una terminal en la raíz del proyecto:
 + "`" + ash
cd backend
# (Opcional) Crea un entorno virtual: python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py
# (Alternativamente para debug): uvicorn main:app --reload --port 8000
 + "`" + 
*Nota: El servidor correrá en http://localhost:8000 y paralelamente iniciará los loops asíncronos del bot.*

### Paso 4: Instalación y Arranque del Frontend (Next.js)
Abre otra terminal en la raíz del proyecto:
 + "`" + ash
npm install
npm run dev
 + "`" + 
*El dashboard estará disponible en http://localhost:3000.*

## 📡 Tabla de Endpoints de la API (Python)

El backend en Python expone endpoints que Next.js consume mediante Rewrites (/api/*).

| Endpoint | Método | Descripción |
|----------|--------|-------------|
|  + "" + /api/analyze/{symbol} + "" +  | GET | Motor Cuantitativo: Devuelve Score, Señales, Soportes/Resistencias. |
|  + "" + /api/screener + "" +  | GET | Motor Multimoneda: Escanea y evalúa top coins para encontrar oportunidades. |
|  + "" + /api/onchain/{symbol} + "" +  | GET | Extrae datos institucionales, Flujo Inteligente y apalancamiento On-Chain. |
|  + "" + /api/supply/{symbol} + "" +  | GET | Procesa la tokenomics, inflación y métricas de emisión (Supply Dynamics). |
|  + "" + /api/stablecoins/analysis + "" +  | GET | Analiza la liquidez del ecosistema y el poder de compra de las stablecoins. |
|  + "" + /api/backtest + "" +  | GET | Ejecuta pruebas retrospectivas para validar rentabilidades del modelo AI. |
|  + "" + /api/telegram/config + "" +  | POST | Conecta tu cuenta actual del Frontend al Bot de alertas de Telegram. |
|  + "" + /api/alerts + "" +  | GET/POST | Rutas puente para sincronización bidireccional entre la UI y Supabase. |

## 📊 Convenciones del Quant Score

El modelo predictivo está estrictamente ajustado a una escala del **0 al 100**, eliminando la ambigüedad matemática:

| Rango de Score | Sentimiento | Acción Algorítmica |
|----------------|-------------|--------------------|
| **0 a 25** | Extremadamente Bajista | Venta Fuerte (Corto) |
| **25 a 45** | Bajista | Venta |
| **45 a 55** | Neutral | Mantener (No operar) |
| **55 a 75** | Alcista | Compra |
| **75 a 100** | Extremadamente Alcista | Compra Fuerte (Largo) |

## 🚀 Notas sobre el Despliegue en Producción

- **Vercel (Frontend)**: Al desplegar en Vercel, asegúrate de configurar  + "" + NEXT_PUBLIC_PYTHON_API_URL + "" +  apuntando al dominio otorgado por Render (Ej.  + "" + https://oraculo-backend.onrender.com + "" + ).
- **Render (Backend)**: 
  - Conecta tu repositorio y elige "Web Service".
  - Build Command:  + "" + pip install -r requirements.txt + "" + 
  - Start Command:  + "" + python backend/main.py + "" +  (Crucial ejecutarlo de esta manera en vez de usar  + "" + uvicorn + "" +  directo, para garantizar que el loop de eventos del bot arranque correctamente).
  - Las variables  + "" + PORT + "" + ,  + "" + SUPABASE_URL + "" +  y  + "" + SUPABASE_SERVICE_ROLE_KEY + "" +  deben estar inyectadas explícitamente en el panel de configuración de Render.