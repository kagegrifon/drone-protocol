# Drone Loop — Game Design Document (GDD)

Version: 0.1  
Status: Pre-production  
Target Scope: 1-week MVP

---

# High Concept

Drone Loop — атмосферная automation strategy game, где игрок программирует поведение добывающих дронов и оптимизирует автоматизированную систему добычи ресурсов.

Игрок не управляет юнитами напрямую.
Вместо этого он:
- создает программы,
- назначает их роботам,
- устраняет bottleneck'и,
- управляет энергией,
- наблюдает за системой.

Главный игровой опыт:
> "Я создал красивую и эффективную автоматизированную систему."

---

# Genre

- Automation Strategy
- Programming-inspired Sandbox
- Optimization Game
- Atmospheric Simulation

---

# Pillars

## 1. Pleasant Observation
На игру должно быть приятно смотреть даже без активного взаимодействия.

## 2. System Design
Игрок проектирует поведение системы, а не управляет вручную.

## 3. Optimization
Gameplay строится вокруг поиска более эффективных решений.

## 4. Calm Atmosphere
Игра должна создавать состояние flow и медитативности.

## 5. Accessible Programming Fantasy
Игра дает ощущение программирования без необходимости писать настоящий код.

---

# Inspirations

## Gameplay
- Factorio
- Screeps
- Opus Magnum
- while True: learn()
- Oxygen Not Included

## Atmosphere
- Space Haven
- Deep Rock Galactic (calm moments)
- ambient synth / hang drum music

---

# Core Gameplay Loop

1. Игрок анализирует систему
2. Находит inefficiency
3. Меняет программы дронов
4. Перестраивает маршруты
5. Улучшает throughput
6. Наблюдает результат
7. Получает новые ограничения
8. Повторяет цикл

---

# Player Fantasy

Игрок должен чувствовать:
- "Я построил автономную систему"
- "Я написал умную логику"
- "Мои дроны работают сами"
- "Я оптимизировал процесс"

---

# Core Mechanics

## Drone Programming

У каждого дрона есть:
- программа,
- энергия,
- inventory,
- command slots.

Игрок может:
- создавать программы,
- назначать программы,
- вызывать подпрограммы,
- использовать условия и циклы.

---

# Program Structure

## Program Types

### Actions
- MOVE_TO
- MINE
- PICKUP
- DROP
- CHARGE
- WAIT

### MOVE_TO Design Philosophy

MOVE_TO requires an explicit target entity.

Examples:
- MOVE_TO(base)
- MOVE_TO(mine_1)
- MOVE_TO(charger_1)

The player explicitly defines where drones should move.

This reinforces:
- intentional system design,
- readable logic,
- spatial planning,
- programming-like thinking.

Future progression (in game) may unlock advanced automation actions such as:
- MOVE_TO_NEAREST(MINE)
- MOVE_TO_NEAREST(CHARGER)
- MOVE_TO_NEAREST(DROPPING_POINT)

These future upgrades create meaningful progression from:
manual explicit logic → more abstract automation tools.

### Conditions
- IF energy < X
- IF inventory full
- IF inventory empty
- IF storage has ore
- IF target reachable

### Flow Control
- LOOP
- REPEAT
- RUN PROGRAM

---

# Example Program

MAIN:
- IF energy < 20
    -> RUN recharge

- IF inventory full
    -> RUN unload

- RUN mining

MINING:
- MOVE_TO(mine_1)
- MINE
- REPEAT

AUTO_MINING:
- MOVE_TO nearest mine
- MINE
- REPEAT

UNLOAD:
- MOVE_TO(base)
- DROP

RECHARGE:
- MOVE_TO(charger_1)
- CHARGE

---

# Command Slots

Каждый дрон имеет ограниченное количество command slots.

Пример:
- Basic Drone = 4 slots
- Worker Drone = 6 slots
- Advanced Drone = 8 slots

Это создает gameplay вокруг:
- оптимизации логики,
- переиспользования кода,
- abstraction,
- subprograms.

---

# Energy System

Дроны:
- тратят энергию на движение,
- тратят энергию на mining,
- должны заряжаться.

Low energy:
- снижает скорость,
- может остановить дрона.

Energy management — ключевая часть gameplay.

---

# Congestion Gameplay

Дроны физически присутствуют на карте:
- занимают клетки,
- создают пробки,
- мешают друг другу.

Это создает:
- routing gameplay,
- optimization challenges,
- emergent behavior.

---

# Win Conditions

## MVP
- добыть определенное количество ore
или
- достичь target efficiency.

---

# Failure Conditions

- время вышло,
- throughput слишком низкий,
- система перестала функционировать.

---

# World

## Setting

Небольшая sci-fi mining station в изолированной среде.

Настроение:
- тихая индустриальная атмосфера,
- automation meditation,
- мягкий sci-fi.

---

# Visual Direction

## Palette
- dark blue
- graphite
- warm amber
- cyan accents
- soft orange lighting

## Visual Features
- glow effects
- blinking lights
- soft fog
- dust particles
- smooth movement
- light trails

---

# Audio Direction

## Music
- calm synth ambient
- flute ambient
- hang drum
- soft industrial ambience

## Sound Design
- mining clicks
- servo sounds
- electric buzz
- drone hum
- machinery ambience

---

# UI Philosophy

UI должен:
- быть минималистичным,
- не ломать атмосферу,
- напоминать sci-fi terminal,
- оставаться читаемым.

---

# Main UI Screens

## Game View
Игровой мир и дроны.

## Program Editor
Редактор поведения.

## Drone Inspector
Информация о дроне.

## Statistics Panel
- ore/min
- idle time
- congestion
- energy usage

---

# Missions

## Mission 1
Один дрон.
Простой цикл добычи.

## Mission 2
Добавляется энергия.

## Mission 3
Добавляется второй дрон.
Появляются пробки.

## Mission 4
Добавляются command slots и subprograms.

---

# MVP Scope

## Included
- 1 resource
- 1 drone type
- energy
- charging
- mining
- inventory
- program system
- conditions
- loops
- subprograms
- congestion
- statistics

## Excluded
- combat
- enemies
- procedural generation
- multiplayer
- belts
- electricity network
- crafting chains
- complex economy

---

# Success Criteria

MVP считается успешным если:
- приятно наблюдать за системой,
- игрок испытывает удовольствие от оптимизации,
- программы ощущаются как "настоящее программирование",
- gameplay остается понятным и расслабляющим.

---

# Future Expansion Ideas

- новые ресурсы
- разные типы дронов
- terrain hazards
- logistics drones
- wireless charging
- signal systems
- visual scripting graph
- research tree
- production chains