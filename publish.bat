@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "MSG=%~1"
if "%MSG%"=="" set "MSG=auto: DEEPFORGE update"

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git is not installed or not in PATH.
  pause
  exit /b 1
)

if not exist ".git" (
  echo [1/8] Initializing Git repository...
  git init
  git branch -M main
) else (
  echo [1/8] Git repository already initialized.
)

git config user.name "divangames"
git config user.email "61680664+divangames@users.noreply.github.com"
git config core.autocrlf true

git remote get-url origin >nul 2>nul
if errorlevel 1 (
  git remote add origin https://github.com/divangames/DEEPFORGE.git
) else (
  git remote set-url origin https://github.com/divangames/DEEPFORGE.git
)

echo [2/8] Syncing with GitHub...
git fetch origin main
if errorlevel 1 goto :fail
git rebase --autostash origin/main
if errorlevel 1 (
  echo [ERROR] Git sync conflict. Send me a screenshot.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [3/8] Installing dependencies...
  call npm install
  if errorlevel 1 goto :fail
) else (
  echo [3/8] Dependencies already installed.
)

echo [4/8] TypeScript check...
call npm run typecheck
if errorlevel 1 goto :fail

echo [5/8] Tests...
call npm test
if errorlevel 1 goto :fail

echo [6/8] Production build...
call npm run build
if errorlevel 1 goto :fail

echo [7/8] Commit: %MSG%
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "%MSG%"
  if errorlevel 1 goto :fail
) else (
  echo [INFO] Nothing new to commit.
)

echo [8/8] Push to GitHub...
git push -u origin main
if errorlevel 1 goto :fail

echo.
echo [OK] Code pushed to https://github.com/divangames/DEEPFORGE
echo [OK] GitHub Actions will update Pages automatically.
echo [OK] Game: https://divangames.github.io/DEEPFORGE/
start "" "https://divangames.github.io/DEEPFORGE/"
pause
exit /b 0

:fail
echo.
echo [ERROR] Publish stopped. No force-push was used.
pause
exit /b 1
