@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
if errorlevel 1 goto :fail
where npm >nul 2>nul
if errorlevel 1 goto :fail
if not exist "node_modules" (
  call npm install
  if errorlevel 1 goto :fail
)
rem Temporary settings for this window only. No .env file is modified.
set "DATABASE_URL="
set "NODE_ENV=development"
set "HOST=127.0.0.1"
set "PORT=3001"
set "CLIENT_ORIGIN=http://localhost:5173"
set "VITE_API_URL=http://localhost:3001"
echo [DEV MEMORY] Rift profiles, rewards and ranks reset when this server stops.
echo [INFO] Stop any other development servers on ports 3001 and 5173 first.
echo [INFO] Open http://localhost:5173 then Events - Rift Expedition.
echo [INFO] This mode is for local testing, not a public server.
call npm run dev
exit /b %errorlevel%
:fail
echo [ERROR] Development startup failed. No project files were reset.
pause
exit /b 1
