<!-- generated-by: gsd-doc-writer -->
# Разработка — Digital Factory (Bratsy_DP)

## Локальная настройка среды

### Зависимости

| Инструмент | Версия | Назначение |
|---|---|---|
| Rust toolchain (`rustup`, `cargo`) | stable | Компиляция Rust-бэкенда |
| Node.js + npm | любая LTS | Tauri CLI и сборка |
| Tauri CLI v2 | `^2` (из `node_modules`) | Запуск dev-сборки и release |
| Windows 10 / 11 | 64-bit | Единственная поддерживаемая ОС |
| Tecnomatix Plant Simulation 16 | опционально | Реальная симуляция; есть mock |

### Шаги установки

```
# 1. Клонировать репозиторий
git clone https://github.com/ney9992/Bratsy_DP.git
cd Bratsy_DP

# 2. Установить npm-зависимости (Tauri CLI)
cd bratsy-tauri
npm install

# 3. Скомпилировать Rust-бэкенд в режиме debug
cd src-tauri
cargo build
```

### Первый запуск

После успешного `cargo build` запустите собранный исполняемый файл напрямую:

```
bratsy-tauri\src-tauri\target\debug\bratsy-tauri.exe
```

Приложение откроет окно 1200×660 (не изменяет размер). Файл `settings.json` создаётся автоматически рядом с exe при первом запуске.

---

## Команды сборки

| Команда | Описание |
|---|---|
| `npm run tauri build` | Production-сборка + NSIS-инсталлятор в `src-tauri/target/release/bundle/nsis/` |
| `cargo build` | Debug-компиляция Rust-бэкенда |
| `cargo build --release` | Release-компиляция Rust-бэкенда без упаковки |

Единственный скрипт в `bratsy-tauri/package.json`:

```json
"tauri": "tauri"
```

Tauri CLI находится в `bratsy-tauri/node_modules/.bin/tauri.cmd`.

---

## Скрипт релизной сборки

Для создания дистрибутива используется `make-release.ps1` в корне проекта:

```powershell
powershell -ExecutionPolicy Bypass -File make-release.ps1
```

Скрипт выполняет следующие шаги:

1. **Очищает кэш сборки** (`target/release/build/bratsy-tauri-*`, `.fingerprint/bratsy-tauri-*`, `bratsy-tauri.exe`) — обязательно, иначе фронтенд не перевстраивается в бандл.
2. Запускает `tauri build` через `node_modules/.bin/tauri.cmd`.
3. Находит инсталлятор по маске `*${version}*-setup.exe` (версия берётся из `tauri.conf.json`) — фильтр по версии предотвращает захват старого инсталлятора.
4. Собирает папку `release/Digital Factory vX.Y.Z/` с `setup.exe` и `README.txt`.
5. Пакует в `release/Digital_Factory_vX.Y.Z.zip`.
6. Создаёт source-архив через `git archive HEAD`.

Итоговые артефакты:

```
release/
  Digital_Factory_vX.Y.Z.zip       # дистрибутив
  Digital_Factory_vX.Y.Z_source.zip  # исходники (без target/ и node_modules/)
```

---

## Управление версией

При выходе нового релиза нужно обновить **два места**:

1. **`bratsy-tauri/src-tauri/tauri.conf.json`** — поле `version`:
   ```json
   { "version": "0.2.6" }
   ```

2. **`bratsy-tauri/src/index.html`** — теги cache-busting в `<link>` и `<script>`:
   ```html
   <link rel="stylesheet" href="styles.css?v=0.2.6" />
   ```

Без обновления `?v=` в `index.html` WebView2 может отдавать старый CSS/JS из кэша.

---

## Структура кода

```
bratsy-tauri/
  src/                    # Фронтенд (Vanilla JS + HTML, без шага сборки)
    index.html            # Единственная страница приложения
    main.js               # Вся UI-логика, Tauri IPC, state machine
    styles.css            # Стили панели управления
    assets/               # SVG-иконки
  src-tauri/
    src/
      lib.rs              # Все Tauri-команды и бизнес-логика
      main.rs             # Точка входа (вызывает bratsy_tauri_lib::run())
    tauri.conf.json       # Конфигурация Tauri (productName, version, окно)
    Cargo.toml            # Rust-зависимости
    capabilities/
      default.json        # Разрешения Tauri (capability allowlist)
  dev-tools/
    mock-plantsim.ps1     # Заглушка Plant Simulation для разработки
  package.json            # npm-манифест (только Tauri CLI devDep)
make-release.ps1          # Скрипт релизной сборки (корень проекта)
```

---

## Mock Plant Simulation

Для разработки без установленного Tecnomatix Plant Simulation используйте заглушку:

```powershell
powershell -ExecutionPolicy Bypass -File bratsy-tauri\dev-tools\mock-plantsim.ps1 /S "macro.spm" "C:\path\to\model.spp"
```

Скрипт имитирует 3-шаговую симуляцию (~2 секунды), затем записывает `results.txt` в директорию `.spp`-файла со следующими метриками в формате `key=value`:

```
load=87.3
throughput=42
cycle_time=18.5
oee=78.5
wip=12
lead_time=24.5
bottleneck=Сварочная_станция
```

Rust-команда `run_plantsim()` читает именно этот файл после завершения процесса.

---

## Стиль кода

В проекте нет настроенных линтеров или форматтеров (`.eslintrc`, `biome.json`, `.prettierrc` отсутствуют). Придерживайтесь паттернов, заложенных в `lib.rs`:

- **Rust:** edition 2021, `serde` для всех публичных структур, `#[serde(default)]` на всех полях `Settings`.
- **JavaScript:** ES-модули (`"type": "module"`), без фреймворков, `window.__TAURI__.core.invoke()` для команд, `window.__TAURI__.event.listen()` для событий.
- **PowerShell:** `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` перед любым выводом, `-ExecutionPolicy Bypass` во всех вызовах.

---

## IPC-контракт фронтенд ↔ бэкенд

### Вызовы команд (invoke)

| Команда | Описание |
|---|---|
| `get_settings` | Читает `settings.json` рядом с exe |
| `save_settings` | Сохраняет `settings.json` |
| `find_plantsim_shortcut` | Возвращает путь к `.lnk` из настроек |
| `run_plantsim(lnk_path, spp_path, method)` | Модифицирует ярлык и запускает PlantSim, ждёт завершения |
| `run_stage(stage)` | Запускает один из этапов: `autocad`, `excel`, `report`, `visual_components` |
| `stop_stage(stage)` | Убивает процесс этапа через `taskkill /F /PID` |
| `vault_get_bom(part_number)` | Запрашивает BOM из Vault API или возвращает mock |
| `vault_download_file(file_id, file_name)` | Скачивает файл из Vault в `work_dir/vault/` |
| `pick_file(title, filter, default_path)` | Открывает WinForms OpenFileDialog через PowerShell |
| `pick_folder(title, default_path)` | Открывает WinForms FolderBrowserDialog через PowerShell |

### События (listen)

| Событие | Payload | Описание |
|---|---|---|
| `stage-status` | `{ stage, status }` | `status`: `"running"` / `"done"` / `"error"` |
| `stage-log` | `{ stage, line }` | Строка stdout из дочернего процесса |
| `stage-results` | `{ stage, load, throughput, cycle_time, oee, wip, lead_time, bottleneck }` | Результаты симуляции |
| `vault-bom` | `{ part_number, items[] }` | BOM из Vault PDM |

### State machine (main.js)

Фронтенд отслеживает прогресс через два `Set`:

- `IMPORT_STAGES = { 'pdm', 'excel', 'autocad' }` — завершение всех трёх активирует шаг 2 (симуляция).
- `SIM_STAGES = { 'plantsim' }` — завершение активирует шаг 3 (отчёт).

---

## Соглашения по веткам и PR

Соглашения по именованию веток не задокументированы в репозитории. Основная ветка — `main`.

CI-пайплайн (`.github/workflows/release.yml`) срабатывает только на теги вида `v*.*.*` и публикует GitHub Release с `setup.exe`. В обычных PR автоматической сборки нет.

---

## Известные особенности разработки

- **Очистка кэша перед release-сборкой обязательна.** Tauri кэширует embed фронтенда; без очистки `cargo build` внутри `tauri build` не заметит изменений в `src/`. Скрипт `make-release.ps1` делает это автоматически.
- **Нет шага сборки для фронтенда.** `tauri.conf.json` указывает `"frontendDist": "../src"` — файлы отдаются напрямую из `bratsy-tauri/src/`. Нет webpack/vite/rollup.
- **Диалоги файлов — через PowerShell.** `pick_file` и `pick_folder` запускают PowerShell-скрипт с WinForms — единственный способ получить нативный диалог без COM/WebView2 ограничений. Ожидаемая задержка первого открытия ~500 мс.
- **Plant Simulation запускается через `.lnk`-ярлык.** Прямой запуск exe не поддерживает нужный формат аргументов. Ярлык создаётся/ищется в первой записываемой директории из цепочки: рядом с exe → `%APPDATA%\Digital Factory\` → `%LOCALAPPDATA%\Digital Factory\`.
