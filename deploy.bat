@echo off
setlocal
cd /d "%~dp0"

echo [DEEPFORGE] Production build + проверки...
call build.bat
if errorlevel 1 exit /b 1

echo.
echo Готовые файлы клиента: client\dist
echo Готовые файлы API:     server\dist
echo.
echo Автоматическая отправка на VPS будет подключена после указания домена,
echo пути на сервере и способа деплоя. Этот файл специально не содержит
 echo чужих SSH-данных или паролей.
pause
