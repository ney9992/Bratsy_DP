---
phase: 3
slug: integraciya-plant-simulation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Ручное тестирование (unit-тест фреймворк не используется в проекте) |
| **Config file** | none |
| **Quick run command** | `npm run tauri dev` (из bratsy-tauri/) |
| **Full suite command** | `npm run tauri dev` + ручная проверка каждого из 4 Success Criteria |
| **Estimated runtime** | ~60–90 секунд до UI |

---

## Sampling Rate

- **After every task commit:** Run `npm run tauri dev` — убедиться, что приложение компилируется и запускается
- **After every plan wave:** Ручная проверка изменённых фич по ROADMAP Success Criteria
- **Before `/gsd-verify-work`:** Все 4 Success Criteria зелёные
- **Max feedback latency:** ~90 секунд (время сборки Tauri)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | INT-03 | T-01 | plant_sim_exe и plant_sim_macro сохраняются в settings.json | smoke (manual) | `npm run tauri dev` + сохранить настройки | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | INT-03 | T-01 | Новые поля появляются в панели настроек | smoke (manual) | `npm run tauri dev` + открыть settings | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 2 | INT-01 | T-02 | `run_stage("plantsim")` запускает PlantSim.exe или mock | smoke (manual) | `npm run tauri dev` + клик PlantSim stage | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 2 | INT-01 | T-02 | Ошибка config (exe не найден) → диалог, не crash | smoke (manual) | Очистить plant_sim_exe, кликнуть PlantSim | ❌ W0 | ⬜ pending |
| 3-02-03 | 02 | 2 | INT-02 | T-03 | results.txt парсится: load/throughput/cycle_time → числа | smoke (manual) | Создать mock results.txt, запустить mock PlantSim | ❌ W0 | ⬜ pending |
| 3-02-04 | 02 | 2 | INT-02 | T-03 | Отсутствие results.txt → warning в лог, пустая панель | smoke (manual) | Запуск без results.txt | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 3 | PIPE-04 | T-04 | Панель результатов появляется после stage-results | smoke (manual) | Проверить DOM после получения события | ❌ W0 | ⬜ pending |
| 3-03-02 | 03 | 3 | PIPE-04 | T-04 | 3 карточки показывают правильные числа из results.txt | smoke (manual) | Сравнить #resLoad, #resThroughput, #resCycleTime с файлом | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `bratsy-tauri/dev-tools/mock-plantsim.ps1` — PowerShell-скрипт: пишет `work_dir/results.txt` со значениями (load=87.3, throughput=42, cycle_time=18.5) и завершается с exit code 0. Заменяет реальный PlantSim.exe при разработке.

*Нет тест-фреймворка — это нормально для данного проекта. Mock-скрипт — единственный Wave 0 артефакт.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PlantSim.exe запускается с реальными файлами .spp и .spm | INT-01 | PlantSim.exe отсутствует в dev-среде | Тест на реальном заводском ПК: задать пути в настройках, нажать PlantSim, проверить статус «Запущен» |
| Правильный синтаксис CLI `/S:"macro.spm" "file.spp"` | INT-01 | Зависит от версии PlantSim (ASSUMED) | Проверить, что PlantSim открывает файл и выполняет макрос без ошибок |
| SimTalk-макрос записывает results.txt | INT-02 | SimTalk пишется отдельно командой | После реального запуска проверить наличие work_dir/results.txt с ключами load/throughput/cycle_time |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
