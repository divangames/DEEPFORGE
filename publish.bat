@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "REPO_URL=https://github.com/divangames/DEEPFORGE.git"
set "PAGE_URL=https://divangames.github.io/DEEPFORGE/"

echo ==================================================
echo   DEEPFORGE - CHECK ^> COMMIT ^> PUSH ^> PAGES
echo ==================================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git не найден. Установи Git for Windows.
  goto :error
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js не найден. Нужен Node.js 22+.
  goto :error
)

if not exist node_modules (
  echo [1/7] Устанавливаю зависимости...
  call npm install
  if errorlevel 1 goto :error
) else (
  echo [1/7] Зависимости уже установлены.
)

echo [2/7] TypeScript check...
call npm run typecheck
if errorlevel 1 goto :error

echo [3/7] Tests...
call npm test
if errorlevel 1 goto :error

echo [4/7] Production build...
call npm run build
if errorlevel 1 goto :error

if not exist .git (
  echo [5/7] Инициализирую Git...
  git init
  git branch -M main
  git remote add origin "%REPO_URL%"
) else (
  echo [5/7] Git уже инициализирован.
  git remote get-url origin >nul 2>nul
  if errorlevel 1 git remote add origin "%REPO_URL%"
)

git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo [6/7] Изменений для коммита нет.
) else (
  if "%~1"=="" (
    for /f "tokens=1-3 delims=./- " %%a in ("%date%") do set "D=%%a-%%b-%%c"
    set "MSG=auto: DEEPFORGE update %date% %time:~0,5%"
  ) else (
    set "MSG=%~1"
  )
  echo [6/7] Commit: %MSG%
  git commit -m "%MSG%"
  if errorlevel 1 goto :error
)

echo [7/7] Push в GitHub. После push GitHub Actions обновит Pages...
git push -u origin main
if errorlevel 1 goto :error

echo.
echo [OK] Код отправлен: https://github.com/divangames/DEEPFORGE
echo [OK] GitHub Pages: %PAGE_URL%
echo.
echo Если это самый первый деплой репозитория, GitHub может один раз потребовать:
echo Settings ^> Pages ^> Source ^> GitHub Actions.
echo После этого все следующие публикации полностью автоматические.
echo.
start "" "%PAGE_URL%"
pause
exit /b 0

:error
echo.
echo [DEEPFORGE] Публикация остановлена из-за ошибки. Ничего не пушилось после сбоя проверки.
pause
exit /b 1
