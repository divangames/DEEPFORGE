@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo [DEEPFORGE] Устанавливаю зависимости...
  call npm install
  if errorlevel 1 goto :error
)

if not exist .env (
  copy /Y .env.example .env >nul
)

for /f "tokens=1,* delims==" %%A in (.env) do (
  if not "%%A"=="" set "%%A=%%B"
)

set VITE_API_URL=http://localhost:3001

echo [DEEPFORGE] Игра: http://localhost:5173
echo [DEEPFORGE] API:  http://localhost:3001/api/health
echo.
start "" "http://localhost:5173"
call npm run dev
exit /b %errorlevel%

:error
echo.
echo [DEEPFORGE] Ошибка запуска.
pause
exit /b 1
