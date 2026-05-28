---
name: session-metrics-hook-design
description: Stop-хук для автоматической записи метрик токенов/стоимости в session-файлы
metadata:
  type: spec
---

# Session Metrics Hook — Дизайн

**Дата:** 2026-05-28  
**Статус:** approved

## Цель

Автоматически дописывать секцию `## Метрики сессии` в конец session-файлов (`docs/sessions/*.md`) сразу после их создания — без участия пользователя.

## Источник данных

Транскрипт JSONL (`~/.claude/projects/<project>/sessions/<session_id>.jsonl`).  
Путь передаётся Stop-хуку в stdin как `transcript_path`.

Каждая запись-ответ Claude содержит `message.usage`:

```json
{
  "input_tokens": 3,
  "cache_creation_input_tokens": 715,
  "cache_read_input_tokens": 81427,
  "output_tokens": 1714
}
```

Поле `message.model` содержит имя модели (`claude-sonnet-4-6`).

## Формат секции в session-файле

```markdown
## Метрики сессии
- Модель: claude-sonnet-4-6
- Input: 24,830 токенов (кеш: 81,427 / запись в кеш: 12,450)
- Output: 8,210 токенов
- Контекст: 94,380 / 200,000 токенов (47%)
- Стоимость: $0.184
```

Значения:
- **Input** = сумма `input_tokens` по всем сообщениям сессии
- **кеш** = сумма `cache_read_input_tokens` (в скобках — дешевле)
- **запись в кеш** = сумма `cache_creation_input_tokens`
- **Output** = сумма `output_tokens`
- **Контекст** = из последнего сообщения: `input_tokens + cache_read_input_tokens + cache_creation_input_tokens` / 200000
- **Стоимость** = по прайсу Sonnet 4.6: input×$3/M, cache_write×$3.75/M, cache_read×$0.30/M, output×$15/M

## Механизм

### Stop-хук

Срабатывает после каждого завершённого ответа Claude.  
Команда: PowerShell-скрипт `.claude/scripts/append-session-metrics.ps1`.

Логика скрипта:
1. Читает stdin JSON → получает `transcript_path`
2. Парсит JSONL — суммирует поля usage по всем assistant-записям
3. Берёт `model` из последней assistant-записи
4. Ищет `docs/sessions/*.md` файлы в рабочей директории сессии, изменённые < 60 секунд назад
5. Проверяет, что файл не содержит уже `## Метрики сессии` (защита от двойной записи)
6. Дописывает секцию в конец файла

### Конфигурация хука

В `~/.claude/settings.json` (глобально, не в проекте):

```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "powershell -NoProfile -File 'C:/Users/Master/.claude/scripts/append-session-metrics.ps1'",
        "shell": "powershell",
        "timeout": 10
      }]
    }]
  }
}
```

Хук глобальный (user settings), потому что логика применима ко всем проектам, а не только к `robot-protocol`.

## Ценовая модель

Прайс захардкожен для Sonnet 4.6 (основная модель проекта). Если транскрипт содержит другую модель — стоимость считается по тем же коэффициентам (может быть неточной).

| Тип | Цена за 1M токенов |
|-----|-------------------|
| Input | $3.00 |
| Cache write | $3.75 |
| Cache read | $0.30 |
| Output | $15.00 |

Контекстное окно: **200,000 токенов** (Sonnet 4.6).

## Граничные случаи

- **Нет session-файла < 60 сек**: скрипт ничего не делает (тихий выход)
- **Секция уже есть**: пропустить (проверка по заголовку `## Метрики сессии`)
- **Транскрипт пустой / без usage**: пропустить
- **Несколько session-файлов < 60 сек**: дописать в каждый (редкий случай, безвредно)

## Файлы

- `.claude/scripts/append-session-metrics.ps1` — скрипт (глобальный, в `~/.claude/scripts/`)
- `~/.claude/settings.json` — Stop-хук (глобальный user settings)
