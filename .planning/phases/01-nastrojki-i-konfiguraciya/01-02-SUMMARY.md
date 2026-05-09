---
phase: 01-nastrojki-i-konfiguraciya
plan: "02"
subsystem: ui
tags: [powershell, winforms, settings, json, file-dialog, validation]

# Dependency graph
requires:
  - phase: 01-nastrojki-i-konfiguraciya
    plan: "01"
    provides: "$settingsPanel с хедером, разделителями, кнопками Сохранить/Отмена и анимацией слайда"
provides:
  - "Три поля TextBox+Button (Plant Simulation .spp, рабочий каталог, папка скриптов) в $settingsPanel"
  - "Функция Add-SettingsField — переиспользуемый хелпер для полей с диалогами"
  - "Цвета ошибки $colErrorBg / $colErrorText в палитре"
  - "Валидация Test-Path при клике Сохранить — красный фон + метка 'Путь не найден'"
  - "Сохранение settings.json (PlantSimPath, WorkDir, ScriptsDir) в UTF-8"
  - "Загрузка settings.json при старте через $form.Add_Load"
affects:
  - "02-pipeline-control"
  - "03-plant-simulation"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Add-SettingsField helper — параметризованный хелпер для создания поля (метка + ReadOnly TextBox + кнопка ... + метка ошибки + диалог)"
    - "GetNewClosure() в обработчиках диалогов — захват переменных $tb/$errLbl из outer scope функции"
    - "Test-Path validation on Save — валидация только при Submit, пустые поля считаются валидными"
    - "ConvertTo-Json | Out-File -Encoding UTF8 — паттерн сохранения настроек"
    - "Get-Content -Raw | ConvertFrom-Json в $form.Add_Load — паттерн загрузки настроек при старте"

key-files:
  created: []
  modified:
    - "app/create_test.ps1"

key-decisions:
  - "Три поля с вертикальным шагом 84px (y=76, y=160, y=244) — помещаются в диапазон 56..500px панели"
  - "Add-SettingsField возвращает PSCustomObject с .TextBox и .ErrorLabel для доступа из $saveBtn.Add_Click"
  - "Пустые поля при сохранении считаются валидными — соответствует D-12"
  - "Corrupt settings.json при загрузке игнорируется через try/catch — соответствует T-02-04 (DoS mitigation)"
  - "Пути из settings.json записываются только в ReadOnly TextBox — не передаются в Invoke-Expression (T-02-03)"

patterns-established:
  - "Add-SettingsField: параметризованный хелпер поля путей для боковой панели"
  - "Validate-on-Save: Test-Path только при нажатии кнопки, не on-blur"
  - "settings.json в $PSScriptRoot: стандартное место хранения конфигурации приложения"

requirements-completed:
  - UI-02
  - INT-03

# Metrics
duration: 15min
completed: "2026-05-09"
---

# Phase 1 Plan 02: Валидация, сохранение и загрузка настроек — Summary

**Три ReadOnly TextBox+Button поля в $settingsPanel с OpenFileDialog(*.spp) / FolderBrowserDialog, Test-Path валидацией при Сохранить, записью settings.json UTF-8 и загрузкой через $form.Add_Load**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-09T13:06:00Z
- **Completed:** 2026-05-09T13:10:33Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Реализована функция `Add-SettingsField` — переиспользуемый хелпер для поля с меткой, ReadOnly TextBox, диалогом (OpenFileDialog или FolderBrowserDialog) и скрытой меткой ошибки
- Добавлены цвета ошибки `$colErrorBg` / `$colErrorText` в цветовую палитру
- Три поля настроек добавлены в `$settingsPanel`: Plant Simulation (.spp), рабочий каталог, папка скриптов
- Клик "Сохранить" валидирует непустые пути через `Test-Path`, выделяет невалидные красным фоном + меткой "Путь не найден", при успехе записывает `settings.json` и закрывает панель анимацией
- `$form.Add_Load` загружает `settings.json` при каждом запуске и заполняет TextBox'ы сохранёнными путями; повреждённый JSON игнорируется через try/catch

## Task Commits

Работа была зафиксирована через авто-сохранение:

1. **Task 1: Цвета ошибки + Add-SettingsField + три поля** - `cb937d4` / `0e1bd35` (feat)
2. **Task 2: $form.Add_Load (ConvertFrom-Json)** - `2e304a1` (feat)

Note: `$saveBtn.Add_Click` (ConvertTo-Json, валидация) был включён в коммиты Task 1 при авто-сохранении.

## Files Created/Modified
- `app/create_test.ps1` — добавлены: `$colErrorBg`/`$colErrorText`, функция `Add-SettingsField`, три поля `$fieldPlantSim`/`$fieldWorkDir`/`$fieldScripts`, `$saveBtn.Add_Click` с валидацией и сохранением, `$form.Add_Load` с загрузкой настроек

## Decisions Made
- `Add-SettingsField` возвращает `PSCustomObject @{ TextBox; ErrorLabel }` — обеспечивает доступ к обоим контролам из обработчика `$saveBtn.Add_Click`
- `GetNewClosure()` использован в обработчиках диалогов для захвата переменных `$tb` и `$errLbl` из outer scope функции-хелпера
- Шаг 84px между полями (22px метка + 24px TextBox + 16px ошибка + 22px отступ) — вписывается в диапазон 56..500px без перекрытия футера

## Deviations from Plan

None - план выполнен точно по спецификации. Все acceptance criteria Task 1 и Task 2 выполнены. Threat mitigations T-02-03 и T-02-04 реализованы согласно плану.

## Issues Encountered
None

## User Setup Required
None - никакой внешней конфигурации не требуется. Файл `settings.json` создаётся автоматически при первом сохранении настроек.

## Next Phase Readiness
- Phase 1 полностью завершена: панель настроек открывается/закрывается анимацией, три поля путей работают с диалогами, настройки сохраняются и загружаются при старте
- Phase 2 (pipeline control) может использовать `$tbPlantSimPath.Text`, `$tbWorkDir.Text`, `$tbScriptsDir.Text` для запуска этапов пайплайна
- `settings.json` с ключами `PlantSimPath`, `WorkDir`, `ScriptsDir` является контрактом для Phase 2 и Phase 3

---
*Phase: 01-nastrojki-i-konfiguraciya*
*Completed: 2026-05-09*
