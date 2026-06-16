@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference = 'Stop'; $port = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if (-not $port) { $npm = (Get-Command npm.cmd).Source; Start-Process -FilePath $npm -ArgumentList @('run','dev','--','--host','127.0.0.1','--port','5173','--strictPort') -WorkingDirectory (Get-Location).Path -WindowStyle Normal; Start-Sleep -Seconds 3 }; Start-Process 'http://127.0.0.1:5173/'"

if errorlevel 1 (
  echo Failed to start 99 Personal Player.
  pause
  exit /b 1
)
