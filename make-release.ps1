# make-release.ps1
# Собирает Tauri-приложение и упаковывает в ZIP для передачи.
# Запуск: powershell -ExecutionPolicy Bypass -File make-release.ps1

Set-Location "$PSScriptRoot\bratsy-tauri"

# ── 1. Сборка ────────────────────────────────────────────────────
Write-Host ""
Write-Host "==> Сборка приложения..." -ForegroundColor Cyan
& ".\node_modules\.bin\tauri.cmd" build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Сборка завершилась с ошибкой." -ForegroundColor Red
    exit 1
}

# ── 2. Найти собранный установщик ───────────────────────────────
$bundleDir  = ".\src-tauri\target\release\bundle\nsis"
$setupFile  = Get-ChildItem $bundleDir -Filter "*-setup.exe" | Select-Object -First 1
if (-not $setupFile) {
    Write-Host "Установщик не найден в $bundleDir" -ForegroundColor Red
    exit 1
}

# Получаем версию из tauri.conf.json
$conf    = Get-Content ".\src-tauri\tauri.conf.json" | ConvertFrom-Json
$version = $conf.version

# ── 3. Собрать папку для архива ──────────────────────────────────
$releaseDir = "$PSScriptRoot\release"
$folderName = "Digital Factory v$version"
$outFolder  = "$releaseDir\$folderName"

if (Test-Path $releaseDir) { Remove-Item $releaseDir -Recurse -Force }
New-Item -ItemType Directory -Path $outFolder | Out-Null

# Установщик → setup.exe
Copy-Item $setupFile.FullName "$outFolder\setup.exe"

# README с инструкцией
@"
Цифровой завод — Digital Factory v$version
==========================================

Требования:
  - Windows 10 / 11 (64-bit)
  - Tecnomatix Plant Simulation (любая версия, установленная в C:\Program Files\Siemens\)

Установка:
  1. Запустите setup.exe
  2. При необходимости разрешите установку WebView2 (скачается автоматически ~2 МБ)
  3. Запустите «Digital Factory» из меню Пуск

Первый запуск:
  - Приложение автоматически найдёт Plant Simulation в стандартной директории Siemens
  - Если Plant Simulation установлен в нестандартное место — укажите путь
    к ярлыку (.lnk) вручную через шестерёнку (Настройки) в правом верхнем углу

Использование Plant Simulation:
  - Нажмите блок «Tecnomatix Plant Simulation» в шаге «Симуляция»
  - Выберите файл модели (.spp)
  - Введите имя SimTalk-метода (по умолчанию: .UserObjects.printed)
  - Метод должен записывать результаты в файл results.txt рядом с приложением

Поддержка: github.com/ney9992/Bratsy_DP
"@ | Set-Content "$outFolder\README.txt" -Encoding UTF8

# ── 4. Упаковать в ZIP ───────────────────────────────────────────
$zipName = "Digital_Factory_v${version}.zip"
$zipPath = "$releaseDir\$zipName"

Compress-Archive -Path $outFolder -DestinationPath $zipPath -Force

# ── 5. Архив исходников (git archive — без target/ и node_modules/) ──
Set-Location $PSScriptRoot
$srcZip = "$releaseDir\Digital_Factory_v${version}_source.zip"
git archive HEAD --format=zip --output="$srcZip"
if ($LASTEXITCODE -eq 0) {
    $srcMB = [math]::Round((Get-Item $srcZip).Length / 1MB, 1)
    Write-Host "==> Исходники: $srcZip ($srcMB МБ)" -ForegroundColor Green
}

# ── 6. Итог ──────────────────────────────────────────────────────
$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "==> Установщик: $zipPath ($sizeMB МБ)" -ForegroundColor Green
Write-Host ""
Write-Host "Содержимое архива установщика:" -ForegroundColor Yellow
Write-Host "  $zipName"
Write-Host "  └── $folderName\"
Write-Host "      ├── setup.exe"
Write-Host "      └── README.txt"
Write-Host ""
