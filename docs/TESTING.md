<!-- generated-by: gsd-doc-writer -->
# TESTING.md — Bratsy_DP (Цифровой завод)

## Test framework and setup

The project has **no automated test suite**. There are no unit, integration, or end-to-end test files in the codebase, and no test framework (`jest`, `vitest`, `pytest`, etc.) is installed. All validation is done through manual exploratory testing and a mock tool for the simulation pipeline.

Required before testing:

1. Build the dev server:
   ```bash
   cd bratsy-tauri
   npx tauri dev
   ```
2. Or build and install the production artifact:
   ```powershell
   powershell -ExecutionPolicy Bypass -File make-release.ps1
   ```

## Running tests

### Development build (manual testing entry point)

```bash
cd bratsy-tauri
npx tauri dev
```

This launches the Tauri window in dev mode with hot-reload. Use it to exercise the full UI manually.

### Mock PlantSimulation

`bratsy-tauri/dev-tools/mock-plantsim.ps1` replaces `PlantSimulation16.exe` for development without the real Siemens software installed.

**Setup:**

1. Create a `.lnk` shortcut whose target is `powershell -File "<absolute-path>\mock-plantsim.ps1"`.
2. Open Settings (gear icon) in the app and point `plant_sim_shortcut` to that `.lnk` file.
3. Click the Tecnomatix card in Step 2 to trigger the mock run.

**What the mock does:**

- Accepts the same arguments as a real `.lnk` launch (`-f "<model.spp>" /E <method>`).
- Writes `results.txt` to the same directory as the `.spp` file (or the current directory if the file path does not exist) with seven hardcoded key=value lines (UTF-8, no BOM):
  ```
  load=87.3
  throughput=42
  cycle_time=18.5
  oee=78.5
  wip=12
  lead_time=24.5
  bottleneck=Сварочная_станция
  ```
- Exits with code 0 after approximately 2 seconds.
- The app backend reads `results.txt` and emits a `stage-results` Tauri event, which populates the Step 3 report cards.

## Manual test checklist

Run these scenarios manually after every significant change to `src/main.js`, `src-tauri/src/lib.rs`, or `src/index.html`.

### Pipeline flow

| # | Action | Expected result |
|---|--------|-----------------|
| 1 | Click Vault PDM card (with empty `vault_url`) | BOM panel opens with a 7-item collapsible tree (`МЧД-001` hierarchy) |
| 2 | Click Excel card | Card transitions to Running, then Done; step counter updates to `1 / 3` |
| 3 | Click AutoCAD card | Card transitions to Running, then Done; counter updates to `2 / 3` |
| 4 | After all 3 cards Done | Step 1 transitions to `step-done`; Step 2 unlocks and becomes active |
| 5 | In Step 2, verify Visual Components card | Card has `card-disabled` class and is grayed out (not clickable) |
| 6 | Click Tecnomatix card → select `.spp` file → enter method | File picker opens, method prompt appears |
| 7 | After mock run completes | Step 3 report shows 7 metrics: Load `87.3`, Throughput `42`, Cycle time `18.5`, OEE `78.5`, WIP `12`, Lead time `24.5`, Bottleneck `Сварочная станция` |
| 8 | Click "↺ Новый расчёт" | All pipeline state resets to initial; all report values show `—` |

### Settings persistence

| # | Action | Expected result |
|---|--------|-----------------|
| 9 | Save `plant_sim_shortcut` via Settings panel | Value persists to `settings.json` next to the executable |
| 10 | Close and reopen the app | `plant_sim_shortcut` field pre-filled from saved `settings.json` |
| 11 | Enter a method in the SimTalk prompt and complete a run | `lastSimMethod` stored in `localStorage`; next PlantSim run pre-fills the prompt with this value |
| 12 | Close and reopen the app, trigger PlantSim again | `lastSimMethod` prompt still pre-filled (persists across sessions) |

### Encoding and file paths

| # | Action | Expected result |
|---|--------|-----------------|
| 13 | Use a `.spp` file path containing Cyrillic characters (e.g., `C:\Проекты\модель.spp`) | File picker returns the path correctly; `run_plantsim` receives the unmangled path |
| 14 | `results.txt` contains Cyrillic in the `bottleneck` field | `rptBottleneck` DOM element shows the value correctly (UTF-8 decoded) |

### Release artifact

| # | Action | Expected result |
|---|--------|-----------------|
| 15 | Run `make-release.ps1` | Script reads `version` from `bratsy-tauri/src-tauri/tauri.conf.json` and packs the installer matching `*${version}*-setup.exe` (not an old `0.1.0` installer) |
| 16 | Launch the installed app | App header shows version matching `tauri.conf.json` (currently `0.2.6`) |
| 17 | Inspect `index.html` cache-busting query strings | `styles.css?v=0.2.6` and `main.js?v=0.2.6` match `tauri.conf.json` version |

### Vault mock (empty `vault_url`)

| # | Action | Expected result |
|---|--------|-----------------|
| 18 | Open Settings, leave `vault_url` blank, click Vault PDM | Log shows `[mock] Vault URL не задан — загружаю тестовые данные`; BOM panel renders 7 items |
| 19 | Expand BOM tree nodes | Items show collapsible hierarchy: root → Module 1 → wall panel / profile; root → Module 2 → floor panel / fasteners |

## Coverage requirements

No coverage threshold is configured. There is no automated test runner and no coverage tooling in the project.

## CI integration

No CI/CD pipeline is configured. There are no `.github/workflows/` files in the repository. All builds and releases are produced locally by running `make-release.ps1`.

## Known issues and limitations

- **`stage-results` may not fire if PlantSim closes before writing `results.txt`.** The Rust backend reads `results.txt` only after the `Start-Process -Wait` PowerShell command returns with exit code 0. If the real Plant Simulation exits non-zero or crashes before writing the file, the Step 3 report will not populate (log shows `[warning] results.txt не найден`).
- **`Start-Process -FilePath <lnk> -Wait` reliability.** On some Windows versions, this pattern may return before the launched process actually finishes. When testing with the real Siemens software, verify that `results.txt` is present before the app backend reads it. The mock tool is not affected because it writes the file synchronously before exiting.
- **Visual Components card is permanently disabled.** The `card-disabled` class is set in `index.html` directly. There is no runtime toggle for it — this integration is not yet implemented.
