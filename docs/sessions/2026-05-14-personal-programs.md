# 2026-05-14 — Персональные программы дронов

## Цель

Реализовать фичу «Персональные программы дронов» (план humming-waddling-orbit.md). У каждого дрона появляется собственная программа-пространство, дополненная опциональной назначенной библиотечной программой.

## Результаты

### Фаза 1 — Типы и модель данных
- `ProgramDef`: добавлен `personal?: boolean`
- `ProgramComponent`: добавлены `personalProgramId: string`, `assignedProgramId?: string`
- `DroneState`: добавлены те же поля, проброшены через `snapshotDrones`
- `createDrone.ts`: инициализация `personalProgramId: ''` (заполняется в миссиях)

### Фаза 2 — Инициализация в миссиях
- mission1–2: дроны без программ теперь стартуют с personalProg (id = String(droneId))
- mission3–4: дроны с библиотечными программами получают personalProg + `assignedProgramId`

### Фаза 3 — Store-экшны
- `assignProgram`: сохраняет `assignedProgramId`
- `unassignProgram`: новый экшн, сбрасывает assigned, возвращает к personal + сбрасывает movement
- `programs`-селектор: фильтрует `personal: true` (5 мест в store)

### Фаза 4 — UI вкладки ДРОН
- Без assigned: один зелёный блок personal, развёрнут по умолчанию, редактируемый; кнопка «Назначить →»
- С assigned: синий блок assigned (↗ → library) + серый блок personal (радио → unassign, кнопка ▼/▲)

### Фаза 5 — UI вкладки БИБЛИОТЕКА
- У каждой программы строка «назначена:» с чипами дронов
- Клик на чип → `selectDrone` + переключение на вкладку DRONE

## Коммиты

- `b5dc51f` feat: Добавить personalProgramId и assignedProgramId в типы и DroneState (Фаза 1)
- `7387d62` feat: Инициализировать personal-программы для дронов в миссиях (Фаза 2)
- `b54f136` feat: Добавить unassignProgram, обновить assignProgram и фильтр programs (Фаза 3)
- `e2456b7` feat: Переработать вкладку ДРОН с блоками personal/assigned (Фаза 4)
- `6d0d25a` fix: Разворачивать блок персональной программы по умолчанию
- `8571113` feat: Добавить чипы назначенных дронов в вкладку LIBRARY (Фаза 5)
