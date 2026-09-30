@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
if errorlevel 1 goto :fail
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not in PATH.
  goto :fail
)
if not exist "scripts\deepforge-publish.cjs" (
  echo [ERROR] Missing scripts\deepforge-publish.cjs.
  echo Copy BOTH publish.bat and the scripts folder from the patch.
  goto :fail
)
node "scripts\deepforge-publish.cjs" "%~1"
if errorlevel 1 goto :fail
echo.
echo [OK] Open GitHub Actions and wait for the Pages deployment.
start "" "https://github.com/divangames/DEEPFORGE/actions"
pause
exit /b 0

:fail
echo.
echo [ERROR] Publish stopped. Read the message above.
echo Do not delete .git or your source files.
pause
exit /b 1
