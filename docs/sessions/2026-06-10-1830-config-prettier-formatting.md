# 2026-06-10 18:30 — Настройка единого форматирования (Prettier + EditorConfig)

## Цель
Решить проблему автоматического переформатирования файлов при открытии в VS Code (скачущие кавычки, отступы, переносы строк).

## Проблема
- В проекте не было конфигов форматирования (ни Prettier, ни EditorConfig)
- Файлы написаны в смешанном стиле: 209 одинарных кавычек vs 127 двойных
- VS Code форматировал по своим дефолтам при сохранении → расходился с репозиторием → diff

## Решение
Установлен **Prettier 3.8.4** + **EditorConfig** + **VS Code settings**:

### Конфиги
- `.prettierrc.json` — singleQuote: false, tabWidth: 2, semi: true, printWidth: 80, trailingComma: all, endOfLine: lf, arrowParens: always
- `.prettierignore` — исключены node_modules, dist, *.md
- `.editorconfig` — базовые правила (utf-8, LF, 2 пробела, trim trailing whitespace)
- `.vscode/settings.json` — defaultFormatter: Prettier, formatOnSave: true, files.eol: "\n"
- `.vscode/extensions.json` — рекомендации esbenp.prettier-vscode, editorconfig.editorconfig
- `package.json` — скрипты `format` и `format:check`

### Выполненные шаги
1. `npm install --save-dev prettier`
2. Создано 5 конфиг-файлов
3. `npx prettier --write .` — переформатирован весь проект
4. Проверка: type-check ✅, 225 unit-тестов ✅, prettier --check ✅
5. Коммит: `chore: настроить Prettier и единое форматирование`

## Результат
✅ Выполнено. Весь проект переформатирован под единый стандарт (двойные кавычки, 2 пробела, LF, точка с запятой).

Пользователю нужно установить в VS Code расширение **Prettier - Code formatter** (`esbenp.prettier-vscode`). Редактор предложит его автоматически.

## Что дальше
После установки расширения Prettier в VS Code:
- При открытии файла → VS Code читает `.editorconfig` + `.prettierrc.json`
- При сохранении → Prettier форматирует по единому стандарту
- Рассинхрона исчезнет

## Метрики сессии
- Модель: claude-haiku-4-5-20251001
- Input: 17,334 токенов (кеш: 1,397,452 / запись в кеш: 102,066)
- Output: 16,112 токенов
- Контекст: 42,175 / 200,000 токенов (21.1%)
- Стоимость: $1.096
