@echo off
title KrishiSetu Launcher
echo ============================================================
echo   Starting KrishiSetu - Farmer Procurement System
echo ============================================================
echo.

echo [1/3] Starting Backend API Server (Port 5000)...
start "KrishiSetu Backend Server (Port 5000)" cmd /k "npm --prefix server start"

timeout /t 3 /nobreak >nul

echo [2/3] Starting Frontend Client (Port 5173)...
start "KrishiSetu Frontend Client (Port 5173)" cmd /k "npm --prefix client run dev -- --host"

timeout /t 2 /nobreak >nul

echo [3/3] Launching Web Browser at http://localhost:5173...
start http://localhost:5173

echo.
echo ============================================================
echo   SUCCESS! KrishiSetu is running:
echo   - Web App URL:    http://localhost:5173
echo   - Backend Health: http://localhost:5000/api/health
echo.
echo   Demo Accounts:
echo   1. Centre Operator: operator.c07@krishisetu.in / password123
echo   2. Office Manager:  manager@krishisetu.in / password123
echo ============================================================
pause

