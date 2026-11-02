# memrot

**English** · [繁體中文](docs/README.zh-TW.md) · [繁體中文(見下方)](#繁體中文)

**Your AI agent's memory rots. memrot finds the rot.**

A zero-dependency, fully local linter for `CLAUDE.md`, `AGENTS.md`, `MEMORY.md` and memory folders.
No AI calls, no cloud, no config. One file.

![memrot demo](https://raw.githubusercontent.com/frc9427liu-tech/memrot/main/demo.gif)

## Why

Memory tools (claude-mem, mem0, CLAUDE.md…) are great at *storing*. Nobody checks whether what they stored is still **true**.
Stale memories are worse than none: the agent confidently opens files that were deleted months ago.

## What it checks

| Rule | Catches |
|---|---|
| `stale-path` | backticked paths/files that no longer exist in your project |
| `stale-command` | `npm run x` when `package.json` has no script `x` |
| `broken-link` | markdown links to files that are gone |
| `contradiction` | "always X" vs "never X" in the same file |
| `duplicate` | the same line repeated (you pay tokens twice) |
| `oversize` / `budget` | files over 200 lines / 25 KB, or total token budget exceeded |
| `encoding` | files that are not valid UTF-8 (the agent reads garbage) |
| `relative-time` | "today", "yesterday", "目前" — rots by tomorrow |

Token estimates are CJK-aware (Chinese/Japanese/Korean count ~1 token per character, not 1/4).

## Usage

```
memrot                    # auto-detect CLAUDE.md, AGENTS.md, MEMORY.md, .claude/, memory/
memrot path/to/memory     # or point at files / folders
memrot --root ~/myproject # where to resolve referenced paths
memrot --budget 3000      # total token budget
memrot --json             # for CI
memrot --all              # also show low-priority notes
memrot --fix              # safe fixes only (writes .bak)
```

Exit code is `1` if there is any error-level finding, so it drops into CI or a pre-commit hook.

`--fix` only does things that cannot lose information: repairs non-UTF-8 files (UTF-8 / Big5 / GBK / Shift-JIS, per line) and removes exact duplicate lines. Stale paths and contradictions need a human; memrot never deletes those.

## Install

```
npx @leokai0322/memrot          # no install
# or
node memrot.mjs       # it is a single file
```

Requires Node 18+.

## 繁體中文

**AI 助手的記憶會腐爛。memrot 幫你抓出來。**

零依賴、全本機、不呼叫任何 AI 的 `CLAUDE.md` / `AGENTS.md` / `MEMORY.md` 檢查器,單一檔案。

記憶工具(claude-mem、mem0、CLAUDE.md…)很會「存」,但沒人檢查存的東西還是不是真的。過期的記憶比沒有更糟:AI 會很有自信地去打開幾個月前就刪掉的檔案。

### 會檢查什麼

| 規則 | 抓什麼 |
|---|---|
| `stale-path` | 記憶裡寫的檔案/路徑,專案裡已經不存在 |
| `stale-command` | 寫了 `npm run x`,但 `package.json` 沒有這個指令 |
| `broken-link` | Markdown 連結指到已不存在的檔案 |
| `contradiction` | 同一檔案裡「一定要 X」vs「不要 X」 |
| `duplicate` | 重複的行(token 白花兩次) |
| `oversize` / `budget` | 超過 200 行 / 25 KB,或總 token 超出預算 |
| `encoding` | 不是合法 UTF-8(AI 讀到亂碼) |
| `relative-time` | 「今天」「昨天」「目前」——明天就過期 |

Token 估算對中日韓友善(一個字約 1 token,不是 1/4)。

### 用法

```
npx @leokai0322/memrot                 # 不用安裝,自動偵測記憶檔
npx @leokai0322/memrot 記憶資料夾 --root 專案資料夾
npx @leokai0322/memrot --fix           # 只做不會遺失資訊的修復(留 .bak)
```

`--fix` 會修復編碼損壞(UTF-8 / Big5 / GBK / Shift-JIS)並移除完全重複的行;過期路徑和矛盾需要人判斷,memrot 不會自動刪。

需要 Node 18 以上。有誤報歡迎到 [Issues](https://github.com/frc9427liu-tech/memrot/issues) 回報。

## License

MIT
