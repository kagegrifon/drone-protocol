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
| [library-modules-import.md](planned/library-modules-import.md) | Подключение модулей в программы дронов (library imports) | planned |


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
| [drone-tab-assigned-program-editor.md](done/drone-tab-assigned-program-editor.md) | Вкладка DRONE: редактор кода назначенной программы (дебаггинг, этап 1) |
| [code-debugging-line-highlight.md](done/code-debugging-line-highlight.md) | Дебаггинг кода: подсветка текущей исполняемой строки (этап 2) |
| [drone-code-mode-core.md](done/drone-code-mode-core.md) | Code Mode (этап 1) — ядро исполнения JS-кода |
| [object-world-api.md](done/object-world-api.md) | Объектный World API для скриптов дронов (Screeps-style) |
| [drone-code-mode-monaco.md](done/drone-code-mode-monaco.md) | Code Mode (этап 2) — редактор Monaco |