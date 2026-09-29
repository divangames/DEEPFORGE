@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

set "REPO_URL=https://github.com/divangames/DEEPFORGE.git"
set "PAGE_URL=https://divangames.github.io/DEEPFORGE/"

REM Сообщение коммита задаём ДО любых скобочных блоков.
REM Это важно для cmd.exe: переменные вида %%VAR%% внутри блока раскрываются заранее.
set "MSG=%~1"
if not defined MSG set "MSG=auto: DEEPFORGE update"

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

REM Git identity задаём только для DEEPFORGE, глобальные настройки не меняем.
git config --local user.name >nul 2>nul
if errorlevel 1 (
  echo [GIT] Настраиваю имя автора: divangames
  git config --local user.name "divangames"
)

git config --local user.email >nul 2>nul
if errorlevel 1 (
  echo [GIT] Настраиваю GitHub noreply email...
  git config --local user.email "61680664+divangames@users.noreply.github.com"
)

REM На всякий случай приводим origin к нужному репозиторию.
git remote set-url origin "%REPO_URL%" >nul 2>nul

git add -A
if errorlevel 1 goto :error

git diff --cached --quiet
if not errorlevel 1 (
  echo [6/7] Изменений для нового коммита нет.
) else (
  echo [6/7] Commit: %MSG%
  git commit -m "%MSG%"
  if errorlevel 1 goto :error
)

echo [7/7] Push в GitHub...
git push -u origin main
if errorlevel 1 goto :error

echo.
echo [OK] Код отправлен: https://github.com/divangames/DEEPFORGE
echo [OK] GitHub Actions теперь должен обновить Pages.
echo [OK] Игра: %PAGE_URL%
echo.
echo Если это первый запуск Pages:
echo GitHub ^> Settings ^> Pages ^> Source ^> GitHub Actions
echo.
start "" "%PAGE_URL%"
pause
exit /b 0

:error
echo.
echo [DEEPFORGE] Публикация остановлена из-за ошибки.
echo Ничего после ошибочного шага не отправлялось.
pause
exit /b 1
