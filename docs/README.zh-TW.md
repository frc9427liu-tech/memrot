# memrot

[English](../README.md) · **繁體中文**

![memrot demo](https://raw.githubusercontent.com/frc9427liu-tech/memrot/main/demo.gif)

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

## 授權

MIT
