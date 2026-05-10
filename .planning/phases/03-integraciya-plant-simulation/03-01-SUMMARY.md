---
phase: 03-integraciya-plant-simulation
plan: "01"
subsystem: api
tags: [rust, tauri, process-spawn, plant-simulation, ipc, events]

requires:
  - phase: 02-upravlenie-pajplajnom
    provides: run_stage async fn, ProcessMap State, BufReader stdout streaming, stage-status/stage-log events
  - phase: 01-nastrojki-i-konfiguraciya
    provides: Settings struct, get_settings sync fn, settings.json persistence

provides:
  - "Settings struct с 5 полями: plant_sim_path, work_dir, scripts_dir, plant_sim_exe, plant_sim_macro"
  - "StageResultsPayload для события stage-results (load, throughput, cycle_time f32)"
  - "run_stage('plantsim'): валидация путей с prefix 'config:', Command::new(plant_sim_exe), чтение results.txt, emit stage-results"

affects: [03-02-frontend-results-panel, 03-03-settings-panel-extension]

tech-stack:
  added: []
  patterns:
    - "Path validation before ProcessMap sentinel — Pitfall #2 prevention pattern"
    - "Read settings before spawn_blocking — Pitfall #1 prevention pattern"
    - "stage-results event with numeric payload f32"
    - "config: error prefix for JS discrimination of config vs runtime errors (D-13 vs D-14)"

key-files:
  created: []
  modified:
    - bratsy-tauri/src-tauri/src/lib.rs

key-decisions:
  - "Валидация путей ДО sentinel insert (не после) — предотвращает блокировку stage при ошибке конфига (Pitfall #2)"
  - "get_settings() вызывается до spawn_blocking и передаётся через move-переменные (Pitfall #1)"
  - "Ошибки config: возвращают Err с префиксом для JS-различения типов ошибок (D-13)"
  - "Отсутствующий results.txt — warning в лог, не Err (D-08)"
  - "Command::new(plant_sim_exe) с args ['/S', macro, spp] — без PowerShell обёртки (D-04)"

patterns-established:
  - "Патерн валидации перед мутацией состояния: validate → reserve sentinel → spawn"
  - "Чтение sync-данных до spawn_blocking для передачи через move"

requirements-completed: [INT-01, INT-02]

duration: 25min
completed: 2026-05-10
---

# Phase 03 Plan 01: PlantSim Backend Integration Summary

**Rust run_stage расширен реальным запуском PlantSim.exe через Command::new с валидацией трёх путей и парсингом results.txt в событие stage-results**

## Performance

- **Duration:** ~25 мин
- **Started:** 2026-05-10T06:24:00Z
- **Completed:** 2026-05-10T06:49:09Z
- **Tasks:** 2 (Task 1 — из предыдущего сеанса, Task 2 — текущий)
- **Files modified:** 1

## Accomplishments

- Settings struct расширен до 5 полей: добавлены `plant_sim_exe` и `plant_sim_macro` с обратной совместимостью через `#[derive(Default)]`
- StageResultsPayload объявлен с load/throughput/cycle_time f32 для нового события `stage-results`
- run_stage("plantsim") получил три вставки: валидация путей с `"config:"` prefix ДО sentinel, реальный `Command::new(plant_sim_exe)` вместо PowerShell mock, чтение `work_dir/results.txt` с emit `stage-results` после `child.wait()`
- cargo check прошёл без ошибок (Finished dev profile)

## Task Commits

1. **Task 1: Расширить Settings struct и добавить StageResultsPayload** — `461d3d0` (feat) / `a9e71be` (merge)
2. **Task 2: Реализовать PlantSim-ветку в run_stage** — `a451804` (feat)

## Files Created/Modified

- `bratsy-tauri/src-tauri/src/lib.rs` — Settings расширен двумя полями; добавлен StageResultsPayload; run_stage получил plantsim-ветку с валидацией, запуском PlantSim.exe и парсингом results.txt

## Decisions Made

- Валидация трёх путей (`plant_sim_exe`, `plant_sim_path`, `plant_sim_macro`) через `std::path::Path::new().exists()` выполняется ДО `map.insert(stage.clone(), 0)` — исключает постоянную блокировку stage при ошибке конфигурации
- get_settings() вызывается дважды в async-части до spawn_blocking, результаты сохраняются в `let`-переменные и передаются через move — соответствует Pitfall #1 из RESEARCH.md
- `stage_is_plantsim` и `work_dir_for_results` объявлены до spawn_blocking для доступа внутри замыкания
- Ошибки путей содержат префикс `"config:"` — JS использует `e.startsWith('config:')` для показа диалога с кнопкой «Открыть настройки» вместо стандартного toast

## Deviations from Plan

None — план выполнен точно в соответствии с указаниями.

## Issues Encountered

- Рабочая директория инструментов Edit/Write указывала на основной репозиторий (`E:/Bratsy_DP/`), тогда как ворктри расположен в `E:/Bratsy_DP/.claude/worktrees/agent-a0bdb618e3148c1db/`. Изменения были сначала записаны в основной репозиторий, затем скопированы в ворктри через cp — файл идентичен, cargo check подтвердил корректность.

## Known Stubs

None — вся логика запуска PlantSim реализована. Панель результатов в UI (D-10, D-11, D-12) — скоуп следующих планов (03-02).

## Threat Flags

Угроз, не покрытых threat_model плана, не обнаружено. Все три trust boundary (JS→Rust invoke, Rust→filesystem, Rust→OS process) учтены в плане. Валидация путей (T-01-02) и allowlist (T-01-01) реализованы.

## Next Phase Readiness

- Rust backend готов к приёму stage-results на фронтенде — нужен `listen('stage-results')` в main.js
- Два новых поля Settings (plant_sim_exe, plant_sim_macro) нужно добавить в HTML панель настроек и JS save_settings (план 03-02 или 03-03)
- mock-plantsim.ps1 доступен в `bratsy-tauri/dev-tools/` для тестирования без реального PlantSim

---
*Phase: 03-integraciya-plant-simulation*
*Completed: 2026-05-10*
