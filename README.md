# nodrift

[![npm](https://img.shields.io/npm/v/nodrift-cli)](https://www.npmjs.com/package/nodrift-cli) [![license](https://img.shields.io/npm/l/nodrift-cli)](LICENSE)

nodrift 把仓库规则做成 `nodrift check` 能执行的门禁，供人和 AI 一起改代码的仓库使用。一次安装包含七道门禁、只减不增的技术债棘轮、带生命周期的决策笔记，以及一份有字数上限的 `AGENTS.md`。模板可以整棵手拷；CLI 负责安装和执行。

仓库腐坏来自漂移：文档过期，口头规范被新代码违反，技术债只进不出。能写成机械规则的部分由 `nodrift check` 执行，失败时进程退出码为 1。机制来自 DeepSeek Harness（3.5 个月、19,000+ 提交，几乎全部 AI 协作仍未腐化），去掉了该仓库特有的规模假设。出处见 [NOTICE](NOTICE)。

npm 包内是本文件、`LICENSE`、`NOTICE` 和 `dist/`。`templates/`、`AGENTS.md`、`CONTRIBUTING.md` 和 `.agents/notes/` 不在包里；这些相对链接在源码仓库 [github.com/tymolu233/nodrift](https://github.com/tymolu233/nodrift) 解析。npmjs 在 `package.json` 的 `repository` 指向该仓库时，会把它们改写成该仓库上的链接。

## 安装

CLI 需要 Node.js 22 或更高版本。

```sh
npx nodrift-cli init
npm install --save-dev nodrift-cli
npx nodrift check
```

`init` 把整套模板写进当前目录。已有文件跳过；`--force` 重写受管文件。`nodrift.yml` 归仓库所有者，`init` 不写这个文件。`<test command>`、`<build command>`、`<lint command>` 分别在 `scripts.test`、`scripts.build`、`scripts.lint` 为字符串时写成 `npm test`、`npm run build`、`npm run lint`；script 不存在、`package.json` 缺失或 JSON 无法解析时，占位符原样保留。结束时打印 next steps，每条标明由人完成还是由 agent 完成。

第一次 `check` 失败是预期结果，报告点名的是真实缺口。模板里的示例棘轮规则匹配 `src/**`，空仓库里这些文件不存在；一门禁纳入的文件数低于它的 `minCorpus` 时，这一门失败。缺口补上之后，同一条命令通过。任一启用的门禁失败，进程退出码为 1；`--fail-fast` 在第一门失败后停止其余门禁。

## 装进仓库的文件

- 给人读的 README 骨架，和给 agent 读的 `AGENTS.md`。每条规则 1–3 行，细则只放在它自己的文档里；`AGENTS.md` 自身也有字数上限。
- [nodrift.yml](templates/nodrift.yml) 是唯一开关，`init` 释放的是带行注释的骨架。不要的门禁写 `enabled: false`，不要的文件直接删除。安装没有档位，裁剪在装完之后做。
- 六个 skills：`pre-push-checks`、`code-review`、`agent-notes`、`prose-standard`、`find-simplifications`、`trim-cot-leakage`。
- 决策笔记在 `.agents/notes/`，格式与生命周期见 [.agents/notes/README.md](.agents/notes/README.md)。归档只追加：封存后的文件被改，封印检查失败。

完整清单是 [templates/manifest.json](templates/manifest.json)。没有 Node 时，手拷 `templates/`；最小集是其中的 `CONTRIBUTING.md` 和 `.github/PULL_REQUEST_TEMPLATE.md`。`scripts/check` 按改动的路径选择 lint、类型检查和测试；`scripts/check-notes` 检查笔记结构。装了 CLI 之后，门禁用 `nodrift check`，笔记结构以 `note-format`、`note-classification`、`note-archive-seal` 为准。

使用 CLI 时，CI 只保留 `.github/workflows/ci-verdict.yml`，分支保护只要求一个状态检查 `all-checks-passed`。同一次 `init` 还会写入无 CLI 时的 `ci.yml` 和 `verify-notes.yml`。这三份不要一起留：`ci.yml` 和 `ci-verdict.yml` 的 workflow 名都是 `ci`。

## 七道门禁

每道门禁声明绿证明什么、不证明什么。各门的 `doc` 行由 `nodrift check --list` 打印。绿只表示那句证明成立。

| 门禁 | 管什么 | 绿证明 | 不证明 |
|---|---|---|---|
| md-wrap | Markdown 一段一物理行 | 段落未被硬换行 | 段落言之有物 |
| md-links | 相对链接与锚点 | 目标文件与锚点真实存在 | 链接去对了该去的文档、外链可达 |
| doc-budgets | 字数上限 | 未超上限，且词数不超过上限的 95% | 内容值得这些字 |
| note-format | 笔记头块与章节骨架 | 结构合法、备选方案在场 | 动机真实、备选诚实 |
| note-classification | 生命周期、类、日期、文件名 | 目录归属在封闭集内 | 类选得恰当 |
| note-archive-seal | 归档只追加 | 封存件未被改、manifest 完好 | 该不该归档这一判断 |
| ratchet | 禁止模式基线 | 无新增命中、基线无失效条目 | 存量在减少、模式合理 |

字数按空白分词，代码块计入，算法与 `wc -w` 相同。`nodrift.yml` 中的未知键、未知门禁 id，以及 `--agents` 中的未知 id，在加载或解析时抛错，不会被跳过。

## 命令

| 命令 | 作用 |
|---|---|
| `nodrift init [--force] [--agents <id,id>] [--dir <path>]` | 释放模板。`--agents` 额外安装「适配各个 agent」一节里的指路桩 |
| `nodrift check [--only <id,id>] [--fail-fast] [--list] [--dir <path>]` | 跑已启用的门禁。`--only` 只能收窄这个集合，不能打开配置里关掉的门 |
| `nodrift note new --class <class> --title <title>` | 建一则 `proposed`（默认）或 `--lifecycle rejected` 笔记。日期默认是当天的 UTC 日期。`implemented` 笔记直接写文件，不经这条命令 |
| `nodrift note archive <path>` / `nodrift note reseal` | 把 implemented 笔记移入 `archived/` 并用 SHA-256 封存。`reseal` 按磁盘上的归档重建 manifest；缺少封印行的笔记会被拒绝 |
| `nodrift ratchet verify` / `nodrift ratchet update <rule-id\|all>` | `verify` 只读比对基线。`update` 用一次新扫描重写基线：现存命中被登记，已经消失的条目被核销 |

旗标的完整列表以 `nodrift --help` 为准。

## 适配各个 agent

省略 `--agents` 时，安装只写 `AGENTS.md` 和 `.agents/`。`nodrift init --agents claude,cursor` 再把指路桩写到该 agent 会读的路径。id 是封闭集，用逗号分隔。桩只陈述四件事：宪法是 `AGENTS.md`；笔记在 `.agents/notes/`，规则在 `.agents/notes/README.md`；skills 在该 agent 能发现的目录；推送前跑最窄的 `nodrift check`。

| `--agents` | 安装位置 |
|---|---|
| `claude` | `CLAUDE.md`（含 `@AGENTS.md`），并把 `.agents/skills/` 镜像到 `.claude/skills/`。规范副本是 `.agents/skills/` |
| `cursor` | `.cursor/rules/nodrift.mdc`（`alwaysApply: true`） |
| `copilot` | `.github/copilot-instructions.md` |
| `gemini` | `GEMINI.md` |
| `windsurf` | `.windsurf/rules/nodrift.md` |

解析顺序是命令行 `--agents`，否则 `nodrift.yml` 的 `agents:`，否则不装桩。非空安装若还没记在 `agents:` 里，next steps 会要求人写上 `agents: [...]`；写上之后，不带该旗标的 `init` 安装同一组。笔记留在 `.agents/notes/`，不随桩迁移。

## 这个仓库

本仓库运行自己发布的全部门禁、字数预算、棘轮和单判决 CI。`npm test` 运行测试；`npm run coverage` 要求 `src/**` 逐文件 100% 覆盖；`npm run check` 先构建，再对本仓库执行 `nodrift check`。给人的规则见 [CONTRIBUTING.md](CONTRIBUTING.md)，给 agent 的规则见 [AGENTS.md](AGENTS.md)。

## License

MIT，文本见 [LICENSE](LICENSE)。设计移植自 DeepSeek Harness（MIT），取舍见[这篇笔记](.agents/notes/implemented/process/2026-09-28-shitcode-v0-1-design.md)。
