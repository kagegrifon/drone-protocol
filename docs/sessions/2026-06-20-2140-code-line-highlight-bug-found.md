# 2026-06-20 — Подсветка строк: обнаружен баг в инструментаторе

## Ситуация

Реализация фичи завершена (Tasks 1–5 на ветке `feat/code-line-highlight`, коммит 8133bdb).
- 185/185 тестов зелёные
- type-check чистый
- Финальное ревью: Ready to merge

Но при запуске игры с кодом дрона обнаружена ошибка:
```
(__line(...) , (intermediate value)) is not a function
```

## Проблемный код дрона

```javascript
while (true) {
  while (drone.inventory === 0) {
    await drone.moveTo(2)
    await drone.mine()
  }
  while (drone.inventory > 0) {
    await drone.drop()
  }
}
```

## Диагностика

- Ошибка приходит через `drone.codeError` (не выводится в консоль браузера)
- Воспроизводится на коде с вложенными `while`-циклами и несколькими `await drone.*`
- Все юнит-тесты `instrument.test.ts` проходят — баг не покрыт тестами
- Предположительно: инструментатор генерирует некорректный JS в edge case с вложенными конструкциями

## Корневая причина (найдена в следующей сессии)

JavaScript ASI (Automatic Semicolon Insertion) не срабатывает перед `(`. Инструментатор превращал:
```js
await drone.moveTo(2)   // без ;
await drone.mine()
```
в:
```js
(__line(3), await drone.moveTo(2))
(__line(4), await drone.mine())
```

JS парсит это как вызов функции: `expr1(expr2)` → `(intermediate value) is not a function`.

## Исправление (коммит 63043b1)

Добавлен `;` перед каждым wrap-ом в `instrument.ts`:
```js
`;(__line(${line}), ${original})`
```

Добавлен регрессионный тест на вложенные `while` без точек с запятой.
Добавлен `console.error` в catch `codeRuntime.ts` для диагностики.

## Результат

- 186/186 тестов зелёные
- Ветка запушена, PR создан

## Метрики сессии
- Модель: claude-haiku-4-5-20251001
- Input: 268 токенов (кеш: 7,501,356 / запись в кеш: 224,416)
- Output: 30,730 токенов
- Контекст: 103,053 / 200,000 токенов (51.5%)
- Стоимость: $3.554
