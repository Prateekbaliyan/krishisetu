# KrishiSetu PowerShell Launcher
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Starting KrishiSetu - Farmer Procurement System" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""

Write-Host "[1/3] Starting Backend API Server (Port 5000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm --prefix server start"

Start-Sleep -Seconds 3

Write-Host "[2/3] Starting Frontend Client (Port 5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm --prefix client run dev -- --host"

Start-Sleep -Seconds 2

Write-Host "[3/3] Opening browser at http://localhost:5173..." -ForegroundColor Cyan
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  SUCCESS! KrishiSetu is live:" -ForegroundColor Green
Write-Host "  - Web App URL:    http://localhost:5173" -ForegroundColor Yellow
Write-Host "  - Backend Health: http://localhost:5000/api/health" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Demo Credentials:" -ForegroundColor White
Write-Host "  1. Operator: operator.c07@krishisetu.in / password123"
Write-Host "  2. Manager:  manager@krishisetu.in / password123"
Write-Host "============================================================" -ForegroundColor Green

