---
phase: 04-dannye-plant-simulation
reviewed: 2026-05-15T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - bratsy-tauri/src/index.html
  - bratsy-tauri/src/main.js
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-15
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

The Phase 4 gap-closure changes add two HTML field groups (`inputSppPath`, `inputWorkDir`) to the PLANT SIMULATION settings section, and wire them up through `loadSettings` and `btnSave` in main.js. The HTML additions are structurally clean. The JS wiring is mostly correct but contains two Critical bugs: a silent data-loss on clear and a dangling event-listener that causes duplicate status processing on every pipeline run. Four pre-existing warnings in the surrounding code were also found that can affect correctness.

---

## Critical Issues

### CR-01: `loadSettings` silently skips clearing fields when the stored value is empty/null

**File:** `bratsy-tauri/src/main.js:463`

**Issue:** The `set` helper only writes to an input if `val` is truthy:
```js
const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
```
If the user previously filled in `inputSppPath` or `inputWorkDir` and then saves an empty value (cleared the field), the next `loadSettings` call (triggered by reopening settings or `showConfigError`) will leave the old stale text in the input. The user sees a path that has already been erased from `settings.json`, creating a false impression that the setting is still saved. Any subsequent "Save" while the panel is open will re-persist the stale value, undoing the intentional clear.

**Fix:** Remove the truthiness guard so that empty values are applied:
```js
const set = (id, val) => {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
};
```

---

### CR-02: `waitForStage('plantsim')` creates a new persistent `stage-status` listener on every pipeline run, causing duplicate resolution and event accumulation

**File:** `bratsy-tauri/src/main.js:367-381`

**Issue:** `waitForStage` calls `listen('stage-status', handler)` which registers a new global listener. The listener is removed with `unlisten()` only on the matching `done`/`error` event for the requested stage. However, if `pipelineRunning` becomes false (user stops the pipeline via `stopPipeline`), the `setInterval` guard fires `reject`, but `unlisten()` is never called — the listener remains attached for the lifetime of the page.

On the next pipeline run a second listener is registered. Both listeners receive every `stage-status` event. The first orphaned listener will fire `resolve`/`reject` on the new run's Promise (which has already settled), silently corrupting the event processing order. Over multiple runs this grows unboundedly.

Additionally, the Promise constructor anti-pattern `new Promise(async (resolve, reject) => …)` is used: if `await listen(…)` throws, the rejection is swallowed (unhandled promise rejection inside the executor).

**Fix:**
```js
function waitForStage(stage) {
  return new Promise((resolve, reject) => {
    let unlisten = null;
    const guard = setInterval(() => {
      if (!pipelineRunning) {
        clearInterval(guard);
        if (unlisten) unlisten();
        reject(new Error('Остановлено'));
      }
    }, 300);

    listen('stage-status', (evt) => {
      if (evt.payload.stage !== stage) return;
      const s = evt.payload.status;
      if (s === 'done' || s === 'error') {
        clearInterval(guard);
        if (unlisten) unlisten();
        s === 'done' ? resolve() : reject(new Error(`Ошибка: ${stage}`));
      }
    }).then(fn => { unlisten = fn; }).catch(err => {
      clearInterval(guard);
      reject(err);
    });
  });
}
```

---

## Warnings

### WR-01: `inputSppPath` field-group has no error/hint element — inconsistent with adjacent fields

**File:** `bratsy-tauri/src/index.html:231-237`

**Issue:** The newly added `inputPlantSimShortcut` field group already has a `<div class="field-error" id="errPlantSimShortcut">` element for inline validation feedback. The new `inputSppPath` field-group has no corresponding error element. The `inputWorkDir` field-group also has no error element. If the Rust backend returns a `config:` error referencing either of these fields, `showConfigError` shows a `confirm()` dialog instead of inline feedback, which is inconsistent and hides the error from the user if they dismiss the dialog.

**Fix:** Add field-error or field-hint elements matching the pattern of the shortcut field:
```html
<!-- inputSppPath field-group, after field-row -->
<div class="field-error" id="errSppPath" style="display:none">Файл не найден</div>

<!-- inputWorkDir field-group, after field-row -->
<div class="field-hint" id="hintWorkDir">Куда Plant Simulation пишет results.txt</div>
```

---

### WR-02: `btnSave` catch block swallows the error — failures are untraceable

**File:** `bratsy-tauri/src/main.js:492`

**Issue:**
```js
} catch { showToast('Ошибка сохранения', 'error'); }
```
The catch clause discards the exception entirely. If `save_settings` fails (e.g., write permission error, serialization issue) or if `get_settings` throws on the initial load, the developer has no way to diagnose it. The toast only says "save error" with no detail.

**Fix:**
```js
} catch (e) {
  console.error('save_settings failed:', e);
  showToast('Ошибка сохранения', 'error');
}
```

---

### WR-03: `stopPipeline` sets `pipelineRunning = false` before issuing `stop_stage` invocations — guard in `waitForStage` fires before backend receives stop signal

**File:** `bratsy-tauri/src/main.js:344-353`

**Issue:**
```js
function stopPipeline() {
  pipelineRunning = false;          // ← guard interval fires immediately
  setLaunchState('');
  clog('⏹ Остановлено пользователем', 'warn');
  PIPELINE.forEach(s => {
    const p = document.getElementById(`pill-${s}`);
    if (p?.className.includes('pill-running')) setPill(s, 'idle');
  });
  PIPELINE.forEach(s => invoke('stop_stage', { stage: s }).catch(() => {}));
}
```
Setting `pipelineRunning = false` causes the 300 ms guard inside `waitForStage` to fire on its next tick and call `reject('Остановлено')`. The `runReal('plantsim')` `catch` block then re-throws, and `startPipeline` records it as a failure and increments `failedAttempts`/`errRate`. The `stop_stage` invocations have not yet been sent. This means the error counter is incremented on every clean stop by the user, misleading the error rate indicator.

**Fix:** Send `stop_stage` first, then clear `pipelineRunning`:
```js
async function stopPipeline() {
  setLaunchState('');
  clog('⏹ Остановлено пользователем', 'warn');
  PIPELINE.forEach(s => {
    const p = document.getElementById(`pill-${s}`);
    if (p?.className.includes('pill-running')) setPill(s, 'idle');
  });
  await Promise.allSettled(
    PIPELINE.map(s => invoke('stop_stage', { stage: s }).catch(() => {}))
  );
  pipelineRunning = false;
}
```
Also consider not incrementing `failedAttempts` when the error message is 'Остановлено'.

---

### WR-04: `loadSettings` is called inside `showConfigError` while settings panel may already be open — double `invoke('get_settings')` race condition

**File:** `bratsy-tauri/src/main.js:439-447`

**Issue:**
```js
function showConfigError(msg) {
  const display = msg.startsWith('config: ') ? msg.slice(8) : msg;
  const confirmed = confirm(display + '\n\nОткрыть настройки?');
  if (confirmed) {
    settingsOverlay.classList.add('open');
    loadSettings();   // ← always calls get_settings
  }
}
```
`loadSettings` is also called inside the `btnSettings` click handler. If the settings panel is already open (user opened it before launching the pipeline), and then `showConfigError` fires (because `find_plantsim_shortcut` found a bad path), `loadSettings` is called again and overwrites any unsaved edits the user has made in the open form. The user typed a new `.spp` path but it gets cleared and replaced with the previously saved (empty) value.

**Fix:** Only call `loadSettings` when the panel is freshly opened, i.e. when the `open` class was not already present:
```js
if (confirmed) {
  const wasOpen = settingsOverlay.classList.contains('open');
  settingsOverlay.classList.add('open');
  if (!wasOpen) loadSettings();
}
```

---

## Info

### IN-01: `inputWorkDir` browse button uses `data-type="folder"` — `pick_folder` passes `defaultPath: ''` which ignores existing setting value as pre-navigation hint

**File:** `bratsy-tauri/src/main.js:500-508`

**Issue:** The browse-button handler always passes `defaultPath: ''` to both `pick_file` and `pick_folder`. For `inputWorkDir` the user likely wants the dialog to open at the currently configured directory. Since `defaultPath` is always empty the dialog opens at the system default (usually `Desktop` or `Documents`), forcing extra navigation on every change.

**Fix:**
```js
const currentVal = document.getElementById(targetId)?.value || '';
if (btn.dataset.type === 'folder') {
  selected = await invoke('pick_folder', { title: 'Выберите папку', defaultPath: currentVal });
} else {
  selected = await invoke('pick_file', { title: 'Выберите файл', filter, defaultPath: currentVal });
}
```

---

### IN-02: `console.error(e)` in `loadSettings` catch leaks internal Tauri IPC error strings to browser devtools in production

**File:** `bratsy-tauri/src/main.js:472`

**Issue:**
```js
} catch (e) { console.error(e); }
```
In a packaged Tauri application the devtools console is accessible to end-users (Tauri exposes it by default). The raw IPC error from `get_settings` may contain file-system paths (the full path to `settings.json`) which could expose installation layout. This is low-impact but worth noting in a production-facing build.

**Fix:** Use a user-visible toast for the failure case and restrict `console.error` to development builds, or at minimum sanitize the logged value:
```js
} catch (e) {
  console.error('[loadSettings]', String(e));
  showToast('Не удалось загрузить настройки', 'error');
}
```

---

_Reviewed: 2026-05-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
