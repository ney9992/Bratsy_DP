---
phase: 04-dannye-plant-simulation
plan: 01
subsystem: bratsy-tauri/src-tauri
completed: 2026-05-15
status: done
tags: [rust, plantsim, timeout, archive, validation]
dependency_graph:
  requires: []
  provides: [plantsim-pipeline-rust]
  affects: [bratsy-tauri/src-tauri/src/lib.rs]
tech_stack:
  added: []
  patterns: [mpsc-channel-timeout, days_to_ymd-no-chrono, taskkill-process-tree]
key_files:
  created: []
  modified:
    - bratsy-tauri/src-tauri/src/lib.rs
decisions:
  - D-03: валидация work_dir блокирует run_plantsim с Err("config: ...")
  - D-04: lnk_dir = PathBuf::from(&settings.work_dir) — results.txt из work_dir
  - D-05/D-12: архив work_dir/history/YYYY-MM-DD_HH-MM-SS.txt после успешного чтения
  - D-06: Arguments = -f "{spp}" /E {method} --workdir "{work_dir}" (без /E если метод пустой)
  - D-07: валидация spp_path (exists) блокирует run_plantsim с Err("config: ...")
  - D-09/D-10: таймаут через std::sync::mpsc::channel + recv_timeout + taskkill
  - D-11: stop_stage при plantsim дополнительно убивает PlantSimulation*.exe
metrics:
  duration: ~30 min
  completed: 2026-05-15
  tasks_total: 2
  tasks_completed: 2
  files_modified: 1
---

# Phase 04 Plan 01: Rust бэкенд Plant Simulation — финальная состыковка

**One-liner:** Полный сквозной Rust-пайплайн PlantSim: валидация путей, Arguments с spp/method/workdir, results.txt из work_dir, архив history/, таймаут через mpsc + taskkill, Stop с PlantSimulation*.exe kill.

## Выполнено

### Задача 1: Settings.sim_timeout_minutes + валидация D-03/D-07 + аргументы D-06

- `const APP_VERSION: &str = env!("CARGO_PKG_VERSION")` — константа версии для заголовков архива
- `sim_timeout_minutes: u32` добавлен в Settings struct с `#[serde(default)]` (D-09)
- Валидация `work_dir.is_empty()` перед WScript.Shell → `Err("config: Рабочий каталог...")` (D-03)
- Валидация `spp_path.is_empty() || !Path::exists()` → `Err("config: Файл модели .spp не найден...")` (D-07)
- Arguments ярлыка: `-f "{spp}" /E {method} --workdir "{work_dir}"` или без `/E` если метод пустой (D-06)
- Блок модификации ярлыка всегда выполняется (не только при наличии метода)

### Задача 2: Путь results.txt из work_dir, таймаут, архив, Stop с taskkill

- `lnk_dir = PathBuf::from(&settings.work_dir)` — results.txt читается из work_dir (D-04)
- Таймаут: `timeout_secs = if mins == 0 { 120 } else { mins * 60 }` (D-09)
- Реализация таймаута: `std::sync::mpsc::channel` + `std::thread::spawn` + `rx.recv_timeout` (D-10)
  - При таймауте: лог "Таймаут истёк — Plant Simulation принудительно завершён" + `taskkill /F /IM PlantSimulation*.exe /T`
- Архивирование после успешного чтения results.txt (D-05/D-12):
  - Директория `work_dir/history/` создаётся автоматически
  - Имя файла: `YYYY-MM-DD_HH-MM-SS.txt` (UTC, без chrono — через `days_to_ymd()`)
  - Заголовок: `# DP_orchestra run <timestamp>`, version, spp, method, work_dir
- `days_to_ymd(days: u64)` — helper функция для форматирования даты без chrono (алгоритм Howard Hinnant)
- `stop_stage` при `stage == "plantsim"`: дополнительный `taskkill /F /IM PlantSimulation*.exe /T` + лог (D-11)

## Файлы изменены

- `bratsy-tauri/src-tauri/src/lib.rs` — все изменения Phase 4 Plan 01

## Верификация

- `cargo build` завершается без ошибок и предупреждений
- `grep -n "recv_timeout"` → строка 471
- `grep -n "PlantSimulation\*.exe"` → строки 480, 583 (таймаут + stop_stage)
- `grep -n "history"` → строки 505, 506, 524 (history_dir, create_dir_all, archive_path)
- `grep -n "days_to_ymd"` → строки 515 (вызов), 607 (объявление)
- `grep -n "APP_VERSION" | grep -v const` → строка 528 (использование в заголовке архива)

## Deviations from Plan

**1. [Rule 1 - Bug] Исправлено предупреждение компилятора `unused_mut`**
- **Found during:** Task 2, cargo build
- **Issue:** `let mut child` объявлен как mutable, но `child` уже не вызывает `.wait()` напрямую — вместо этого передаётся в `child_for_wait`
- **Fix:** Изменено на `let child = ...`
- **Files modified:** bratsy-tauri/src-tauri/src/lib.rs
- **Commit:** c3a15a2 (auto-save)

## Known Stubs

None — все функции подключены к реальным данным.

## Threat Flags

None — все изменения укладываются в существующую threat model (T-4-01 — T-4-05).

## Self-Check: PASSED

- bratsy-tauri/src-tauri/src/lib.rs: существует, содержит все необходимые изменения
- cargo build: Finished без ошибок
- Все acceptance criteria Task 2 пройдены
