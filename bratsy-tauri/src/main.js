const { invoke } = window.__TAURI__.core;

// ── Uptime ────────────────────────────────────────────────────
const startTime = Date.now();
let totalAttempts = 0;
let failedAttempts = 0;
let lastSyncTime = Date.now();

setInterval(() => {
  // Uptime
  const secs = Math.floor((Date.now() - startTime) / 1000);
  const h = String(Math.floor(secs / 3600)).padStart(2, '0');
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  document.getElementById('uptime').textContent = `${h}:${m}:${s}`;

  // Last sync
  const elapsed = Math.floor((Date.now() - lastSyncTime) / 1000);
  const syncEl = document.getElementById('syncTime');
  if (elapsed < 60) syncEl.textContent = `${elapsed} sec ago`;
  else if (elapsed < 3600) syncEl.textContent = `${Math.floor(elapsed / 60)} min ago`;
  else syncEl.textContent = `${(elapsed / 3600).toFixed(1)} h ago`;

  // Error rate
  if (totalAttempts > 0) {
    const pct = ((failedAttempts / totalAttempts) * 100).toFixed(1);
    document.getElementById('errorRate').textContent = `${pct}%`;
  }
}, 1000);

// ── Stage cards ───────────────────────────────────────────────
document.querySelectorAll('.stage-card').forEach(card => {
  card.addEventListener('click', async () => {
    const stage = card.dataset.stage;
    totalAttempts++;
    try {
      await invoke('run_stage', { stage });
      lastSyncTime = Date.now();
    } catch (e) {
      failedAttempts++;
      console.error('Stage error:', e);
    }
  });
});

// ── Run full pipeline ─────────────────────────────────────────
document.getElementById('runPipeline').addEventListener('click', async () => {
  totalAttempts++;
  try {
    await invoke('run_full_pipeline');
    lastSyncTime = Date.now();
  } catch (e) {
    failedAttempts++;
    console.error('Pipeline error:', e);
  }
});

// ── Settings panel ────────────────────────────────────────────
const panel    = document.getElementById('settingsPanel');
const overlay  = document.getElementById('settingsOverlay');
const gearBtn  = document.getElementById('gearBtn');

function openSettings() {
  panel.classList.add('open');
  overlay.classList.add('visible');
  gearBtn.classList.add('active');
}

function closeSettings() {
  panel.classList.remove('open');
  overlay.classList.remove('visible');
  gearBtn.classList.remove('active');
}

gearBtn.addEventListener('click', () => {
  panel.classList.contains('open') ? closeSettings() : openSettings();
});
overlay.addEventListener('click', closeSettings);
document.getElementById('btnCancel').addEventListener('click', closeSettings);

// ── Browse dialogs (via Tauri dialog plugin or fallback) ──────
// Tauri v2 dialog plugin — если не подключён, покажем alert с инструкцией
document.querySelectorAll('.browse-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const targetId = btn.dataset.target;
    const type     = btn.dataset.type;
    const input    = document.getElementById(targetId);

    try {
      // Tauri v2 dialog API
      const { open } = await import('https://cdn.jsdelivr.net/npm/@tauri-apps/plugin-dialog@2/index.js').catch(() => ({ open: null }));

      if (open) {
        const selected = await open({ directory: type === 'folder', multiple: false });
        if (selected) { input.value = selected; clearError(targetId); }
      } else {
        // Fallback: prompt (временно до добавления плагина)
        const val = prompt(type === 'file' ? 'Введите путь к файлу .spp:' : 'Введите путь к папке:');
        if (val) { input.value = val; clearError(targetId); }
      }
    } catch {
      const val = prompt(type === 'file' ? 'Введите путь к файлу .spp:' : 'Введите путь к папке:');
      if (val) { input.value = val; clearError(targetId); }
    }
  });
});

// ── Save settings ─────────────────────────────────────────────
document.getElementById('btnSave').addEventListener('click', async () => {
  const plantSim = document.getElementById('inputPlantSim').value;
  const workDir  = document.getElementById('inputWorkDir').value;
  const scripts  = document.getElementById('inputScripts').value;

  let hasError = false;

  // Validate (Tauri can't check paths from JS — minimal check)
  [[plantSim, 'inputPlantSim', 'errPlantSim'],
   [workDir,  'inputWorkDir',  'errWorkDir'],
   [scripts,  'inputScripts',  'errScripts']].forEach(([val, inputId, errId]) => {
    if (val && val.trim() === '') {
      showError(inputId, errId);
      hasError = true;
    } else {
      clearError(inputId);
    }
  });

  if (hasError) return;

  try {
    await invoke('save_settings', {
      settings: {
        plant_sim_path: plantSim,
        work_dir: workDir,
        scripts_dir: scripts,
      }
    });
    closeSettings();
  } catch (e) {
    console.error('Save error:', e);
  }
});

function showError(inputId, errId) {
  document.getElementById(inputId).closest('.field-row').classList.add('error');
  document.getElementById(errId).classList.add('visible');
}
function clearError(inputId) {
  const row = document.getElementById(inputId)?.closest('.field-row');
  if (row) row.classList.remove('error');
  // clear all errors for this field
  document.querySelectorAll('.field-error').forEach(el => {
    if (el.id === 'err' + inputId.replace('input', '')) el.classList.remove('visible');
  });
}

// ── Load settings on start ────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const s = await invoke('get_settings');
    if (s.plant_sim_path) document.getElementById('inputPlantSim').value = s.plant_sim_path;
    if (s.work_dir)       document.getElementById('inputWorkDir').value  = s.work_dir;
    if (s.scripts_dir)    document.getElementById('inputScripts').value  = s.scripts_dir;
  } catch (e) {
    console.warn('Could not load settings:', e);
  }
});
