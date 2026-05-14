<!-- generated-by: gsd-doc-writer -->
# Digital Factory — Цифровой завод

Windows-приложение для оркестрации данных между промышленными системами (Vault PDM, Tecnomatix Plant Simulation, AutoCAD, Excel): автоматизирует пайплайн **PDM → импорт → симуляция → отчёт** и помогает команде проверять гипотезы по компоновке завода без ручного перекладывания данных.

## Установка

Скачайте последний релиз из `release/`:

```bash
# Распакуйте архив и запустите установщик
Digital_Factory_vX.Y.Z.zip → setup.exe
```

Установка выполняется в профиль текущего пользователя — права администратора не нужны.  
Если WebView2 отсутствует на машине, установщик скачает его автоматически (~2 МБ).

**Требования:**
- Windows 10 / 11 (64-bit)
- Tecnomatix Plant Simulation 16 (установленный в `C:\Program Files\Siemens\`)

## Быстрый старт

1. Запустите `setup.exe` и установите приложение.
2. Откройте **Digital Factory** из меню Пуск.
3. Нажмите шестерёнку (⚙) в правом верхнем углу и укажите:
   - Путь к ярлыку Plant Simulation (`.lnk`)
   - URL сервера Vault PDM + Bearer-токен (или оставьте пустым для mock-режима)
4. Нажмите кнопку нужного источника в **Шаге 1** чтобы импортировать данные, затем запустите симуляцию в **Шаге 2**.

## Использование

Интерфейс построен как трёхшаговый пайплайн:

### Шаг 1 — Импорт исходных данных

| Источник | Что загружается |
|---|---|
| **Vault PDM** | Состав изделия (BOM) по номеру детали через HTTP API или mock |
| **Excel** | Нормативы и таблицы (mock) |
| **AutoCAD** | Планировочные решения (mock) |

Кликните по карточке источника. Для Vault PDM откроется BOM-дерево с возможностью скачать прикреплённые файлы.

### Шаг 2 — Симуляция производства

Кликните по карточке **Tecnomatix Plant Simulation**:
1. Приложение найдёт ярлык `.lnk` из настроек.
2. Появится диалог выбора файла модели (`.spp`).
3. Введите имя SimTalk-метода (последнее значение сохраняется).
4. Plant Simulation запустится и выполнит расчёт; по завершении приложение прочитает `results.txt`.

### Шаг 3 — Результаты расчёта

После завершения симуляции отображается сетка из 7 метрик:

| Метрика | Единица |
|---|---|
| Загрузка линии | % |
| Пропускная способность | ед./ч |
| Время цикла | сек |
| OEE | % |
| WIP (незавершённое производство) | ед. |
| Lead time | мин |
| Узкое место (Bottleneck) | название станции |

Кнопка **↺ Новый расчёт** сбрасывает пайплайн к шагу 1.

## Сборка из исходников

**Требования для сборки:** Node.js, Rust (stable), cargo-tauri.

```powershell
cd bratsy-tauri
npm install
npx tauri build
```

Для создания дистрибутивного ZIP-архива (NSIS-установщик + source archive):

```powershell
powershell -ExecutionPolicy Bypass -File make-release.ps1
```

Результат: `release\Digital_Factory_vX.Y.Z.zip`

## Настройки

Все настройки сохраняются в `settings.json` рядом с исполняемым файлом (или в `%APPDATA%\Digital Factory\`):

| Параметр | Описание |
|---|---|
| `plant_sim_shortcut` | Путь к `.lnk`-ярлыку Plant Simulation |
| `vault_url` | URL Vault PDM API (`http://host:port`); пусто = mock-режим |
| `vault_token` | Bearer-токен для авторизации в Vault |
| `vault_part_number` | Обозначение изделия по умолчанию |

## Архитектура

```
bratsy-tauri/
├── src-tauri/src/lib.rs   # Rust-бэкенд: Tauri-команды
│   ├── run_plantsim        # Запуск Plant Simulation через .lnk, чтение results.txt
│   ├── vault_get_bom       # HTTP-запрос BOM из Vault PDM (или mock)
│   ├── run_stage           # Mock-запуск для Excel / AutoCAD / report
│   ├── pick_file / pick_folder  # Нативный диалог выбора файла (PowerShell)
│   └── find_plantsim_shortcut   # Резолвинг пути к .lnk из настроек
├── src/
│   ├── index.html          # 3-шаговый UI (аккордеон)
│   ├── main.js             # State machine, Tauri invoke-вызовы, localStorage
│   └── styles.css          # Тёмные/светлые карточки, accordion-шаги
└── src-tauri/tauri.conf.json   # Конфиг: productName, version, NSIS bundling
```

**Стек:** Rust + Tauri v2 (бэкенд), Vanilla HTML/CSS/JS + WebView2 (фронтенд), NSIS (дистрибуция).

## Поддержка

GitHub: [github.com/ney9992/Bratsy_DP](https://github.com/ney9992/Bratsy_DP)
