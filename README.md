# 反屎山工具包（Anti-ShiShan Kit）

把"AI 高强度协作却不腐"的治理机制做成任何仓库都能装的工具包：一套静态模板（手拷即用，零依赖）+ 一个 anti-shishan CLI（门禁、决策笔记、棘轮基线的可执行形态，配置集中在目标仓根的 `anti-shishan.yml`）。机制提炼自 DeepSeek Harness（3.5 个月约 19,000 提交、几乎全部 AI 协作仍不腐），去掉了该仓库特有的规模假设；署名见其 MIT 许可与本仓 `NOTICE`。

## 两种使用形态

- **静态模板层**：`templates/` 即安装树，直接拷进目标仓替换 `<>` 占位即可，L0 连 Node 都不需要。
- **anti-shishan CLI 层**：`init` 安装、`check` 执行、`note`/`ratchet` 维护；模板在构建时打平嵌入 CLI 本体（tarball 只含 dist），`init` 时释放并按目标仓 `package.json` 渲染命令占位（如 `<test command>` → `` `npm test` ``）。仓库内保留 `templates/` 原件，自家 md-wrap/md-links 门禁继续监管它。

## 安装与裁剪

`init` 一次装全量（清单见 `templates/manifest.json`），**不分级别**——采纳梯度不在安装器里，而在装完之后：门禁想关哪个就在 `anti-shishan.yml` 里 `enabled: false`，用不到的文件直接删。静态手拷与 CLI 安装共用同一颗 `templates/` 树（手拷不需要 Node；静态 fallback 脚本与 CI 只在没有 CLI 时才顶用）。

## 快速开始

新项目目录里一条命令装上（npm 包 `anti-shishan-kit`，提供 bin `anti-shishan-kit` 与短名 `anti-shishan`；命名说明：npm 上 `govkit` 已被无关项目占用）：

```sh
npx anti-shishan-kit init        # 全量装进你的项目目录；已有文件不覆盖，anti-shishan.yml 永远归你改
```

之后把 CLI 装进项目依赖，日常走 npm script 或 `npx anti-shishan <command>`：

```sh
npm install --save-dev anti-shishan-kit
npx anti-shishan check
```

本仓开发期：`npm run build`，然后 `node dist/cli/index.js <command>`（或 `npm run anti-shishan -- <command>`）。

**第一次 `check` 见红是特性**：报告会逐条点名还要补的占位——README 尚未存在（doc-budgets 指向失效路径）、示例棘轮规则还没有 `src/**` 可扫（语料哨兵：门禁探测范围收缩时不许装绿）。补齐占位后同一命令变绿；期间引入的真实违规（比如一个 `TODO`）会被 ratchet 以"新增即红、登记即封"的方式处理：`anti-shishan ratchet update <id|all>`。

## 命令一览

| 命令 | 作用 |
|---|---|
| `anti-shishan init [--force] [--dir]` | 安装 `templates/manifest.json` 全量清单；`--force` 重刷受管文件但保留 `anti-shishan.yml` |
| `anti-shishan check [--only <gate,...>] [--fail-fast] [--config] [--dir]` | 跑启用的门禁，任一失败退出 1；`--list` 打印每门的证明边界 |
| `anti-shishan note new --class <c> --title <t> [--lifecycle proposed\|rejected] [--date]` | 生成正确路径与章节骨架的决策笔记 |
| `anti-shishan note archive <note-path>` | 仅限 implemented：插 `Archived:` 行、移入 `archived/<class>/`、SHA-256 封存进 append-only manifest |
| `anti-shishan ratchet verify` | 只读比对当前命中与基线（等价于 `check --only ratchet` 的展开版） |
| `anti-shishan ratchet update <id\|all>` | 重扫重写基线：登记存量债、核销已偿还条目 |

## 七门禁一览

每门的"证明/不证明"同时印在 `anti-shishan check --list` 和失败报告里——绿 ≠ 对，只是绿所证明的那件事成立。

| 门禁 | 一句话 | 绿证明了 | 绿不证明 |
|---|---|---|---|
| md-wrap | Markdown 一段一物理行 | 段落未被硬换行 | 段落言之有物 |
| md-links | 相对链接与锚点可解析 | 链接目标、标题锚点存在 | 指向的是正确的"家"、外链可达 |
| doc-budgets | 字数预算棘轮 | 受管文件未超预算且留 ≥5% 下调空间 | 内容值得这些字 |
| note-format | 头块/骨架/Status 与目录一致、Alternatives 非空 | 笔记结构合法、备选方案在场 | 动机真实、备选诚实（语义自检见 `templates/docs/notes-quality-gate.md`） |
| note-classification | 生命周期/类/日期/文件名合法 | 目录归属在封闭集内 | 类选得恰当 |
| note-archive-seal | 归档树 append-only | 封存件未被改、manifest 完好 | "该归档"这个判断本身 |
| ratchet | 禁止模式基线只减不增 | 无新增命中、基线无失效条目 | 存量在减少、模式写得合理 |

## 四条元规则

1. **规则即代码**：反复口头提醒的规则必须写成门禁进 CI；`anti-shishan.yml` 是唯一开关面。
2. **门禁有自测**：每个门禁自带覆盖其模块的测试；每门公开声明证明/不证明，杜绝"绿 = 对"的幻觉；门禁探测语料为 0 时自身即红。
3. **记忆会修剪**：决策进 `.agents/notes/`，归档即冻结且不再是权威；字数与年龄永远不是归档标准（纪律见 skills 的 agent-notes）。
4. **宪法有预算**：AGENTS.md 受 doc-budgets 棘轮管辖，上调要在 PR 说明理由；细则各住其家（bug→postmortem、决策→notes、流程→docs/），宪法只放 1–3 行的规则与指针。

## 本仓开发（自举）

本仓是它的第一个客户：七个门禁、字数预算、棘轮规则、单判决 CI 全部对自身生效。命令：`npm test`、`npm run coverage`（`src/**` 逐文件 100% 行/分支/函数/语句，防御性死角用带理由的 `v8 ignore` 豁免）、`npm run check`（构建后自跑门禁）。v0.1 交付时 306 个测试全绿。

## Roadmap

文档代码块编译门禁（fence → tsc）；双语文档 blob 配对；自定义进程门禁的进程树级 fail-fast；copier 分发通道；semgrep/ast-grep 桥接仓自定义规则；录制回放测试基建（生态确认空白件，单独设计）。

## 文件清单

`init` 安装 `templates/manifest.json` 列出的全部文件，按区块分组：

| 区块 | 文件 | 用途 |
|---|---|---|
| 硬规则 | `templates/CONTRIBUTING.md`、`templates/.github/PULL_REQUEST_TEMPLATE.md` | 一页硬规则、PR 门禁清单（手拷即用的最小集） |
| 工具配置 | `templates/anti-shishan.yml`、`templates/AGENTS.md` | 门禁与笔记配置骨架（全注释）、宪法模板（约 330 词，以身作则低于默认预算） |
| 决策笔记 | `templates/.agents/notes/README.md`、`templates/.agents/notes/templates/` 三模板 | 笔记机制说明与 proposed/implemented/rejected 骨架 |
| CI | `templates/.github/workflows/ci-verdict.yml`（单判决，含两个坑注释）、`ci.yml` + `verify-notes.yml`（无 CLI 时的静态 fallback） | 三选一按是否装 CLI 使用 |
| 工作流 | `templates/.agents/skills/` 六个 SKILL.md | pre-push-checks / code-review / agent-notes / prose-standard / find-simplifications / trim-cot-leakage |
| 无 Node fallback | `templates/scripts/check` + `check-notes` | 零依赖 POSIX sh 脚本 |
| 文档 | `templates/docs/notes-quality-gate.md`、`docs/verify-rules.md` | 笔记语义自检（永不进脚本）、规则脚本化起手清单 |
| 清单 | `templates/manifest.json` | 受管模板全量清单；`gen:templates` 在构建时校验其与 `templates/` 树一致并嵌入 dist |

## License

MIT（见 `LICENSE`）。门禁与笔记机制的设计移植自 DeepSeek Harness（MIT），溯源图见 `NOTICE` 与本仓第一篇决策笔记 `.agents/notes/implemented/process/2026-09-28-anti-shishan-v0-1-design.md`。
