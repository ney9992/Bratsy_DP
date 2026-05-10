---
phase: 03-integraciya-plant-simulation
reviewed: 2026-05-10T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - bratsy-tauri/dev-tools/mock-plantsim.ps1
  - bratsy-tauri/src-tauri/src/lib.rs
  - bratsy-tauri/src/index.html
  - bratsy-tauri/src/main.js
  - bratsy-tauri/src/styles.css
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Код реализует интеграцию с Plant Simulation через Tauri (Rust backend + JS frontend). Архитектура в целом разумна, TOCTOU-гонка на ProcessMap исправлена через sentinel, escapeHtml присутствует. Тем не менее обнаружены три критических проблемы: инъекция команды через пользовательский ввод в `run_plantsim` (PowerShell-аргументы строятся конкатенацией без экранирования), опасный автопоиск `.lnk`-ярлыка который может подхватить любой ярлык в директории, и бесконечный цикл при отслеживании parent-директорий в `find_plantsim_shortcut`. Дополнительно выявлен ряд предупреждений по качеству и надёжности.

---

## Critical Issues

### CR-01: Command Injection через `lnk_path` и `spp_path` в `run_plantsim`

**File:** `bratsy-tauri/src-tauri/src/lib.rs:313-315`
**Issue:** Метод `run_plantsim` строит PowerShell-команду конкатенацией строк без экранирования значений `lnk_path`, `spp_path` и `method`:

```rust
let modify_cmd = format!(
    r#"$s=(New-Object -ComObject WScript.Shell).CreateShortcut("{}");$s.Arguments='-f "{}" /E {}';$s.Save()"#,
    lnk_path, spp_path, method
);
```

Путь с символом `"` или специальными символами PowerShell (`$(`, `` ` ``, `&`) в любом из трёх параметров позволяет исполнить произвольный код на уровне PowerShell. Параметр `method` вводится пользователем напрямую через `prompt()` в JS (строка 79 `main.js`) и никак не валидируется на стороне Rust. Аналогично строка `wait_cmd` (строка 339) вставляет `lnk_path` в PowerShell-скрипт — там экранируется только `'`, но не `"` (используется внутри строк с кавычками в modify_cmd).

**Fix:** Передавать параметры отдельными аргументами процессу, а не через `-Command`; либо добавить строгое экранирование перед подстановкой в скрипт. Для `method` — валидировать на стороне Rust по whitelist (только `.`, буквы, цифры, `_`):

```rust
// Валидация method перед использованием
if !method.chars().all(|c| c.is_alphanumeric() || "._".contains(c)) {
    return Err("invalid method: only alphanumeric, dot and underscore allowed".into());
}

// Экранирование пути для PowerShell (замена " на `")
fn ps_escape_dq(s: &str) -> String {
    s.replace('"', "`\"")
}

let modify_cmd = format!(
    r#"$s=(New-Object -ComObject WScript.Shell).CreateShortcut("{}");$s.Arguments='-f "{}" /E {}';$s.Save()"#,
    ps_escape_dq(&lnk_path),
    ps_escape_dq(&spp_path),
    method   // уже проверен whitelist
);
```

---

### CR-02: Неограниченный автопоиск `.lnk` — захватывает первый попавшийся ярлык

**File:** `bratsy-tauri/src-tauri/src/lib.rs:271-280`
**Issue:** `find_plantsim_shortcut` возвращает **первый** файл с расширением `.lnk`, найденный при обходе рабочего каталога и нескольких его родителей. Никакая проверка имени файла не производится. Если в корне проекта или workspace-директории лежит любой другой `.lnk` (ярлык браузера, проводника, чужого ПО), он будет передан в `run_plantsim` и запущен через `Start-Process`, что приведёт к запуску произвольного приложения без ведома пользователя.

```rust
if path.extension().and_then(|e| e.to_str()) == Some("lnk") {
    return Ok(path.to_string_lossy().into_owned());  // любой .lnk!
}
```

**Fix:** Проверять имя файла на соответствие ожидаемому паттерну Plant Simulation (например, имя содержит "plant" или "sim" без учёта регистра):

```rust
let name_lower = path.file_stem()
    .and_then(|s| s.to_str())
    .map(|s| s.to_lowercase())
    .unwrap_or_default();

if path.extension().and_then(|e| e.to_str()) == Some("lnk")
    && (name_lower.contains("plant") || name_lower.contains("sim"))
{
    return Ok(path.to_string_lossy().into_owned());
}
```

Если ни один подходящий ярлык не найден — возвращать ошибку (текущее поведение) и просить пользователя указать путь вручную.

---

### CR-03: Бесконечный цикл в `find_plantsim_shortcut` при подъёме по дереву директорий

**File:** `bratsy-tauri/src-tauri/src/lib.rs:262-268`
**Issue:** Цикл поднимается вверх по дереву директорий, добавляя родителей в `scan_dirs`, но берёт `scan_dirs.last()` на каждой итерации. Когда достигается корневая директория (`C:\` или `/`), `parent()` возвращает `None`, и `scan_dirs.last()` остаётся прежним — корнем. При следующей итерации цикла `scan_dirs.last().cloned()` снова возвращает корень, `parent()` снова `None`, и корень **не добавляется повторно** (это `and_then` цепочка возвращает `None`). Формально бесконечного зависания нет, так как цикл `for _ in 0..4` ограничен четырьмя итерациями. Однако фактический эффект: при достижении файловой системы root все оставшиеся итерации добавляют `None`-результат (push не происходит), и алгоритм сканирует корневую директорию файловой системы (`C:\`) в поисках `.lnk`. Это может быть очень медленно и неожиданно на системах с ярлыками в корне диска.

**Fix:** Завершать цикл, как только родитель совпадает с текущим (корень достигнут):

```rust
let mut cur = dir.to_path_buf();
for _ in 0..4 {
    match cur.parent().map(|p| p.to_path_buf()) {
        Some(p) if p != cur => {
            scan_dirs.push(p.clone());
            cur = p;
        }
        _ => break,
    }
}
```

---

## Warnings

### WR-01: Sentinel PID=0 конфликтует с системным PID

**File:** `bratsy-tauri/src-tauri/src/lib.rs:84, 304`
**Issue:** В качестве sentinel (место зарезервировано, процесс ещё не запущен) используется PID `0`. На Windows PID 0 — это System Idle Process. Если `stop_stage` вызывается между резервированием sentinel и апгрейдом до реального PID (что возможно в редком race condition в async среде), команда `taskkill /F /PID 0` будет запущена, что приведёт к ошибке (taskkill отклонит PID 0), но это нежелательное поведение.

**Fix:** Использовать `Option<u32>` вместо `u32` в `ProcessMap`, или использовать специальный sentinel значение `u32::MAX` которое гарантированно не является реальным PID:

```rust
// В stop_stage — не вызывать taskkill если pid == 0
if let Some(pid) = pid {
    if pid == 0 {
        // Процесс ещё не запустился — просто убрать из map (уже сделано выше)
        return Ok(());
    }
    let _ = Command::new("taskkill")
        .args(["/F", "/PID", &pid.to_string()])
        .output();
    // ...
}
```

---

### WR-02: Ошибки `save_settings` при запуске `run_plantsim` молча игнорируются с потерей данных

**File:** `bratsy-tauri/src/main.js:55-77`
**Issue:** В функции `runPlantSim` два вызова `save_settings` обёрнуты в `try/catch` с комментарием `/* некритично */`. Однако если сохранение провалится (например, нет прав записи рядом с .exe), пользователь не получит никакого уведомления, и выбранный путь к .spp-файлу не сохранится — при следующем запуске диалог снова откроется без предзаполнения.

```js
try {
  await invoke('save_settings', { settings: { ...s, plant_sim_shortcut: lnkPath } });
} catch { /* некритично */ }
```

**Fix:** Минимально — логировать ошибку в `console.warn`. Желательно — показывать toast-уведомление о том, что настройки не сохранились:

```js
} catch (e) {
  console.warn('Не удалось сохранить настройки:', e);
}
```

---

### WR-03: `run_plantsim` читает `results.txt` вне зависимости от статуса завершения процесса

**File:** `bratsy-tauri/src-tauri/src/lib.rs:362-404`
**Issue:** В `spawn_blocking` результат `child.wait()` записывается в `status_ok`, но чтение `results.txt` и эмит `stage-results` выполняются **независимо** от `status_ok`. Если Plant Simulation завершился с ошибкой или был убит, но старый `results.txt` от предыдущего запуска присутствует в директории, UI получит устаревшие результаты и отобразит их как актуальные.

```rust
// status_ok не проверяется перед чтением results.txt
match std::fs::read_to_string(&results_path) {
    Ok(content) => { /* эмитируем stage-results даже при status_ok=false */ }
```

**Fix:** Читать `results.txt` только при успешном завершении:

```rust
if status_ok {
    match std::fs::read_to_string(&results_path) {
        Ok(content) => { /* парсинг и emit */ }
        Err(_) => { /* warning в лог */ }
    }
}
```

---

### WR-04: Валидация настроек в `btnSave` ошибочна — пустые поля не блокируют сохранение

**File:** `bratsy-tauri/src/main.js:350-358`
**Issue:** Логика проверки: `if (val && val.trim() === '')` — это условие **никогда не выполняется**. Если `val` — пустая строка, то `val` — falsy, и условие `val && ...` сразу даёт `false`. Если `val` непустое — `val.trim() === ''` ложно для строк с символами. Намерение было поймать строки из одних пробелов, но фактически проверка не работает: строки из пробелов (`"   "`) проходят как валидные, а полностью пустые поля не помечаются ошибкой.

```js
if (val && val.trim() === '') {  // всегда false
  showError(inputId, errId);
```

**Fix:**

```js
if (!val || val.trim() === '') {
  showError(inputId, errId);
  hasError = true;
}
```

---

### WR-05: `clearError` строит ID по хрупкой строковой манипуляции

**File:** `bratsy-tauri/src/main.js:382-386`
**Issue:** Функция `clearError` вычисляет ID error-элемента через строковую операцию `'err' + inputId.replace('input', '')`. Это работает только если имя поля строго следует шаблону `inputXxx → errXxx`. Любое отклонение в именовании (например, `inputPlantSimShortcut` → ожидаемый `errPlantSimShortcut`) приведёт к тому, что ошибка не будет скрыта. Сейчас совпадает случайно, но паттерн хрупкий.

```js
if (el.id === 'err' + inputId.replace('input', '')) el.classList.remove('visible');
```

**Fix:** Передавать `errId` явно в `clearError`, как это сделано в `showError`:

```js
function clearError(inputId, errId) {
  const row = document.getElementById(inputId)?.closest('.field-row');
  if (row) row.classList.remove('error');
  if (errId) document.getElementById(errId)?.classList.remove('visible');
}
```

---

## Info

### IN-01: `run_stage` выполняет mock-скрипт с захардкоженным форматом строки и инъекцией `stage` в PowerShell-команду

**File:** `bratsy-tauri/src-tauri/src/lib.rs:93-99`
**Issue:** Имя `stage` подставляется напрямую в строку PowerShell-скрипта:

```rust
let script = format!(
    "for ($i=1; $i -le 5; $i++) {{ Write-Output '[{stage}] step $i/5'; Start-Sleep ... }}; ...",
    stage = stage
);
```

Хотя выше есть allowlist (`["autocad", "pdm", "excel", "report"]`), этот паттерн опасен как образец для будущего кода. Если allowlist будет ослаблен или убран, это станет инъекцией. Стоит оставить комментарий об этой зависимости, чтобы код не копировался без понимания контекста.

**Fix:** Добавить комментарий-предупреждение рядом с format!, поясняющий что подстановка безопасна только при наличии allowlist выше.

---

### IN-02: `console.log` / `console.info` в production-коде

**File:** `bratsy-tauri/src/main.js:94, 391`
**Issue:** Строки 94 и 391 содержат `console.error` и `console.info` соответственно. `console.info` на строке 391 сообщает о нереализованной функции («Full pipeline: будет реализовано в Phase 3»). Это debug-артефакт, который должен быть удалён или заменён на реальную реализацию.

**Fix:** Удалить `console.info` на строке 391 или заменить обработчик на заглушку с UI-уведомлением через `showToast`.

---

### IN-03: Метрики `Drawings processed` и `Throughput` захардкожены в HTML

**File:** `bratsy-tauri/src/index.html:56-68`
**Issue:** Значения `1,284` (drawings processed) и `94.2%` (throughput) жёстко прописаны в HTML и никогда не обновляются из реальных данных. Пользователь видит статичные числа независимо от состояния системы. Это может вводить в заблуждение на производстве.

**Fix:** Заменить на элементы с `id` и обновлять через JS из событий бэкенда, либо явно пометить как "демо-данные" в UI (например, серым цветом с подписью "demo").

---

_Reviewed: 2026-05-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
