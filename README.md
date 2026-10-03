# nodrift

[![npm](https://img.shields.io/npm/v/nodrift-cli)](https://www.npmjs.com/package/nodrift-cli) [![node](https://img.shields.io/node/v/nodrift-cli)](https://nodejs.org) [![license](https://img.shields.io/npm/l/nodrift-cli)](LICENSE)

> 规范写在文档里时，违反了，命令照样成功。

[功能](#功能) • [安装](#安装) • [用法](#用法)

nodrift 把规范放进 `nodrift.yml`，用 `nodrift check` 跑。文档和代码对不上，或者以前禁止的写法又出现，检查就失败。一个决定为什么没选别的方案，记在 `.agents/notes/`。

## 功能

- **文档检查** — Markdown 一段占一行。相对链接和标题锚点必须指向存在的文件和标题。写进预算的文档有字数上限，超过上限的 95% 即失败。
- **决策笔记** — `.agents/notes/` 里必须写下问题，以及考虑过、没采纳的方案。目录按提议、已落地、已否决分开。归档只追加，改已经封存的笔记会失败。
- **技术债只减不增** — 在配置里写禁止模式，例如没有 issue 编号的 `TODO`。已有命中记成基线，不因此失败。新出现的命中会失败。基线里已经消失的命中要更新掉，否则也会失败。
- **给 AI 的短规则** — `AGENTS.md` 一条规则 1–3 行，长说明放到链接里。这份文件自己也有字数上限。可以给 Claude、Cursor、Copilot、Gemini、Windsurf 各装一个指路文件，笔记仍在 `.agents/notes/`。

不用的检查在 `nodrift.yml` 里关掉，不用的文件直接删。没有只装一部分的档位。

## 安装

需要 Node.js 22 或更高。在仓库根目录执行：

```sh
npx nodrift-cli init
npm install --save-dev nodrift-cli
npx nodrift check
```

包名是 `nodrift-cli`，命令是 `nodrift`。`init` 跳过已有文件，也不改 `nodrift.yml`。

> [!IMPORTANT]
>
> 空仓库第一次 `check` 会失败。模板里的棘轮匹配 `src/**`，这些文件还不在。补上文件后再跑同一条命令。

CI 留哪一份、每道检查的原文、各个 agent 的安装路径，见 [docs/install.md](docs/install.md)。

## 用法

`nodrift check` 只跑 `nodrift.yml` 里打开的门禁。`nodrift check --list` 打印每道门禁证明什么、不证明什么。关掉一道门禁，写 `gates.<id>.enabled: false`。

改编自 DeepSeek Harness（MIT）。改了哪些见 [NOTICE](NOTICE)，为什么这么取舍见[这篇笔记](.agents/notes/implemented/process/2026-09-28-shitcode-v0-1-design.md)。
