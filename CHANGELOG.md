# 0.11.0

**把 `dsh-agentmemory-recall` 合并进本包。** 召回与 capture 现在是同一个插件的两半，
打同一个 daemon、读同一份 url + secret。

## 为什么合并

- 两个包配置两个 `url` / `secret`，改一处要改两处，且两边容易漂。
- `dsh-agentmemory-recall` 走的是 `file:../../plugins/...` 依赖，2026-11-06 被一次
  无关插件的安装连带删掉过。合并后不再有第二条会被 pnpm 清理的本地依赖。
- 职责本来就是同一件事：一个负责写、一个负责读，都对着 agentmemory。

## 改动

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

## 升级注意

- 旧的两条 patch 行（`agentmemory-recall`）要删掉，配置并到主包行的 `recall:` 下；
  留着不会报错，但那份配置不再生效（那条插件已经不存在）。
- 本版本起 `lib/` 多一个文件，`files` 已包含整个 `lib`，无需改包清单。

# 0.10.2

首次通过 GitHub Release 自动发布到 npm 的版本，用来验证 Trusted Publishing
（OIDC）端到端可用。

功能与 0.10.0 相同，`lib/index.js` 逐字节未变（SHA256 `5347F36F…`），与
0.10.0、0.10.1 完全一致。tarball 内的实质差异只有版本号字符串。

0.10.1 从未发布到 npm——它只是把版本号抬起来，让 workflow 有一个尚未被占用的
版本可以尝试，实际发布用 0.10.2 完成。

# 0.10.1

用于验证 GitHub Actions 的 OIDC 发布链路（未实际发布）。功能与 0.10.0 相同，
`lib/index.js` 逐字节未变（SHA256 `5347F36F…`）。

- 新增 `.gitattributes`，把 workflow 与 shell 文件的换行符固定为 LF，避免
  Windows 下 `core.autocrlf=true` 把它们检出成 CRLF 后，Linux runner 报
  `\r: command not found`。
- workflow 在发布前先查 registry 上是否已有当前版本，有则立刻失败并指出是哪个
  版本，而不是等到打包完才由 npm 拒绝（那种报错看起来像鉴权问题）。

# 0.10.0

首个发布。基于 `@agentmemory/agentmemory@0.9.33` 的 `dist/integrations/dsh.mjs`。

## 版本号约定

本包使用**独立版本序列**，不跟上游对齐。首个发布是 `0.10.0` 而非 `0.9.33`，原因是：

- `0.9.33-1`（补丁代次做预发布后缀）会被 npm 判成 prerelease：`npm publish` 不加 `--tag` 直接失败，且 `^0.9.33` 这类 range 依赖静默匹配不上。
- `0.9.33.1`（四段式）不是 semver，npm 清洗成 `0.9.3-3.1`，比 `0.9.33` 更小，且仍是 prerelease。
- `0.9.34` 在上下游同步时早晚会撞车。

上游基线版本记录在这里和 commit message 里。

## 改动

- **2026-11-02** 允许远程明文 HTTP daemon 携带 bearer secret（上游会拒绝所有非回环 `http://`）。
- **2026-11-10** 注入的记忆使用独立的字符上限 `contextMaxChars`（默认 64000），不再复用 capture 输出那套 8000 上限。修复 pinned 槽位超长时记忆被静默截断在半句的问题。
- **2026-11-14** 移除指向未随包分发的 `dsh.mjs.map` 的 `sourceMappingURL` 尾注。

## 说明

capture 路径（工具输入输出）的上限未改动，仍是上游的 8000。
