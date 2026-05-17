@echo off
cd /d "%~dp0"

cargo --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Rust is not installed. Download: https://rustup.rs
    pause
    exit /b 1
)

if not exist node_modules (
    echo [INFO] node_modules not found, running npm install...
    npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
)

npm run tauri dev
pause
