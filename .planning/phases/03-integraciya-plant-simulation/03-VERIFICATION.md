---
phase: 03-integraciya-plant-simulation
verified: 2026-05-10T12:00:00Z
status: human_needed
score: 7/10 must-haves verified
overrides_applied: 0
re_verification: false

human_verification:
  - test: "Smoke-тест: запуск реальной симуляции через UI с mock-plantsim"
    expected: "Нажатие карточки Plant Simulation → диалог выбора .spp файла → ввод метода → запуск mock → появление панели с числами 87.3%, 42, 18.5"
    why_human: "Требует живого Tauri-окна, нативных Windows-диалогов (pick_file, prompt), реального запуска PowerShell-скрипта через WScript.Shell → Start-Process. Нельзя верифицировать grep-ом."

  - test: "Диалог ошибки конфигурации"
    expected: "Если ярлык .lnk не найден — появляется confirm() с кнопкой «Открыть настройки», нажатие открывает settings panel"
    why_human: "Зависит от runtime-поведения find_plantsim_shortcut (сканирование файловой системы), нативного confirm(), openSettings(). Нельзя проверить статически."

  - test: "Task 4 checkpoint из плана 03-02 не пройден"
    expected: "Пользователь подтверждает 4 проверки smoke-теста из плана"
    why_human: "В SUMMARY.md явно указано: 'Task 4 (checkpoint:human-verify) — НЕ выполнена (smoke-тест с mock-plantsim). Ожидает подтверждения от пользователя.'"
---

# Phase 3: Интеграция Plant Simulation — Verification Report

**Phase Goal:** Пользователь запускает реальную симуляцию Tecnomatix Plant Simulation через кнопку в UI и видит числовые результаты (загрузка линии, пропускная способность, время цикла) после её завершения.
**Verified:** 2026-05-10T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Важное предупреждение: архитектурное отклонение от планов

Реализация **существенно отличается** от планов 03-01 и 03-02, но при этом может достигать цели фазы альтернативным способом. Это не баг реализации — это эволюция дизайна, которая произошла в процессе выполнения. Детали ниже.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | mock-plantsim.ps1 существует и принимает аргументы /S macro.spm file.spp | VERIFIED | Файл существует в `bratsy-tauri/dev-tools/mock-plantsim.ps1`, param($S, $SppPath) объявлены |
| 2 | Скрипт записывает results.txt с тремя ключами load/throughput/cycle_time | VERIFIED | Строка 34: `"load=87.3\`nthroughput=42\`ncycle_time=18.5"` через WriteAllText UTF-8 |
| 3 | Скрипт завершается с exit code 0 после задержки | VERIFIED | Строка 40: `exit 0`; Start-Sleep -Seconds 1 дважды = ~2 сек |
| 4 | Пользователь может запустить PlantSim через кнопку в UI | VERIFIED | `stage-card[data-stage="plantsim"]` click → `runPlantSim()` (main.js:108) |
| 5 | После завершения симуляции появляется панель с тремя числами | VERIFIED | `listen('stage-results')` → `resLoad/resThroughput/resCycleTime.textContent` + `showResultsPanel(true)` |
| 6 | Числовые результаты парсятся из results.txt через key=value | VERIFIED | `run_plantsim()` в lib.rs строки 368-389: `split_once('=')`, три ключа, emit stage-results |
| 7 | При ошибке конфигурации показывается диалог с кнопкой "Открыть настройки" | VERIFIED | `showConfigError()` в main.js:274-279; catch в runPlantSim: `e.startsWith('config:')` |
| 8 | Settings struct содержит поля plant_sim_exe и plant_sim_macro | FAILED | Settings содержит `plant_sim_shortcut` вместо этих полей. plant_sim_exe/macro отсутствуют |
| 9 | В панели настроек есть поля inputPlantSimExe и inputPlantSimMacro | FAILED | В HTML только `inputPlantSimShortcut`. Поля inputPlantSimExe/Macro отсутствуют |
| 10 | run_stage('plantsim') валидирует пути и запускает PlantSim.exe | FAILED | run_stage исключает 'plantsim' из allowlist (строка 73). Вместо этого существует отдельная команда run_plantsim() |

**Score:** 7/10 truths verified

---

## Архитектурное отклонение: смена подхода к запуску PlantSim

**Что планировалось (план 03-01):**
- `run_stage('plantsim')` с валидацией путей к exe + macro + spp
- Command::new(plant_sim_exe) с аргументами ["/S", macro, spp]
- Поля `plant_sim_exe` и `plant_sim_macro` в Settings

**Что реализовано:**
- Отдельная команда `run_plantsim(lnk_path, spp_path, method)` через .lnk-ярлык
- Запуск через `Start-Process -FilePath lnk_path -Wait` (PowerShell)
- Поле `plant_sim_shortcut` в Settings вместо exe+macro
- `find_plantsim_shortcut()` — автопоиск .lnk-ярлыка
- `pick_file` диалог для выбора .spp прямо при запуске
- `prompt()` для ввода SimTalk-метода при каждом запуске

**Оценка отклонения:** Это **намеренная смена дизайна**, а не баг. Подход через .lnk-ярлык может быть более реалистичным для реального PlantSim.exe (который обычно запускается через ярлык, а не напрямую). Цель фазы при этом **потенциально достигается** — пользователь может запустить симуляцию и увидеть результаты.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bratsy-tauri/dev-tools/mock-plantsim.ps1` | Заглушка PlantSim.exe | VERIFIED | Существует, содержит load=87.3, throughput=42, cycle_time=18.5, exit 0 |
| `bratsy-tauri/src-tauri/src/lib.rs` | Settings с plant_sim_exe/macro | PARTIAL | Существует и содержит StageResultsPayload, run_plantsim, stage-results emit — но Settings не содержит plant_sim_exe/macro, содержит plant_sim_shortcut вместо |
| `bratsy-tauri/src/index.html` | resultsPanel + inputPlantSimExe/Macro | PARTIAL | #resultsPanel ПРИСУТСТВУЕТ с тремя карточками. inputPlantSimExe/Macro ОТСУТСТВУЮТ, вместо них inputPlantSimShortcut |
| `bratsy-tauri/src/main.js` | listen('stage-results') + showConfigError | VERIFIED | Оба присутствуют и полностью реализованы |
| `bratsy-tauri/src/styles.css` | .results-panel с max-height transition | VERIFIED | Строки 544-582: .results-panel, .results-panel.visible, max-height 0→160px |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| stage-card[plantsim] click | runPlantSim() | `else if (stage === 'plantsim')` в main.js:108 | WIRED | Клик вызывает runPlantSim(), не invoke('run_stage') |
| runPlantSim() | run_plantsim Rust | `invoke('run_plantsim', {...})` main.js:86 | WIRED | Вызывается с lnkPath, sppPath, method |
| run_plantsim → results.txt → stage-results | listen('stage-results') | lib.rs:368-389 + main.js:415-424 | WIRED | Полная цепочка: read_to_string → parse → emit → DOM update |
| catch(e) в runPlantSim | showConfigError() | `e.startsWith('config:')` main.js:90 | WIRED | find_plantsim_shortcut возвращает Err с префиксом "config:" |
| showResultsPanel(true) | #resultsPanel CSS visible | classList.add('visible') + .results-panel.visible max-height:160px | WIRED | CSS transition корректно настроена |
| btnSave | save_settings invoke | main.js:362-369 | PARTIAL | Сохраняет plant_sim_shortcut/path/work_dir/scripts_dir — НЕ plant_sim_exe/macro (т.к. их полей нет) |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| #resLoad | resLoad.textContent | stage-results event → run_plantsim → read_to_string(results.txt) | Да (при наличии results.txt) | FLOWING |
| #resThroughput | resThroughput.textContent | Та же цепочка | Да | FLOWING |
| #resCycleTime | resCycleTime.textContent | Та же цепочка | Да | FLOWING |
| results.txt | mock: WriteAllText | mock-plantsim.ps1 пишет реальные значения 87.3/42/18.5 | Да | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED для большинства поведений — требует живого Tauri-приложения с Windows GUI (нативные диалоги, Start-Process). Статические проверки ниже.

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| mock-plantsim.ps1 содержит exit 0 | grep "exit 0" | Строка 40: `exit 0` | PASS |
| results.txt контракт в mock | grep "load=87.3" | Строка 34 | PASS |
| stage-results event emit в lib.rs | grep "stage-results" | Строка 384: `app_clone.emit("stage-results", StageResultsPayload{...})` | PASS |
| listen('stage-results') в main.js | grep "listen.*stage-results" | Строка 415 | PASS |
| StageResultsPayload в lib.rs | grep "StageResultsPayload" | Строки 36-41 | PASS |
| find_plantsim_shortcut регистрирована | grep "invoke_handler" | Строка 451 | PASS |
| run_plantsim регистрирована | grep "invoke_handler" | Строка 452 | PASS |

---

## Requirements Coverage

| Requirement | Описание | Status | Evidence |
|-------------|----------|--------|----------|
| INT-01 | Пользователь может запустить симуляцию через кнопку в UI | SATISFIED | stage-card click → runPlantSim() → invoke('run_plantsim') → запуск через .lnk |
| INT-02 | Приложение получает результаты симуляции (загрузка, пропускная способность, время цикла) | SATISFIED (условно) | run_plantsim читает results.txt, парсит три ключа, эмитирует stage-results с f32 значениями |
| PIPE-04 | Результаты симуляции отображаются в UI после завершения этапа | SATISFIED | listen('stage-results') → DOM update #resLoad/#resThroughput/#resCycleTime → showResultsPanel(true) |

**Замечание по INT-02:** Требование помечено как "Pending" в REQUIREMENTS.md. Реализация технически корректна, но требует человеческой проверки полного flow (smoke-тест с mock или реальным PlantSim).

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/index.html` | 188 | `Last full pipeline run — today, 14:32` — хардкоженная дата | Info | Не влияет на Phase 3 goal |
| `src/index.html` | 55, 64 | `Drawings processed: 1,284`, `Throughput: 94.2%` — статические числа в metric-cards | Info | Верхняя панель метрик не подключена к данным — скоуп другой фазы |
| `src/main.js` | 389-391 | `runPipeline` заглушка с `console.info` | Info | Явно помечено как будет в Phase 3 |
| `src-tauri/src/lib.rs` | 73 | allowlist `["autocad", "pdm", "excel", "report"]` — комментарий говорит что plantsim использует run_plantsim | Info | Намеренное архитектурное решение, не баг |

Ни один из найденных анти-паттернов не является блокером для цели Phase 3.

---

## Отклонения от must_haves планов

### Plan 03-01 must_haves — ЧАСТИЧНО выполнены

Выполнены:
- StageResultsPayload объявлен с load/throughput/cycle_time f32 — VERIFIED
- stage-results событие эмитируется — VERIFIED
- results.txt парсится через split_once('=') — VERIFIED
- Ошибка конфигурации возвращает Err с префиксом "config:" — VERIFIED (find_plantsim_shortcut строка 282)
- Отсутствующий results.txt → warning в лог — VERIFIED (lib.rs строка 392-396)

НЕ выполнены как описано в плане:
- Settings struct НЕ содержит plant_sim_exe/plant_sim_macro — вместо этого plant_sim_shortcut
- run_stage('plantsim') НЕ валидирует три пути — вместо этого separate command run_plantsim
- Command::new(plant_sim_exe) НЕ существует — вместо этого PowerShell Start-Process через .lnk

### Plan 03-02 must_haves — ЧАСТИЧНО выполнены

Выполнены:
- #resultsPanel скрыта по умолчанию — VERIFIED
- После stage-results панель появляется с CSS transition — VERIFIED
- Три карточки с числами (#resLoad, #resThroughput, #resCycleTime) — VERIFIED
- Catch с e.startsWith('config:') → showConfigError() — VERIFIED
- Диалог предлагает openSettings() — VERIFIED
- showResultsPanel() и showConfigError() реализованы — VERIFIED

НЕ выполнены как описано в плане:
- Поля inputPlantSimExe и inputPlantSimMacro в панели настроек — ОТСУТСТВУЮТ
- Сохранение plant_sim_exe/plant_sim_macro в save_settings — ОТСУТСТВУЕТ
- Загрузка s.plant_sim_exe/s.plant_sim_macro при старте — ОТСУТСТВУЕТ
- Вместо этого: поле inputPlantSimShortcut (.lnk) и логика через find_plantsim_shortcut

---

## Human Verification Required

### 1. Smoke-тест полного happy path с mock-plantsim.ps1

**Test:** В запущенном `npm run tauri dev` (из bratsy-tauri/):
1. Нажать карточку Plant Simulation
2. В появившемся нативном диалоге выбрать любой .spp файл (или создать пустой)
3. В prompt ввести метод (например `.UserObjects.printed`)
4. Наблюдать запуск mock-plantsim.ps1 (если plant_sim_exe = powershell и lnk настроен)
5. После завершения — панель результатов должна появиться

**Expected:** Панель #resultsPanel становится видимой с числами (для mock: 87.3%, 42, 18.5)

**Why human:** Требует нативных Windows-диалогов, реального запуска powershell через WScript.Shell Start-Process, event-driven UI. Невозможно проверить статически.

**Примечание:** Интеграция через .lnk-ярлык требует либо реального PlantSim.exe, либо специального тестового ярлыка указывающего на mock-plantsim.ps1 через PowerShell. Это более сложный smoke-тест чем описан в плане 03-02.

### 2. Поведение run_plantsim при отсутствии results.txt

**Test:** Настроить ярлык на процесс который завершается без создания results.txt → run_plantsim
**Expected:** В лог-панели появляется строка "[warning] results.txt не найден — результаты недоступны", панель результатов не показывается
**Why human:** Зависит от реального поведения процесса и filesystem.

### 3. Task 4 checkpoint — явно не пройден

**Test:** Проверки 1-4 из плана 03-02 (Проверка настроек, Ошибка конфигурации, Happy path, Панель результатов)
**Expected:** Все 4 проверки проходят без краша
**Why human:** 03-02-SUMMARY.md явно документирует "Task 4 (checkpoint:human-verify) — НЕ выполнена. Ожидает подтверждения от пользователя."

---

## Gaps Summary

Три must-have из планов 03-01 и 03-02 не реализованы **в описанной форме**, однако реализация пошла по альтернативному, более сложному пути (через .lnk-ярлык вместо прямого вызова exe).

**Что это значит для цели фазы:**
- Цель фазы ("пользователь запускает симуляцию и видит числа") **потенциально достижима** через реализованный подход
- Но smoke-тест (Task 4 checkpoint) не был пройден человеком
- Поля настроек, описанные в планах (inputPlantSimExe, inputPlantSimMacro), заменены на inputPlantSimShortcut — что является намеренным архитектурным изменением

**Критичный вопрос для developer:** Является ли подход через .lnk-ярлык приемлемой заменой прямого вызова PlantSim.exe через exe+macro? Если да — необходимо пройти smoke-тест для закрытия фазы.

---

## Заключение

Фаза реализована по **существенно изменённой архитектуре** относительно планов. Реализация технически выглядит корректной и полной для нового подхода. Основная блокировка — непройденный smoke-тест (Task 4 checkpoint:human-verify), который сам автор SUMMARY явно отметил как "ожидает подтверждения пользователя".

Для закрытия фазы требуется:
1. Прохождение smoke-теста человеком (запуск через UI, проверка панели результатов)
2. Опционально: обновление REQUIREMENTS.md — пометить INT-01, INT-02, PIPE-04 как Done

---

_Verified: 2026-05-10T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
