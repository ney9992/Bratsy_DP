---
status: partial
phase: 04-dannye-plant-simulation
source: [04-VERIFICATION.md]
started: 2026-05-17T10:00:00Z
updated: 2026-05-17T10:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Smoke-тест полного happy path

expected: Числа из results.txt появляются в панели ОТЧЁТ в динамических карточках reportGridDyn
result: [pending]

**Шаги:**
1. Открыть настройки → задать путь к .spp файлу через browse-кнопку «Путь к .spp файлу»
2. Задать рабочий каталог через browse-кнопку «Рабочий каталог»
3. Сохранить настройки
4. Запустить этап Plant Simulation в режиме «Реал»
5. Дождаться завершения симуляции

**Why human:** Требует реального Windows-окружения с PlantSim.exe или mock-plantsim.ps1, нативных диалогов выбора файлов, filesystem событий.

### 2. Диалог ошибки конфигурации

expected: confirm() с текстом «Файл модели .spp не найден...» + кнопка «Открыть настройки» открывает панель настроек
result: [pending]

**Шаги:**
1. Очистить spp_path в settings.json (или задать несуществующий путь)
2. Запустить этап Plant Simulation
3. Наблюдать диалог ошибки

**Why human:** Требует runtime-исполнения Rust-кода и нативного confirm() в Tauri WebView.

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
