@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  call npm install
  if errorlevel 1 goto :error
)

call npm run typecheck
if errorlevel 1 goto :error
call npm test
if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error

echo.
echo [DEEPFORGE] Сборка успешно создана.
pause
exit /b 0

:error
echo.
echo [DEEPFORGE] Сборка остановлена из-за ошибки.
pause
exit /b 1
