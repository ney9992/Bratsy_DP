# Phase 3: Интеграция Plant Simulation — Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 5
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `bratsy-tauri/src-tauri/src/lib.rs` | service/backend | request-response + file-I/O | сам файл (расширение) | exact — тот же файл |
| `bratsy-tauri/src/index.html` | component/view | request-response | сам файл (расширение `.field-group`, `.metric-card`) | exact — тот же файл |
| `bratsy-tauri/src/main.js` | controller/frontend | event-driven | сам файл (расширение `listen`) | exact — тот же файл |
| `bratsy-tauri/src/styles.css` | config/styles | — | `.log-panel` / `.log-panel.visible` в том же файле | exact — тот же файл |
| `bratsy-tauri/dev-tools/mock-plantsim.ps1` | utility/test-mock | file-I/O | нет прямого аналога в проекте | no analog |

---

## Pattern Assignments

### `bratsy-tauri/src-tauri/src/lib.rs` (service, request-response + file-I/O)

**Analog:** тот же файл — расширение существующих структур и функций.

#### Паттерн 1: Расширение Settings struct (строки 10–15)

```rust
// ТЕКУЩЕЕ СОСТОЯНИЕ — строки 10-15
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Settings {
    pub plant_sim_path: String,
    pub work_dir: String,
    pub scripts_dir: String,
}

// КАК РАСШИРИТЬ — добавить 2 поля по тому же паттерну:
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Settings {
    pub plant_sim_path: String,
    pub work_dir: String,
    pub scripts_dir: String,
    pub plant_sim_exe: String,   // новое поле D-02
    pub plant_sim_macro: String, // новое поле D-03
}
```

**Важно:** `#[derive(Default)]` + `serde_json::from_str().unwrap_or_default()` в `get_settings()` (строка 47) обеспечивают обратную совместимость — старый `settings.json` без новых полей вернёт пустые строки без паники.

#### Паттерн 2: Новый Payload для stage-results (по аналогии со строками 22–32)

```rust
// АНАЛОГ — строки 22-32 (StageStatusPayload, StageLogPayload)
#[derive(Serialize, Clone)]
pub struct StageStatusPayload {
    pub stage: String,
    pub status: String,
}

#[derive(Serialize, Clone)]
pub struct StageLogPayload {
    pub stage: String,
    pub line: String,
}

// НОВЫЙ Payload — тот же паттерн, добавить после строки 32:
#[derive(Serialize, Clone)]
pub struct StageResultsPayload {
    pub stage: String,
    pub load: f32,
    pub throughput: f32,
    pub cycle_time: f32,
}
```

#### Паттерн 3: Валидация путей до запуска (вставить в run_stage перед sentinel)

```rust
// ПРАВИЛЬНЫЙ ПОРЯДОК (Pitfall #2 из RESEARCH.md):
// 1. Validate paths (до любого state mutation)
// 2. Reserve sentinel
// 3. Spawn process

// Добавить в run_stage после allowlist-проверки (строка 67), ДО строки 71:
if stage == "plantsim" {
    let settings = get_settings(); // sync fn — вызывается напрямую (строка 42)
    if !std::path::Path::new(&settings.plant_sim_exe).exists() {
        return Err("config: PlantSimulation.exe не найден".into());
    }
    if !std::path::Path::new(&settings.plant_sim_path).exists() {
        return Err("config: файл .spp не найден".into());
    }
    if !std::path::Path::new(&settings.plant_sim_macro).exists() {
        return Err("config: файл .spm не найден".into());
    }
}
```

**Источник:** `std::path::Path::new()` + `.exists()` — стандартная библиотека Rust, уже есть `use std::path::PathBuf` в строке 6. Нужно добавить `use std::path::Path;` или использовать `std::path::Path::new(...)`.

#### Паттерн 4: Запуск PlantSim вместо PowerShell-заглушки (строки 83–100)

```rust
// ТЕКУЩАЯ ЗАГЛУШКА — строки 83-100 (заменить для stage == "plantsim"):
let script = format!(
    "for ($i=1; $i -le 5; $i++) {{ Write-Output '[{stage}] step $i/5'; ... }}",
    stage = stage
);
let mut child = Command::new("powershell")
    .args(["-ExecutionPolicy", "Bypass", "-Command", &script])
    .stdout(Stdio::piped())
    .stderr(Stdio::null())
    .spawn()
    .map_err(|e| {
        let mut map = state.0.lock().unwrap();
        map.remove(&stage);
        e.to_string()
    })?;

// ЗАМЕНИТЬ для plantsim — ветка if/else или отдельный блок:
// Прочитать settings ДО spawn_blocking (Pitfall #1 из RESEARCH.md):
let settings = get_settings();
let plant_sim_exe = settings.plant_sim_exe.clone();
let plant_sim_macro = settings.plant_sim_macro.clone();
let plant_sim_path = settings.plant_sim_path.clone();
let work_dir = settings.work_dir.clone();

let mut child = Command::new(&plant_sim_exe)
    .args(["/S", &plant_sim_macro, &plant_sim_path])
    .stdout(Stdio::piped())
    .stderr(Stdio::null())  // CR-01: предотвращает deadlock
    .spawn()
    .map_err(|e| {
        // Тот же паттерн очистки sentinel — строки 96-99
        let mut map = state.0.lock().unwrap();
        map.remove(&stage);
        e.to_string()
    })?;
```

#### Паттерн 5: Чтение results.txt и emit stage-results (вставить в spawn_blocking после child.wait())

```rust
// АНАЛОГ emit — строки 119-122, 143-146
// ВСТАВИТЬ после child.wait() (строка 129), перед блоком state_arc.lock (строка 137):

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
        // D-08: предупреждение, не ошибка
        let _ = app_clone.emit("stage-log", StageLogPayload {
            stage: stage_clone.clone(),
            line: "[warning] results.txt не найден — результаты недоступны".into(),
        });
    }
}
```

**Источник emit-паттерна:** строки 119–122 и 143–146 в `lib.rs`. `app_clone` и `stage_clone` уже объявлены на строках 108–110.

---

### `bratsy-tauri/src/index.html` (component/view, request-response)

**Analog:** тот же файл — добавить HTML в 2 места по существующим паттернам.

#### Паттерн 6: 2 новых поля в панели настроек (по паттерну строк 164–189)

```html
<!-- АНАЛОГ — строки 164-189, существующие field-group -->
<div class="field-group">
  <label class="field-label">Путь к файлу Plant Simulation (.spp)</label>
  <div class="field-row">
    <input class="field-input" id="inputPlantSim" type="text" readonly placeholder="Не задан">
    <button class="browse-btn" data-target="inputPlantSim" data-type="file">…</button>
  </div>
  <div class="field-error" id="errPlantSim">Путь не найден</div>
</div>

<!-- ДОБАВИТЬ ПОСЛЕ строки 189 — 4-е поле: PlantSimulation.exe -->
<div class="field-group">
  <label class="field-label">Путь к PlantSimulation.exe</label>
  <div class="field-row">
    <input class="field-input" id="inputPlantSimExe" type="text" readonly placeholder="Не задан">
    <button class="browse-btn" data-target="inputPlantSimExe" data-type="file">…</button>
  </div>
  <div class="field-error" id="errPlantSimExe">Путь не найден</div>
</div>

<!-- ДОБАВИТЬ ПОСЛЕ — 5-е поле: SimTalk макрос .spm -->
<div class="field-group">
  <label class="field-label">Путь к макросу SimTalk (.spm)</label>
  <div class="field-row">
    <input class="field-input" id="inputPlantSimMacro" type="text" readonly placeholder="Не задан">
    <button class="browse-btn" data-target="inputPlantSimMacro" data-type="file">…</button>
  </div>
  <div class="field-error" id="errPlantSimMacro">Путь не найден</div>
</div>
```

**Конвенция именования:** `id="input{FieldName}"` + `id="err{FieldName}"` — строго по паттерну строк 167/170, 176/179, 185/188.

#### Паттерн 7: Панель результатов (по паттерну строк 136–143 — #logPanel)

```html
<!-- АНАЛОГ — строки 136-143 (logPanel) -->
<div class="log-panel" id="logPanel">
  <div class="log-header">...</div>
  <div class="log-body" id="logBody"></div>
</div>

<!-- ДОБАВИТЬ ПОСЛЕ строки 143, перед <!-- Footer --> (строка 145):
<!-- Results panel (Phase 3) -->
<div class="results-panel" id="resultsPanel">
  <div class="results-header">
    <span class="results-title">Результаты симуляции</span>
  </div>
  <div class="results-body">
    <div class="metric-card">
      <div class="metric-info">
        <div class="metric-label">Загрузка линии</div>
        <div class="metric-value" id="resLoad">—</div>
        <div class="metric-unit">%</div>
      </div>
      <div class="metric-icon" style="background:#EDF7F0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
      </div>
    </div>
    <div class="metric-card">
      <div class="metric-info">
        <div class="metric-label">Пропускная способность</div>
        <div class="metric-value" id="resThroughput">—</div>
        <div class="metric-unit">ед./ч</div>
      </div>
      <div class="metric-icon" style="background:#EBF4FF">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1761A5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
    </div>
    <div class="metric-card">
      <div class="metric-info">
        <div class="metric-label">Время цикла</div>
        <div class="metric-value" id="resCycleTime">—</div>
        <div class="metric-unit">сек</div>
      </div>
      <div class="metric-icon" style="background:#F5F5F7">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
    </div>
  </div>
</div>
```

**SVG-иконки:** копировать из секции `.metrics` (строки 50–88) — там уже есть stroke-цвета под каждый фоновый цвет.

---

### `bratsy-tauri/src/main.js` (controller/frontend, event-driven)

**Analog:** тот же файл — 4 добавления по существующим паттернам.

#### Паттерн 8: listen('stage-results') (по паттерну строк 311–327)

```javascript
// АНАЛОГ — строки 311-327 (существующие listen)
await listen('stage-status', (event) => {
    const { stage, status } = event.payload;
    updatePill(stage, status);
    // ...
});

await listen('stage-log', (event) => {
    const { stage, line } = event.payload;
    appendLog(stage, line);
});

// ДОБАВИТЬ в DOMContentLoaded после строки 327:
await listen('stage-results', (event) => {
    const { stage, load, throughput, cycle_time } = event.payload;
    if (stage !== 'plantsim') return;

    document.getElementById('resLoad').textContent = load.toFixed(1);
    document.getElementById('resThroughput').textContent = throughput.toFixed(0);
    document.getElementById('resCycleTime').textContent = cycle_time.toFixed(1);

    showResultsPanel(true);
});
```

#### Паттерн 9: showResultsPanel() (по паттерну строк 132–139)

```javascript
// АНАЛОГ — строки 132-139
function showLogPanel(visible) {
    const panel = document.getElementById('logPanel');
    if (visible) {
        panel.classList.add('visible');
    } else {
        panel.classList.remove('visible');
    }
}

// ДОБАВИТЬ рядом — после строки 139:
function showResultsPanel(visible) {
    const panel = document.getElementById('resultsPanel');
    if (visible) {
        panel.classList.add('visible');
    } else {
        panel.classList.remove('visible');
    }
}
```

#### Паттерн 10: showConfigError() (вставить рядом с showToast, строки 185–207)

```javascript
// АНАЛОГ для вызова openSettings() — строки 214-218
function openSettings() {
    panel.classList.add('open');
    overlay.classList.add('visible');
    gearBtn.classList.add('active');
}

// ДОБАВИТЬ после showToast() (строка 207):
function showConfigError(message) {
    const goSettings = confirm(
        `Ошибка конфигурации Plant Simulation:\n${message}\n\nОткрыть настройки?`
    );
    if (goSettings) openSettings();
}
```

#### Паттерн 11: Перехват ошибки конфигурации в click-обработчике (строки 60–70)

```javascript
// ТЕКУЩИЙ catch — строки 63-68:
} catch (e) {
    failedAttempts++;
    console.error('run_stage error:', e);
    updatePill(stage, 'error');
    showToast(STAGE_LABELS[stage] || stage, 'error');
}

// ЗАМЕНИТЬ на разветвлённый catch (D-13 vs D-14):
} catch (e) {
    if (typeof e === 'string' && e.startsWith('config:')) {
        // Ошибка конфигурации — диалог с кнопкой «Открыть настройки»
        showConfigError(e.replace('config: ', ''));
    } else {
        // Ошибка выполнения — стандартный механизм Phase 2
        failedAttempts++;
        console.error('run_stage error:', e);
        updatePill(stage, 'error');
        showToast(STAGE_LABELS[stage] || stage, 'error');
    }
}
```

#### Паттерн 12: Расширение save_settings + валидации (строки 257–289)

```javascript
// АНАЛОГ — строки 258-260 (читаем значения полей):
const plantSim = document.getElementById('inputPlantSim').value;
const workDir  = document.getElementById('inputWorkDir').value;
const scripts  = document.getElementById('inputScripts').value;

// ДОБАВИТЬ ещё 2 переменные после строки 260:
const plantSimExe   = document.getElementById('inputPlantSimExe').value;
const plantSimMacro = document.getElementById('inputPlantSimMacro').value;

// АНАЛОГ — строки 264-273 (массив валидации):
[[plantSim, 'inputPlantSim', 'errPlantSim'],
 [workDir,  'inputWorkDir',  'errWorkDir'],
 [scripts,  'inputScripts',  'errScripts']].forEach(...)

// ЗАМЕНИТЬ массив — добавить 2 новые строки:
[[plantSim,      'inputPlantSim',      'errPlantSim'],
 [workDir,       'inputWorkDir',       'errWorkDir'],
 [scripts,       'inputScripts',       'errScripts'],
 [plantSimExe,   'inputPlantSimExe',   'errPlantSimExe'],
 [plantSimMacro, 'inputPlantSimMacro', 'errPlantSimMacro']].forEach(...)

// АНАЛОГ — строки 278-284 (объект settings при invoke):
settings: {
    plant_sim_path: plantSim,
    work_dir: workDir,
    scripts_dir: scripts,
}
// ЗАМЕНИТЬ — добавить новые поля (должны совпадать с полями Settings struct в lib.rs):
settings: {
    plant_sim_path: plantSim,
    work_dir: workDir,
    scripts_dir: scripts,
    plant_sim_exe: plantSimExe,
    plant_sim_macro: plantSimMacro,
}

// АНАЛОГ — строки 331-334 (загрузка настроек в DOMContentLoaded):
if (s.plant_sim_path) document.getElementById('inputPlantSim').value = s.plant_sim_path;
if (s.work_dir)       document.getElementById('inputWorkDir').value  = s.work_dir;
if (s.scripts_dir)    document.getElementById('inputScripts').value  = s.scripts_dir;
// ДОБАВИТЬ после строки 334:
if (s.plant_sim_exe)   document.getElementById('inputPlantSimExe').value   = s.plant_sim_exe;
if (s.plant_sim_macro) document.getElementById('inputPlantSimMacro').value = s.plant_sim_macro;
```

---

### `bratsy-tauri/src/styles.css` (config/styles)

**Analog:** `.log-panel` / `.log-panel.visible` — строки 417–433.

#### Паттерн 13: .results-panel (по паттерну строк 417–433)

```css
/* АНАЛОГ — строки 417-433 */
.log-panel {
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.35s ease;
  opacity: 0;
  margin: 0 24px;
  border-radius: 14px;
  margin-bottom: 0;
}

.log-panel.visible {
  max-height: 162px;
  opacity: 1;
  margin-bottom: 12px;
}

/* ДОБАВИТЬ В КОНЕЦ ФАЙЛА — тот же паттерн для results-panel: */
.results-panel {
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.35s ease;
  opacity: 0;
  margin: 0 24px;
  border-radius: 14px;
  margin-bottom: 0;
  background: var(--gray-light);  /* отличие от log-panel: светлый фон */
}

.results-panel.visible {
  max-height: 140px;  /* подбирается под 3 карточки в ряд — меньше чем log-panel 162px */
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
  padding: 0 12px 12px;
}

/* Переопределение metric-unit — отсутствует в текущем styles.css */
.metric-unit {
  font-size: 11px;
  color: var(--text-sec);
  margin-top: 2px;
}
```

**Anti-pattern:** `height: 0 → auto` не работает в CSS transition. Используется `max-height` с конкретным значением — как в `.log-panel.visible` (строка 430). Никаких JS-таймеров.

---

### `bratsy-tauri/dev-tools/mock-plantsim.ps1` (utility, file-I/O)

**Analog:** нет прямого аналога в проекте. Файл новый.

**Назначение:** заглушка PlantSim.exe для разработки без реального ПО. Принимает аргументы по тому же протоколу что и реальный PlantSim (`/S macro.spm file.spp`), пишет `results.txt` в рабочую директорию и завершается.

**Рекомендуемый шаблон** (на основе контракта D-07 из CONTEXT.md):

```powershell
# mock-plantsim.ps1
# Заглушка PlantSimulation.exe для разработки без реального ПО
# Вызов: powershell -File mock-plantsim.ps1 /S macro.spm file.spp
# (или напрямую как .exe-обёртка через Command::new)

param(
    [string]$S,        # путь к .spm макросу (аргумент /S)
    [string]$SppPath   # путь к .spp файлу (позиционный)
)

Write-Output "[mock-plantsim] Запуск симуляции..."
Write-Output "[mock-plantsim] Макрос: $S"
Write-Output "[mock-plantsim] Модель: $SppPath"

Start-Sleep -Seconds 2  # имитация работы

# Определить work_dir — директория .spp файла или текущая
$workDir = if ($SppPath -and (Test-Path $SppPath)) {
    Split-Path $SppPath -Parent
} else {
    Get-Location
}

# Записать results.txt по контракту D-07
$resultsPath = Join-Path $workDir "results.txt"
@"
load=87.3
throughput=42
cycle_time=18.5
"@ | Set-Content -Path $resultsPath -Encoding UTF8

Write-Output "[mock-plantsim] Результаты записаны в $resultsPath"
Write-Output "[mock-plantsim] Завершено."
```

**Замечание по запуску из Rust:** В Rust команда будет `Command::new("powershell").args(["-File", "...\\mock-plantsim.ps1", "/S", macro_path, spp_path])`. При тестировании с mock нужно временно подставить путь к `.ps1` вместо реального `.exe` в настройки приложения.

---

## Shared Patterns

### CSS transition: max-height 0 → значение + .visible класс

**Источник:** `bratsy-tauri/src/styles.css`, строки 418–433
**Применить к:** `.results-panel` / `.results-panel.visible`

```css
/* Паттерн: скрытый → видимый через max-height transition */
.element {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease;
}
.element.visible {
  max-height: <конкретное значение>px;  /* НЕ auto — animation не работает с auto */
  opacity: 1;
}
```

### Emit события из Rust (Tauri v2)

**Источник:** `bratsy-tauri/src-tauri/src/lib.rs`, строки 78–81, 119–122, 143–146
**Применить к:** новый `stage-results` emit

```rust
use tauri::Emitter;  // строка 8 — уже импортировано
let _ = app_handle.emit("event-name", Payload { field: value });
// app_clone используется внутри spawn_blocking (строки 108-109)
```

### listen() в DOMContentLoaded

**Источник:** `bratsy-tauri/src/main.js`, строки 309–327
**Применить к:** `listen('stage-results')`

```javascript
// В window.addEventListener('DOMContentLoaded', async () => { ... })
await listen('event-name', (event) => {
    const { field1, field2 } = event.payload;
    // обновить DOM
});
```

### field-group паттерн (настройки)

**Источник:** `bratsy-tauri/src/index.html`, строки 164–189
**Применить к:** 4-е и 5-е поля настроек

```html
<div class="field-group">
  <label class="field-label">Метка поля</label>
  <div class="field-row">
    <input class="field-input" id="input{Name}" type="text" readonly placeholder="Не задан">
    <button class="browse-btn" data-target="input{Name}" data-type="file|folder">…</button>
  </div>
  <div class="field-error" id="err{Name}">Путь не найден</div>
</div>
```

### ProcessMap sentinel cleanup при ошибке

**Источник:** `bratsy-tauri/src-tauri/src/lib.rs`, строки 95–100
**Применить к:** spawn ошибка для plantsim ветки

```rust
.map_err(|e| {
    let mut map = state.0.lock().unwrap();
    map.remove(&stage);  // убрать sentinel при ошибке spawn
    e.to_string()
})?;
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `bratsy-tauri/dev-tools/mock-plantsim.ps1` | utility | file-I/O | В проекте нет других PowerShell-скриптов — mock пишется с нуля по контракту D-07 |

---

## Critical Pitfalls (из RESEARCH.md — обязательно учесть при реализации)

| Pitfall | Проблема | Решение |
|---|---|---|
| **#1: Settings в spawn_blocking** | `spawn_blocking` — sync, нельзя вызвать async | Читать `get_settings()` ДО `spawn_blocking`, передавать как `move`-переменные |
| **#2: Sentinel после ошибки валидации** | Если Path::exists() провалился после `map.insert(sentinel)`, слот блокируется | Делать валидацию ДО `map.insert()` — порядок: validate → reserve → spawn |
| **#3: /S синтаксис PlantSim** | Порядок аргументов зависит от версии | Стандарт: `args(["/S", &macro, &spp])` — проверить на реальной установке |
| **#4: CSS height: auto** | Transition с `height: auto` не работает | Использовать `max-height` с конкретным значением — как в `.log-panel.visible` |

---

## Metadata

**Analog search scope:** `bratsy-tauri/src-tauri/src/`, `bratsy-tauri/src/`
**Files scanned:** 4 (lib.rs, main.js, index.html, styles.css)
**Pattern extraction date:** 2026-05-10
**Confidence:** HIGH — все паттерны извлечены из верифицированного работающего кода Phase 1–2
