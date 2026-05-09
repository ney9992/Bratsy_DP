# Phase 2: Управление пайплайном - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Пользователь может запускать и останавливать отдельные этапы пайплайна, видеть их статус в реальном времени и лог выполнения, получать уведомления при завершении или ошибке.

Входит в скоуп: запуск/остановка процессов, real-time статус пиллов, лог-панель, toast-уведомления.
Не входит: реальные PowerShell-скрипты интеграций (Plant Simulation, AutoCAD и т.д.) — они появятся в Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Лог выполнения (UI-03)

- **D-01:** Лог — фиксированная секция под карточками этапов, высота ~130px, тёмный фон (терминал-стиль, monospace шрифт).
- **D-02:** Панель скрыта когда ни один этап не запущен. При запуске — CSS transition (`height: 0 → 130px`), плавное появление.
- **D-03:** Заголовок панели показывает имя активного этапа: `● Plant Simulation — лог`. При завершении заголовок обновляется (Завершён / Ошибка).
- **D-04:** Строки лога добавляются снизу вверх (auto-scroll вниз). Timestamp `HH:MM:SS` перед каждой строкой.

### Уведомления (UI-01)

- **D-05:** Toast в правом нижнем углу, ширина ~300px, border-radius 12px. Автоисчезает через 4 сек с fade-out анимацией.
- **D-06:** Цвет: зелёный (#34C759 accent) = завершение успешно, красный (#FF3B30 accent) = ошибка.
- **D-07:** Текст: `«Plant Simulation» завершён` / `«Plant Simulation» — ошибка`.

### Запуск и остановка (PIPE-02, PIPE-03)

- **D-08:** Toggle-паттерн: клик по карточке запускает, повторный клик по активной карточке останавливает.
- **D-09:** Пока этап активен — иконка на карточке меняется на ■ (стоп). При наведении на активную карточку — border меняется на красный (подсказка что клик = стоп).
- **D-10:** Остановка = kill процесса (не graceful). Приемлемо для заводской среды.

### Real-time статус (PIPE-01)

- **D-11:** Механизм — Tauri events: Rust эмитит события `stage-status` и `stage-log` в JS через `window.emit()`. JS слушает через `window.__TAURI__.event.listen()`.
- **D-12:** Rust хранит запущенные процессы в `Arc<Mutex<HashMap<String, Child>>>`, шарит между командами через Tauri State.
- **D-13:** Статусы: `waiting` / `running` / `done` / `error`. JS обновляет пилл и иконку карточки при получении события.

### Claude's Discretion

- Точные цвета, размеры шрифтов и отступы лог-панели — в стиле существующей цветовой схемы
- Количество строк лога в истории (рекомендую: последние 200 строк)
- Debounce/throttle для событий лога (если процесс выдаёт слишком много строк)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Существующий код (обязательно прочитать)
- `bratsy-tauri/src-tauri/src/lib.rs` — текущие Rust команды, структура Settings, паттерн Command::new
- `bratsy-tauri/src/index.html` — структура UI: stage-cards, data-stage атрибуты, pills
- `bratsy-tauri/src/styles.css` — CSS переменные (--blue, --green, --red, --text), паттерны stage-card, pill-*
- `bratsy-tauri/src/main.js` — invoke() паттерн, setInterval для метрик, closeSettings()

### Требования
- `.planning/REQUIREMENTS.md` — PIPE-01, PIPE-02, PIPE-03, UI-01, UI-03
- `.planning/ROADMAP.md` — Phase 2 Success Criteria (5 конкретных критериев)

### Phase 1 контекст
- `.planning/phases/01-nastrojki-i-konfiguraciya/01-CONTEXT.md` — решения по дизайну, цветам, структуре

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **CSS переменные**: `--blue`, `--green`, `--red`, `--green-light`, `--red-light`, `--gray-light` — использовать для лог-панели и toast
- **CSS transition паттерн**: `transition: transform 0.3s cubic-bezier(...)` из settings-panel — аналогично для лог-панели
- **`invoke()` из main.js**: стандартный способ вызова Rust команд из JS
- **`window.__TAURI__.event.listen()`**: доступен через `withGlobalTauri: true` в tauri.conf.json

### Established Patterns
- **Tauri State**: `app.state::<T>()` для шаринга данных между командами (нужно для процессов)
- **Stage cards**: `data-stage` атрибут на `.stage-card` — использовать для маппинга этап → процесс
- **Pills**: классы `pill-ready`, `pill-active`, `pill-idle` — добавить `pill-done`, `pill-error`

### Integration Points
- JS должен слушать события ДО клика на карточку: `listen('stage-status', handler)` в `DOMContentLoaded`
- Rust команда `run_stage` будет реструктурирована: станет неблокирующей (spawn async task, emit events)
- `stop_stage(stage: String)` — новая команда, убивает Child из Mutex HashMap

</code_context>

<specifics>
## Specific Ideas

- Лог-панель: тёмный фон `#1C1C1E` или `#2C2C2E`, текст `#E5E5EA`, шрифт `Menlo, Consolas, monospace` 12px
- Toast: появляется снизу вверх (`transform: translateY(100%) → translateY(0)`), аналог iOS notification

</specifics>

<deferred>
## Deferred Ideas

- Реальные PowerShell-скрипты интеграций (AutoCAD, Vault, PlantSim) — Phase 3
- История запусков (когда, кто, результат) — после Phase 3
- Прогресс-бар внутри карточки (% завершения) — можно добавить позже если скрипты возвращают прогресс

</deferred>

---

*Phase: 2-upravlenie-pajplajnom*
*Context gathered: 2026-05-09*
