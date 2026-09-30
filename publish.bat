@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
if errorlevel 1 goto :fail

set "MSG=%~1"
if not defined MSG set "MSG=auto: DEEPFORGE update"

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git is not installed or not in PATH.
  goto :fail
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js / npm is not installed or not in PATH.
  goto :fail
)
if not exist "package.json" goto :wrong_folder
if not exist "client\package.json" goto :wrong_folder
if not exist "server\package.json" goto :wrong_folder
if not exist ".git" (
  echo [ERROR] This folder has no .git repository.
  echo Put publish.bat in your existing DEEPFORGE repository, not a new extracted folder.
  goto :fail
)

echo [1/8] Checking Git repository access...
call :ensure_git_access
if errorlevel 1 goto :fail

set "DF_BRANCH="
for /f "delims=" %%B in ('git branch --show-current') do set "DF_BRANCH=%%B"
if not "%DF_BRANCH%"=="main" (
  echo [ERROR] The current branch is not main. No branch was renamed or pushed.
  echo Finish any active Git operation and switch to main before publishing.
  goto :fail
)

git config --get user.name >nul 2>nul
if errorlevel 1 (
  git config --local user.name "divangames"
  if errorlevel 1 goto :fail
)
git config --get user.email >nul 2>nul
if errorlevel 1 (
  git config --local user.email "61680664+divangames@users.noreply.github.com"
  if errorlevel 1 goto :fail
)
git config --local core.autocrlf true
if errorlevel 1 goto :fail

git remote get-url origin >nul 2>nul
if errorlevel 1 (
  git remote add origin https://github.com/divangames/DEEPFORGE.git
  if errorlevel 1 goto :fail
) else (
  git remote set-url origin https://github.com/divangames/DEEPFORGE.git
  if errorlevel 1 goto :fail
)

echo [2/8] Syncing with GitHub...
git fetch origin main
if errorlevel 1 goto :fail
git rebase --autostash origin/main
if errorlevel 1 goto :sync_conflict
rem Autostash can report conflicts even when rebase itself has completed.
for /f "delims=" %%F in ('git diff --name-only --diff-filter^=U') do goto :sync_conflict

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

echo [7/8] Commit: "%MSG%"
git add -A
if errorlevel 1 goto :fail
git diff --cached --quiet
if errorlevel 2 goto :fail
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
echo [OK] Push accepted by GitHub.
echo [INFO] Check GitHub Actions for the build and Pages deployment result.
echo [INFO] Actions: https://github.com/divangames/DEEPFORGE/actions
echo [INFO] Game: https://divangames.github.io/DEEPFORGE/
start "" "https://github.com/divangames/DEEPFORGE/actions"
pause
exit /b 0

:ensure_git_access
rem This probe happens before local config, remotes, fetch or repository hooks.
set "DF_GIT_ERROR=%TEMP%\deepforge-git-access-%RANDOM%-%RANDOM%.log"
git rev-parse --is-inside-work-tree >nul 2>"%DF_GIT_ERROR%"
if not errorlevel 1 goto :git_access_ok

rem Do not treat every Git error as an ownership problem.
findstr /L /C:"dubious ownership" "%DF_GIT_ERROR%" >nul
if errorlevel 1 goto :git_access_failed

echo.
echo [WARN] Windows reports a different owner for this repository.
echo [INFO] Project folder: "%CD%"
echo [INFO] Only this exact folder will be added to your Git safe.directory list.
echo [INFO] Continue only if this is your trusted DEEPFORGE project.
choice /C YN /N /M "Trust this exact project folder and continue? [Y/N]: "
if errorlevel 2 goto :git_access_cancelled
if not errorlevel 1 goto :git_access_cancelled

rem Delayed expansion stays disabled so exclamation marks in paths are literal.
rem Forward slashes avoid shell-specific quoting copied from Git error messages.
git config --global --add safe.directory "%CD:\=/%"
if errorlevel 1 goto :git_trust_failed

git rev-parse --is-inside-work-tree >nul 2>"%DF_GIT_ERROR%"
if errorlevel 1 goto :git_access_failed
echo [OK] Access verified for this repository.

:git_access_ok
if exist "%DF_GIT_ERROR%" del /q "%DF_GIT_ERROR%" >nul 2>nul
exit /b 0

:git_access_failed
echo [ERROR] Git cannot access this repository. Details:
if exist "%DF_GIT_ERROR%" type "%DF_GIT_ERROR%"
if exist "%DF_GIT_ERROR%" del /q "%DF_GIT_ERROR%" >nul 2>nul
exit /b 1

:git_access_cancelled
echo [INFO] Cancelled. No trusted folder was added and nothing was pushed.
if exist "%DF_GIT_ERROR%" del /q "%DF_GIT_ERROR%" >nul 2>nul
exit /b 1

:git_trust_failed
echo [ERROR] Could not write the current user's global Git configuration.
echo Check access to your Git configuration file. No push was attempted.
if exist "%DF_GIT_ERROR%" del /q "%DF_GIT_ERROR%" >nul 2>nul
exit /b 1

:wrong_folder
echo [ERROR] Put this file next to package.json, client and server in DEEPFORGE.
goto :fail

:sync_conflict
echo [ERROR] Git sync has a conflict. Resolve it before publishing.
echo No forced reset, automatic conflict resolution or force-push was used.
goto :fail

:fail
echo.
echo [ERROR] Publish stopped. No force-push was used.
pause
exit /b 1
