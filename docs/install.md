# 安装 nodrift

这份给要在目标仓库里安装 nodrift 的 agent。按下面做。人自己装，用同一套命令。

需要 Node.js 22 或更高。在目标仓库根目录执行：

```sh
npx nodrift-cli init
npm install --save-dev nodrift-cli
npx nodrift check
```

`init` 把模板拷进当前目录，已经存在的文件不动。包名是 `nodrift-cli`，装上之后命令叫 `nodrift`。`check` 读仓库根的 `nodrift.yml`，只跑里面打开的门禁。全过，退出码 0。有门禁失败、抛错，或者扫到的文件比 `minCorpus` 少，退出码 1。

空仓库第一次 `check` 会失败。模板里的棘轮匹配 `src/**`，这些文件还不在。`minCorpus` 没写时当作 1，扫到的文件更少，这道门禁失败。这不是装坏了。把 `src` 补上，再跑同一条命令。不要为了变绿去删这道门禁，除非目标仓库确实不需要它。

`init --force` 会重写它拷过的文件，但不动 `nodrift.yml`。要一份新配置，先删掉这个文件再 `init`。注释过的样本在 [templates/nodrift.yml](../templates/nodrift.yml)。配置不见了、YAML 解析失败、`version` 写成了 `1` 以外的值（这一项可以不写）、或者出现不认识的顶层键、门禁 id、`agents` id，`check` 在加载时失败。关掉一道门禁就写 `gates.<id>.enabled: false`。不要的文件直接删。没有安装档位，不要发明 `--level` 之类的旗标。

`package.json` 里 `scripts.test`、`scripts.build`、`scripts.lint` 是字符串时，模板里对应的占位符会写成 `npm test`、`npm run build`、`npm run lint`。对不上就保持 `<...>`，留给下一步去填，不要猜命令。

`init` 结束时往终端打 `next steps:`，每行开头是 `human:` 或 `agent:`。`agent:` 的条目由 agent 做，`human:` 的条目停下来交给人。

`--only` 只能少跑几道已经打开的门禁，不能把关掉的重新打开。`--fail-fast` 第一道失败后就停。

## 装进仓库的文件

- `AGENTS.md` 是给 agent 的短规则，一条 1–3 行，长说明放到链接的文档里。字数上限在 `doc-budgets`。
- 一份 README 骨架。目录里已经有 `README.md` 时，`init` 不会覆盖它。不要用骨架换掉目标仓库原来的 README。
- `.agents/skills/` 里有六个：`pre-push-checks`、`code-review`、`agent-notes`、`prose-standard`、`find-simplifications`、`trim-cot-leakage`。
- 决策笔记在 `.agents/notes/`，写法见 [.agents/notes/README.md](../.agents/notes/README.md)。`archived/` 里封印过的笔记不能改，改了 `note-archive-seal` 失败。

完整清单是 [templates/manifest.json](../templates/manifest.json)。没有 Node 就自己拷 `templates/`。

`scripts/check` 给没装 CLI 的仓库用：按改动的路径决定跑不跑 lint、类型检查和测试。它不跑门禁。`scripts/check-notes` 只看笔记目录。门禁是 `nodrift check` 的事。

用了 CLI，CI 只留 `.github/workflows/ci-verdict.yml`，分支保护认检查名 `all-checks-passed`。删掉 `ci.yml` 和 `verify-notes.yml`，那两份是不装 CLI 时的备用。`ci.yml` 和 `ci-verdict.yml` 的 workflow `name` 都是 `ci`，两份一起留会撞名。分支保护要改仓库设置，agent 改不了就留在 `human:` 那一条，不要假装已经配好。

## 门禁

绿了只说明下表「证明」这一列里的事。每道门禁的原文用 `nodrift check --list` 看。

| 门禁 | 证明 | 不证明 |
|---|---|---|
| md-wrap | 每个散文段落（含列表和引用）占一个物理行。代码块、表格、HTML 块除外 | 内容好不好 |
| md-links | 相对链接的目标文件存在；`#锚点` 对应真实标题 slug 或 `<a id>` | `http` / `mailto` 外链可达 |
| doc-budgets | `budgets` 里列出的文件，字数不超过上限的 95%。列出的路径不存在则失败 | 未列出的文件；文章值不值得写 |
| note-format | 第 1 行标题、第 2 行 Status、归档笔记第 3 行有归档日期；Status 与生命周期目录一致；章节按顺序；Alternatives considered 非空 | 内容正确，或决策明智 |
| note-classification | 路径为 `<lifecycle>/<class>/yyyy-mm-dd-slug.md`：lifecycle 与 class 已知，日期是真日历日，slug 为小写连字符，且没有未知顶层目录把笔记藏起来 | 分类选得对 |
| note-archive-seal | manifest 中每条的 sha256 与文件一致（git 能回答时还核对 blob）；每篇归档笔记都在 manifest 里，且第 3 行有 Archived | 这篇该不该归档 |
| ratchet | 每条禁止模式的命中不多于已承认的基线，且基线里没有已经消失的命中 | 存量已经被清掉，或模式本身合理 |

字数按空格切开，代码块也算，跟 `wc -w` 一样。一整句中文中间没有空格，只算一个词。字数过了上限的 95% 就失败，还没写到上限也一样。把上限调高，这道门禁不检查。

## 命令

| 命令 | 作用 |
|---|---|
| `nodrift init [--force] [--agents <id,id>]` | 拷入模板。`--agents` 同时装下一节的适配文件 |
| `nodrift check [--only <id,id>] [--fail-fast] [--list]` | 跑已打开的门禁。`--list` 打印每道门禁的 `doc` |
| `nodrift note new --class <class> --title <title>` | 建 `proposed`（默认）或 `--lifecycle rejected` 的笔记。`--date` 不写就是 UTC 当天。`implemented` 自己写文件，不走这条命令 |
| `nodrift note archive <path>` | 把一篇 implemented 笔记移进 `archived/`，写上 SHA-256 |
| `nodrift note reseal` | 按磁盘上的归档笔记重做 manifest。没有 `Archived:` 行的笔记会被拒绝 |
| `nodrift ratchet verify` | 对照当前命中和基线，不改文件 |
| `nodrift ratchet update <rule-id\|all>` | 按新扫描重写基线。还在的命中留下，已经没了的删掉 |

`<notes.root>/templates/<lifecycle>.md` 如果存在，`note new` 用它，不用内置骨架，并把里面的 `<title>`、`<date>` 换掉。别的旗标看 `nodrift --help`。

## 装到各个 agent

不写 `--agents`，`agents:` 又是空的或者没这一项，就只装 `AGENTS.md` 和 `.agents/`。目标仓库用哪个 agent，就给 `init` 加上对应 id。`--agents` 盖过配置里的 `agents:`。适配文件只指向 `AGENTS.md`、`.agents/notes/`、`.agents/skills/`，并写明推送前要跑 `nodrift check`。笔记仍在 `.agents/notes/`，不另拷一份。

| `--agents` | 装到 |
|---|---|
| `claude` | `CLAUDE.md`（含 `@AGENTS.md`）。`.agents/skills/` 会再镜像到 `.claude/skills/`。改 skill 改 `.agents/skills/` |
| `cursor` | `.cursor/rules/nodrift.mdc`（`alwaysApply: true`） |
| `copilot` | `.github/copilot-instructions.md` |
| `gemini` | `GEMINI.md` |
| `windsurf` | `.windsurf/rules/nodrift.md` |

id 就这五个，别的 id 会在加载时失败。这次传了 `--agents`，配置里却还没有同样的 `agents:`，`next steps:` 会让人写上。写上之后，以后不带旗标的 `init` 会装同一组。
