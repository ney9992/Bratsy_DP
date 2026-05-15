---
phase: 04-dannye-plant-simulation
verified: 2026-05-15T12:00:00Z
status: gaps_found
score: 9/14 must-haves verified
overrides_applied: 0
re_verification: false

gaps:
  - truth: "Панель настроек содержит поле «Путь к .spp файлу» (inputSppPath) — пользователь может задать spp_path через UI"
    status: failed
    reason: "Поле inputSppPath упоминается в main.js (loadSettings строка 465, btnSave строка 481, browse-btn строка 503) — но в index.html соответствующий <input id=\"inputSppPath\"> отсутствует. g('inputSppPath') возвращает '' и перезаписывает spp_path при каждом сохранении. Пользователь не может задать путь к .spp через UI."
    artifacts:
      - path: "bratsy-tauri/src/index.html"
        issue: "Отсутствует field-group с input id=\"inputSppPath\" в секции PLANT SIMULATION"
      - path: "bratsy-tauri/src/main.js"
        issue: "Строки 465, 481, 503 ссылаются на inputSppPath — элемент не существует в HTML"
    missing:
      - "Добавить field-group с <input class=\"field-input\" id=\"inputSppPath\" type=\"text\" readonly placeholder=\"Укажите путь к .spp файлу\"> и browse-btn в секцию PLANT SIMULATION index.html"

  - truth: "Панель настроек содержит поле «Рабочий каталог» (inputWorkDir) — пользователь может задать work_dir через UI"
    status: failed
    reason: "Ни HTML-поля inputWorkDir, ни сохранения work_dir в btnSave нет. main.js не имеет ни одного упоминания work_dir или inputWorkDir. Пользователь не может задать рабочий каталог через UI — D-03 validation в Rust будет срабатывать всегда, симуляция никогда не запустится."
    artifacts:
      - path: "bratsy-tauri/src/index.html"
        issue: "Отсутствует field-group с input id=\"inputWorkDir\" в секции PLANT SIMULATION"
      - path: "bratsy-tauri/src/main.js"
        issue: "work_dir не сохраняется в btnSave handler (строки 474-491). Нет упоминания inputWorkDir."
    missing:
      - "Добавить field-group с <input class=\"field-input\" id=\"inputWorkDir\" type=\"text\" readonly placeholder=\"Рабочий каталог\"> и browse-btn (data-type=\"folder\") в секцию PLANT SIMULATION index.html"
      - "Добавить work_dir: g('inputWorkDir') в btnSave save_settings вызов"
      - "Добавить set('inputWorkDir', s.work_dir) в loadSettings"
---

# Phase 4: Данные Plant Simulation — Verification Report

**Phase Goal:** Сквозная отладка реального запуска: формат results.txt согласован с SimTalk-макросом, числа из реальной симуляции отображаются в UI → milestone v1 закрыт.
**Verified:** 2026-05-15T12:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Arguments ярлыка содержит `-f "{spp_path}" /E {method} --workdir "{work_dir}"` | VERIFIED | lib.rs строки 388-395: `format!("-f \"{}\" /E {} --workdir \"{}\"", spp_escaped, trimmed_method, workdir_escaped)` |
| 2 | results.txt читается из settings.work_dir (не из writable_dir) | VERIFIED | lib.rs строка 444: `let lnk_dir = PathBuf::from(&settings.work_dir)` — D-04 выполнен |
| 3 | work_dir пустой → run_plantsim возвращает Err("config: Рабочий каталог..."), ProcessMap очищается | VERIFIED | lib.rs строки 360-364: `if settings.work_dir.is_empty() { map.remove("plantsim"); return Err("config: ...") }` |
| 4 | spp_path пустой или не существует → run_plantsim возвращает Err("config: ..."), ProcessMap очищается | VERIFIED | lib.rs строки 367-371: `if settings.spp_path.is_empty() \|\| !Path::new(&settings.spp_path).exists()` |
| 5 | Таймаут истёк → taskkill /F /IM PlantSimulation*.exe /T + лог "Таймаут истёк" | VERIFIED | lib.rs строки 471-484: `rx.recv_timeout(Duration::from_secs(timeout_secs))` + Err ветка с emit "Таймаут истёк" + taskkill |
| 6 | Stop при plantsim → taskkill PowerShell PID + taskkill PlantSimulation*.exe + лог "Остановлено принудительно" | VERIFIED | lib.rs строки 581-589: `if stage == "plantsim" { taskkill /F /IM PlantSimulation*.exe /T + emit "Остановлено принудительно" }` |
| 7 | После успешного чтения results.txt создаётся work_dir/history/YYYY-MM-DD_HH-MM-SS.txt с заголовком | VERIFIED | lib.rs строки 504-540: `history_dir = lnk_dir.join("history"); create_dir_all; days_to_ymd; header с APP_VERSION/spp/method/work_dir` |
| 8 | Панель настроек содержит поле «Таймаут симуляции (мин)» с placeholder «2» | VERIFIED | index.html строки 222-228: `<input class="field-input" id="inputSimTimeout" type="number" min="1" max="999" placeholder="2">` |
| 9 | showConfigError() при Err("config: ...") показывает диалог с кнопкой «Открыть настройки» | VERIFIED | main.js строки 439-447: `confirm(display + '\n\nОткрыть настройки?'); if confirmed → settingsOverlay.classList.add('open') + loadSettings()` |
| 10 | Файл bratsy-tauri/docs/simtalk-template.md существует и содержит getCommandLineArg | VERIFIED | Файл существует: 3 варианта SimTalk-кода, getCommandLineArg встречается на строках 36 и 90, exitApplication 3 раза, Prohibit access в секции диагностики |
| 11 | Панель настроек содержит поле inputSppPath — пользователь может задать путь к .spp | FAILED | index.html не содержит ни одного вхождения "inputSppPath". g('inputSppPath') всегда возвращает '' |
| 12 | Панель настроек содержит поле inputWorkDir — пользователь может задать work_dir | FAILED | index.html и main.js не содержат ни одного вхождения inputWorkDir или work_dir в контексте сохранения настроек |
| 13 | invoke('run_plantsim') вызывается с { lnkPath, method } (без sppPath/workDir — Rust читает их сам) | VERIFIED | main.js строка 419: `await invoke('run_plantsim', { lnkPath, method })` — соответствует D-08 |
| 14 | Числа из симуляции (stage-results) появляются в UI в динамических карточках reportGridDyn | VERIFIED (conditional) | main.js строки 120-138: listen('stage-results') → dom-карточки в reportGridDyn. Но выполнение заблокировано gap-ами 11/12 — пользователь не может задать work_dir/spp_path через UI |

**Score:** 9/14 truths verified (11 и 12 — BLOCKER)

---

## Критические пробелы

### Gap 1: inputSppPath отсутствует в index.html

Поле для указания пути к .spp файлу (`inputSppPath`) присутствует в `main.js` в трёх местах:
- `loadSettings` строка 465: `set('inputSppPath', s.spp_path)`
- `btnSave` строка 481: `spp_path: g('inputSppPath')`
- browse-btn логика строка 503: `targetId === 'inputSppPath' ? 'Plant Simulation Model (*.spp)|*.spp|...'`

Но в `index.html` элемента с `id="inputSppPath"` нет. Это означает:
- `loadSettings` молча игнорирует присвоение (getElementById возвращает null)
- `g('inputSppPath')` всегда возвращает `''`
- При сохранении настроек через btnSave значение `spp_path` сбрасывается в пустую строку
- D-07 валидация в Rust гарантированно срабатывает, блокируя запуск

### Gap 2: inputWorkDir отсутствует в index.html И main.js

Поле рабочего каталога (`work_dir`) не существует нигде во фронтенде:
- В `index.html` нет элемента `inputWorkDir`
- В `main.js` нет упоминания `inputWorkDir` или `work_dir` (ни в loadSettings, ни в btnSave)
- Пользователь не может задать `work_dir` через UI
- D-03 валидация в Rust гарантированно срабатывает при каждом запуске
- SC-1 ("Arguments ярлыка содержат --workdir") и SC-2 ("числа из симуляции появляются в UI") не достижимы для пользователя

**Примечание о предыстории:** Phase 3 Verification Report (03-VERIFICATION.md строка 99) фиксировала что в тогдашней реализации `btnSave` сохранял `work_dir`. В текущей Tauri-реализации это поле исчезло — вероятно было потеряно при рефакторинге фронтенда между Phase 3 и Phase 4.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bratsy-tauri/src-tauri/src/lib.rs` | Все изменения Phase 4 (D-03/D-04/D-06/D-07/D-09/D-10/D-11/D-12) | VERIFIED | Все 8 изменений реализованы: sim_timeout_minutes, APP_VERSION, валидация work_dir/spp_path, Arguments с spp/method/workdir, lnk_dir из work_dir, recv_timeout, taskkill в таймауте и stop_stage, history архив, days_to_ymd |
| `bratsy-tauri/src/index.html` | Поле inputSimTimeout в PLANT SIMULATION + поля spp_path и work_dir | PARTIAL | inputSimTimeout присутствует (строки 222-228). inputSppPath и inputWorkDir — ОТСУТСТВУЮТ |
| `bratsy-tauri/src/main.js` | showConfigError(), inputSimTimeout в loadSettings/btnSave, runReal plantsim с config: перехватом | PARTIAL | showConfigError реализован (строки 439-447), inputSimTimeout обрабатывается (строки 470, 486), config: перехват работает (строки 411-425). Но g('inputSppPath') ссылается на несуществующий HTML-элемент, work_dir не сохраняется |
| `bratsy-tauri/docs/simtalk-template.md` | SimTalk-шаблон с getCommandLineArg, exitApplication, Prohibit access | VERIFIED | Файл существует, содержит 3 варианта кода, полную диагностику, правильный порядок fi.close → exitApplication |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| run_plantsim | settings.work_dir | `lnk_dir = PathBuf::from(&settings.work_dir)` | WIRED | lib.rs строка 444 |
| run_plantsim | history/ | `std::fs::create_dir_all` | WIRED | lib.rs строка 506 |
| stop_stage | taskkill PlantSimulation*.exe | `Command::new("taskkill").args(["/F", "/IM", "PlantSimulation*.exe", "/T"])` | WIRED | lib.rs строка 582-584 |
| btnSave handler | inputSimTimeout | `parseInt(g('inputSimTimeout'), 10) \|\| 0` | WIRED | main.js строка 486 |
| runReal('plantsim') | run_plantsim Rust | `invoke('run_plantsim', { lnkPath, method })` | WIRED | main.js строка 419 |
| run_plantsim Err('config:...') | showConfigError() | `msg.startsWith('config:')` в catch | WIRED | main.js строки 412, 422 |
| stage-results event | reportGridDyn DOM | `listen('stage-results')` → `document.getElementById('reportGridDyn')` | WIRED | main.js строки 120-138 |
| btnSave | spp_path save | `spp_path: g('inputSppPath')` | BROKEN | g('inputSppPath') возвращает '' — элемент не существует в HTML |
| btnSave | work_dir save | — | NOT_WIRED | work_dir не упоминается в btnSave вообще |
| loadSettings | inputWorkDir | — | NOT_WIRED | set('inputWorkDir', ...) не вызывается — поле не существует |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| reportGridDyn карточки | entries из stage-results event | lib.rs: read_to_string(results.txt) → parse → emit stage-results | Да — если results.txt существует | HOLLOW_PROP — данные не достигают из-за заблокированного запуска (work_dir всегда пустой) |
| inputSimTimeout | sim_timeout_minutes | get_settings() → s.sim_timeout_minutes | Да — поле сохраняется корректно | FLOWING |
| inputSppPath | spp_path | g('inputSppPath') в btnSave | Нет — элемент не существует в HTML | DISCONNECTED |
| inputWorkDir | work_dir | Нет соответствующего кода | Нет — поле не реализовано | DISCONNECTED |

---

## Behavioral Spot-Checks

| Поведение | Результат проверки | Status |
|-----------|-------------------|--------|
| APP_VERSION константа объявлена | lib.rs строка 10: `const APP_VERSION: &str = env!("CARGO_PKG_VERSION")` | PASS |
| sim_timeout_minutes в Settings struct | lib.rs строка 23: `pub sim_timeout_minutes: u32` с `#[serde(default)]` | PASS |
| recv_timeout в spawn_blocking | lib.rs строка 471: `rx.recv_timeout(std::time::Duration::from_secs(timeout_secs))` | PASS |
| PlantSimulation*.exe в taskkill | lib.rs строки 480 и 582: два вхождения | PASS |
| history в spawn_blocking | lib.rs строки 505, 506, 524 | PASS |
| days_to_ymd функция | lib.rs строки 515 (вызов), 607 (объявление) | PASS |
| getCommandLineArg в simtalk-template.md | simtalk-template.md строки 36 и 90 | PASS |
| inputSimTimeout в index.html | index.html строка 225 | PASS |
| showConfigError в main.js | main.js строки 439-447 (объявление) + строки 412, 422 (вызовы) | PASS |
| inputSppPath в index.html | Не найдено ни одного вхождения | FAIL |
| inputWorkDir в index.html | Не найдено ни одного вхождения | FAIL |
| work_dir в btnSave | Нет в main.js строки 474-491 | FAIL |

Step 7b: Поведенческие проверки выполнены статически — запуск Tauri-приложения не производился.

---

## Requirements Coverage

| Requirement | Source Plan | Описание | Status | Evidence |
|-------------|------------|----------|--------|----------|
| INT-01 | 04-01, 04-02 | Пользователь может запустить симуляцию Plant Simulation через кнопку в UI | BLOCKED | Технически wired (runReal → invoke run_plantsim), но заблокирован: work_dir нельзя задать через UI → D-03 validation всегда срабатывает |
| INT-02 | 04-01, 04-02 | Приложение получает результаты симуляции после завершения | BLOCKED | stage-results listener и парсинг results.txt реализованы корректно, но симуляция никогда не запустится без work_dir поля |
| INT-03 | 04-02 | Путь к .spp файлу задаётся через панель настроек | FAILED | inputSppPath отсутствует в index.html. Значение spp_path сбрасывается в '' при каждом сохранении настроек |
| PIPE-04 | 04-01 | Результаты симуляции отображаются в UI после завершения этапа | BLOCKED | reportGridDyn и listen('stage-results') реализованы — но вся цепочка заблокирована отсутствием work_dir и spp_path в UI |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `bratsy-tauri/src/main.js` | 465 | `set('inputSppPath', ...)` — ссылка на несуществующий HTML-элемент | Blocker | spp_path не загружается в UI |
| `bratsy-tauri/src/main.js` | 481 | `spp_path: g('inputSppPath')` — значение всегда '' | Blocker | spp_path сбрасывается при сохранении настроек |
| `bratsy-tauri/src/main.js` | 503 | browse-btn для inputSppPath — `document.getElementById(targetId).value = selected` бросит TypeError | Blocker | Клик «…» для .spp файла упадёт с ошибкой |
| `bratsy-tauri/src/index.html` | — | Отсутствует поле рабочего каталога (work_dir) | Blocker | Пользователь не может задать work_dir через UI — D-03 всегда срабатывает |

---

## Human Verification Required

(После закрытия gap-ов — эти проверки не могут быть выполнены статически)

### 1. Smoke-тест полного happy path

**Test:** После добавления полей inputSppPath и inputWorkDir:
1. Открыть настройки → задать путь к .spp и рабочий каталог → сохранить
2. Запустить этап Plant Simulation в режиме «Реал»
3. Наблюдать запуск PlantSim, ожидание, появление числовых результатов

**Expected:** Числа из results.txt появляются в панели ОТЧЁТ в динамических карточках

**Why human:** Требует реального Windows-окружения с PlantSim.exe или mock-plantsim.ps1, нативных диалогов выбора файлов, filesystem событий.

### 2. Диалог ошибки конфигурации

**Test:** Очистить spp_path в settings.json → запустить этап Plant Simulation → наблюдать диалог

**Expected:** confirm() с текстом "Файл модели .spp не найден..." + кнопка «Открыть настройки»

**Why human:** Требует runtime-исполнения Rust кода и нативного confirm().

---

## Gaps Summary

Найдено 2 блокирующих пробела с общим корнем — отсутствие HTML-полей для `spp_path` и `work_dir` в панели настроек.

**Корневая причина:** В процессе Phase 3/4 рефакторинга фронтенда поля `inputSppPath` и `inputWorkDir` не были добавлены в `index.html`. `main.js` содержит ссылки на `inputSppPath` (3 места), но HTML-элемента нет. `work_dir` не присутствует нигде в логике сохранения настроек.

**Последствие для milestone v1:** Без этих полей пользователь не может сконфигурировать `spp_path` и `work_dir` через UI → Rust-валидации D-03 и D-07 срабатывают при каждом запуске → симуляция никогда не запускается → числа из реальной симуляции не появляются в UI. ROADMAP Success Criteria 1 и 2 недостижимы.

**Rust-бэкенд (Plan 04-01) выполнен полностью** — все 8 изменений реализованы и проверены: APP_VERSION, sim_timeout_minutes, валидация work_dir/spp_path, полная строка Arguments, results.txt из work_dir, архив history/, recv_timeout таймаут, stop с taskkill.

**SimTalk-документация (Plan 04-02 Task 2) выполнена полностью** — simtalk-template.md содержит все 3 варианта кода, диагностику, правильный порядок fi.close/exitApplication.

**Фронтенд (Plan 04-02 Task 1) выполнен частично:** inputSimTimeout, showConfigError, config: перехват — реализованы. Поля inputSppPath и inputWorkDir — не реализованы.

---

_Verified: 2026-05-15T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
