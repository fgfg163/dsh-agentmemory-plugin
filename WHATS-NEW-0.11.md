# What's new in 0.11.0

English | [简体中文](#简体中文)

**Per-turn memory recall.** On every turn, before the model call, the plugin
searches the daemon for memories relevant to what you just said and weaves the
hits into the outbound request.

## What's new

| | |
|---|---|
| **Per-turn recall** | Every turn is searched against the memory store; matching memories ride along with the request |
| **`recall` config block** | `enabled`, `limit`, `maxChars`, `fetchTimeoutMs`, `queryMaxChars`, `minConfidence`, `includeLessons`, `tailRatio`, `minQueryChars` |
| **Optional `@fgfg163/dsh-prompt-slot` peer** | Provides the slot service recall injects through |
| **`lib/recall.js`** | The recall implementation, alongside `lib/index.js` |
| **Tests** | 18 unit tests and 3 probes |

How the new recall behaves:

- **Two-hop search.** Hop one asks the daemon for ranked candidates, hop two
  expands them into text. Both go to `/smart-search`.
- **Conclusions only.** The query is scoped to `targetLayer: 'memory'`, so raw
  tool traffic and session observations do not crowd out remembered conclusions.
- **`request` channel only.** The recalled block is woven into the outbound
  provider request. It is never written to the session log, so the conversation
  history stays exactly as it was without recall.
- **No machine filter.** `project` and `agentId` are deliberately not sent, so one
  daemon shared by several machines stops each from seeing only its own slice.
- **The query is your message.** It is taken from the human prompt, filtered by
  `source.kind === 'user'`, so plugin-injected text is never searched.

## What did not change

- Capture, the per-session `/context` injection, and the `contextMaxChars`
  ceiling behave exactly as before.
- The plugin's internal name is still `agentmemory`. `agentmemory connect`
  identifies its own loader row by id + name; renaming would make it append a
  duplicate row.

## Good to know

- **Short prompts are not searched.** `minQueryChars` defaults to 8, so "ok" or
  "重启了" never trigger recall. They carry no searchable intent.
- **A missing slot plugin is silent.** You lose per-turn recall and keep capture;
  nothing errors.
- **An unreachable daemon is silent too.** Recall degrades to "no recall this
  turn" and logs a warning.

---

# 简体中文

[English](#whats-new-in-0110) | 简体中文

**每轮记忆召回。** 每一轮，在模型调用之前，插件会去 daemon 检索与你当前发言相关的记忆，
命中的内容随出站请求一起带给模型。

## 新增内容

| | |
|---|---|
| **每轮召回** | 每一轮都检索记忆库；命中的记忆随请求一起发出 |
| **`recall` 配置块** | `enabled`、`limit`、`maxChars`、`fetchTimeoutMs`、`queryMaxChars`、`minConfidence`、`includeLessons`、`tailRatio`、`minQueryChars` |
| **可选 peer 依赖 `@fgfg163/dsh-prompt-slot`** | 提供召回注入所用的插槽服务 |
| **`lib/recall.js`** | 召回实现，与 `lib/index.js` 并列 |
| **测试** | 18 项单元测试与 3 个探针 |

新召回的运行方式：

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

## 没变的部分

- 采集、每会话的 `/context` 注入、`contextMaxChars` 上限，行为与之前完全一致。
- 插件内部名仍是 `agentmemory`。`agentmemory connect` 靠 id + name 双重识别自己那条，
  改名会让它追加一条重复行。

## 注意

- **短提问不检索。** `minQueryChars` 默认 8，「好」「重启了」不会触发召回——
  这类话没有可检索的意图。
- **缺插槽插件是静默的。** 只是没有每轮召回，采集照常，不报错。
- **daemon 连不上同样静默。** 召回降级成「本轮不召回」并打 warning。
