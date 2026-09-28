# 反屎山工具包（Anti-ShiShan Kit）

把"AI 高度协作却不腐"的治理机制做成任何仓库都能装的工具包：一套静态模板（手拷即用，零依赖）+ 一个 govkit CLI（门禁运行器）。来源：对 DeepSeek Harness 开发规范与方法论的提炼（3.5 个月 19000 提交、几乎全部 AI 协作仍不腐），去掉了该仓库特有的规模假设。

## 两种使用形态

- **静态模板层**：`templates/` 即安装树，直接拷进目标仓、替换 `<>` 占位即可，L0 连 Node 都不需要。
- **govkit CLI 层**：门禁、决策笔记、棘轮基线的可执行形态，配置集中在目标仓根的 `govkit.yml`。

## 级别

- **L0 · 最小必做集**（任何项目 Day 1）：一页硬规则 + PR 门禁清单，两个文件手拷即完成。
- **L1 · 标准集**（2+ 协作者或引入 AI agent）：govkit 配置、宪法模板（AGENTS.md，自带字数预算）、决策笔记机制、单判决 CI。
- **L2 · 全量集**（大仓库 / AI 高参与度）：六个工作流 skills、零依赖 fallback 脚本、规则脚本化与语义自检文档。

级别是增量的：`govkit init --level N` 安装级别 0..N 的文件并集（见 `templates/manifest.json`）。

## 安装与快速开始

```sh
npm install --save-dev anti-shishan-kit   # 发布后（包名占位）
npx govkit init --level 1                 # 把模板清单拷进本仓
npx govkit check                          # 跑门禁
```

本仓开发期（未发布）：`npm run build && node dist/cli/index.js <command>`。

## 命令一览

| 命令 | 作用 |
|---|---|
| `govkit init --level 0\|1\|2` | 按 manifest 增量拷贝模板树；已有文件不覆盖（`--force` 例外，`govkit.yml` 永远保留归用户） |
| `govkit check [--only <gate,...>] [--fail-fast]` | 跑门禁；`--list` 列出每门的"证明/不证明" |
| `govkit note new <class> <topic>` | 按生命周期模板建决策笔记（日期与路径自动） |
| `govkit note archive <path>` | 归档封印：插 `Archived:` 行并移入 `archived/<class>/` |
| `govkit ratchet update <id>` | 重记棘轮基线全集；此后"只减不增"由 check 强制 |

## 七门禁一览

每门的"证明/不证明"同时印在 `govkit check --list` 和失败报告里——绿≠对，只是绿所证明的那件事成立。

| 门禁 | 一句话 | 绿证明了 | 绿不证明 |
|---|---|---|---|
| md-wrap | Markdown 一段一物理行 | 段落未被硬换行 | 段落言之有物 |
| md-links | 相对链接可解析 | 链接目标存在 | 指向的是正确的"家" |
| doc-budgets | 字数预算棘轮 | 受管文件未超预算 | 内容值得这些字 |
| note-format | 头块/骨架/Status 一致 | 笔记结构合法 | 动机真实、备选诚实（语义走 notes-quality-gate） |
| note-classification | class 封闭集 | 目录归属在封闭集内 | 类选得恰当 |
| note-archive-seal | 归档只增不改 | archived/ 未被封后回改 | "该归档"这个判断本身 |
| ratchet | 基线只减不增 | 没有新增违规 | 存量在减少、模式写得合理 |

## 四条元规则

1. **规则即代码**：反复口头提醒的规则必须写成门禁进 CI，禁止靠记忆维持；`govkit.yml` 是唯一开关面。
2. **门禁有自测**：每个门禁自带"无效输入必红"的测试；每门公开声明证明/不证明，杜绝"绿=对"的幻觉。
3. **记忆会修剪**：决策进 `.agents/notes/`，超龄归档、过期护栏按寿命删除；字数与年龄永远不是归档标准。
4. **宪法有预算**：AGENTS.md 受 doc-budgets 棘轮管辖；细则住各自的"家"（bug→postmortem、决策→notes、流程→docs/），宪法只放 1–3 行的规则和指针。

## Roadmap

文档代码块编译门禁；中英文档配对校验；进程树级 fail-fast；copier 分发通道；semgrep 桥接仓特自定义规则；录制回放测试基建。

## 文件清单

| 路径 | 用途 | 级别 |
|---|---|---|
| `templates/CONTRIBUTING.md` | 一页硬规则 | L0 |
| `templates/.github/PULL_REQUEST_TEMPLATE.md` | PR 门禁清单 | L0 |
| `templates/govkit.yml` | 门禁与笔记配置骨架 | L1 |
| `templates/AGENTS.md` | 宪法模板（≤350 词，以身作则受自身预算约束） | L1 |
| `templates/.agents/notes/README.md` + `templates/.agents/notes/templates/` 三模板 | 决策笔记机制 | L1 |
| `templates/.github/workflows/ci-verdict.yml` | 单判决 CI（all-checks-passed） | L1 |
| `templates/.agents/skills/` 六个 SKILL.md | pre-push-checks / code-review / agent-notes / prose-standard / find-simplifications / trim-cot-leakage | L2 |
| `templates/scripts/check` + `check-notes` | 零依赖 fallback 脚本（POSIX sh） | L2 |
| `templates/docs/verify-rules.md` + `notes-quality-gate.md` | 规则脚本化起手清单、笔记语义自检 | L2 |
| `templates/.github/workflows/ci.yml` + `verify-notes.yml` | 无 govkit 仓的静态 CI fallback | L2 |
| `templates/manifest.json` | init 消费的增量文件清单（键 "0"/"1"/"2"） | — |

## 致谢

本工具包移植自 DeepSeek Harness——其宪法式 `AGENTS.md`、`.agents/notes/` 决策笔记、单判决 CI 与棘轮基线实践——特此致谢；六个 skills 由其 `dsh-*` 同名技能通用化重写而来。
