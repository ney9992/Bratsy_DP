@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create_test.ps1"
if errorlevel 1 (
    echo.
    echo Oshibka PowerShell. Prochitayte soobshenie vyshe.
    pause
)
