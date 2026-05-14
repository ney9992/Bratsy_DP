const { invoke } = window.__TAURI__.core;
const { listen }  = window.__TAURI__.event;
const { getVersion } = window.__TAURI__.app;

// ── Версия в заголовке ─────────────────────────────────────────
getVersion().then(v => {
  const el = document.getElementById('appVersion');
  if (el) el.textContent = 'v' + v;
});

// ── Метаданные этапов ──────────────────────────────────────────
const PIPELINE = ['pdm', 'excel', 'autocad', 'plantsim'];
const STAGE_LABELS = {
  pdm: 'Vault PDM', excel: 'Excel', autocad: 'AutoCAD', plantsim: 'Tecnomatix',
};

// ── Uptime / статус ────────────────────────────────────────────
let failedAttempts = 0;
const startMs = Date.now();

setInterval(() => {
  const s = Math.floor((Date.now() - startMs) / 1000);
  document.getElementById('uptimeEl').textContent =
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}, 1000);

function updateErrChip() {
  const el = document.getElementById('errRate');
  el.textContent = `${failedAttempts} ош.`;
  el.classList.toggle('err', failedAttempts > 0);
}

// ── Консоль ────────────────────────────────────────────────────
const consoleBody = document.getElementById('consoleBody');

function ts() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`;
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function clog(text, type = 'log', stage = null) {
  const line = document.createElement('span');
  line.className = `cline cline-${type}`;
  let html = `<span class="ts">${ts()}</span>`;
  if (stage) html += `<span class="tag tag-${stage}">${esc(STAGE_LABELS[stage] || stage)}</span>`;
  html += esc(text);
  line.innerHTML = html;
  consoleBody.appendChild(line);
  consoleBody.scrollTop = consoleBody.scrollHeight;
}

function csep() {
  const el = document.createElement('span');
  el.className = 'cline cline-sep';
  consoleBody.appendChild(el);
  consoleBody.scrollTop = consoleBody.scrollHeight;
}

document.getElementById('btnClearConsole').addEventListener('click', () => {
  consoleBody.innerHTML = '';
  clog('Консоль очищена.', 'sys');
});

// ── Подписка на события Tauri ──────────────────────────────────
listen('stage-log', (evt) => {
  clog(evt.payload.line, 'log', evt.payload.stage);
});

listen('stage-status', (evt) => {
  const { stage, status } = evt.payload;
  setPill(stage, status);
  if (status === 'done')  clog('✓ Завершён', 'ok', stage);
  if (status === 'error') clog('✗ Ошибка', 'err', stage);
});

listen('stage-results', (evt) => {
  const v = evt.payload;
  csep();
  clog('══ РЕЗУЛЬТАТЫ СИМУЛЯЦИИ ══════════════', 'header');
  clog(`Загрузка:      ${v.load}%`,           'result');
  clog(`Выпуск:        ${v.throughput} ед/ч`, 'result');
  clog(`Цикл:          ${v.cycle_time} с`,    'result');
  clog(`OEE:           ${v.oee}%`,            'result');
  clog(`WIP:           ${v.wip} ед.`,         'result');
  clog(`Lead time:     ${v.lead_time} мин`,   'result');
  clog(`Узкое место:   ${v.bottleneck}`,      'result');
  csep();
});

listen('vault-bom', (evt) => {
  clog(`BOM: ${evt.payload.part_number} — ${evt.payload.items.length} поз.`, 'ok', 'pdm');
});

// ── Пилюли статуса ─────────────────────────────────────────────
function setPill(stage, status) {
  const pill = document.getElementById(`pill-${stage}`);
  if (!pill) return;
  const MAP = {
    idle:    ['pill-idle',    'Ожидание'],
    running: ['pill-running', 'Запущен'],
    done:    ['pill-done',    'Завершён'],
    error:   ['pill-error',   'Ошибка'],
  };
  const [cls, label] = MAP[status] || MAP.idle;
  pill.className = `stage-pill ${cls}`;
  pill.innerHTML = `<span class="dot"></span>${label}`;
  const row = pill.closest('.stage-row');
  if (row) {
    row.classList.remove('running', 'done', 'error');
    if (status !== 'idle') row.classList.add(status);
  }
}

function resetPills() {
  PIPELINE.forEach(s => setPill(s, 'idle'));
}

// ── Переключатели тест / реал ──────────────────────────────────
function getMode(stage) { return localStorage.getItem(`mode_${stage}`) || 'test'; }
function setMode(stage, mode) { localStorage.setItem(`mode_${stage}`, mode); }

document.querySelectorAll('.mode-toggle').forEach(toggle => {
  const stage = toggle.dataset.stage;
  const track = toggle.querySelector('.toggle-track');
  const thumb = toggle.querySelector('.toggle-thumb');
  const testLbl = toggle.querySelector('.test-lbl');
  const realLbl = toggle.querySelector('.real-lbl');

  applyToggle(track, thumb, testLbl, realLbl, getMode(stage) === 'real');

  toggle.addEventListener('click', () => {
    const nowReal = getMode(stage) !== 'real';
    setMode(stage, nowReal ? 'real' : 'test');
    applyToggle(track, thumb, testLbl, realLbl, nowReal);
  });
});

function applyToggle(track, thumb, testLbl, realLbl, isReal) {
  thumb.style.left = isReal ? '20px' : '2px';
  track.classList.toggle('is-real', isReal);
  testLbl.classList.toggle('active', !isReal);
  realLbl.classList.toggle('active', isReal);
}

// ── Кнопка запуска ─────────────────────────────────────────────
let pipelineRunning = false;

const btnLaunch   = document.getElementById('btnLaunch');
const launchText  = document.getElementById('launchText');
const launchIcon  = document.getElementById('launchIcon');
const launchStatus = document.getElementById('launchStatus');

const ICON_PLAY = '<polygon points="5 3 19 12 5 21 5 3"/>';
const ICON_STOP = '<rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/>';

btnLaunch.addEventListener('click', () => {
  if (pipelineRunning) stopPipeline();
  else startPipeline();
});

function setLaunchState(state) {
  btnLaunch.className = `launch-btn${state ? ' ' + state : ''}`;
  if (state === 'running') {
    launchIcon.innerHTML = ICON_STOP;
    launchText.innerHTML = 'Остановить';
    launchStatus.textContent = 'Пайплайн выполняется...';
  } else if (state === 'done') {
    launchIcon.innerHTML = ICON_PLAY;
    launchText.innerHTML = 'Запуск<br>Цифрового завода';
    launchStatus.textContent = 'Завершено успешно';
  } else if (state === 'error') {
    launchIcon.innerHTML = ICON_PLAY;
    launchText.innerHTML = 'Запуск<br>Цифрового завода';
    launchStatus.textContent = 'Ошибка — см. консоль';
  } else {
    launchIcon.innerHTML = ICON_PLAY;
    launchText.innerHTML = 'Запуск<br>Цифрового завода';
    launchStatus.textContent = 'Готов к запуску';
  }
}

// ── Запуск пайплайна ───────────────────────────────────────────
async function startPipeline() {
  pipelineRunning = true;
  setLaunchState('running');
  resetPills();
  csep();
  clog('▶ Запуск пайплайна', 'header');

  let success = true;
  for (const stage of PIPELINE) {
    if (!pipelineRunning) { success = false; break; }
    const mode = getMode(stage);
    clog(`Этап: ${STAGE_LABELS[stage]} [${mode === 'real' ? 'реальный' : 'тест'}]`, 'sys');
    setPill(stage, 'running');

    try {
      if (mode === 'test') await runTest(stage);
      else await runReal(stage);
      setPill(stage, 'done');
    } catch (e) {
      setPill(stage, 'error');
      clog(String(e.message || e), 'err', stage);
      failedAttempts++;
      updateErrChip();
      success = false;
      break;
    }
  }

  pipelineRunning = false;
  document.getElementById('syncStatus').textContent = '● Синхр.';

  if (success) {
    setLaunchState('done');
    clog('✓ Пайплайн завершён', 'ok');
    setTimeout(() => setLaunchState(''), 5000);
  } else {
    setLaunchState('error');
    setTimeout(() => setLaunchState(''), 5000);
  }
}

function stopPipeline() {
  pipelineRunning = false;
  clog('⏹ Остановлено пользователем', 'warn');
  PIPELINE.forEach(s => {
    const p = document.getElementById(`pill-${s}`);
    if (p?.classList.contains('pill-running')) setPill(s, 'idle');
  });
  PIPELINE.forEach(s => invoke('stop_stage', { stage: s }).catch(() => {}));
}

// ── Тестовый режим: чистый JS-мок ─────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest(stage) {
  for (let i = 1; i <= 3; i++) {
    if (!pipelineRunning) throw new Error('Остановлено');
    clog(`шаг ${i}/3`, 'log', stage);
    await sleep(500);
  }
}

// ── Рабочий режим: реальные команды ───────────────────────────
function waitForStage(stage) {
  return new Promise(async (resolve, reject) => {
    const check = setInterval(() => {
      if (!pipelineRunning) { clearInterval(check); reject(new Error('Остановлено')); }
    }, 300);

    const unlisten = await listen('stage-status', (evt) => {
      if (evt.payload.stage !== stage) return;
      const s = evt.payload.status;
      if (s === 'done' || s === 'error') {
        clearInterval(check);
        unlisten();
        s === 'done' ? resolve() : reject(new Error(`Ошибка в этапе ${stage}`));
      }
    });
  });
}

async function runReal(stage) {
  switch (stage) {

    case 'pdm': {
      const s = await invoke('get_settings');
      await invoke('vault_get_bom', { partNumber: s.vault_part_number || '' });
      break;
    }

    case 'excel':
    case 'autocad': {
      const waiter = waitForStage(stage);
      await invoke('run_stage', { stage });
      await waiter;
      break;
    }

    case 'plantsim': {
      const s = await invoke('get_settings');
      const lnkPath = await invoke('find_plantsim_shortcut');
      const sppPath = s.spp_path || '';
      if (!sppPath) throw new Error('Путь к .spp модели не задан — откройте Настройки');
      const method = s.sim_method || localStorage.getItem('lastSimMethod') || '.UserObjects.printed';
      const waiter = waitForStage('plantsim');
      await invoke('run_plantsim', { lnkPath, sppPath, method });
      if (method) localStorage.setItem('lastSimMethod', method);
      await waiter;
      break;
    }

    default:
      throw new Error(`Неизвестный этап: ${stage}`);
  }
}

// ── Настройки ──────────────────────────────────────────────────
const settingsOverlay = document.getElementById('settingsOverlay');

document.getElementById('btnSettings').addEventListener('click', openSettings);
document.getElementById('btnCloseSettings').addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', e => { if (e.target === settingsOverlay) closeSettings(); });

function openSettings() {
  settingsOverlay.classList.add('open');
  loadSettings();
}
function closeSettings() {
  settingsOverlay.classList.remove('open');
}

async function loadSettings() {
  try {
    const s = await invoke('get_settings');
    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    set('inputPlantSimShortcut', s.plant_sim_shortcut);
    set('inputSppPath',          s.spp_path);
    set('inputSimMethod',        s.sim_method);
    set('inputVaultUrl',         s.vault_url);
    set('inputVaultToken',       s.vault_token);
    set('inputVaultPartNumber',  s.vault_part_number);
  } catch (e) { console.error(e); }
}

document.getElementById('btnSave').addEventListener('click', async () => {
  try {
    const s = await invoke('get_settings');
    const g = id => document.getElementById(id)?.value || '';
    await invoke('save_settings', { settings: {
      ...s,
      plant_sim_shortcut: g('inputPlantSimShortcut'),
      spp_path:           g('inputSppPath'),
      sim_method:         g('inputSimMethod'),
      vault_url:          g('inputVaultUrl'),
      vault_token:        g('inputVaultToken'),
      vault_part_number:  g('inputVaultPartNumber'),
    }});
    showToast('Настройки сохранены', 'success');
    closeSettings();
  } catch (e) { showToast('Ошибка сохранения', 'error'); }
});

// ── Browse кнопки ──────────────────────────────────────────────
document.querySelectorAll('.browse-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const targetId = btn.dataset.target;
    const type = btn.dataset.type;
    try {
      let selected;
      if (type === 'folder') {
        selected = await invoke('pick_folder', { title: 'Выберите папку', defaultPath: '' });
      } else {
        const filter =
          targetId === 'inputPlantSimShortcut' ? 'Ярлык Plant Simulation (*.lnk)|*.lnk|Все файлы (*.*)|*.*' :
          targetId === 'inputSppPath'           ? 'Plant Simulation Model (*.spp)|*.spp|Все файлы (*.*)|*.*' :
                                                  'Все файлы (*.*)|*.*';
        selected = await invoke('pick_file', { title: 'Выберите файл', filter, defaultPath: '' });
      }
      if (selected) document.getElementById(targetId).value = selected;
    } catch (e) { console.error(e); }
  });
});

// ── Toasts ─────────────────────────────────────────────────────
function showToast(msg, type = '') {
  const t = document.createElement('div');
  t.className = `toast${type ? ' ' + type : ''}`;
  t.textContent = msg;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
