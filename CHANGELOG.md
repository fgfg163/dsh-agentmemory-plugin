# Changelog

All notable changes to `@fgfg163/dsh-agentmemory-plugin` are recorded here.
`@fgfg163/dsh-agentmemory-plugin` 的版本变更记录。每个版本内先英文后中文。

---

# 0.13.4

## English

**Fixed**

- **The settings page could create a phantom workspace, and doing so made it
  impossible to configure the real one.** Opening the page assigned a target
  before the user picked anything: `status` was called without a workspace, the
  Host fell back to `workingDirectory.defaultDirectory`, and in the desktop host
  that is the PROFILE directory (`%DSH_HOME%\profiles\desktop`) — not a project
  at all. The page then adopted that key, so the first keystroke in any override
  field wrote a settings block for `profiles\desktop`. Because the block existed,
  the picker listed it, and the list showed two entries where the user had one
  workspace.

  Three layers were fixed, because any one of them alone would have prevented
  it:
  1. The Host no longer falls back to the process/profile directory.
     `resolveDirectory` answers `undefined` when the request names no workspace.
  2. `save` and `clear` require a named workspace and answer `400` otherwise.
     A write must never be redirected to a guessed directory.
  3. The page only adopts a `workspaceKey` that the picker actually offers, so a
     key with no matching option becomes "nothing selected" rather than being
     stored and displayed as the first option.

- **A select with no blank option showed the wrong workspace as selected.** When
  `wsKey` held a path with no corresponding `<option>`, the browser rendered the
  first real option, so the control read `dsh — E:\gem12\dsh` while edits were
  being written to the profile directory. The picker now has an explicit
  「— 未选择 —」 entry, and the override rows stay hidden while nothing is
  selected, with a line saying a workspace must be picked first.

**Added**

- A stored block whose directory is not (or no longer) a DSH workspace is
  labelled「（不在工作区列表里）」in the picker and reported by `status` as
  `registered: false` plus an `orphaned` array. Previously such a row rendered
  identically to a real workspace, which is what made a stray block read as a
  second workspace rather than as leftover data.

**Upgrade note**

- The stray block is NOT deleted automatically. Find it in the picker — it is the
  one marked「（不在工作区列表里）」— select it, and press
  「删除这个工作区的配置」. Only settings for directories that no workspace
  answers to are affected.

## 简体中文

**修复**

- **设置页会凭空创建一个工作区，而这个假条目反而让人配不好真正的工作区。**
  打开页面时，在用户还没选任何东西之前它就已经有了目标：`status` 请求不带
  工作区，Host 于是回退到 `workingDirectory.defaultDirectory`；桌面宿主里
  那就是 profile 目录（`%DSH_HOME%\profiles\desktop`），根本不是项目目录。
  页面又采纳了这个键，于是覆盖项里第一次按键就把配置写给了 `profiles\desktop`。
  条目一旦存在，选择器就会列出它，用户明明只有一个工作区，列表却显示两个。

  三层都改了，因为只改任何一层都不够：
  1. Host 不再回退到进程/profile 目录。请求没点名工作区时，`resolveDirectory`
     返回 `undefined`。
  2. `save` 与 `clear` 必须点名工作区，否则返回 `400`。写入绝不能被重定向到
     一个猜出来的目录。
  3. 页面只采纳选择器里**确实存在**的 `workspaceKey`；对不上的键变成
     「未选择」，而不是被存下来又渲染成第一项。

- **没有空白项的下拉框会把错误的工作区显示成已选中。** 当 `wsKey` 存着一个
  在 `<option>` 里并不存在的路径时，浏览器会渲染第一个真实选项，于是控件上
  写着 `dsh — E:\gem12\dsh`，实际却把改动写进了 profile 目录。现在选择器有
  显式的「— 未选择 —」项；未选中时覆盖项不显示，并明确提示要先选工作区。

**新增**

- 存有配置、但对应目录不是（或已不是）DSH 工作区的条目，在选择器里标注
  「（不在工作区列表里）」，`status` 也会返回 `registered: false` 与
  `orphaned` 列表。此前这种行和真实工作区渲染得一模一样，所以一个残留块
  才会被当成「第二个工作区」，而不是被当成待清理的数据。

**升级提示**

- 残留块**不会**被自动删除。它就在选择器里带「（不在工作区列表里）」标记的
  那一条：选中它，然后点「删除这个工作区的配置」。只会影响那些没有任何工作区
  对应的目录设置。

---

# 0.13.3

## English

**Added**

- **`contextMaxLessons`: a ceiling on how many `## Lessons Learned` entries the
  session-start block may carry.** The daemon builds that list itself and
  hard-codes ten (`mem::context`: `.slice(0, 10)` over the confidence-sorted
  lessons), and its `/context` endpoint accepts only a whole-block token
  `budget` — so "at most N lessons" cannot be requested from the client at
  all. The plugin trims the rendered block instead.

  `0` (the default) means "do not trim", so upgrading changes nothing. A
  positive value keeps that many **whole bullet lines**; because the daemon has
  already sorted by confidence, those are the most confident ones it sent.

**Changed**

- The setting is exposed both as a global field and as a per-workspace
  override, and both halves of the settings page now label it identically.

**Notes**

- Trimming shortens what the MODEL reads; it does not save daemon token budget,
  because the block was already selected before it reached the plugin.
- The cap applies to both `/session/start` and `/context`, which share one
  helper. Everything outside the lessons section is passed through
  byte-for-byte, and input the parser does not recognise is returned untouched:
  a cosmetic cap must never corrupt injected memory.

**Fixed**

- A store value filled in from `GLOBAL_DEFAULTS` no longer shadows an explicit
  profile-row pin. `readGlobalSettings()` fills every missing key, so a field
  with a meaningful zero looked "declared" even on a store that never mentioned
  it, and the row value was silently discarded. The config ladder now asks the
  raw document whether the key was declared.
- The new key is registered in **both** key tables. `write-global` reuses the
  workspace sanitiser, so listing it only under the global table made the
  settings page reject it with `nothing to save: no known keys in the payload`
  — a 400 the page swallows into a silent no-op.

## 简体中文

**新增**

- **`contextMaxLessons`：会话开头注入块里 `## Lessons Learned` 最多保留几条。**
  这份清单由 daemon 自己生成、条数硬编码为 10（`mem::context` 对按置信度排序
  的列表 `.slice(0, 10)`），而它的 `/context` 只接受整块 token 预算 `budget`——
  「最多 N 条」从客户端根本无法表达。因此改由插件裁剪已渲染好的块。

  `0`（默认值）表示不裁剪，升级后行为不变。给正整数则保留该数量的**完整
  bullet 行**；因为 daemon 已按置信度排好序，留下的正是它给出的最可信那几条。

**变更**

- 该设置同时提供全局字段与按工作区覆盖，设置页两处的文案现已统一。

**注意**

- 裁剪只缩短**模型读到**的内容，不省 daemon 的 token 预算——块在到达插件之前
  就已被选定。
- 该上限作用于 `/session/start` 与 `/context` 两个入口（共用同一个助手）。
  lessons 段之外的内容逐字节原样透传，解析不了的一律原样返回：一个装饰性的
  上限绝不能把注入的记忆弄坏。

**修复**

- 由 `GLOBAL_DEFAULTS` 补出来的存储值不再遮盖显式的 profile 行配置。
  `readGlobalSettings()` 会把缺失的键全部补齐，导致一个「0 有意义」的字段在
  从没写过的 store 上也显得「已声明」，于是行配置被静默丢弃。现在配置层直接
  查原始文档确认该键是否真的被写过。
- 新键在**两张**键表里都登记了。`write-global` 复用的是工作区侧的校验器，
  只写进全局表会让设置页以 `nothing to save: no known keys in the payload`
  拒收——而这个 400 会被页面吞成静默无操作。

---

# 0.13.2

## English

**Changed**

- **The two directions of `agentId` are now separate settings.** They were
  never symmetric, and treating them as one field forced a choice between two
  bad outcomes:
  - **Writing** is free. `/session/start` stores the id it is handed and
    `/observe` copies the session's id onto every row.
  - **Reading** is a hard equality filter. The daemon drops any row whose
    `agentId` differs — not reranks it, drops it.

  So the capture side keeps `agentId` (default `owner`), and the recall query
  gets its own `recallAgentId`, which defaults to **empty meaning "send no
  filter"**. That is what the plugin has always actually done; the difference
  is that a scoped read is now possible without also relabelling writes.

  Setting `recallAgentId` to the write id is a narrow read: historical rows
  filed under another id disappear from recall. `*` is the daemon's wildcard.

**Added**

- `recallAgentId` in the global settings, the per-workspace overrides, the
  schema and the store. Both ids can be overridden per workspace, independently.
- The read-id field renders blank with a `留空＝不过滤` placeholder, so an empty
  field reads as "deliberately off" rather than "not filled in yet".

**Fixed**

- **The workspace override inputs were all the same width.** Those rows are
  generated from one loop, and the width was written into that loop, so an id
  field got the same 220px box as a five-digit character ceiling — while the
  hand-written global rows above were 280/220/180 by content. Each override
  field now declares its own width, using the same numbers as the global row
  for the same setting.

**Migration**

- Existing installs need nothing: no store key is written until you type a read
  id, and an absent key keeps recall unfiltered. Behaviour is unchanged for
  anyone who never opens the new field.

## 简体中文

**变更**

- **`agentId` 的写和读拆成两个独立设置。** 这两个方向从来不对称，当成一个字段
  就只能在两个坏结果里挑一个：
  - **写入**是自由的。`/session/start` 存下给它的 id，`/observe` 把会话的 id
    抄到每条记录上。
  - **读取**是硬等值过滤。daemon 对不上的行直接丢掉——不是排到后面，是丢掉。

  所以捕获侧保留 `agentId`（默认 `owner`），召回查询改用独立的
  `recallAgentId`，默认**留空即「不传过滤」**。这本来就是插件的实际行为，区别在于
  现在可以在不重新打标写入的前提下做圈定读。

  把 `recallAgentId` 填成写侧那个 id 就是窄读：历史里其它 id 的记录会从召回里消失。
  `*` 是 daemon 的通配。

**新增**

- `recallAgentId` 已接入全局设置、按工作区覆盖、schema 与存储层。两个 id 都能
  按工作区独立覆盖。
- 读侧 id 输入框默认空白 + `留空＝不过滤` 占位提示，让空字段看起来是「故意关掉」
  而不是「还没填」。

**修复**

- **工作区的覆盖输入框全是一个宽度。** 那一块是一个循环批量生成的，宽度写死在
  循环里，于是 id 字段和五位的字符上限一样宽（220px）；而上面手写的全局行是按内容
  给的 280/220/180。现在每个覆盖字段各自声明宽度，取值与全局同类字段一致。

**迁移**

- 已有安装什么都不用做：不填读侧 id 就不会写入任何存储键，缺键即保持召回不过滤。
  不开这个新字段的人行为完全不变。

---

# 0.13.1

## English

**Fixed**

- **The settings page could spin forever.** The initial load rendered a
  "connecting" placeholder while its data was null, and the error branch
  returned without ever setting a value. Any failure — an unreachable route, or
  a plain 401 from a browser with no session for this host — left the panel
  showing "connecting" with no reason given.
  A failed read now renders the page with built-in defaults and states so at the
  top, because otherwise "the read failed" and "your settings are empty" look
  identical.

No other behaviour changed.

## 简体中文

**修复**

- **配置页可能一直显示「正在连接」。** 初次加载时数据为空，页面渲染
  「正在连接配置服务」占位；而错误分支直接 `return`，没有给数据赋值。任何失败
  ——路由不可达，或浏览器对该宿主没有会话因此拿到 401——都会让面板停在
  「正在连接」，不给任何原因。
  现在读取失败时会渲染页面并显示内置默认值，同时在顶部说明这一点，否则
  「读取失败」和「设置是空的」看起来完全一样。

除此之外行为不变。

---

# 0.13.0

## English

**Added**

- **Per-workspace settings.** DSH's own configuration layers are all
  profile-scoped, so before this every session on a machine shared one daemon,
  one `agentId` and one recall budget regardless of the project it was working
  in. The settings page now has a 按工作区覆盖 block: pick a workspace from the
  ones DSH has registered and the fields below it override the global values for
  sessions started in that directory only. Edits save on change — no Save press.
- **A workspace list that includes workspaces with no settings yet.** Choosing
  from an "already customised" list would have made the first override
  impossible to create.
- **Delete button for one workspace's settings**, on its own row above the
  picker. It only removes that workspace's block; the workspace, its sessions
  and every other workspace's settings are untouched. Clearing a field already
  means "follow global", so no separate control is needed for that.
- `lib/workspace-store.js` — the single store: canonical path keys, atomic
  writes, defaults, and one-time import from the profile row.
- `lib/workspace-route.js` — the Host half of the page, served through
  `connection.fetch.register()` at `/api/dsh-agentmemory/workspace`, so the
  official `/api` carrier authenticates the browser and the plugin never
  handles cookies. A Host/Origin-checked `webServer` fallback covers
  compositions without `connection.fetch`.

**Changed**

- **All settings now live in one file:**

  ```
  <DSH_HOME>/storages/dsh-agentmemory-workspaces.json
  ```

  of the shape `{ version, global, workspaces: { <path>: {...} } }`, beside
  every other section of DSH. `cordis.patch.yml` keeps only the mount row
  (`id` + `name`), so the generated settings form no longer edits these fields —
  this page is the only editor. A value left in the YAML row still works: the
  store is read first, then the row, then the built-in default.
- **Upgrade is automatic.** On first run the values still in the profile row are
  imported into the store, so an existing install keeps its configured daemon
  URL instead of falling back to `localhost`. Run once; the row is ignored
  afterwards. A store written by the previous build (no `global` block) still
  reads.
- **The global form autosaves** (400ms debounce) instead of requiring a Save
  press, matching every other settings section. Only fields that differ from the
  loaded snapshot are written.
- The capture half resolves config **per session**, so `agentId`,
  `contextMaxChars` and the daemon URL can differ between two concurrently
  running sessions. The recall half resolves its view inside `render()`, the
  only place the session exists; because `promptInject` fixes a slot's
  `maxChars` at registration, the slot registers at a 64k ceiling and the
  per-session `recall.maxChars` is enforced in `render()`.
- The spool drain timer drains every daemon target a workspace has selected, not
  just the profile one.
- Path keys are canonicalised: trailing separators dropped and, where the
  directory exists, `realpath` applied — a project reached through a symlink is
  one workspace, not two competing blocks.

**Fixed**

- **Saving one workspace erased every global setting.** The workspace writers
  rebuilt the document from `{version, workspaces}` and dropped `global`.
- **The route answered 401 to everything.** The first build registered it on
  `webServer` outside `/api` and called `connection.admit()` itself. Only the
  `/api` carrier mints the browser cookie `admit` verifies, so every request was
  refused; it also failed whenever `connection` loaded after `webServer`.
- **Volatile config leaves came back as `{}`.** Schema-resolved fields are
  `{ get }` references, so the page showed `{"limit":{}}` for every recall field.
  All read paths now unwrap.
- **The page never left its loading placeholder.** `setRemote` was declared but
  never called, and it referenced a helper that did not exist.
- **The global save wrote all fourteen fields** on any edit, and stored cleared
  values as `""` — which the runtime reads as an explicit empty id. It now sends
  only what differs and omits blanks so defaults apply.
- **An early return above the hooks** blanked the settings panel: the hook count
  differed between renders, so React dropped the effect that loads the data.

**Tests**

55 pass. New contract tests pin the classes of bug above: undefined label
references, an early return before the last hook, a helper call with no
declaration, a page action the Host does not serve, and a workspace write that
would drop the global block. Each was confirmed red before green.

## 简体中文

**新增**

- **按工作区设置。** DSH 自身的配置层全部属于 profile，在此之前一台机器上所有
  会话不论在哪个项目里都共用一个 daemon、一个 `agentId`、一套召回预算。配置页
  现在有「按工作区覆盖」区：从 DSH 已注册的工作区里选一个，下面的字段只对在该
  目录下启动的会话覆盖全局值。改一下就存，不需要点保存。
- **下拉框列出全部已注册工作区**，包括还没有任何设置的。只列「已有设置的」会让
  第一个覆盖永远建不起来。
- **删除单个工作区配置的按钮**，位于选择器上方独占一行。它只删那个工作区的块，
  工作区本身、它的会话以及其他工作区的设置都不受影响。清空字段本身就等于「跟随
  全局」，因此不需要额外的清除控件。
- `lib/workspace-store.js`——唯一的存储层：规范化路径键、原子写入、默认值，以及
  从 profile 行一次性导入。
- `lib/workspace-route.js`——配置页的宿主半边，经
  `connection.fetch.register()` 挂在 `/api/dsh-agentmemory/workspace`，由官方
  `/api` 载体鉴权，插件自身不碰 cookie。没有 `connection.fetch` 的组合走另一条
  路径、自行校验 Host/Origin 的 `webServer` 兜底。

**变更**

- **所有设置现在只存在一个文件里：**

  ```
  <DSH_HOME>/storages/dsh-agentmemory-workspaces.json
  ```

  形如 `{ version, global, workspaces: { <路径>: {...} } }`，与 DSH 其他各节的
  数据放在一起。`cordis.patch.yml` 只保留挂载行（`id` + `name`），生成式设置表单
  不再编辑这些字段——本页面是唯一入口。YAML 行里留着值仍然有效：先读存储，再读
  该行，最后用内置默认值。
- **升级自动完成。** 首次启动会把 profile 行里现有的值导入存储，因此已有安装不会
  丢掉配置好的 daemon 地址、回落到 `localhost`。只跑一次，之后忽略该行。旧版本写
  出的存储（没有 `global` 块）仍能正常读取。
- **全局表单改为自动保存**（400ms 防抖），不再需要点「保存」，与其他设置节一致。
  只写入与加载时快照不同的字段。
- 采集半边改为**按会话**解析配置，因此同时运行的两个会话可以有不同的 `agentId`、
  `contextMaxChars` 和 daemon 地址。召回半边在 `render()` 内解析自己的视图——那是
  会话唯一存在的地方；由于 `promptInject` 的 `maxChars` 在注册时固定，插槽按 64k
  上限注册，按会话的 `recall.maxChars` 在 `render()` 里执行。
- 暂存区排空定时器会排空工作区选过的每一个 daemon 目标，而不只是 profile 那个。
- 路径键会规范化：去掉尾部斜杠，目录存在时套用 `realpath`——通过符号链接到达的
  项目算一个工作区，而不是两个互相打架的块。

**修复**

- **保存一个工作区会抹掉所有全局设置。** 工作区写入从
  `{version, workspaces}` 重建文档，把 `global` 丢了。
- **路由对一切请求都回 401。** 第一版注册在 `/api` 之外的 `webServer` 上并自己调
  `connection.admit()`。但只有 `/api` 载体才会签发 `admit` 所校验的浏览器 cookie，
  于是每个请求都被拒；当 `connection` 晚于 `webServer` 加载时同样会拒。
- **volatile 配置叶子被读成 `{}`。** schema 解析出的字段是 `{ get }` 引用，页面
  因此对每个召回字段显示 `{"limit":{}}`。所有读取路径现已解包。
- **页面永远停在加载态。** `setRemote` 声明了却从未调用，且它引用了一个不存在的
  辅助函数。
- **全局保存会把 14 个字段全部写一遍**，并把清空的值存成 `""`——运行时会把空字符
  串当成显式的空 id。现在只发送有差异的字段，并省略空值以让默认值生效。
- **早退写在了 hook 之前**导致设置面板空白：两次渲染的 hook 数量不同，React 因此
  丢弃了负责加载数据的 effect。

**测试**

55 项通过。新增的契约测试锁定上述几类错误：引用未定义的标签、早退在最后一个
hook 之前、调用未声明的辅助函数、页面调用了宿主未提供的 action、以及会丢全局块的
工作区写入。每一条都验证过先红后绿。

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

## 简体中文

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
