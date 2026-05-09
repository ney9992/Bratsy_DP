---
plan: 02-01
phase: 02-upravlenie-pajplajnom
status: complete
started: 2026-05-09
completed: 2026-05-09
wave: 1
---

# SUMMARY — 02-01: Rust backend (ProcessMap, async run_stage, stop_stage)

## What Was Built

Полный Rust-слой управления процессами для pipeline control:

- **ProcessMap State** — `Arc<Mutex<HashMap<String, u32>>>` зарегистрирован через `.manage()` в `run()`. Хранит PID запущенных процессов (PID вместо Child для совместимости с Send).
- **async run_stage** — неблокирующий запуск PowerShell-процесса; немедленно эмитит `stage-status: running`, затем в `spawn_blocking` читает stdout построчно и эмитит `stage-log`, после завершения эмитит финальный `stage-status: done/error`.
- **stop_stage** — убивает процесс через `taskkill /F /PID` (PID из State), эмитит `stage-status: error` и лог `[остановлено пользователем]`.
- **use tauri::Emitter** — импортирован trait для `AppHandle::emit()` (Tauri v2 stable API).

## Security Mitigations Implemented

- **T-02-01**: allowlist-проверка stage ID (autocad/pdm/excel/plantsim/report)
- **T-02-02**: double-launch guard — проверка `map.contains_key(&stage)` перед запуском
- **T-02-03**: PID берётся только из собственного State, не из внешнего ввода

## Key Files

### Created / Modified
- `bratsy-tauri/src-tauri/src/lib.rs` — ProcessMap State, StageStatusPayload, StageLogPayload, async run_stage, stop_stage

## Self-Check: PASSED

- `cargo check` — завершился без ошибок
- `cargo build` — `Finished dev profile` без ошибок
- `lib.rs` содержит `pub struct ProcessMap`
- `lib.rs` содержит `async fn run_stage`
- `lib.rs` содержит `async fn stop_stage`
- `lib.rs` содержит `app_handle.emit("stage-status"`
- `lib.rs` содержит `app_handle.emit("stage-log"`
- `lib.rs` содержит `tauri::async_runtime::spawn_blocking`
- `run_full_pipeline` убран из `generate_handler!`

## Deviations

- `use tauri::Emitter` добавлен в imports (не было в плане явно) — Tauri v2 требует явный импорт trait для `.emit()`
- Cargo.toml не изменён — `features = ["unstable"]` не нужен, `emit()` доступен через `tauri::Emitter` без дополнительных features
