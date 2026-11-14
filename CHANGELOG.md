# 0.10.1

用于验证 GitHub Actions 的 OIDC 发布链路。功能与 0.10.0 相同，`lib/index.js`
逐字节未变（SHA256 `5347F36F…`）。

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
