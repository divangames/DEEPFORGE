@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo [DEEPFORGE] Repairing stale local Git history...

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git is not installed or not in PATH.
  pause
  exit /b 1
)

if not exist ".git" (
  echo [ERROR] No .git directory found.
  echo Run this file inside the same DEEPFORGE folder where push failed.
  pause
  exit /b 1
)

git config user.name "divangames"
git config user.email "61680664+divangames@users.noreply.github.com"
git remote get-url origin >nul 2>nul
if errorlevel 1 (
  git remote add origin https://github.com/divangames/DEEPFORGE.git
) else (
  git remote set-url origin https://github.com/divangames/DEEPFORGE.git
)

echo [1/5] Fetching current GitHub main...
git fetch origin main
if errorlevel 1 goto :fail

echo [2/5] Creating safety backup branch...
git branch -f stage2-local-backup HEAD
if errorlevel 1 goto :fail

echo [3/5] Moving branch base to origin/main while keeping Stage 2 files...
git reset --soft origin/main
if errorlevel 1 goto :fail

echo [4/5] Creating clean Stage 2 commit...
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "feat: stage 2 managers and automation"
  if errorlevel 1 goto :fail
) else (
  echo [INFO] No differences to commit. Stage 2 may already be synchronized.
)

echo [5/5] Pushing repaired main...
git push -u origin main
if errorlevel 1 goto :fail

echo.
echo [OK] Git history repaired. Stage 2 pushed successfully.
echo [OK] Backup branch: stage2-local-backup
echo [OK] Repo: https://github.com/divangames/DEEPFORGE
echo [OK] Game: https://divangames.github.io/DEEPFORGE/
start "" "https://divangames.github.io/DEEPFORGE/"
pause
exit /b 0

:fail
echo.
echo [ERROR] Repair stopped. No force-push was used.
echo Your Stage 2 commit is still preserved locally.
pause
exit /b 1
