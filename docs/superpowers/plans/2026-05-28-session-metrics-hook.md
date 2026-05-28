# Session Metrics Hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Автоматически дописывать метрики токенов/стоимости/контекста в конец session-файлов `docs/sessions/*.md` сразу после их создания Claude.

**Architecture:** Stop-хук в глобальном `~/.claude/settings.json` запускает PowerShell-скрипт `~/.claude/scripts/append-session-metrics.ps1`. Скрипт читает `transcript_path` из stdin, парсит JSONL-транскрипт, находит session-файл изменённый < 60 сек назад и дописывает секцию `## Метрики сессии`.

**Tech Stack:** PowerShell 5.1, Claude Code Stop-хук, JSONL.

---

## Файлы

- **Создать:** `C:/Users/Master/.claude/scripts/append-session-metrics.ps1` — основной скрипт
- **Изменить:** `C:/Users/Master/.claude/settings.json` — добавить Stop-хук
- **Без изменений в репозитории** — скрипт и settings глобальные, не проектные

---

## Task 1: Создать PowerShell-скрипт

**Files:**
- Create: `C:/Users/Master/.claude/scripts/append-session-metrics.ps1`

- [ ] **Step 1.1: Создать директорию scripts**

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\scripts"
```

- [ ] **Step 1.2: Создать скрипт**

Создать файл `C:/Users/Master/.claude/scripts/append-session-metrics.ps1` с содержимым:

```powershell
param()

$raw = [Console]::In.ReadToEnd()
if (-not $raw.Trim()) { exit 0 }

try { $data = $raw | ConvertFrom-Json } catch { exit 0 }

$tp = $data.transcript_path
if (-not $tp -or -not (Test-Path $tp)) { exit 0 }

$iTokens = 0; $crTokens = 0; $cwTokens = 0; $oTokens = 0
$model = "unknown"; $cwd = $null; $lastCtx = 0

foreach ($line in (Get-Content $tp -Encoding UTF8)) {
    if (-not $line.Trim()) { continue }
    try {
        $r = $line | ConvertFrom-Json
        if ($r.cwd) { $cwd = $r.cwd }
        if ($r.type -eq "assistant" -and $r.message -and $r.message.usage) {
            $u = $r.message.usage
            $it = if ($u.input_tokens)                { [int]$u.input_tokens                } else { 0 }
            $cr = if ($u.cache_read_input_tokens)     { [int]$u.cache_read_input_tokens     } else { 0 }
            $cw = if ($u.cache_creation_input_tokens) { [int]$u.cache_creation_input_tokens } else { 0 }
            $ot = if ($u.output_tokens)               { [int]$u.output_tokens               } else { 0 }
            $iTokens += $it; $crTokens += $cr; $cwTokens += $cw; $oTokens += $ot
            if ($r.message.model) { $model = $r.message.model }
            $lastCtx = $it + $cr + $cw
        }
    } catch {}
}

if (-not $cwd) { exit 0 }

$sessDir = Join-Path $cwd "docs\sessions"
if (-not (Test-Path $sessDir)) { exit 0 }

$cutoff = (Get-Date).AddSeconds(-60)
$sf = Get-ChildItem $sessDir -Filter "*.md" |
    Where-Object { $_.LastWriteTime -gt $cutoff } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $sf) { exit 0 }

$existing = Get-Content $sf.FullName -Raw -Encoding UTF8
if ($existing.Contains("## Метрики сессии")) { exit 0 }

$ic = [System.Globalization.CultureInfo]::InvariantCulture
function N($n) { $n.ToString("N0", $ic) }

$costTotal = ($iTokens / 1e6 * 3.0) + ($cwTokens / 1e6 * 3.75) +
             ($crTokens / 1e6 * 0.30) + ($oTokens / 1e6 * 15.0)
$ctxPct = [math]::Round($lastCtx / 200000 * 100, 1)

$section  = "`n## Метрики сессии`n"
$section += "- Модель: $model`n"
$section += "- Input: $(N $iTokens) токенов (кеш: $(N $crTokens) / запись в кеш: $(N $cwTokens))`n"
$section += "- Output: $(N $oTokens) токенов`n"
$section += "- Контекст: $(N $lastCtx) / 200,000 токенов ($ctxPct%)`n"
$section += "- Стоимость: `$$($costTotal.ToString('F3', $ic))`n"

Add-Content -Path $sf.FullName -Value $section -Encoding UTF8 -NoNewline
```

---

## Task 2: Зарегистрировать Stop-хук

**Files:**
- Modify: `C:/Users/Master/.claude/settings.json`

- [ ] **Step 2.1: Добавить hooks в settings.json**

Обновить `C:/Users/Master/.claude/settings.json` — добавить секцию `hooks`, сохранив существующие настройки:

```json
{
  "language": "russian",
  "effortLevel": "medium",
  "autoUpdatesChannel": "latest",
  "voiceEnabled": true,
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true
  },
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "powershell -NoProfile -NonInteractive -File \"C:/Users/Master/.claude/scripts/append-session-metrics.ps1\"",
            "shell": "powershell",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2.2: Проверить синтаксис JSON**

```powershell
Get-Content "$env:USERPROFILE\.claude\settings.json" | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

Ожидаемый результат: JSON без ошибок парсинга, видна секция `hooks.Stop`.

---

## Task 3: Pipe-test скрипта

- [ ] **Step 3.1: Найти актуальный transcript_path**

```powershell
$proj = "c--Users-Master-Desktop-project-my-game-project-robot-protocol"
$tf = Get-ChildItem "$env:USERPROFILE\.claude\projects\$proj\*.jsonl" |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host $tf.FullName
```

- [ ] **Step 3.2: Запустить скрипт вручную с реальными данными**

Подставить путь из предыдущего шага в `<PATH>`:

```powershell
'{"transcript_path":"<PATH>","session_id":"test","stop_hook_active":false}' |
    powershell -NoProfile -NonInteractive -File "$env:USERPROFILE\.claude\scripts\append-session-metrics.ps1"
Write-Host "Exit code: $LASTEXITCODE"
```

Ожидаемый результат: exit code 0, нет ошибок. (Session-файл не изменится — нет свежего md-файла < 60 сек, это нормально.)

- [ ] **Step 3.3: Тест с фиктивным session-файлом**

```powershell
# Создать тестовый файл
$sessDir = "C:\Users\Master\Desktop\project\my\game project\robot-protocol\docs\sessions"
$testFile = Join-Path $sessDir "_test-metrics.md"
Set-Content $testFile "# Test session`n`n## Результат`n- Тест`n" -Encoding UTF8

# Запустить скрипт
$proj = "c--Users-Master-Desktop-project-my-game-project-robot-protocol"
$tf = (Get-ChildItem "$env:USERPROFILE\.claude\projects\$proj\*.jsonl" |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName

"{`"transcript_path`":`"$($tf.Replace('\','\\'))`",`"session_id`":`"test`",`"stop_hook_active`":false}" |
    powershell -NoProfile -NonInteractive -File "$env:USERPROFILE\.claude\scripts\append-session-metrics.ps1"

# Проверить результат
Get-Content $testFile -Encoding UTF8
```

Ожидаемый результат: файл содержит секцию `## Метрики сессии` с реальными числами из транскрипта.

- [ ] **Step 3.4: Проверить защиту от двойной записи**

```powershell
# Запустить скрипт повторно на том же файле
"{`"transcript_path`":`"$($tf.Replace('\','\\'))`",`"session_id`":`"test`",`"stop_hook_active`":false}" |
    powershell -NoProfile -NonInteractive -File "$env:USERPROFILE\.claude\scripts\append-session-metrics.ps1"

# Посчитать вхождения заголовка
(Get-Content $testFile -Raw).Split("`n") | Where-Object { $_ -match "## Метрики сессии" } | Measure-Object | Select-Object -ExpandProperty Count
```

Ожидаемый результат: `1` (заголовок не дублируется).

- [ ] **Step 3.5: Удалить тестовый файл**

```powershell
Remove-Item "C:\Users\Master\Desktop\project\my\game project\robot-protocol\docs\sessions\_test-metrics.md"
```

---

## Task 4: Подтвердить хук в настройках и сделать коммит спека

- [ ] **Step 4.1: Открыть /hooks в Claude Code UI**

Выполнить `/hooks` в Claude Code для перезагрузки конфигурации хуков.  
Убедиться, что Stop-хук виден в списке.

- [ ] **Step 4.2: Закоммитить spec-документ**

```powershell
git add docs/superpowers/specs/2026-05-28-session-metrics-hook-design.md
git add docs/superpowers/plans/2026-05-28-session-metrics-hook.md
git commit -m @'
docs: добавить спек и план Stop-хука для метрик сессии

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
'@
```

---

## Ожидаемый итог

После следующей сессии, где Claude создаст `docs/sessions/*.md`, файл будет содержать секцию:

```markdown
## Метрики сессии
- Модель: claude-sonnet-4-6
- Input: 1,234 токенов (кеш: 81,427 / запись в кеш: 12,450)
- Output: 8,210 токенов
- Контекст: 94,380 / 200,000 токенов (47.2%)
- Стоимость: $0.184
```
