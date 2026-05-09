---
status: partial
phase: 02-upravlenie-pajplajnom
source: [02-VERIFICATION.md]
started: 2026-05-09
updated: 2026-05-09
---

## Current Test

[awaiting human testing — запустить `cargo tauri dev` из `bratsy-tauri/`]

## Tests

### 1. Real-Time Status Update
expected: После клика по карточке пилл меняется на "Запущен" (синий) без перезагрузки приложения; через ~2 сек — "Завершён" (зелёный)
result: [pending]

### 2. Stop Running Stage
expected: Повторный клик по активной карточке завершает процесс; пилл → "Ошибка" (красный); в логе появляется "[остановлено пользователем]"
result: [pending]

### 3. Log Lines Streaming
expected: При запуске этапа лог-панель открывается плавно, строки `[stage] step 1/5 ... step 5/5` появляются с интервалом ~400ms с timestamp HH:MM:SS
result: [pending]

### 4. Toast Notifications
expected: При завершении/ошибке — toast в правом нижнем углу; зелёный при success, красный при error; исчезает через 4 сек с анимацией
result: [pending]

### 5. Log Panel Show/Hide
expected: Лог-панель плавно появляется при запуске (CSS transition 0.35s); скрывается через 3 сек после завершения/остановки всех этапов
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
