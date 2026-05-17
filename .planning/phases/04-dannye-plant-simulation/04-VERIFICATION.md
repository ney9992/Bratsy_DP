---
phase: 04-dannye-plant-simulation
verified: 2026-05-17T10:00:00Z
status: human_needed
score: 14/14 must-haves verified
overrides_applied: 0
re_verification: true

re_verification_meta:
  previous_status: gaps_found
  previous_score: 9/14
  gaps_closed:
    - "Панель настроек содержит поле inputSppPath — пользователь может задать путь к .spp файлу (index.html строка 233)"
    - "Панель настроек содержит поле inputWorkDir — пользователь может задать рабочий каталог (index.html строка 241, main.js строки 466 и 488)"
  gaps_remaining: []
  regressions: []

human_verification:
  - test: "Smoke-тест полного happy path: открыть настройки → задать путь к .spp и рабочий каталог через browse-кнопки → сохранить → запустить этап Plant Simulation в режиме «Реал» → дождаться завершения"
    expected: "Числа из results.txt появляются в панели ОТЧЁТ в динамических карточках reportGridDyn"
    why_human: "Требует реального Windows-окружения с PlantSim.exe или mock-plantsim.ps1, нативных диалогов выбора файлов (pick_file / pick_folder через Tauri), файловых событий"
  - test: "Диалог ошибки конфигурации: очистить spp_path в settings.json → запустить этап Plant Simulation → наблюдать диалог"
    expected: "confirm() с текстом «Файл модели .spp не найден...» + кнопка «Открыть настройки» открывает панель настроек"
    why_human: "Требует runtime-исполнения Rust-кода и нативного confirm() в Tauri WebView"
---

# Phase 4: Данные Plant Simulation — Verification Report (Re-verification)

**Phase Goal:** Сквозная отладка реального запуска: формат results.txt согласован с SimTalk-макросом, числа из реальной симуляции отображаются в UI → milestone v1 закрыт.
**Verified:** 2026-05-17T10:00:00Z
**Status:** human_needed
**Re-verification:** Да — после закрытия gap-ов планом 04-03

---

## Сравнение с предыдущей верификацией

| Показатель | Предыдущая (2026-05-15) | Текущая (2026-05-17) |
|-----------|------------------------|---------------------|
| Status | gaps_found | human_needed |
| Score | 9/14 | 14/14 |
| Blocker gaps | 2 | 0 |
| Human items | 2 (отложены до закрытия gaps) | 2 (активны) |

Оба блокирующих пробела закрыты планом 04-03. Все автоматически проверяемые истины подтверждены.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Arguments ярлыка содержит `-f "{spp_path}" /E {method} --workdir "{work_dir}"` | VERIFIED | lib.rs строки 388-392: `format!("-f \"{}\" /E {} --workdir \"{}\"", spp_escaped, trimmed_method, workdir_escaped)` — ветка с методом; строки 388-390: без метода `-f "{}" --workdir "{}"`. D-06 выполнен |
| 2 | results.txt читается из settings.work_dir (не из writable_dir) | VERIFIED | lib.rs строка 444: `let lnk_dir = PathBuf::from(&settings.work_dir)` — D-04 выполнен |
| 3 | work_dir пустой → run_plantsim возвращает Err("config: Рабочий каталог..."), ProcessMap очищается | VERIFIED | lib.rs строки 360-364: `if settings.work_dir.is_empty() { map.remove("plantsim"); return Err("config: ...") }` — D-03 выполнен |
| 4 | spp_path пустой или не существует → run_plantsim возвращает Err("config: ..."), ProcessMap очищается | VERIFIED | lib.rs строки 367-371: `if settings.spp_path.is_empty() \|\| !Path::new(&settings.spp_path).exists()` — D-07 выполнен |
| 5 | Таймаут истёк → taskkill /F /IM PlantSimulation*.exe /T + лог "Таймаут истёк" | VERIFIED | lib.rs строки 471-484: `rx.recv_timeout(Duration::from_secs(timeout_secs))` + Err-ветка с emit "Таймаут истёк" + taskkill — D-10 выполнен |
| 6 | Stop при plantsim → taskkill PowerShell PID + taskkill PlantSimulation*.exe + лог "Остановлено принудительно" | VERIFIED | lib.rs строки 580-589: `if stage == "plantsim" { taskkill /F /IM PlantSimulation*.exe /T + emit "Остановлено принудительно" }` — D-11 выполнен |
| 7 | После успешного чтения results.txt создаётся work_dir/history/YYYY-MM-DD_HH-MM-SS.txt с заголовком | VERIFIED | lib.rs строки 504-540: `history_dir = lnk_dir.join("history"); create_dir_all; header с APP_VERSION/spp/method/work_dir` — D-05/D-12 выполнен |
| 8 | Панель настроек содержит поле «Таймаут симуляции (мин)» с placeholder «2» | VERIFIED | index.html строки 222-228: `<input class="field-input" id="inputSimTimeout" type="number" min="1" max="999" placeholder="2">` — регрессия не обнаружена |
| 9 | showConfigError() при Err("config: ...") показывает диалог с кнопкой «Открыть настройки» | VERIFIED | main.js строки 439-447: `confirm(display + '\n\nОткрыть настройки?'); if confirmed → settingsOverlay.classList.add('open') + loadSettings()` — регрессия не обнаружена |
| 10 | Файл bratsy-tauri/docs/simtalk-template.md существует и содержит getCommandLineArg | VERIFIED | Файл существует: getCommandLineArg на строках 36 и 90, exitApplication три раза, Prohibit access в секции диагностики — регрессия не обнаружена |
| 11 | Панель настроек содержит поле inputSppPath — пользователь может задать путь к .spp | VERIFIED | index.html строка 233: `<input class="field-input" id="inputSppPath" type="text" readonly placeholder="Укажите путь к .spp файлу">` + строка 234: browse-btn data-type="file". GAP ЗАКРЫТ планом 04-03 |
| 12 | Панель настроек содержит поле inputWorkDir — пользователь может задать work_dir | VERIFIED | index.html строка 241: `<input class="field-input" id="inputWorkDir" type="text" readonly placeholder="Рабочий каталог...">` + строка 242: browse-btn data-type="folder". main.js строка 466: `set('inputWorkDir', s.work_dir)`. main.js строка 488: `work_dir: g('inputWorkDir')`. GAP ЗАКРЫТ планом 04-03 |
| 13 | invoke('run_plantsim') вызывается с { lnkPath, method } (без sppPath/workDir — Rust читает их сам) | VERIFIED | main.js строка 419: `await invoke('run_plantsim', { lnkPath, method })` — соответствует D-08. Регрессия не обнаружена |
| 14 | Числа из симуляции (stage-results) появляются в UI в динамических карточках reportGridDyn | VERIFIED (conditional — requires human smoke test) | main.js строки 120-138: `listen('stage-results')` → dom-карточки в reportGridDyn. Цепочка теперь не заблокирована: inputSppPath и inputWorkDir присутствуют в HTML. Фактический сквозной запуск требует human-тест |

**Score:** 14/14 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bratsy-tauri/src-tauri/src/lib.rs` | Все изменения Phase 4 (D-03/D-04/D-06/D-07/D-09/D-10/D-11/D-12) | VERIFIED | Все 8 изменений реализованы: APP_VERSION (строка 10), sim_timeout_minutes (строка 23), валидация work_dir/spp_path (строки 360-371), Arguments с spp/method/workdir (строки 388-395), lnk_dir из work_dir (строка 444), recv_timeout (строка 471), taskkill в таймауте и stop_stage (строки 480, 582-584), history архив (строки 504-540), days_to_ymd |
| `bratsy-tauri/src/index.html` | Поля inputSimTimeout, inputSppPath, inputWorkDir в секции PLANT SIMULATION | VERIFIED | inputSimTimeout (строки 222-228), inputSppPath (строки 230-236), inputWorkDir (строки 238-244) — все три поля присутствуют в секции PLANT SIMULATION до метки VAULT PDM API (строка 246) |
| `bratsy-tauri/src/main.js` | showConfigError(), inputSimTimeout/inputSppPath/inputWorkDir в loadSettings/btnSave, runReal plantsim с config: перехватом | VERIFIED | showConfigError (строки 439-447), loadSettings: set inputSppPath (465) + inputWorkDir (466) + inputSimTimeout (471), btnSave: spp_path (482) + work_dir (488) + sim_timeout_minutes (487), config: перехват (строки 411-425) |
| `bratsy-tauri/docs/simtalk-template.md` | SimTalk-шаблон с getCommandLineArg, exitApplication, Prohibit access | VERIFIED | Файл существует, содержит 3 варианта кода, полную диагностику, правильный порядок fi.close → exitApplication |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| run_plantsim | settings.work_dir | `lnk_dir = PathBuf::from(&settings.work_dir)` | WIRED | lib.rs строка 444 |
| run_plantsim | history/ | `std::fs::create_dir_all` | WIRED | lib.rs строка 506 |
| stop_stage | taskkill PlantSimulation*.exe | `Command::new("taskkill").args(["/F", "/IM", "PlantSimulation*.exe", "/T"])` | WIRED | lib.rs строки 582-584 |
| btnSave handler | inputSimTimeout | `parseInt(g('inputSimTimeout'), 10) \|\| 0` | WIRED | main.js строка 487 |
| runReal('plantsim') | run_plantsim Rust | `invoke('run_plantsim', { lnkPath, method })` | WIRED | main.js строка 419 |
| run_plantsim Err('config:...') | showConfigError() | `msg.startsWith('config:')` в catch | WIRED | main.js строки 412, 422 |
| stage-results event | reportGridDyn DOM | `listen('stage-results')` → `document.getElementById('reportGridDyn')` | WIRED | main.js строки 120-138 |
| btnSave | spp_path save | `spp_path: g('inputSppPath')` | WIRED | main.js строка 482 — g('inputSppPath') теперь возвращает реальное значение (элемент существует) |
| btnSave | work_dir save | `work_dir: g('inputWorkDir')` | WIRED | main.js строка 488 — добавлено планом 04-03 |
| loadSettings | inputWorkDir | `set('inputWorkDir', s.work_dir)` | WIRED | main.js строка 466 — добавлено планом 04-03 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| reportGridDyn карточки | entries из stage-results event | lib.rs: read_to_string(results.txt) → parse → emit stage-results | Да — если results.txt существует | FLOWING (условно — цепочка разблокирована, сквозной запуск требует human-тест) |
| inputSimTimeout | sim_timeout_minutes | get_settings() → s.sim_timeout_minutes | Да — поле сохраняется корректно | FLOWING |
| inputSppPath | spp_path | g('inputSppPath') в btnSave → save_settings → get_settings → run_plantsim | Да — элемент существует, readonly, выбирается через pick_file | FLOWING |
| inputWorkDir | work_dir | g('inputWorkDir') в btnSave → save_settings → get_settings → run_plantsim / lnk_dir | Да — элемент существует, readonly, выбирается через pick_folder | FLOWING |

---

## Behavioral Spot-Checks

| Поведение | Результат проверки | Status |
|-----------|-------------------|--------|
| APP_VERSION константа объявлена | lib.rs строка 10: `const APP_VERSION: &str = env!("CARGO_PKG_VERSION")` | PASS |
| sim_timeout_minutes в Settings struct | lib.rs строка 23: `pub sim_timeout_minutes: u32` с `#[serde(default)]` | PASS |
| recv_timeout в spawn_blocking | lib.rs строка 471: `rx.recv_timeout(std::time::Duration::from_secs(timeout_secs))` | PASS |
| PlantSimulation*.exe в taskkill | lib.rs строки 480 и 582: два вхождения | PASS |
| history в spawn_blocking | lib.rs строки 505, 506, 524 | PASS |
| days_to_ymd вызов | lib.rs строка 515 (вызов) | PASS |
| getCommandLineArg в simtalk-template.md | simtalk-template.md строки 36 и 90 | PASS |
| inputSimTimeout в index.html | index.html строка 225 | PASS |
| showConfigError в main.js | main.js строки 439-447 (объявление) + строки 412, 422 (вызовы) | PASS |
| inputSppPath в index.html | index.html строка 233: `id="inputSppPath"` + строка 234: browse-btn data-type="file" | PASS (ранее FAIL) |
| inputWorkDir в index.html | index.html строка 241: `id="inputWorkDir"` + строка 242: browse-btn data-type="folder" | PASS (ранее FAIL) |
| work_dir в loadSettings | main.js строка 466: `set('inputWorkDir', s.work_dir)` | PASS (ранее FAIL) |
| work_dir в btnSave | main.js строка 488: `work_dir: g('inputWorkDir')` | PASS (ранее FAIL) |

Step 7b: Поведенческие проверки выполнены статически — запуск Tauri-приложения не производился.

---

## Requirements Coverage

| Requirement | Source Plan | Описание | Status | Evidence |
|-------------|------------|----------|--------|----------|
| INT-01 | 04-01, 04-02, 04-03 | Пользователь может запустить симуляцию Plant Simulation через кнопку в UI | SATISFIED (needs human smoke test) | runReal → invoke run_plantsim реализован. Цепочка разблокирована: inputSppPath и inputWorkDir теперь присутствуют в HTML. Rust-валидации D-03/D-07 теперь достижимы (пользователь может задать пути через UI). Сквозной запуск требует human-тест |
| INT-02 | 04-01, 04-02 | Приложение получает результаты симуляции после завершения | SATISFIED (needs human smoke test) | stage-results listener (main.js строки 120-138) и парсинг results.txt (lib.rs строки 487-502) реализованы корректно. Цепочка разблокирована |
| INT-03 | 04-02, 04-03 | Путь к .spp файлу задаётся через панель настроек | SATISFIED | inputSppPath присутствует в index.html (строка 233), сохраняется в btnSave (строка 482), загружается в loadSettings (строка 465), browse-кнопка data-type="file" (строка 234) |
| PIPE-04 | 04-01 | Результаты симуляции отображаются в UI после завершения этапа | SATISFIED (needs human smoke test) | reportGridDyn и listen('stage-results') реализованы. Цепочка разблокирована — требует human-тест для подтверждения сквозного потока |

---

## Anti-Patterns Found

Blocker-паттерны, обнаруженные в предыдущей верификации, закрыты:

| File | Строка | Паттерн | Статус |
|------|--------|---------|--------|
| `bratsy-tauri/src/main.js` | 465 | `set('inputSppPath', ...)` — ранее ссылался на несуществующий HTML-элемент | CLOSED — элемент добавлен в index.html строка 233 |
| `bratsy-tauri/src/main.js` | 482 | `spp_path: g('inputSppPath')` — ранее возвращал '' | CLOSED — g('inputSppPath') теперь возвращает реальное значение |
| `bratsy-tauri/src/main.js` | 505 | browse-btn для inputSppPath мог бросать TypeError | CLOSED — элемент существует, document.getElementById вернёт не null |
| `bratsy-tauri/src/index.html` | — | Отсутствовало поле work_dir | CLOSED — inputWorkDir добавлен в index.html строка 241 |

Новых anti-pattern-ов в файлах, изменённых планом 04-03, не обнаружено.

---

## Human Verification Required

### 1. Smoke-тест полного happy path

**Test:**
1. Запустить приложение
2. Открыть настройки → нажать «…» рядом с «Путь к .spp файлу» → выбрать реальный .spp файл
3. Нажать «…» рядом с «Рабочий каталог» → выбрать папку, куда PlantSim пишет results.txt
4. Нажать «Сохранить»
5. Нажать кнопку запуска этапа Plant Simulation в режиме «Реал»
6. Дождаться завершения PlantSim

**Expected:** Числа из results.txt появляются в панели ОТЧЁТ в динамических карточках (rpt-card-dyn с ключами и значениями)

**Why human:** Требует реального Windows-окружения с PlantSim.exe или mock-plantsim.ps1, нативных диалогов выбора файлов (pick_file / pick_folder через Tauri), реального filesystem-события от PlantSim

### 2. Диалог ошибки конфигурации

**Test:**
1. Очистить spp_path в settings.json (или указать путь к несуществующему файлу) → сохранить
2. Нажать кнопку запуска этапа Plant Simulation

**Expected:** Появляется confirm()-диалог с текстом «Файл модели .spp не найден: '...'...» и вопросом «Открыть настройки?». При нажатии «ОК» открывается панель настроек с уже загруженными значениями.

**Why human:** Требует runtime-исполнения Rust-кода (run_plantsim) и нативного confirm() в Tauri WebView

---

## Итог ре-верификации

**Два блокирующих пробела закрыты планом 04-03:**

- Gap 1 (inputSppPath): добавлен в `bratsy-tauri/src/index.html` строки 230-236 — field-group с `id="inputSppPath"`, `type="text"`, `readonly`, browse-кнопкой `data-type="file"`. Существующие ссылки в main.js (строки 465, 482, 505) теперь работают корректно.

- Gap 2 (inputWorkDir): добавлен в `bratsy-tauri/src/index.html` строки 238-244 — field-group с `id="inputWorkDir"`, `type="text"`, `readonly`, browse-кнопкой `data-type="folder"`. В main.js добавлено `set('inputWorkDir', s.work_dir)` (строка 466) и `work_dir: g('inputWorkDir')` (строка 488).

**Все 14 автоматически проверяемых истин верифицированы.** Оставшиеся 2 пункта требуют human-проверки в реальном окружении с PlantSim — автоматически не верифицируемы по природе (нативные диалоги, filesystem-события, runtime Rust).

Rust-бэкенд, SimTalk-документация и фронтенд-форма настроек — все три компонента Phase 4 теперь полностью реализованы и взаимосвязаны.

---

_Verified: 2026-05-17T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after plan 04-03 gap closure_
