@echo off
chcp 65001 >nul
title Central de Jogos
cd /d "%~dp0"
where node >/dev/null 2>nul
if errorlevel 1 (
  echo O Node.js nao foi encontrado. Instale em https://nodejs.org e tente de novo.
  pause
  exit /b 1
)
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/api/status -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "Central de Jogos - feche esta janela para desligar" /min node servidor\servidor.js
  timeout /t 2 /nobreak >nul
)
start "" chrome "http://127.0.0.1:8765/" 2>nul
if errorlevel 1 start "" "http://127.0.0.1:8765/"
exit /b 0
