# Phase 3: Интеграция Plant Simulation — Research

**Researched:** 2026-05-10
**Domain:** Tauri v2 (Rust) — запуск внешнего процесса, чтение файла результатов, Tauri-события, HTML/CSS панель результатов, расширение Settings struct
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Запуск Plant Simulation**
- D-01: Метод запуска — прямой вызов exe: `"<plant_sim_exe>" /S:"<plant_sim_macro>" "<plant_sim_path>"`. Не через COM, не через PowerShell-обёртку.
- D-02: Путь к PlantSimulation.exe — хранится в настройках (новое 4-е поле).
- D-03: Путь к .spm макросу — хранится в настройках (новое 5-е поле). Итого 3 поля, связанных с PlantSim.
- D-04: Rust запускает через `Command::new(&plant_sim_exe).args(["/S", &plant_sim_macro, &plant_sim_path])` — аналогично паттерну Phase 2, без PowerShell.
- D-05: Stdout PlantSim стримится в `stage-log` (существующий механизм). Stderr — `Stdio::null()`.

**Источник результатов**
- D-06: SimTalk-макрос пишет результаты в `work_dir/results.txt`.
- D-07: Формат: `key=value` построчно (`load=87.3`, `throughput=42`, `cycle_time=18.5`). Парсинг — только `std::fs` + split, новых crate не добавлять.
- D-08: Rust читает results.txt после `child.wait()` в `spawn_blocking`. Если файл отсутствует — пустая панель + warning в лог.
- D-09: Rust эмитит событие `stage-results` с payload `{ stage: "plantsim", load: f32, throughput: f32, cycle_time: f32 }`.

**Отображение результатов**
- D-10: Новая панель результатов под `.stages` (аналогично `#logPanel`). CSS height transition (0 → auto / max-height).
- D-11: 3 карточки с большими числами: Загрузка линии (%), Пропускная способность (ед./ч), Время цикла (сек). Стиль — `.metric-card`.
- D-12: Панель скрыта по умолчанию. Показывается только при получении `stage-results`.

**Обработка ошибок**
- D-13: Ошибки конфигурации (exe/spp/spm не найден) → диалог с описанием + кнопка «Открыть настройки». Проверяется в Rust через `Path::exists()` до запуска.
- D-14: Ошибки выполнения → существующий механизм Phase 2: `stage-status: error` + toast.
- D-15: Диалог ошибки — JS-нативный `alert()` или кастомный modal; кнопка открывает `openSettings()`.

### Claude's Discretion
- Точные CSS-размеры панели результатов — аналогично log-panel, в стиле существующей схемы.
- Поведение при повторном запуске PlantSim — обновить числа или скрыть и показать снова.
- Имена ключей в results.txt — главное соответствие Rust-парсеру.

### Deferred Ideas (OUT OF SCOPE)
- Реальные PowerShell-скрипты для AutoCAD, Vault PDM, Excel.
- История запусков.
- Запуск полного пайплайна одной кнопкой.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INT-01 | Пользователь может запустить симуляцию Tecnomatix Plant Simulation через кнопку в UI | D-04: `Command::new` паттерн из `run_stage`; `plantsim` stage-card уже есть в HTML |
| INT-02 | Приложение получает результаты симуляции (загрузка линии, пропускная способность, время цикла) | D-07/D-08: чтение `results.txt` после `child.wait()`; D-09: `stage-results` событие |
| PIPE-04 | Результаты симуляции Plant Simulation отображаются в UI после завершения | D-10/D-11/D-12: новая `.results-panel` + 3 `.metric-card`; JS `listen('stage-results')` |
</phase_requirements>

---

## Summary

Phase 3 надстраивается над полностью готовой инфраструктурой Phases 1–2: Tauri v2.11.1, `run_stage` / `stop_stage` с `ProcessMap State`, события `stage-status` / `stage-log`, `Settings` struct, панель настроек, `.log-panel` CSS-паттерн. Все ключевые механизмы уже работают.

Три изменения в этой фазе: (1) расширить `Settings` struct двумя новыми полями и добавить 2 поля в панель настроек; (2) заменить mock-скрипт в `run_stage("plantsim")` на реальный запуск PlantSim.exe и добавить чтение `results.txt` с эмитом `stage-results`; (3) добавить панель результатов в HTML/CSS/JS.

Все задействованные паттерны уже верифицированы в коде. Новый код минимален и симметричен существующим решениям.

**Primary recommendation:** Максимально копировать существующие паттерны — `Command::new` из `run_stage`, `.log-panel` CSS для панели результатов, `.metric-card` для карточек, `listen()` для нового события.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Запуск PlantSim.exe | Rust (API/Backend) | — | Process spawn происходит только в Rust; JS не имеет доступа к ОС |
| Валидация путей до запуска | Rust (API/Backend) | JS (отображение ошибки) | `Path::exists()` в Rust, диалог ошибки в JS |
| Стриминг лога stdout | Rust (API/Backend) | — | `BufReader::lines()` в `spawn_blocking`; JS только слушает `stage-log` |
| Чтение results.txt | Rust (API/Backend) | — | После `child.wait()` в `spawn_blocking`, до финального `stage-status` |
| Парсинг key=value | Rust (API/Backend) | — | `std::fs::read_to_string` + `split('=')`, никаких новых crate |
| Эмит `stage-results` | Rust (API/Backend) | — | `app_handle.emit("stage-results", ...)` |
| Отображение панели результатов | JS Frontend | CSS | `listen('stage-results')` → show panel, fill cards |
| 2 новых поля в панели настроек | JS Frontend + HTML | Rust (Settings struct) | JS собирает значения, `save_settings` их сохраняет |
| Диалог ошибки конфигурации | JS Frontend | Rust (возвращает Err) | `run_stage` возвращает `Err(String)`, JS ловит в `invoke().catch()` |

---

## Standard Stack

### Core (всё уже в проекте)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tauri | 2.11.1 | Desktop app runtime; IPC Rust↔JS | [VERIFIED: Cargo.lock] |
| serde / serde_json | 1.x | Сериализация Settings, Payload | [VERIFIED: Cargo.toml] |
| std::process::Command | stdlib | Запуск PlantSim.exe | [VERIFIED: lib.rs строки 90-100] |
| std::fs | stdlib | Чтение results.txt | [ASSUMED] — стандарт Rust |
| std::io::BufReader | stdlib | Построчный stdout | [VERIFIED: lib.rs строки 5, 116] |
| tauri::async_runtime::spawn_blocking | Tauri 2 | Блокирующий I/O в async-контексте | [VERIFIED: lib.rs строка 113] |

### Новые зависимости Phase 3
Новых crate не требуется — все необходимые инструменты уже в `std` и Tauri. [VERIFIED: D-07 в CONTEXT.md]

### Installation
```
# Никаких новых зависимостей в Cargo.toml не добавляется
```

---

## Architecture Patterns

### System Architecture Diagram

```
Пользователь кликает stage-card[plantsim]
         │
         ▼
   JS: invoke('run_stage', { stage: 'plantsim' })
         │
         ▼
   Rust: run_stage("plantsim")
         │
         ├─► Path::exists() checks (plant_sim_exe, plant_sim_path, plant_sim_macro)
         │        │
         │        └─ FAIL ──► Err("config: ...") ──► JS catch ──► showConfigError() ──► alert + openSettings()
         │
         ├─► ProcessMap: insert("plantsim", 0) [sentinel]
         │
         ├─► emit("stage-status", { stage, status: "running" })
         │
         ├─► Command::new(plant_sim_exe).args(["/S", macro, spp]).stdout(piped).stderr(null).spawn()
         │        │
         │        └─ FAIL ──► ProcessMap.remove; Err → JS toast "ошибка"
         │
         ├─► ProcessMap: insert("plantsim", real_pid)
         │
         └─► spawn_blocking:
                  │
                  ├─ BufReader::lines(stdout) ──► emit("stage-log", line) [×N]
                  │
                  ├─ child.wait() → ExitStatus
                  │
                  ├─ fs::read_to_string(work_dir/results.txt)
                  │        ├─ OK  ──► parse key=value ──► emit("stage-results", { load, throughput, cycle_time })
                  │        └─ ERR ──► emit("stage-log", "[warning] results.txt не найден")
                  │
                  ├─ ProcessMap.remove("plantsim")
                  │
                  └─ emit("stage-status", { stage, status: "done"|"error" })
                              │
                              ▼
                    JS: listen('stage-status') ──► updatePill + toast
                    JS: listen('stage-results') ──► showResultsPanel + fillMetricCards
```

### Recommended Project Structure (без изменений)
```
bratsy-tauri/
├── src/
│   ├── index.html   # + .results-panel HTML, 2 новых field-group в settings
│   ├── main.js      # + listen('stage-results'), showResultsPanel(), showConfigError()
│   └── styles.css   # + .results-panel, .results-panel.visible
└── src-tauri/src/
    └── lib.rs       # + plant_sim_exe/macro в Settings; run_stage("plantsim") реальная логика;
                     #   StageResultsPayload; новая команда run_plantsim или модификация run_stage
```

### Pattern 1: Расширение Settings struct

**What:** Добавить 2 новых поля к существующей структуре `Settings`. serde автоматически обработает JSON-сериализацию; старый `settings.json` без новых ключей вернёт пустую строку (Default).

**When to use:** Всегда при добавлении настраиваемого параметра.

```rust
// Source: lib.rs (VERIFIED — строки 10-15, расширить по паттерну)
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Settings {
    pub plant_sim_path: String,
    pub work_dir: String,
    pub scripts_dir: String,
    // Phase 3: новые поля
    pub plant_sim_exe: String,
    pub plant_sim_macro: String,
}
```

**Важно:** `#[serde(default)]` не нужен — уже есть `#[derive(Default)]` на уровне struct + `serde_json::from_str().unwrap_or_default()` в `get_settings()`. Старый `settings.json` без новых полей не вызовет паники — вернёт пустые строки. [VERIFIED: lib.rs строки 43-48]

### Pattern 2: Валидация путей до запуска (D-13)

**What:** До `Command::spawn()` проверить три пути через `std::path::Path::exists()`. Если хоть один не существует — вернуть `Err(String)` с описанием проблемы.

**When to use:** Только для `run_stage("plantsim")`. Другие stages используют mock-скрипты без реальных файлов.

```rust
// Source: pattern from CONTEXT.md D-13 + std::path (ASSUMED — стандарт Rust)
use std::path::Path;

// В начале run_stage, после allowlist-проверки:
let settings = get_settings(); // или передать через State
if !Path::new(&settings.plant_sim_exe).exists() {
    return Err("config: PlantSimulation.exe не найден".into());
}
if !Path::new(&settings.plant_sim_path).exists() {
    return Err("config: файл .spp не найден".into());
}
if !Path::new(&settings.plant_sim_macro).exists() {
    return Err("config: файл .spm не найден".into());
}
```

**Важно:** Префикс `"config:"` в сообщении ошибки позволяет JS отличить ошибку конфигурации от ошибки выполнения и показать нужный диалог.

### Pattern 3: Запуск PlantSim и чтение results.txt

**What:** Вместо mock-скрипта — реальный `Command::new` для PlantSim.exe. После `child.wait()` — читаем `results.txt`.

```rust
// Source: lib.rs строки 90-147 (VERIFIED) — адаптировать для plantsim

// Вместо mock powershell:
let mut child = Command::new(&plant_sim_exe)
    .args(["/S", &plant_sim_macro, &plant_sim_path])
    .stdout(Stdio::piped())
    .stderr(Stdio::null())   // CR-01: prevents deadlock
    .spawn()
    .map_err(|e| { /* sentinel cleanup */ e.to_string() })?;

// ... spawn_blocking с BufReader (без изменений) ...

// После child.wait():
let results_path = std::path::Path::new(&work_dir).join("results.txt");
match std::fs::read_to_string(&results_path) {
    Ok(content) => {
        let mut load = 0f32;
        let mut throughput = 0f32;
        let mut cycle_time = 0f32;
        for line in content.lines() {
            if let Some((k, v)) = line.split_once('=') {
                match k.trim() {
                    "load"       => load       = v.trim().parse().unwrap_or(0.0),
                    "throughput" => throughput = v.trim().parse().unwrap_or(0.0),
                    "cycle_time" => cycle_time = v.trim().parse().unwrap_or(0.0),
                    _ => {}
                }
            }
        }
        let _ = app_clone.emit("stage-results", StageResultsPayload {
            stage: "plantsim".into(),
            load,
            throughput,
            cycle_time,
        });
    }
    Err(_) => {
        let _ = app_clone.emit("stage-log", StageLogPayload {
            stage: stage_clone.clone(),
            line: "[warning] results.txt не найден — результаты недоступны".into(),
        });
    }
}
```

### Pattern 4: Новый Payload для stage-results

```rust
// Source: паттерн из lib.rs строки 23-32 (VERIFIED)
#[derive(Serialize, Clone)]
pub struct StageResultsPayload {
    pub stage: String,
    pub load: f32,
    pub throughput: f32,
    pub cycle_time: f32,
}
```

### Pattern 5: Панель результатов — HTML

**What:** Новый `<div>` под `.stages`, перед `<!-- Footer -->`. Аналогично `#logPanel`. [VERIFIED: index.html строки 136-143]

```html
<!-- Results panel (Phase 3) -->
<div class="results-panel" id="resultsPanel">
  <div class="results-header">
    <span class="results-title">Результаты симуляции</span>
  </div>
  <div class="results-body">
    <div class="metric-card results-metric">
      <div class="metric-info">
        <div class="metric-label">Загрузка линии</div>
        <div class="metric-value" id="resLoad">—</div>
        <div class="metric-unit">%</div>
      </div>
      <div class="metric-icon" style="background:#EDF7F0"><!-- SVG --></div>
    </div>
    <div class="metric-card results-metric">
      <div class="metric-info">
        <div class="metric-label">Пропускная способность</div>
        <div class="metric-value" id="resThroughput">—</div>
        <div class="metric-unit">ед./ч</div>
      </div>
      <div class="metric-icon" style="background:#EBF4FF"><!-- SVG --></div>
    </div>
    <div class="metric-card results-metric">
      <div class="metric-info">
        <div class="metric-label">Время цикла</div>
        <div class="metric-value" id="resCycleTime">—</div>
        <div class="metric-unit">сек</div>
      </div>
      <div class="metric-icon" style="background:#F5F5F7"><!-- SVG --></div>
    </div>
  </div>
</div>
```

### Pattern 6: CSS панели результатов

**What:** Повторить `.log-panel` / `.log-panel.visible` паттерн с `max-height` transition. [VERIFIED: styles.css строки 418-433]

```css
/* Source: styles.css строки 418-433 (VERIFIED) — адаптация для results-panel */
.results-panel {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.35s ease;
  margin: 0 24px;
  border-radius: 14px;
  margin-bottom: 0;
}

.results-panel.visible {
  max-height: 140px;   /* подбирается под высоту 3 карточек в ряд */
  opacity: 1;
  margin-bottom: 12px;
}

.results-header {
  padding: 8px 16px 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-sec);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.results-body {
  display: flex;
  gap: 12px;
  padding: 0 0 12px;
}

.results-metric {
  flex: 1;
}

.metric-unit {
  font-size: 11px;
  color: var(--text-sec);
  margin-top: 2px;
}
```

### Pattern 7: JS — listen('stage-results')

```javascript
// Source: main.js строки 310-327 (VERIFIED) — добавить новый listen

// В DOMContentLoaded, после существующих listen('stage-status') и listen('stage-log'):
await listen('stage-results', (event) => {
  const { stage, load, throughput, cycle_time } = event.payload;
  if (stage !== 'plantsim') return;

  document.getElementById('resLoad').textContent = load.toFixed(1);
  document.getElementById('resThroughput').textContent = throughput.toFixed(0);
  document.getElementById('resCycleTime').textContent = cycle_time.toFixed(1);

  showResultsPanel(true);
});
```

### Pattern 8: Диалог ошибки конфигурации (D-15)

```javascript
// Source: main.js строки 44-70 (VERIFIED) — добавить catch-логику

// В обработчике клика stage-card, в блоке catch invoke('run_stage'):
} catch (e) {
  if (typeof e === 'string' && e.startsWith('config:')) {
    // Ошибка конфигурации — диалог с кнопкой
    showConfigError(e.replace('config: ', ''));
  } else {
    // Ошибка выполнения — стандартный toast
    failedAttempts++;
    updatePill(stage, 'error');
    showToast(STAGE_LABELS[stage] || stage, 'error');
  }
}

function showConfigError(message) {
  // D-15: alert() с предложением открыть настройки
  // Простейший вариант: confirm()
  const goSettings = confirm(
    `Ошибка конфигурации Plant Simulation:\n${message}\n\nОткрыть настройки?`
  );
  if (goSettings) openSettings();
}
```

**Альтернатива:** кастомный modal-div поверх overlay — если `confirm()` не устраивает визуально. Решение отдаётся на усмотрение (Claude's Discretion).

### Pattern 9: 2 новых поля в HTML панели настроек

**What:** По паттерну существующих `.field-group` в index.html (строки 164-189). Добавить после третьего существующего поля.

```html
<!-- Source: index.html строки 164-189 (VERIFIED) — копировать паттерн -->
<div class="field-group">
  <label class="field-label">Путь к PlantSimulation.exe</label>
  <div class="field-row">
    <input class="field-input" id="inputPlantSimExe" type="text" readonly placeholder="Не задан">
    <button class="browse-btn" data-target="inputPlantSimExe" data-type="file">…</button>
  </div>
  <div class="field-error" id="errPlantSimExe">Путь не найден</div>
</div>

<div class="field-group">
  <label class="field-label">Путь к макросу SimTalk (.spm)</label>
  <div class="field-row">
    <input class="field-input" id="inputPlantSimMacro" type="text" readonly placeholder="Не задан">
    <button class="browse-btn" data-target="inputPlantSimMacro" data-type="file">…</button>
  </div>
  <div class="field-error" id="errPlantSimMacro">Путь не найден</div>
</div>
```

### Anti-Patterns to Avoid

- **Добавлять новый `#[tauri::command]` `run_plantsim` вместо модификации `run_stage`:** Дублирует логику ProcessMap и event-эмиттинга. Правильно — добавить ветку `if stage == "plantsim"` внутри существующего `run_stage` или вынести читаемый `plant_sim_exe` через `get_settings()`.
- **Читать settings внутри `spawn_blocking` через новый invoke:** `spawn_blocking` — синхронный контекст, там нельзя использовать async. Нужно прочитать settings до `spawn_blocking` и передать как `move`-переменные.
- **`height: auto` в CSS transition:** `transition: height 0 → auto` не работает в CSS. Используется `max-height` с большим верхним значением — как уже сделано в `.log-panel`. [VERIFIED: styles.css строка 421]
- **Вызов `get_settings()` в async `run_stage` через `invoke()`:** `get_settings` — уже таури-команда, доступна напрямую как Rust-функция. Вызывать как `get_settings()` напрямую или передавать Settings через State.
- **Парсить results.txt с regex или serde_json:** Контракт D-07 — plain `key=value`, `split_once('=')` достаточно. Не усложнять.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Запуск процесса | Собственный process manager | `std::process::Command` + ProcessMap (уже есть) | Уже реализовано в Phase 2, проверено |
| Стриминг stdout | Polling или WebSocket | `BufReader::lines()` в `spawn_blocking` (уже есть) | Уже реализовано, deadlock-safe (CR-01) |
| CSS reveal-анимация | JS-таймер изменения высоты | `max-height` transition + `.visible` класс (паттерн log-panel) | Декларативно, плавно, нет JS-таймеров |
| Диалог конфигурации | Кастомное окно Tauri | `confirm()` / `alert()` (D-15) | Нет зависимостей, достаточно для MVP |

**Key insight:** Вся сложная инфраструктура (ProcessMap, Tauri events, BufReader streaming) уже написана и отлажена в Phase 2. Phase 3 добавляет только специфику PlantSim поверх готового каркаса.

---

## Common Pitfalls

### Pitfall 1: Settings недоступны внутри spawn_blocking

**What goes wrong:** `spawn_blocking` — это `FnOnce + Send + 'static` замыкание. Таури State не реализует `Send` в нужном контексте; `get_settings()` — async Tauri-команда, не вызывается из sync-контекста.

**Why it happens:** `spawn_blocking` принимает синхронное замыкание. Async-вызовы там невозможны без `block_on`, который вызовет панику в Tokio-контексте.

**How to avoid:** Прочитать settings в async-части `run_stage` ДО `spawn_blocking`, передать как `move`-переменные:
```rust
let settings = get_settings(); // sync вызов — get_settings() не помечена async!
let plant_sim_exe = settings.plant_sim_exe.clone();
let work_dir = settings.work_dir.clone();
// ... затем spawn_blocking(move || { use plant_sim_exe, work_dir })
```
**Важно:** `get_settings()` в lib.rs помечена `fn`, а не `async fn` [VERIFIED: lib.rs строка 42] — её можно вызвать напрямую из любого контекста.

**Warning signs:** Ошибка компилятора «closure may outlive the current function» или «cannot borrow».

### Pitfall 2: Sentinel в ProcessMap не убирается при ошибке валидации

**What goes wrong:** Если Path::exists() проверка произошла после `map.insert(stage, 0)` (sentinel), но Err возвращается — sentinel остаётся в map, stage блокируется навсегда.

**Why it happens:** Порядок операций в run_stage: reserve → validate → spawn. Если validate провалится после reserve, нужен cleanup.

**How to avoid:** Два варианта: (a) делать валидацию ДО reserve sentinel, (b) при ранней возврате Err убирать sentinel. Вариант (a) предпочтительнее:
```rust
// ПРАВИЛЬНЫЙ порядок:
// 1. Validate paths (до любого state mutation)
// 2. Reserve sentinel  
// 3. Spawn process
```

**Warning signs:** Повторный клик на PlantSim после ошибки конфигурации возвращает "already running".

### Pitfall 3: results.txt не успевает записаться

**What goes wrong:** PlantSim завершает процесс, но SimTalk-макрос не успел сбросить буфер файла. `read_to_string` читает пустой файл.

**Why it happens:** Некоторые версии Plant Simulation выходят до полной записи stdout/файла. Маловероятно если макрос явно закрывает файл, но возможно.

**How to avoid:** В SimTalk-макросе: явно закрыть файловый стрим перед завершением. В Rust: если файл пуст — лог warning (D-08), не hard error. Пустая панель лучше, чем сбой.

**Warning signs:** Панель результатов не появляется при успешном завершении; в логе появляется warning про results.txt.

### Pitfall 4: PlantSim пишет в stdout мусор или ничего

**What goes wrong:** PlantSim.exe может не писать ничего в stdout (GUI-приложение). `BufReader::lines()` зависнет или сразу вернёт EOF.

**Why it happens:** GUI-приложения на Windows часто не используют stdout. Весь вывод идёт в GUI.

**How to avoid:** Это нормальное поведение. `BufReader::lines()` вернёт EOF сразу — лог-панель будет пустой, это не ошибка. Результаты приходят из results.txt, а не stdout. [ASSUMED — поведение конкретной версии PlantSim неизвестно до тестирования]

**Warning signs:** Лог-панель пуста при запуске PlantSim — это нормально, не баг.

### Pitfall 5: /S флаг PlantSim — порядок аргументов

**What goes wrong:** `PlantSimulation.exe /S:"macro.spm" "file.spp"` — порядок аргументов может отличаться в разных версиях Plant Simulation.

**Why it happens:** Технически точный синтаксис CLI Plant Simulation зависит от версии и лицензии.

**How to avoid:** [ASSUMED] Стандартный вариант по D-01: `args(["/S", &plant_sim_macro, &plant_sim_path])`. При тестировании проверить в реальной заводской среде. Если нужно `/S:"path"` с кавычками в одном аргументе — передавать как `format!("/S:{}", plant_sim_macro)`.

**Warning signs:** PlantSim открывается, но игнорирует макрос; или вылетает с exit code 1.

---

## Code Examples

Verified patterns from existing code:

### Чтение settings в sync-контексте (из run_stage)
```rust
// Source: lib.rs строка 42 (VERIFIED — get_settings — не async)
fn get_settings() -> Settings {
    let path = settings_path();
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}
// Вызов внутри async run_stage:
let settings = get_settings(); // OK — sync fn в async fn
```

### Emit события (из lib.rs)
```rust
// Source: lib.rs строки 78-81 (VERIFIED)
let _ = app_handle.emit("stage-status", StageStatusPayload {
    stage: stage.clone(),
    status: "running".to_string(),
});
```

### Показать панель через JS
```javascript
// Source: main.js строки 132-138 (VERIFIED — showLogPanel паттерн)
function showResultsPanel(visible) {
  const panel = document.getElementById('resultsPanel');
  if (visible) panel.classList.add('visible');
  else panel.classList.remove('visible');
}
```

### Валидация Save при добавлении новых полей
```javascript
// Source: main.js строки 257-289 (VERIFIED — save settings pattern)
// Добавить inputPlantSimExe и inputPlantSimMacro в массив валидации:
[[plantSim, 'inputPlantSim', 'errPlantSim'],
 [workDir,  'inputWorkDir',  'errWorkDir'],
 [scripts,  'inputScripts',  'errScripts'],
 [plantSimExe,    'inputPlantSimExe',    'errPlantSimExe'],    // новое
 [plantSimMacro,  'inputPlantSimMacro',  'errPlantSimMacro']]  // новое
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PlantSim пишет stdout как обычное консольное приложение (или ничего) | Common Pitfalls #4 | Если пишет, BufReader захватит; если нет — лог пуст, не ошибка. Риск низкий. |
| A2 | Синтаксис `/S:"macro.spm" "file.spp"` — правильный порядок аргументов для PlantSim | Common Pitfalls #5 | Нужна проверка на реальной заводской установке. Средний риск — если неверно, запуск молча игнорирует макрос. |
| A3 | `std::path::Path::new(path).exists()` корректно работает с Windows-путями в Rust | Architecture | Стандарт Rust на Windows. Риск крайне низкий. |

---

## Open Questions

1. **Точный CLI-синтаксис запуска PlantSim**
   - Что знаем: D-01 даёт общую форму `exe /S:"macro" "file.spp"`
   - Что неясно: точный формат `/S` — один аргумент `/S:"macro"` или два `/S` + `"macro"`. Зависит от версии PlantSim.
   - Рекомендация: в плане предусмотреть задачу «проверить запуск с реальными файлами» как отдельный тест после реализации.

2. **Поведение панели результатов при повторном запуске PlantSim**
   - Что знаем: Claude's Discretion — обновлять или скрыть/показать.
   - Рекомендация: обновить числа на месте (без скрытия) — это проще и ожидаемо. При повторном `stage-results` просто перезаписать значения в `#resLoad` etc.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust / Cargo | Компиляция lib.rs | Не в PATH bash-агента, но Phases 1-2 собраны | [ASSUMED: установлен через rustup в user-profile] | — |
| Node.js | Tauri CLI | ✓ | v24.14.1 | — |
| PlantSimulation.exe | INT-01: запуск симуляции | Неизвестно в dev-среде | — | Mock: оставить существующий PowerShell mock для разработки |
| results.txt | INT-02: результаты | Создаётся макросом в work_dir | — | Fallback D-08: пустая панель + warning |

**Missing dependencies with no fallback:**
- PlantSimulation.exe — обязателен для финального теста. В dev-среде: использовать mock через PowerShell-скрипт, который пишет results.txt и завершается.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Ручное тестирование (нет unit-тест фреймворка в проекте) |
| Config file | Нет |
| Quick run command | `npm run tauri dev` (из bratsy-tauri/) |
| Full suite command | `npm run tauri dev` + ручная проверка каждого Success Criteria |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INT-01 | Кнопка PlantSim запускает процесс, pill → "Запущен" | smoke (manual) | `npm run tauri dev` + клик PlantSim | ❌ Wave 0: нет тестов |
| INT-01 | stage allowlist отклоняет невалидный stage | unit (manual) | invoke('run_stage', {stage:'hack'}) в DevTools | ❌ |
| INT-02 | results.txt парсится в числа, stage-results эмитится | smoke (manual) | Создать mock results.txt, запустить mock PlantSim | ❌ |
| INT-02 | Отсутствие results.txt → warning в лог, пустая панель | smoke (manual) | Запуск без results.txt | ❌ |
| PIPE-04 | Панель результатов появляется после stage-results | smoke (manual) | Проверить DOM после запуска | ❌ |
| PIPE-04 | 3 карточки показывают правильные значения | smoke (manual) | Сравнить с содержимым results.txt | ❌ |
| D-13 | Ошибка config (exe не найден) → диалог, не crash | smoke (manual) | Очистить plant_sim_exe в настройках, кликнуть PlantSim | ❌ |

### Sampling Rate
- **Per task commit:** `npm run tauri dev` + ручная smoke-проверка изменённой фичи
- **Per wave merge:** Все 4 Success Criteria из ROADMAP.md
- **Phase gate:** Все 4 критерия зелёные перед `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Mock PlantSim script (`bratsy-tauri/dev-tools/mock-plantsim.ps1`) — пишет results.txt и завершается, для разработки без реального PlantSim
- [ ] Нет тест-фреймворка — это нормально для данного проекта (manual testing)

---

## Security Domain

> Проект — локальное Windows-приложение без сети и пользователей. `security_enforcement` не установлен в config.json явно как `false`, поэтому раздел включён.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Нет | Локальное приложение, 1 пользователь |
| V3 Session Management | Нет | Нет сессий |
| V4 Access Control | Частично | Allowlist stage IDs в run_stage [VERIFIED: lib.rs строки 64-67] |
| V5 Input Validation | Да | Path::exists() до запуска; allowlist stage IDs |
| V6 Cryptography | Нет | Нет секретов, нет передачи данных |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal (настройки с `../` в пути) | Tampering | `Path::exists()` возвращает false для несуществующих путей; пути задаются через file dialog, не ввод вручную |
| Stage ID injection | Tampering | Allowlist `["autocad","pdm","excel","plantsim","report"]` [VERIFIED: lib.rs строки 64-67] |
| results.txt подмена | Spoofing | Файл в work_dir — доверенная папка на заводском ПК. MVP-риск приемлем. |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PowerShell + WinForms (оригинальный прототип) | Tauri v2 + Rust + WebView2 | До Phase 1 (MEMORY.md) | Rust обрабатывает процессы; JS — только UI |
| Mock PowerShell script в run_stage | Реальный PlantSim.exe вызов | Phase 3 | Убирает заглушку; логика та же |

---

## Sources

### Primary (HIGH confidence)
- `bratsy-tauri/src-tauri/src/lib.rs` — VERIFIED: ProcessMap, run_stage, spawn_blocking, emit, Settings struct, BufReader pattern
- `bratsy-tauri/src/main.js` — VERIFIED: listen(), updatePill(), showLogPanel(), showToast(), openSettings(), activeStages, DOMContentLoaded pattern
- `bratsy-tauri/src/index.html` — VERIFIED: .stages, #logPanel, .metric-card, .field-group паттерны
- `bratsy-tauri/src/styles.css` — VERIFIED: .log-panel/.log-panel.visible, .metric-card, CSS-переменные, transition-паттерн
- `bratsy-tauri/src-tauri/Cargo.toml` — VERIFIED: зависимости tauri 2, serde, serde_json
- `bratsy-tauri/src-tauri/Cargo.lock` — VERIFIED: tauri 2.11.1

### Secondary (MEDIUM confidence)
- `.planning/phases/03-integraciya-plant-simulation/03-CONTEXT.md` — D-01…D-15: все пользовательские решения
- `.planning/phases/02-upravlenie-pajplajnom/02-CONTEXT.md` — D-11/D-12: Tauri events, ProcessMap паттерн
- `.planning/REQUIREMENTS.md` — INT-01, INT-02, PIPE-04 определения

### Tertiary (LOW confidence / ASSUMED)
- Синтаксис CLI PlantSim `/S:"macro" "file"` — [ASSUMED], требует проверки на реальной установке

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — всё верифицировано в Cargo.lock и коде
- Architecture: HIGH — все паттерны взяты напрямую из работающего кода Phase 2
- Pitfalls: MEDIUM — Pitfall #4 и #5 помечены ASSUMED (специфика PlantSim неизвестна)

**Research date:** 2026-05-10
**Valid until:** Стабильно — Tauri 2.x API не изменится в ближайшие месяцы; PlantSim CLI нужно верифицировать при тестировании
