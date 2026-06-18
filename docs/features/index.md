# Фичи

Файлы фич хранятся по папкам в соответствии со статусом:

```
docs/features/
  planned/   ← описана, ждёт очереди
  done/      ← реализована
```

Фича в разработке остаётся в `planned/` до завершения, статус меняется внутри файла, а так же в таблице этого файла.

## Индекс

### planned

| Файл | Название | Статус |
|---|---|---|
| [congestion-metric.md](planned/congestion-metric.md) | Метрика Congestion (затор дронов) | planned |
| [drone-modifiers.md](planned/drone-modifiers.md) | Система модификаторов дрона | planned |
| [drone-code-mode-core.md](planned/drone-code-mode-core.md) | Code Mode (этап 1) — ядро исполнения JS-кода | ядро и миграция реестра на `behavior: DroneBehavior` готовы |
| [drone-code-mode-monaco.md](planned/drone-code-mode-monaco.md) | Code Mode (этап 2) — редактор Monaco + переключатель | planned |


### done

| Файл | Название |
|---|---|
| [atomic-actions.md](done/atomic-actions.md) | Атомарные игровые действия |
| [personal-programs.md](done/personal-programs.md) | Персональные программы дронов + вкладка PROGRAM |
| [if-condition-editor.md](done/if-condition-editor.md) | Редактор условий IF-блока |
| [time-in-seconds-and-per-drone-controls.md](done/time-in-seconds-and-per-drone-controls.md) | Время в секундах и per-drone управление |
| [world-properties.md](done/world-properties.md) | Свойства объектов мира в условиях IF |
| [missions-atomic-migration.md](done/missions-atomic-migration.md) | Миграция миссий под атомарную семантику |
| [drag-drop-blocks.md](done/drag-drop-blocks.md) | Drag & Drop блоков + визуальный рефактор редактора |
| [work-slots-and-collisions.md](done/work-slots-and-collisions.md) | Эксклюзивные слоты работы и физическая непроходимость дронов |