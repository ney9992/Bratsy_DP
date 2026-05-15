# SimTalk-шаблон для DP_orchestra

Данный шаблон описывает SimTalk-метод, который должен быть создан в модели Plant Simulation для корректной работы с DP_orchestra.

## Требования к модели

1. **File > Model Settings > General > Security**: снять галочку "Prohibit access to the computer"
2. Создать объект `FileInterface` в папке `InformationFlow` модели
3. Создать метод `.UserObjects.printed` в папке `UserObjects`

## Контракт результатов (results.txt)

После завершения симуляции метод должен записать в `{work_dir}\results.txt` строки в формате `ключ=значение`:

```
load=87.3
throughput=42
cycle_time=18.5
```

DP_orchestra парсит эти строки и показывает значения в панели отчёта. Ключи `load`, `throughput`, `cycle_time` — фиксированный контракт.

## Вариант 1: Получить work_dir через getCommandLineArg (рекомендуется)

DP_orchestra передаёт `--workdir "C:\путь"` в аргументах при запуске. SimTalk читает это значение:

```simtalk
-- Метод: .UserObjects.printed
-- Запускается через: PlantSimulation.exe -f "model.spp" /E .UserObjects.printed --workdir "C:\bratsy_work"

var fi : object
var workDir : string
var found : boolean

-- Читаем рабочую директорию из аргументов командной строки
found := getCommandLineArg("--workdir", workDir)
if not found
    -- Fallback: писать рядом с .spp файлом
    workDir := getCurrentDirectory
end

-- Запустить симуляцию
EventController.startSim
-- EventController.startSim блокирует до завершения

-- Записать результаты
fi := .InformationFlow.FileInterface
fi.FileName := workDir + "\\results.txt"
fi.Encoding := "UTF-8"
fi.open
-- ЗАМЕНИТЬ на реальные атрибуты объектов вашей модели:
fi.writeLn("load=" + num_to_str(Station.statPercBusy))
fi.writeLn("throughput=" + num_to_str(Sink.statNumExited))
fi.writeLn("cycle_time=" + num_to_str(Station.statTimeProc))
fi.close     -- ОБЯЗАТЕЛЬНО до exitApplication

exitApplication
```

## Вариант 2: Хардкод пути (быстрее, но не переносимо)

```simtalk
-- Метод: .UserObjects.printed

var fi : object

EventController.startSim

fi := .InformationFlow.FileInterface
fi.FileName := "C:\\bratsy_work\\results.txt"   -- двойной backslash обязателен в SimTalk
fi.Encoding := "UTF-8"
fi.open
fi.writeLn("load=" + num_to_str(Station.statPercBusy))
fi.writeLn("throughput=" + num_to_str(Sink.statNumExited))
fi.writeLn("cycle_time=" + num_to_str(Station.statTimeProc))
fi.close

exitApplication
```

## Вариант 3: Через endSim (для длинных симуляций)

```simtalk
-- Метод: .Models.Frame.endSim
-- Plant Simulation вызывает автоматически в конце симуляции

var fi : object
var workDir : string

getCommandLineArg("--workdir", workDir)
if workDir = ""
    workDir := getCurrentDirectory
end

fi := .InformationFlow.FileInterface
fi.FileName := workDir + "\\results.txt"
fi.Encoding := "UTF-8"
fi.open
fi.writeLn("load=" + num_to_str(Station.statPercBusy))
fi.writeLn("throughput=" + num_to_str(Sink.statNumExited))
fi.writeLn("cycle_time=" + num_to_str(Station.statTimeProc))
fi.close     -- СНАЧАЛА close, ПОТОМ exitApplication

exitApplication
```

## Диагностика

### results.txt не создаётся

1. Проверить: File > Model Settings > General > Security > "Prohibit access to the computer" = OFF
2. Проверить что `fi.open` возвращает true (добавить проверку: `if not fi.open then ... end`)
3. Попробовать писать в папку рядом с .spp (getCurrentDirectory)

### PlantSim открывается, но метод не выполняется

1. Проверить точный путь метода: `/E .UserObjects.printed` — точка перед UserObjects обязательна
2. Открыть PlantSim вручную → Tools → Check Model (F9) — ошибки в методе

### Кодировка: кракозябры в results.txt

Добавить явно: `fi.Encoding := "UTF-8"` до `fi.open`

### Симуляция не останавливается

Убедиться что в endSim или в .UserObjects.printed есть `exitApplication` ПОСЛЕ `fi.close`.

## Ручная проверка перед запуском из DP_orchestra

```cmd
"C:\path\to\PlantSimulation16.exe" -f "C:\path\to\model.spp" /E .UserObjects.printed --workdir "C:\bratsy_work"
```

Ожидание: PlantSim открывается, симуляция запускается, PlantSim закрывается. В `C:\bratsy_work\results.txt` появляются три строки с числами.
