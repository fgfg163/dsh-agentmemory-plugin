# Changelog

All notable changes to `@fgfg163/dsh-agentmemory-plugin` are recorded here.
`@fgfg163/dsh-agentmemory-plugin` 的版本变更记录。每个版本内先英文后中文。

---

# 0.12.0

## English

**Added**

- **Settings page.** The bundle now declares a `Config` schema and ships a
  browser half (`lib/client.js`) registering a `settings.section` tab:
  Settings → AgentMemory 记忆. Daemon URL, credential reference, context
  ceiling, `agentId`, and the whole `recall` block are editable live — a save
  takes effect on the next request without restarting the plugin.

**Changed**

- **Secrets moved out of configuration (`secretEnv`).** Configuration now
  carries a credential REFERENCE (the stored secret's name, resolved per
  request through `ctx.credentials.resolve()`), never the value. Store the
  secret once via the credentials seam (`E:\dsh-home\.credentials.yaml`),
  then rotate it without touching any config file or restarting.
  Precedence: `secretEnv` (credentials) > `secret` (inline, legacy) >
  `secretFile` (legacy) > env/file auto-detect. The legacy `secret` and
  `secretFile` fields are deliberately NOT declared in the schema, so the
  settings form never displays them and a form save preserves them in the
  patch.
- Config fields resolved by the schema arrive as live volatile references;
  every read site (`contextMaxChars`, `agentId`, `recall.*`) unwraps them on
  read. Hand-written plain values keep working.
- **The package is a bundle.** `cordis.patch.yml` plus `dsh.bundle.patch` let
  it be installed, enabled and listed as a profile bundle; its row no longer
  has to sit in the home-level patch.

**Fixed**

- **The settings tab never appeared.** The browser half ran before
  `ui-settings` registered `configForms`, and the guarded client context
  rejects `ctx.slots` without an `inject` declaration, so the tab was dropped
  silently. It now declares `inject: ['slots']`, polls
  `ctx.get('configForms')`, and accepts both loader-row id spellings.
- **Every daemon request answered 401.** `resolveSecret` captured
  `ctx.get('credentials')` at apply time; when the row is loaded from a bundle
  patch that service does not exist yet, so the plugin cached `undefined` and
  sent no bearer token. The service is now resolved per request.
- **The settings page was unstyled.** It rendered native controls with inline
  styles and referenced a token that does not exist. It now follows the
  Harness settings rows (`--dsw-alias-*` tokens, 14px/12px type, 36px controls,
  row separators) so it matches the shipped sections in light and dark themes.

## 中文

**新增**

- **配置页。** 声明 `Config` schema 并内置浏览器半边（`lib/client.js`），在
  设置 → AgentMemory 记忆 注册独立页。Daemon 地址、密钥引用、注入上限、
  `agentId` 与整个 `recall` 块均可实时修改——保存后下一次请求即生效，无需重启插件。

**变更**

- **密钥移出配置（`secretEnv`）。** 配置只携带引用（密钥的名字），运行时每次
  请求经 `ctx.credentials.resolve()` 解析，值存凭据存储
  （`E:\dsh-home\.credentials.yaml`）。轮换密钥免改配置、免重启。
  优先级：`secretEnv`（凭据）> `secret`（内联，旧）> `secretFile`（旧）>
  环境/文件自动探测。旧 `secret` / `secretFile` 键刻意不进 schema：
  配置页不显示、保存时原样保留。
- schema 解析出的配置字段以 live volatile 引用到达；所有读取点
  （`contextMaxChars`、`agentId`、`recall.*`）在读取时解包。手写普通值依旧可用。
- **包改为 bundle。** 新增 `cordis.patch.yml` 与 `dsh.bundle.patch`，可作为
  profile bundle 被安装、启用并列入插件清单；这一行不必再挂在 home 层补丁里。

**修复**

- **配置页不显示。** 浏览器半边在 `ui-settings` 注册 `configForms` 之前执行，
  且受保护的客户端 ctx 在未声明 `inject` 时拒绝访问 `ctx.slots`，页面被静默丢弃。
  现声明 `inject: ['slots']`、轮询 `ctx.get('configForms')`，并兼容两种行 id 拼写。
- **所有 daemon 请求返回 401。** `resolveSecret` 在 apply 时捕获
  `ctx.get('credentials')`；从 bundle patch 加载时该服务尚未注册，插件缓存了
  `undefined`，请求不带 bearer。现改为每次请求现场解析。
- **配置页没有样式。** 之前是原生控件加内联样式，还引用了一个不存在的 token。
  现改为宿主设置行布局（`--dsw-alias-*` token、14px/12px 字号、36px 控件、
  行分隔线），明暗主题都与内置分页一致。

---
# 0.11.1

## English

`@fgfg163/dsh-agentmemory-plugin` 0.11.1.

**Added**

- **`agentId` config option.** Precedence: `config.agentId` > `AGENTMEMORY_AGENT_ID` > `owner`.
  Harnesses sharing one daemon should set the same value on every machine.

**Changed**

- `agentId` is no longer hardcoded. Was `"dsh"`, now read from config.
- The `@fgfg163/dsh-prompt-slot` install command is now shown in the install steps.
  Recall needs it, but it is an optional peer, so skipping it fails silently.

**Fixed**

- **One person split into two agent ids.** The daemon filters `agentId` hard, so rows
  written as `dsh` and rows written as `owner` cannot see each other.
- A blank or whitespace-only `agentId` no longer blanks the value; it falls through to
  the next level.

**Notes**

- This is a write-side change: restart the host for it to take effect.
- Rows already stored under the old id are not migrated.

## 简体中文

**新增**

- **`agentId` 配置项。** 优先级：`config.agentId` > `AGENTMEMORY_AGENT_ID` > `owner`。
  多 harness 共享一个 daemon 时，每台配成同一个值。

**修改**

- `agentId` 不再硬编码。原先是 `"dsh"`，改为读配置。
- `@fgfg163/dsh-prompt-slot` 的安装命令写进了安装步骤。召回需要它，但它是可选 peer，
  漏装只会静默失效。

**修复**

- **同一个人被拆成两个 agentId。** daemon 对 `agentId` 是硬过滤，写成 `dsh` 的行和
  写成 `owner` 的行互相看不见。
- 空串和纯空白的 `agentId` 不再把值清空，会继续往下一级取。

**注意**

- 改的是写入侧，需要重启宿主才生效。
- 已在旧 id 下落库的行不会迁移。

---

# 0.11.0

## English

**`dsh-agentmemory-recall` is merged into this package.** Recall and capture are now two
halves of one plugin, hitting one daemon and reading one url + secret.

**Why merge**

- Two packages meant two `url` / `secret` configs: change one, change the other, and they
  drift.
- `dsh-agentmemory-recall` depended on `file:../../plugins/...`, which one unrelated plugin
  install deleted on 2026-11-06. After merging there is no second local dependency for
  pnpm to sweep away.
- The split was arbitrary: one half wrote, one half read, both talking to agentmemory.

**Changed**

- New `lib/recall.js` (the 389-line implementation from `dsh-agentmemory-recall@1.0.0`,
  logic unchanged). Two-hop `/smart-search`, `targetLayer: 'memory'`, no `project` /
  `agentId`, `request` channel only — behaviour identical to before the merge.
- Config keys moved under `config.recall`: `enabled` / `limit` / `maxChars` /
  `fetchTimeoutMs` / `queryMaxChars` / `minQueryChars` / `minConfidence` / `tailRatio` /
  `includeLessons`. `url` and `secret` are still resolved once at the top level.
- **How the dependency is wired matters.** Recall gets the slot service through
  `ctx.inject(['promptInject'])`, not a module-level `inject`. The latter would keep the
  *entire* plugin — capture included — inactive in a profile without
  `@fgfg163/dsh-prompt-slot`. Verified against a real Cordis kernel: with the slot plugin
  absent, `POST /session/start` still fires.
- `peerDependencies` gains the optional `@fgfg163/dsh-prompt-slot`
  (`peerDependenciesMeta.optional`).
- New tests: `test/recall.test.js` (18 cases, ported and adapted to the optional
  dependency), `test/optional-dep.probe.mjs`, `test/integration-real.mjs` (real Cordis,
  both plugins).
- The plugin name `name = "agentmemory"` is **unchanged**: `agentmemory connect`
  identifies its own loader row by id + name, so renaming it would make it append a
  duplicate row.

**Upgrading**

- Delete the old patch row (`agentmemory-recall`) and move its config under the main row's
  `recall:`. Leaving it does not error, but that config no longer takes effect — the
  plugin it belonged to is gone.
- `lib/` gains a file; `files` already includes the whole directory, so the package
  manifest needs no change.

**How recall behaves**

- **Two-hop search.** Hop one asks the daemon for ranked candidates, hop two expands them
  into text. Both go to `/smart-search`.
- **Conclusions only.** The query is scoped to `targetLayer: 'memory'`, so raw tool traffic
  and session observations do not crowd out remembered conclusions.
- **`request` channel only.** The recalled block is woven into the outbound provider
  request and never written to the session log.
- **No machine filter.** `project` and `agentId` are deliberately not sent, so one daemon
  shared by several machines stops each from seeing only its own slice.
- **The query is your message.** Taken from the human prompt, filtered by
  `source.kind === 'user'`, so plugin-injected text is never searched.

**Good to know**

- **Short prompts are not searched.** `minQueryChars` defaults to 8, so "ok" or "restarted"
  never trigger recall.
- **A missing slot plugin is silent.** You lose per-turn recall and keep capture; nothing
  errors.
- **An unreachable daemon is silent too.** Recall degrades to "no recall this turn" and
  logs a warning.

## 简体中文

**把 `dsh-agentmemory-recall` 合并进本包。** 召回与 capture 现在是同一个插件的两半，
打同一个 daemon、读同一份 url + secret。

**为什么合并**

- 两个包配置两个 `url` / `secret`，改一处要改两处，且两边容易漂。
- `dsh-agentmemory-recall` 走的是 `file:../../plugins/...` 依赖，2026-11-06 被一次
  无关插件的安装连带删掉过。合并后不再有第二条会被 pnpm 清理的本地依赖。
- 职责本来就是同一件事：一个负责写、一个负责读，都对着 agentmemory。

**改动**

- 新增 `lib/recall.js`（原 `dsh-agentmemory-recall@1.0.0` 的 389 行实现，逻辑未改）。
  两跳 `/smart-search`、`targetLayer: 'memory'`、不传 `project` / `agentId`、
  `request` 通道（只进出站请求、不进会话历史）——行为与合并前完全一致。
- 配置键平移到 `config.recall` 下：`enabled` / `limit` / `maxChars` /
  `fetchTimeoutMs` / `queryMaxChars` / `minQueryChars` / `minConfidence` /
  `tailRatio` / `includeLessons`。`url` 与 `secret` 仍由顶层解析后统一注入。
- **依赖方式是关键**：召回通过 `ctx.inject(['promptInject'])` 拿插槽服务（可选依赖），
  不是模块级 `inject`。若写成后者，没装 `@fgfg163/dsh-prompt-slot` 的 profile 里
  **整个插件都会不激活，capture 一起失效**。已用真实 cordis 内核验证：缺插槽插件时
  `POST /session/start` 照常发出。
- `peerDependencies` 增加可选依赖 `@fgfg163/dsh-prompt-slot`（`peerDependenciesMeta.optional`）。
- 新增测试：`test/recall.test.js`（18 项，搬自原包并适配可选依赖）、
  `test/optional-dep.probe.mjs`、`test/integration-real.mjs`（真实 cordis 双插件）。
- 插件名 `name = "agentmemory"` **未改**：`agentmemory connect` 靠 loader 行的 id + name
  双重识别自己那行，改了会被追加一条重复行。

**升级注意**

- 旧的两条 patch 行（`agentmemory-recall`）要删掉，配置并到主包行的 `recall:` 下；
  留着不会报错，但那份配置不再生效（那条插件已经不存在）。
- 本版本起 `lib/` 多一个文件，`files` 已包含整个 `lib`，无需改包清单。

**召回的行为方式**

- **两跳检索。** 第一跳向 daemon 要候选排名，第二跳把它们展开成正文。两跳都打
  `/smart-search`。
- **只要结论。** 查询限定 `targetLayer: 'memory'`，避免原始工具流量和会话流水挤掉
  已沉淀的结论。
- **只走 `request` 通道。** 召回块织进出站请求，**不写会话日志**——所以没有召回时
  会话语义与之前完全一致。
- **不按机器过滤。** 故意不传 `project` 和 `agentId`，避免多机共用一个 daemon 时
  各自只看自己那一份。
- **查询词是你的发言。** 取自人类提问，按 `source.kind === 'user'` 过滤，插件注入的
  文本永远不会被检索。

**注意**

- **短提问不检索。** `minQueryChars` 默认 8，「好」「重启了」不会触发召回——
  这类话没有可检索的意图。
- **缺插槽插件是静默的。** 只是没有每轮召回，采集照常，不报错。
- **daemon 连不上同样静默。** 召回降级成「本轮不召回」并打 warning。

---

# 0.10.2

## English

First release published to npm by GitHub Release, used to verify Trusted Publishing
(OIDC) end to end.

Functionally identical to 0.10.0; `lib/index.js` is byte-for-byte unchanged
(SHA256 `5347F36F…`), the same as 0.10.0 and 0.10.1. The only substantive difference in
the tarball is the version string.

0.10.1 was never published to npm — it only raised the version so the workflow had an
unclaimed number to try. The actual publish used 0.10.2.

## 简体中文

首次通过 GitHub Release 自动发布到 npm 的版本，用来验证 Trusted Publishing
（OIDC）端到端可用。

功能与 0.10.0 相同，`lib/index.js` 逐字节未变（SHA256 `5347F36F…`），与
0.10.0、0.10.1 完全一致。tarball 内的实质差异只有版本号字符串。

0.10.1 从未发布到 npm——它只是把版本号抬起来，让 workflow 有一个尚未被占用的
版本可以尝试，实际发布用 0.10.2 完成。

---

# 0.10.1

## English

Used to validate the GitHub Actions OIDC publish path (not actually published).
Functionally identical to 0.10.0; `lib/index.js` is byte-for-byte unchanged
(SHA256 `5347F36F…`).

- New `.gitattributes` pins LF for workflow and shell files, so a Windows checkout with
  `core.autocrlf=true` cannot hand CRLF to a Linux runner and fail with
  `\r: command not found`.
- The workflow checks the registry for the current version before publishing and fails
  immediately naming that version, instead of letting npm reject it after packing (that
  error looks like an auth problem).

## 简体中文

用于验证 GitHub Actions 的 OIDC 发布链路（未实际发布）。功能与 0.10.0 相同，
`lib/index.js` 逐字节未变（SHA256 `5347F36F…`）。

- 新增 `.gitattributes`，把 workflow 与 shell 文件的换行符固定为 LF，避免
  Windows 下 `core.autocrlf=true` 把它们检出成 CRLF 后，Linux runner 报
  `\r: command not found`。
- workflow 在发布前先查 registry 上是否已有当前版本，有则立刻失败并指出是哪个
  版本，而不是等到打包完才由 npm 拒绝（那种报错看起来像鉴权问题）。

---

# 0.10.0

## English

First release, based on `@agentmemory/agentmemory@0.9.33`'s
`dist/integrations/dsh.mjs`.

**Version numbering**

This package uses its **own version sequence**, not upstream's. The first release is
`0.10.0` rather than `0.9.33` because:

- `0.9.33-1` (patch generation as a prerelease suffix) is treated as a prerelease by npm:
  `npm publish` fails without `--tag`, and `^0.9.33` style ranges silently fail to match.
- `0.9.33.1` (four segments) is not semver; npm normalises it to `0.9.3-3.1`, which sorts
  *below* `0.9.33` and is still a prerelease.
- `0.9.34` will eventually collide with upstream when the two are synced.

The upstream baseline is recorded here and in the commit message.

**Changed**

- **2026-11-02** Allow a remote plain-HTTP daemon to carry a bearer secret (upstream
  rejects every non-loopback `http://`).
- **2026-11-10** Injected memory gets its own character ceiling `contextMaxChars`
  (default 64000) instead of reusing the 8000 capture cap. Fixes memory being silently
  truncated mid-sentence once the pinned slots exceeded 8000.
- **2026-11-14** Remove a `sourceMappingURL` trailer pointing at a map this package does
  not ship.

**Note**

The capture path (tool input/output) still caps at upstream's 8000, unchanged.

## 简体中文

首个发布。基于 `@agentmemory/agentmemory@0.9.33` 的 `dist/integrations/dsh.mjs`。

**版本号约定**

本包使用**独立版本序列**，不跟上游对齐。首个发布是 `0.10.0` 而非 `0.9.33`，原因是：

- `0.9.33-1`（补丁代次做预发布后缀）会被 npm 判成 prerelease：`npm publish` 不加 `--tag` 直接失败，且 `^0.9.33` 这类 range 依赖静默匹配不上。
- `0.9.33.1`（四段式）不是 semver，npm 清洗成 `0.9.3-3.1`，比 `0.9.33` 更小，且仍是 prerelease。
- `0.9.34` 在上下游同步时早晚会撞车。

上游基线版本记录在这里和 commit message 里。

**改动**

- **2026-11-02** 允许远程明文 HTTP daemon 携带 bearer secret（上游会拒绝所有非回环 `http://`）。
- **2026-11-10** 注入的记忆使用独立的字符上限 `contextMaxChars`（默认 64000），不再复用 capture 输出那套 8000 上限。修复 pinned 槽位超长时记忆被静默截断在半句的问题。
- **2026-11-14** 移除指向未随包分发的 `dsh.mjs.map` 的 `sourceMappingURL` 尾注。

**说明**

capture 路径（工具输入输出）的上限未改动，仍是上游的 8000。
