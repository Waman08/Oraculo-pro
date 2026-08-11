@echo off
title Oraculo de Trading Pro
echo Iniciando el Oraculo de Trading...

:: Matar procesos anteriores por si se quedaron colgados
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1

:: Iniciar el Backend de Python (y el bot de Telegram) en una nueva ventana oculta/minimizada
echo Iniciando Motor de Inteligencia Artificial y Bot de Telegram...
start /min cmd /c "cd backend && python main.py"

:: Esperar un par de segundos para que el backend despierte
timeout /t 3 /nobreak >nul

:: Iniciar el Frontend (Next.js)
echo Iniciando Interfaz Profesional...
start cmd /c "npm run dev"

:: Esperar a que el frontend compile y abrir el navegador
echo Abriendo el navegador...
timeout /t 5 /nobreak >nul
start http://localhost:3000

echo.
echo Todo esta corriendo. Puedes cerrar esta ventana si lo deseas.
exit
