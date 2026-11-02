# memrot

**Your AI agent's memory rots. memrot finds the rot.**

A zero-dependency, fully local linter for `CLAUDE.md`, `AGENTS.md`, `MEMORY.md` and memory folders.
No AI calls, no cloud, no config. One file.

![memrot demo](demo.gif)

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
npx memrot            # no install
# or
node memrot.mjs       # it is a single file
```

Requires Node 18+.

## 繁體中文

**AI 助手的記憶會腐爛。memrot 幫你抓出來。**

零依賴、全本機、不呼叫任何 AI 的 `CLAUDE.md` / `AGENTS.md` / `MEMORY.md` 檢查器。

- 抓過期引用:記憶裡寫的檔案、指令還在不在
- 抓矛盾、重複、超長,算 token(中日韓字元正確計算)
- 偵測並修復編碼損壞(Big5/GBK/Shift-JIS → UTF-8)
- `--fix` 只做不會遺失資訊的修復,並留 `.bak`

用法:`node memrot.mjs 記憶資料夾 --root 專案資料夾`

## License

MIT
