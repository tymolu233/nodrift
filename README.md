# nodrift

[![npm](https://img.shields.io/npm/v/nodrift-cli)](https://www.npmjs.com/package/nodrift-cli) [![license](https://img.shields.io/npm/l/nodrift-cli)](LICENSE)

**仓库的规则不该靠自觉。** nodrift 把"AI 高强度协作也不腐"的治理机制做成任何仓库几分钟就能装的工具包：七道 CI 门禁、只减不增的技术债棘轮、有生命周期的决策笔记、带字数预算的 AGENTS.md 宪法。静态模板手拷即用，CLI 负责安装与执行。

机制提炼自 DeepSeek Harness（3.5 个月 19,000+ 提交、几乎全部 AI 协作仍未腐化），剥掉了该仓库特有的规模假设；溯源见 [NOTICE](NOTICE)。

## 为什么

仓库的腐坏从来不是一次写坏，而是一天天漂移：文档悄悄过时，口头规范被新代码违反，技术债只进不出。nodrift 把漂移变成 CI 红灯：

- 规则是 `nodrift check` 里可执行的门禁，不是 wiki 上的劝告；
- 存量债登记进棘轮基线，新增即红、只减不增；
- 决策写进 `.agents/notes/` 而不是蒸发在聊天记录里，归档即冻结；
- AGENTS.md 本身受字数预算管辖，一条规则 1–3 行，细则各归其家。

## 30 秒上手

```sh
npx nodrift-cli init
```

`init` 把模板全量释放到当前目录（已有文件不覆盖），按你的 `package.json` 渲染命令占位，收尾打印一份区分 human/agent 的 next steps 工单。之后把 CLI 装进项目依赖，日常一条命令：

```sh
npm install --save-dev nodrift-cli
npx nodrift check        # 七门全绿，或逐条点名缺欠
```

第一次 `check` 见红是特性，报告点名的是真实缺欠——空仓库里示例棘轮规则连语料都不存在，而探不到语料的门禁自己就是红的，不许装绿。补齐后同一命令变绿。

## 装完得到什么

- **入口文档对**：README 骨架（人读）+ AGENTS.md 宪法模板（AI 读，自带字数预算）；
- **[nodrift.yml](templates/nodrift.yml)**：唯一开关面，不合身的门禁 `enabled: false`，用不到的文件直接删；
- **CI 三选一**：单判决 verdict workflow，或没有 CLI 时的静态 fallback；
- **六个 agent skills**（pre-push-checks / code-review / agent-notes / prose-standard / find-simplifications / trim-cot-leakage）与零依赖 sh 检查脚本。

全量清单见 [templates/manifest.json](templates/manifest.json)。安装不分级：裁剪在装完后做，不在安装器里做。没有 Node 的仓库手拷同一棵 `templates/` 树即可，最小集是 CONTRIBUTING.md + PR 模板。

## 七道门禁

每门公开声明"绿证明了什么、不证明什么"（完整版：`nodrift check --list`）——绿不等于对，只等于绿承诺的那件事成立。

| 门禁 | 管什么 | 绿证明 | 不证明 |
|---|---|---|---|
| md-wrap | Markdown 一段一物理行 | 段落未被硬换行 | 段落言之有物 |
| md-links | 相对链接与锚点 | 目标文件与锚点真实存在 | 链接去对了"家"、外链可达 |
| doc-budgets | 字数预算棘轮 | 未超预算且留有下调空间 | 内容值得这些字 |
| note-format | 笔记头块与章节骨架 | 结构合法、备选方案在场 | 动机真实、备选诚实 |
| note-classification | 生命周期/类/日期/文件名 | 目录归属在封闭集内 | 类选得恰当 |
| note-archive-seal | 归档 append-only | 封存件未被改、manifest 完好 | "该归档"这判断本身 |
| ratchet | 禁止模式基线 | 无新增命中、基线无失效条目 | 存量在减少、模式合理 |

## 命令

| 命令 | 作用 |
|---|---|
| `nodrift init [--force] [--dir]` | 释放模板；`--force` 重刷受管文件，`nodrift.yml` 永远归你 |
| `nodrift check [--only] [--fail-fast] [--list]` | 跑配置里启用的门禁，任一失败退出 1 |
| `nodrift note new / archive / reseal` | 决策笔记：建树、SHA-256 封存归档、封印修复 |
| `nodrift ratchet verify / update` | 只读比对基线；登记存量债、核销已偿还条目 |

参数细节见 `nodrift --help`（每条命令自带用法）；每道门禁的证明边界见 `nodrift check --list`。

### 适配的 agent 位置

通用安装只写 `AGENTS.md` + `.agents/`；`nodrift init --agents claude,cursor`（逗号分隔的封闭集）在通用安装之上，把指路桩装进每个 agent 生态的原生项目级位置——桩只说四件事：宪法读 `AGENTS.md`、决策笔记在 `.agents/notes/`（规则见 `.agents/notes/README.md`）、skills 在哪、推送前跑 `nodrift check`。

| `--agents` 取值 | 安装位置 |
|---|---|
| `claude` | `CLAUDE.md`（含 `@AGENTS.md` 导入行），并把六个 skills 全量镜像到 `.claude/skills/` |
| `cursor` | `.cursor/rules/nodrift.mdc`（alwaysApply 规则） |
| `copilot` | `.github/copilot-instructions.md` |
| `gemini` | `GEMINI.md` |
| `windsurf` | `.windsurf/rules/nodrift.md` |

选择优先级：`--agents` > `nodrift.yml` 的 `agents:` 列表 > 空（仅 AGENTS.md 生态的通用安装）；用了非空组合就把 `agents: [...]` 记进 `nodrift.yml`，让裸 `nodrift init` 可以复现。决策笔记刻意保持 agent 中立，不随桩迁移——主流 agent 没有原生笔记约定，`.agents/notes/` 是所有 agent 的共同归宿。

## 配置

门禁、笔记分类、棘轮规则集中在仓库根的 `nodrift.yml`；`init` 释放的是逐行注释的骨架（原件：[templates/nodrift.yml](templates/nodrift.yml)）。未知键加载时报错，不存在静默忽略。

## 本仓即第一客户

这个仓库被自己装的全部机制管着：七道门禁、字数预算、棘轮、单判决 CI 都对自身生效。本仓开发命令：`npm test`、`npm run coverage`（`src/**` 逐文件 100% 覆盖门禁）、`npm run check`（构建后自跑门禁）。规则与贡献方式见 [CONTRIBUTING.md](CONTRIBUTING.md) 与 [AGENTS.md](AGENTS.md)。

## License

MIT（见 [LICENSE](LICENSE)）。机制设计移植自 DeepSeek Harness（MIT），溯源见 [NOTICE](NOTICE) 与[设计笔记](.agents/notes/implemented/process/2026-09-28-shitcode-v0-1-design.md)。
