@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
if errorlevel 1 goto :failed

set "DF_TMP=%TEMP%\deepforge-workflow-%RANDOM%-%RANDOM%"
set "DF_GH="
set "DF_ACCOUNT="
set "DF_BRANCH="
set "DF_COMMIT="
set "DF_PUSH_URL="

where git.exe >nul 2>nul
if errorlevel 1 goto :no_git
if not exist ".git" goto :wrong_folder
if not exist "package.json" goto :wrong_folder
if not exist "client\package.json" goto :wrong_folder
if not exist "server\package.json" goto :wrong_folder

echo [1/5] Checking the existing DEEPFORGE repository...
git rev-parse --is-inside-work-tree >nul
if errorlevel 1 goto :access_failed
git rev-parse --verify HEAD >"%DF_TMP%.commit"
if errorlevel 1 goto :failed
set /p "DF_COMMIT="<"%DF_TMP%.commit"
git branch --show-current >"%DF_TMP%.branch"
if errorlevel 1 goto :failed
set /p "DF_BRANCH="<"%DF_TMP%.branch"
if not "%DF_BRANCH%"=="main" goto :wrong_branch
for /f "delims=" %%F in ('git diff --name-only --diff-filter^=U') do goto :unfinished_git
for /f "delims=" %%F in ('git rev-parse --git-path MERGE_HEAD') do if exist "%%F" goto :unfinished_git
for /f "delims=" %%F in ('git rev-parse --git-path rebase-merge') do if exist "%%F" goto :unfinished_git
for /f "delims=" %%F in ('git rev-parse --git-path rebase-apply') do if exist "%%F" goto :unfinished_git

rem Validate every configured push URL; never redirect a remote silently.
git remote get-url --push --all origin >"%DF_TMP%.remote"
if errorlevel 1 goto :wrong_remote
set /p "DF_PUSH_URL="<"%DF_TMP%.remote"
if not defined DF_PUSH_URL goto :wrong_remote
for /f "usebackq delims=" %%U in ("%DF_TMP%.remote") do if not "%%U"=="https://github.com/divangames/DEEPFORGE.git" if not "%%U"=="https://github.com/divangames/DEEPFORGE" goto :wrong_remote

echo [INFO] Repository: divangames/DEEPFORGE
echo [INFO] This helper pushes the existing commit only: %DF_COMMIT%
echo [INFO] No source files will be staged, rebuilt, reverted or deleted.
echo [INFO] Uncommitted files are NOT part of this retry.
echo.

rem Environment tokens override the browser credentials used by gh.
rem Never print, copy, or silently replace an inherited token.
if defined GH_TOKEN goto :env_token
if defined GITHUB_TOKEN goto :env_token

echo [2/5] Finding GitHub CLI...
call :find_gh
if defined DF_GH goto :gh_ready
where winget.exe >nul 2>nul
if errorlevel 1 goto :install_manually
choice /C YN /N /M "Install official GitHub CLI using WinGet? [Y/N]: "
if errorlevel 2 goto :cancelled
if not errorlevel 1 goto :cancelled
winget install --id GitHub.cli --exact --source winget
if errorlevel 1 goto :install_manually
call :find_gh
if not defined DF_GH goto :restart_terminal

:gh_ready
rem The installer may not update PATH in an already-open terminal.
for %%G in ("%DF_GH%") do set "PATH=%%~dpG;%PATH%"
"%DF_GH%" --version
if errorlevel 1 goto :failed

echo.
echo [3/5] Authorizing workflow access in the browser...
echo [INFO] Sign in as divangames and review the requested permissions.
echo [INFO] Approve only the one-time device code shown by this command.
echo [INFO] Do not paste tokens, passwords, or device codes into chat.
"%DF_GH%" auth login --hostname github.com --git-protocol https --web --scopes workflow
if errorlevel 1 goto :auth_failed

"%DF_GH%" api --hostname github.com user --jq .login >"%DF_TMP%.account"
if errorlevel 1 goto :auth_failed
set /p "DF_ACCOUNT="<"%DF_TMP%.account"
if /I not "%DF_ACCOUNT%"=="divangames" goto :wrong_account

rem Response headers contain granted scope names, not the authorization token.
"%DF_GH%" api --hostname github.com --include user >"%DF_TMP%.headers"
if errorlevel 1 goto :auth_failed
findstr /I /B /C:"X-OAuth-Scopes:" "%DF_TMP%.headers" >"%DF_TMP%.scopes"
if errorlevel 1 goto :scope_failed
findstr /I /C:"workflow" "%DF_TMP%.scopes" >nul
if errorlevel 1 goto :scope_failed
echo [OK] Account divangames has the workflow scope.

echo.
echo [4/5] Configuring Git to use the authorized GitHub CLI...
echo [INFO] This changes the GitHub.com credential helper for this Windows user.
echo [INFO] Other hosts are not configured. Existing Git history is unchanged.
choice /C YN /N /M "Use GitHub CLI for GitHub.com and retry this push? [Y/N]: "
if errorlevel 2 goto :cancelled
if not errorlevel 1 goto :cancelled
"%DF_GH%" auth setup-git --hostname github.com
if errorlevel 1 goto :auth_failed

rem Explicit command-level helpers prevent an old local helper from winning.
rem Fetch only: no rebase, reset, merge, pull, checkout, or conflict resolution.
git -c credential.helper= -c "credential.helper=!gh auth git-credential" fetch https://github.com/divangames/DEEPFORGE.git main
if errorlevel 1 goto :failed
git merge-base --is-ancestor FETCH_HEAD %DF_COMMIT%
if errorlevel 1 goto :remote_changed

echo [5/5] Retrying the existing commit with normal push...
git -c credential.helper= -c "credential.helper=!gh auth git-credential" push -u origin %DF_COMMIT%:refs/heads/main
if errorlevel 1 goto :push_failed

echo.
echo [OK] GitHub accepted the push.
echo [INFO] Deployment is a separate step. Check the Actions result.
echo [INFO] Actions: https://github.com/divangames/DEEPFORGE/actions
echo [INFO] Game: https://divangames.github.io/DEEPFORGE/
start "" "https://github.com/divangames/DEEPFORGE/actions"
call :cleanup
pause
exit /b 0

:find_gh
set "DF_GH="
for /f "delims=" %%G in ('where gh.exe 2^>nul') do if not defined DF_GH set "DF_GH=%%G"
if defined DF_GH exit /b 0
if exist "%ProgramFiles%\GitHub CLI\gh.exe" set "DF_GH=%ProgramFiles%\GitHub CLI\gh.exe"
if defined DF_GH exit /b 0
if exist "%LOCALAPPDATA%\Programs\GitHub CLI\gh.exe" set "DF_GH=%LOCALAPPDATA%\Programs\GitHub CLI\gh.exe"
if defined DF_GH exit /b 0
if exist "%ProgramW6432%\GitHub CLI\gh.exe" set "DF_GH=%ProgramW6432%\GitHub CLI\gh.exe"
exit /b 0

:wrong_folder
echo [ERROR] Put this BAT beside package.json, client, server and .git.
goto :failed
:no_git
echo [ERROR] Git is not available in PATH.
goto :failed
:access_failed
echo [ERROR] Repository access failed. Run the ownership-fixed publish.bat first.
goto :failed
:wrong_branch
echo [ERROR] Expected branch main. No branch was renamed.
goto :failed
:wrong_remote
echo [ERROR] Expected HTTPS origin pointing only to divangames/DEEPFORGE.
echo [INFO] No remote URL was changed by this helper.
goto :failed
:unfinished_git
echo [ERROR] An unfinished merge or rebase must be resolved first.
goto :failed
:env_token
echo [ERROR] GH_TOKEN or GITHUB_TOKEN is set in this terminal.
echo [INFO] Browser login cannot update that environment token.
echo [INFO] Open a terminal without that override, then run this helper again.
echo [INFO] No token value has been displayed or changed.
goto :failed
:install_manually
echo [ERROR] GitHub CLI installation did not complete, or WinGet is unavailable.
echo [INFO] Install GitHub CLI from its official Windows installer:
echo https://github.com/cli/cli/releases/latest
echo [INFO] Then close all terminal windows and start this BAT again.
goto :failed
:restart_terminal
echo [INFO] Installation completed but gh.exe is not visible in this terminal.
echo [INFO] Close all terminal windows, then start this BAT again.
goto :failed
:wrong_account
echo [ERROR] The active GitHub account is not divangames.
echo [INFO] Run this helper again and authorize the correct account.
goto :failed
:scope_failed
echo [ERROR] The workflow permission could not be verified.
echo [INFO] No push was attempted. Review the permission request and retry.
goto :failed
:auth_failed
echo [ERROR] Authorization or credential configuration did not complete.
goto :failed
:remote_changed
echo [ERROR] Remote main is not an ancestor of the local commit.
echo [INFO] Synchronize and resolve any conflicts using publish.bat first.
echo [INFO] This helper does not rewrite local or remote history.
goto :failed
:push_failed
echo [ERROR] GitHub did not accept the push. Keep the error text above.
goto :failed
:cancelled
echo [INFO] Cancelled. This helper did not push anything.
call :cleanup
pause
exit /b 1
:failed
echo.
echo [ERROR] Stopped. No force-push, reset, or automatic commit was used.
call :cleanup
pause
exit /b 1
:cleanup
if not defined DF_TMP exit /b 0
for %%E in (commit branch remote account headers scopes) do if exist "%DF_TMP%.%%E" del /q "%DF_TMP%.%%E" >nul 2>nul
exit /b 0
