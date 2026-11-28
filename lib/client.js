/**
 * Settings page for `@fgfg163/dsh-agentmemory-plugin` — browser half.
 *
 * Bundle shape: registered through `window.__ModuleLoader__.load` with a
 * `factory(require)` closure (the shipped-bundle form; every specifier is a
 * module-table seed word). One editing entry per configuration: the page
 * registers into `settings.section`, namespace = the profile entry id.
 *
 * Styling follows the Harness settings rows: class names are prefixed `fgf-`
 * and only `--dsw-alias-*` tokens are referenced, so DSH's theme owns the
 * colors and the page matches the shipped sections. The primitives package is
 * deliberately NOT required — it changes across releases and a throwing
 * component blanks the whole slot.
 *
 * Secrets never render here: `secretEnv` is a credential REFERENCE (the name
 * of the stored secret), and the settings service redacts `role('secret')`
 * fields before they reach any client. The legacy `secret`/`secretFile`
 * fields are not declared in the schema, so they stay invisible to the form
 * and preserved in the patch.
 */
;(function (registration) {
  const Re = window.__ModuleLoader__
  const he = Re && Re[Symbol.for('@dsh-plugin/dsh-loader:load-wrap')]
  return (registration.id === '@fgfg163/dsh-agentmemory-plugin' && Re.load === (he && he.ours) && typeof (he && he.original) === 'function'
    ? he.original
    : Re.load).call(Re, registration)
})({
  id: '@fgfg163/dsh-agentmemory-plugin',
  factory: (require) => {
    const react = require('react')

    /** Settings namespace: the profile entry id this page edits. */
    const SETTINGS_NS = 'fgfg163-agentmemory-plugin'

    /**
     * Candidate namespace spellings this page answers to.
     *
     * The Settings mirror keys a form by the Loader entry id. The Desktop host
     * mounts profile rows under the `include` tree, so the same row answers to
     * both the bare patch id and the `include:`-wrapped one depending on the
     * host build. Ask the mirror which spelling it serves instead of
     * hard-coding one (dsh-connect-workbuddy hit the same divergence).
     */
    const SETTINGS_NS_CANDIDATES = ['include:' + SETTINGS_NS, SETTINGS_NS]

    /** Stylesheet id; also the duplicate-insert guard. */
    const STYLE_ID = '@fgfg163/dsh-agentmemory-plugin/settings.css'

    /**
     * Host route serving the six file operations.
     *
     * Must sit under `/api`: that prefix is the authenticated carrier
     * (`connection.fetch.register`), which is the only reason this page can
     * write files at all without the plugin handling cookies itself.
     */
    const ROUTE_PATH = '/api/dsh-agentmemory/workspace'

    /** Row/control styles copied from the Harness settings sections. */
    const CSS = `
.fgf-section{box-sizing:border-box;display:flex;flex-direction:column;max-width:720px;width:100%;color:var(--dsw-alias-label-primary)}
.fgf-intro{margin:0 0 4px;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:22px}
.fgf-group-title{margin:20px 0 0;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}
/* Emphasis for the two primary sections. Scoped variants rather than a change to
   the shared class, which also carries the quieter "工作空间配置" heading. */
.fgf-group-title-strong{font-weight:600}
.fgf-group-title-lead{font-size:15px;font-weight:600;line-height:24px;margin-top:24px}
/* Two visually distinct blocks. The page holds a global config and a
   per-workspace override layer; without a boundary the second group reads as
   "more global settings" rather than "settings for one workspace". */
.fgf-block{box-sizing:border-box;display:flex;flex-direction:column;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);padding:4px 20px 16px;margin:16px 0}
.fgf-block > .fgf-group-title:first-child{margin-top:12px}
.fgf-block-label{margin:12px 0 0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.fgf-row{display:flex;align-items:center;gap:24px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.fgf-row:last-of-type{border-bottom:none}
/* Rows whose control is a select plus a button need room: without a floor on
   the text column the title wraps to one character per line. */
/* Text column: grows, and may shrink, but min-width keeps it readable.
   It used to be 0, which let a wide control squeeze the title down to one
   character per line in a narrow dialog. */
.fgf-row-text{display:flex;flex-direction:column;gap:4px;flex:1 1 auto;min-width:200px}
/* Control column: shrinks and wraps, but never collapses its own content. */
.fgf-control{display:flex;align-items:center;gap:8px;flex:0 1 auto;flex-wrap:wrap;justify-content:flex-end;min-width:0}
.fgf-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}
.fgf-desc{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}
/* max-width:100%: each control carries an inline width (180-260px). In a
   narrow dialog that width exceeds the column, and without this cap the
   input overflows its container instead of shrinking. */
.fgf-input,.fgf-select{box-sizing:border-box;max-width:100%;height:36px;border-radius:var(--dsw-radius-md);border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;padding:0 12px;min-width:0}
.fgf-input::placeholder{color:var(--dsw-alias-label-tertiary)}
.fgf-input:focus,.fgf-select:focus{outline:none;border-color:var(--dsw-alias-border-selected)}
.fgf-input:disabled,.fgf-select:disabled{opacity:.5;cursor:not-allowed}
.fgf-select{cursor:pointer;padding-right:8px}
.fgf-check{width:16px;height:16px;margin:0;accent-color:var(--dsw-alias-brand-primary-new-colorprimary-new-color)}
.fgf-actions{display:flex;align-items:center;gap:8px;padding:20px 0 8px}
.fgf-actions-wrap{flex-wrap:wrap;row-gap:8px}
/* A delete action placed above a row: tighten the gap so it reads as part of
   the block it acts on rather than a separate section. */
.fgf-actions-top{padding:4px 0 0}
.fgf-button{box-sizing:border-box;height:32px;padding:0 14px;border-radius:var(--dsw-radius-md);border:.5px solid var(--dsw-alias-border-l3);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;cursor:pointer}
.fgf-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.fgf-button:disabled{opacity:.5;cursor:not-allowed}
.fgf-button-primary{border-color:transparent;background:var(--dsw-alias-brand-primary-new-colorprimary-new-color);color:#fff}
/* Narrow dialog: stack the row. A roomy settings page holds a label and a
   260px control side by side, but this dialog can shrink to ~300px, and
   there the two columns fight over the same pixels. Below 560px the label
   takes its own line and the control owns the full width underneath. */
@media (max-width:560px){
  .fgf-row{flex-direction:column;align-items:stretch;gap:10px}
  .fgf-row-text{min-width:0}
  .fgf-control{justify-content:flex-start;width:100%}
  /* Every control sets its width inline, so this needs the important flag. */
  .fgf-control > .fgf-input,.fgf-control > .fgf-select{width:100%!important}
  .fgf-block{padding-left:16px;padding-right:16px}
}
.fgf-error{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.fgf-notice{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
`

    const zh = {
      nav: 'AgentMemory 记忆',
      autoSaveHint: '改动自动保存（停止输入约 0.4 秒后写入）',
      globalSaved: '全局配置已保存',
      // Two different activation paths, stated up front: recall is re-resolved
      // on every render, while capture snapshots its config when the session is
      // created so one session cannot span two daemons. Saying "takes effect
      // immediately" was true for only half the fields.
      intro: '捕获与每轮召回的连接参数，改动都不需要重启插件。召回参数下一轮生效；daemon 地址、密钥引用名、上下文上限与两个 agentId 从新会话开始生效。',
      globalBlockLabel: '全局 · 对所有工作区生效',
      storeUnreachable: '读不到设置存储，下面显示的是内置默认值，改动可能无法保存：',
      urlTitle: 'Daemon 地址',
      urlDescription: 'AgentMemory 守护进程的 HTTP 基址，不带尾部斜杠。新会话生效。',
      secretEnvTitle: '密钥引用名',
      secretEnvDescription: '凭据存储里的密钥名称（如 AGENTMEMORY_SECRET）。只存名字，不存密钥值；值在「凭据存储」里管理。新会话生效。',
      contextMaxCharsTitle: '上下文注入上限',
      contextMaxCharsDescription: '每会话 /context 注入内容的字符上限（capture 半边）。新会话生效。',
      contextMaxLessonsTitle: '开头 lesson 条数',
      contextMaxLessonsDescription: '会话开头注入块里 ## Lessons Learned 保留几条，同时作为 maxLessons 发给 daemon。0＝不下发（用 daemon 默认）。新会话生效。',
      contextBudgetTitle: '上下文 token 预算',
      contextBudgetDescription: '向 daemon 请求的 /context 整块 token 预算。daemon 放不下的块会整块跳过而不是截断，所以 lesson 条数调大时这里要一起调大。0＝不下发（用 daemon 的 TOKEN_BUDGET）。新会话生效。',
      contextTimeoutTitle: '首轮注入超时 (ms)',
      contextTimeoutDescription: '/context 与 /session/start 的请求超时。这两个调用要传整块注入内容，是最慢的；超时后该会话的记忆注入会被整轮跳过，不会用更小的请求重试。0＝用内置 1500ms。新会话生效。',
      fetchTimeoutTitle: '其它请求超时 (ms)',
      fetchTimeoutDescription: '捕获（/observe）、/session/end、启动探测等其它 daemon 调用的超时。0＝用内置 1500ms。下一轮生效。',
      agentIdTitle: '写入 agentId',
      agentIdDescription: '写进每条捕获记录的 agent id（daemon 继承会话的 id）。共用同一 daemon 的机器必须一致，否则同一个人会被记到两个 id 下。新会话生效。',
      recallAgentIdTitle: '读取 agentId',
      recallAgentIdDescription: '每轮召回查询时带的 agent id 过滤。daemon 按精确匹配过滤，填了就只读这个 id 的记录，历史里其它 id 的记录会被一起藏掉。留空＝不过滤（推荐）。下一轮生效。',
      workspaceTitle: '工作空间配置',
      workspaceDescription: '按工作区（目录）保存的覆盖，存在 DSH 的数据目录里，改动即存，不写进项目仓库。',
      workspaceEnabledTitle: '启用工作空间覆盖',
      workspaceEnabledDescription: '关闭时所有会话都用全局值，已有覆盖保留但不生效。',
      workspaceEndpointTitle: '允许工作区改 daemon / 密钥',
      workspaceEndpointDescription: '默认关闭：一个工作区不该把本机捕获的对话改发到别的地址。只在完全信任的目录上打开。',
      wsActionsTitle: '按工作区覆盖',
      wsActionsDescription: '每个工作区可以有自己的 daemon、上下文上限、写读两个 agentId 与召回参数。下面的覆盖项改一下就存，不用点保存；没改的项跟随上面的全局值。生效时机同全局：召回参数下一轮，其余新会话。',
      wsPickLabel: '当前工作区',
      wsPickEmpty: '没有可用的工作区；先在侧边栏添加一个',
      wsPickHint: '选一个工作区来编辑它的覆盖；没有覆盖的也能选，改了就会创建。',
      // An explicit blank entry in the picker. Rendering no blank option made
      // the browser show the first workspace as selected while the page's own
      // state held something else, so the control disagreed with where edits
      // were written (0.13.4).
      wsPickNone: '— 未选择 —',
      // ADDED 0.14.0: suffix shown on the two endpoint rows while
      // `allowEndpointOverride` is off.
      wsEndpointLocked: '需先打开上面「允许工作区改 daemon / 密钥」',
      wsPickRequired: '还没选工作区。下面的覆盖项要选好工作区后才会出现，改动也只会写到你选中的那个。',
      // A stored block whose directory is not (or no longer) a DSH workspace.
      // Previously indistinguishable from a real one.
      wsUnregisteredMark: '（不在工作区列表里）',
      wsHasOverrideMark: '  ✓已覆盖',
      wsFollowsGlobal: '跟随全局',
      wsOverrideCount: (count) => `${count} 个工作区有覆盖设置`,
      wsSavedNow: '已保存（清空一项即恢复跟随全局）',
      wsNowFollowsGlobal: '已恢复为跟随全局',
      wsStoreError: '工作区设置读取失败：',
      wsClearThis: '删除这个工作区的配置',
      wsConfirmClearThis: '删除这个工作区保存的覆盖设置？只删它自己，其它工作区和全局配置不受影响。',
      wsClearedThis: '已删除这个工作区的配置',
      wsNoOverrideToClear: '这个工作区本来就没有配置',
      recallTitle: '每轮召回',
      recallDescription: '以下参数作用于每一轮的检索注入，改完下一轮就生效，不用等新会话。',
      limitTitle: '结果条数',
      maxCharsTitle: '注入块上限',
      entryMaxCharsTitle: '单条上限',
      entryMaxCharsDescription: '一条召回结果最多保留多少字符，超出截断并加省略号。调太小会丢结论，调太大则一条长记忆就吃掉整个注入块上限。默认 400。下一轮生效。',
      methodTitle: '检索接口',
      methodDescription: 'smart-search＝两跳（先查 id 再取正文），条数可精确控制，历史行为；search＝一跳、正文随结果一起返回，少一次往返，但条数由 daemon 的 token 预算决定。注意 lessons 只有 smart-search 会返回。下一轮生效。',
      modeTitle: '注入方式',
      modeDescription: '两种「不进入历史」都走 dsh-prompt-slot 的请求通道、不写日志，区别只在位置：请求前读起来更自然但会扰动前缀缓存，所有消息之后（默认）缓存最省。没装 dsh-prompt-slot 时自动退回写历史，不会静默失效。「完全关闭召回」则连注入都不做。下一轮生效。',
      stateSlotTitle: '状态槽位',
      stateSlotDescription: 'agentmemory 槽位名，用来放「我现在在做什么」。每轮首步读一次。留空＝关闭。只接受小写字母开头、[a-z0-9_]，最长 64。下一轮生效。',
      stateSlotModeTitle: '状态注入方式',
      stateSlotModeDescription: '进入历史＝写成一条会话消息，放在你的提问之前，只在内容变化时才注入（省 token，消息留在历史里每轮都看得到）。不进入历史的两种＝走 dsh-prompt-slot 的请求通道，不写日志，但因为不留存所以每轮都要重发。没装 dsh-prompt-slot 时自动退回「进入历史」。下一轮生效。',
      stateSlotModeNoSlot: '这个 profile 没装 @fgfg163/dsh-prompt-slot，选「不进入历史」会退回「进入历史」。',
      fetchTimeoutMsTitle: '抓取超时 (ms)',
      queryMaxCharsTitle: '查询截断',
      minConfidenceTitle: '置信度闸门',
      includeLessonsTitle: '附带 lessons',
      includeLessonsDescription: '把已经学到的规则（lessons）放在召回结果前面。只有检索接口选 smart-search 时才有——daemon 的 /search 端点不返回 lessons，选 search 时本项无效。勾选后多一次检索请求（层级要放宽才拿得到 lessons），但主检索范围不变。下一轮生效。',
      tailRatioTitle: '尾比截尾',
      minQueryCharsTitle: '最短查询长度',
      loading: '正在连接配置服务…',
      saveFailed: '保存失败：',
      saving: '保存中…',
    }

    /** One settings row: title + description on the left, control on the right. */
    const Row = ({ id, title, description, children }) =>
      react.createElement(
        'div',
        { className: 'fgf-row' },
        react.createElement(
          'div',
          { className: 'fgf-row-text' },
          react.createElement('label', { htmlFor: id, className: 'fgf-title' }, title),
          description
            ? react.createElement('p', { className: 'fgf-desc' }, description)
            : null,
        ),
        react.createElement('div', { className: 'fgf-control' }, children),
      )

    /** One numeric text input bound to a draft field. */
    const NumberInput = ({ id, value, disabled, onCommit, width = 120 }) =>
      react.createElement('input', {
        id,
        type: 'number',
        className: 'fgf-input',
        style: { width },
        value,
        disabled,
        onChange: (event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next)) onCommit(next)
        },
      })

    /**
     * Override fields the workspace editor exposes.
     *
     * Deliberately a subset of the global form: `workspace` itself is not
     * overridable (it says where overrides live, so a workspace redefining it
     * would be circular), and `secretEnv`/`url` are omitted on the client but
     * still accepted by the Host for profiles that allow endpoint overrides.
     *
     * `width` exists because these controls are generated from one loop, so
     * without it every field got the same 220px box — an id field the same
     * width as a five-digit character ceiling. The values mirror the widths
     * the hand-written global rows use for the same field, so the two halves
     * of the page read as one form. Keep them in step when adding a field:
     * 180 for ids, 140 for a long number, 120 for a short number, 100 for a
     * value that never exceeds "0.95".
     */
    const WS_OVERRIDE_FIELDS = [
      // ADDED 0.14.0: the two endpoint keys. They are gated behind
      // `allowEndpointOverride` (rendered disabled until it is on), because a
      // workspace pointing at a different daemon sends this machine's captured
      // conversations somewhere else. The store always accepted them — only the
      // UI had no entry, so the capability looked absent.
      { key: 'url', title: 'Daemon 地址', kind: 'string', inRecall: false, width: 260, requiresEndpoint: true },
      { key: 'secretEnv', title: '密钥引用名', kind: 'string', inRecall: false, width: 200, requiresEndpoint: true },
      { key: 'agentId', title: '写入 agentId', kind: 'string', inRecall: false, width: 180 },
      { key: 'recallAgentId', title: '读取 agentId', kind: 'string', inRecall: false, width: 180 },
      { key: 'contextMaxChars', title: '上下文注入上限', kind: 'number', inRecall: false, width: 120 },
      { key: 'contextMaxLessons', title: '开头 lesson 条数', kind: 'number', inRecall: false, width: 120 },
      { key: 'contextBudget', title: '上下文 token 预算', kind: 'number', inRecall: false, width: 140 },
      { key: 'contextTimeoutMs', title: '首轮注入超时 (ms)', kind: 'number', inRecall: false, width: 140 },
      { key: 'fetchTimeoutMs', title: '其它请求超时 (ms)', kind: 'number', inRecall: false, width: 140 },
      { key: 'limit', title: '结果条数', kind: 'number', inRecall: true, width: 120 },
      { key: 'maxChars', title: '注入块上限', kind: 'number', inRecall: true, width: 140 },
      // ADDED 0.15.0: the four recall keys added to the runtime and schema.
      // Without rows here a workspace simply cannot override them, which is the
      // exact gap that made `entryMaxChars` invisible before.
      //
      // `choices` is a `|`-separated string rather than an array on purpose:
      // the contract test slices this table up to the first closing bracket,
      // and an array literal here would truncate that slice and silently stop
      // checking the fields below it. `''` (an empty first entry) means
      // "follow global".
      { key: 'entryMaxChars', title: '单条上限', kind: 'number', inRecall: true, width: 140 },
      { key: 'method', title: '检索接口', kind: 'string', inRecall: true, width: 180, choices: '|smart-search|search' },
      { key: 'mode', title: '注入方式', kind: 'string', inRecall: true, width: 200, choices: '|slot-before|slot-after|off' },
      // ADDED 0.16.0. A workspace that works on a different project may want a
      // different state slot, or none at all (empty = follow nothing).
      { key: 'stateSlot', title: '状态槽位', kind: 'string', inRecall: true, width: 180 },
      // ADDED 0.16.0. One enum, not a pair of switches: channel and position
      // are not independent, and two booleans let a user pick impossible
      // combinations. Overridable so a long-running workspace can keep its
      // log small by routing the state through the request channel.
      { key: 'stateSlotMode', title: '状态注入方式', kind: 'string', inRecall: true, width: 200, choices: '|history|slot-before|slot-after' },
      { key: 'minQueryChars', title: '最短查询长度', kind: 'number', inRecall: true, width: 120 },
      { key: 'minConfidence', title: '置信度闸门', kind: 'number', inRecall: true, width: 100 },
      { key: 'includeLessons', title: '附带 lessons', kind: 'boolean', inRecall: true, width: 140 },
    ]

    /**
     * Call one workspace action on the Host.
     *
     * The route is authenticated by the Host's own browser cookie, which the
     * page already carries: a plain same-origin `fetch` with credentials is the
     * whole protocol. No token is passed in the body — putting one there would
     * make it readable by any script on the page.
     *
     * @param action - one of the names `lib/workspace-route.js` dispatches.
     * @param body - extra fields (`directory`, `payload`).
     * @returns the parsed answer, or `{ ok: false, reason }`.
     */
    const callRoute = async (action, body = {}) => {
      let response
      try {
        response = await fetch(ROUTE_PATH, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, ...body }),
        })
      } catch (cause) {
        return { ok: false, reason: `network error: ${cause instanceof Error ? cause.message : String(cause)}` }
      }
      let json
      try {
        json = await response.json()
      } catch {
        return { ok: false, reason: `HTTP ${response.status} with an unreadable body` }
      }
      if (json !== null && typeof json === 'object') return json
      return { ok: false, reason: `HTTP ${response.status} with an unexpected body` }
    }

    /** One action button that reports its own busy state. */
    /** The section page body. Reads and writes the Host store directly. */
    /**
     * The section page body.
     *
     * Reads and writes the Host store through the same route the workspace
     * block uses — no `configForms` binding any more. Once the global config
     * moved into `storages/` (2026-11-18), the profile settings form stopped
     * being the owner of these fields, so binding to it would show values the
     * plugin no longer reads.
     */
    const AgentMemoryPage = ({ labels }) => {
      /** Host-provided global config; null until the first load lands. */
      const [remote, setRemote] = react.useState(null)
      /**
       * Whether `@fgfg163/dsh-prompt-slot` is mounted in this profile (0.16.0).
       *
       * `undefined` until the Host says, and stays `undefined` when the Host is
       * too old to report it — the warning is additive, never a claim.
       */
      const [slotAvailable, setSlotAvailable] = react.useState(undefined)
      const [draft, setDraft] = react.useState(null)
      const [saving, setSaving] = react.useState(false)
      const [error, setError] = react.useState(undefined)
      const [globalNotice, setGlobalNotice] = react.useState(undefined)

      // The store is always writable through our own route; a read-only profile
      // no longer applies because the profile patch is not involved.
      const writable = true
      // `remote` is null on the first render, and this runs before the loading
      // guard below, so it has to tolerate null. Reading `value.url` off null
      // throws inside render, which blanks the whole settings panel.
      const value = remote ?? {}
      const accepted = () => ({
        url: typeof value.url === 'string' ? value.url : '',
        secretEnv: typeof value.secretEnv === 'string' ? value.secretEnv : '',
        contextMaxChars: Number(value.contextMaxChars) || 64000,
        // 0 is a real value here ("no trim"), so `|| ` would be wrong — it would
        // turn an explicit 0 back into the default. Guard only against NaN.
        contextMaxLessons: Number.isFinite(Number(value.contextMaxLessons)) ? Number(value.contextMaxLessons) : 0,
        // Same reasoning as above: 0 means "send no budget", not "unset".
        contextBudget: Number.isFinite(Number(value.contextBudget)) ? Number(value.contextBudget) : 0,
        // 0 means "use the built-in 1500 ms", so NaN-guard only.
        contextTimeoutMs: Number.isFinite(Number(value.contextTimeoutMs)) ? Number(value.contextTimeoutMs) : 0,
        fetchTimeoutMs: Number.isFinite(Number(value.fetchTimeoutMs)) ? Number(value.fetchTimeoutMs) : 0,
        agentId: typeof value.agentId === 'string' ? value.agentId : '',
        recallAgentId: typeof value.recallAgentId === 'string' ? value.recallAgentId : '',
        workspace: {
          enabled: value.workspace?.enabled !== false,
          allowEndpointOverride: value.workspace?.allowEndpointOverride === true,
        },
        recall: {
          limit: Number(value.recall?.limit) || 5,
          maxChars: Number(value.recall?.maxChars) || 4000,
          // 0.15.0. `|| 400` is correct here: the schema floor is 20, so a
          // stored 0 is never a meaningful value (unlike contextMaxLessons).
          entryMaxChars: Number(value.recall?.entryMaxChars) || 400,
          method: typeof value.recall?.method === 'string' ? value.recall.method : 'smart-search',
          // 0.16.0: one mode replaced the placement / withoutSlot pair. A
          // legacy store is migrated by the runtime (`resolveRecallMode`).
          mode: typeof value.recall?.mode === 'string' ? value.recall.mode : 'slot-after',
          // 0.16.0. `''` is a real value here ("no state slot"), so this is a
          // plain string pass-through rather than `|| 'default'`.
          stateSlot: typeof value.recall?.stateSlot === 'string' ? value.recall.stateSlot : '',
          // 0.16.0: one enum replaced the 0.16.0 boolean. A legacy `false`
          // is migrated by the runtime (`resolveMode`), not here — the page
          // should show what is stored, not rewrite it on open.
          stateSlotMode: typeof value.recall?.stateSlotMode === 'string' ? value.recall.stateSlotMode : 'history',
          fetchTimeoutMs: Number(value.recall?.fetchTimeoutMs) || 1200,
          queryMaxChars: Number(value.recall?.queryMaxChars) || 800,
          minConfidence: Number(value.recall?.minConfidence) || 0.5,
          includeLessons: value.recall?.includeLessons === true,
          tailRatio: Number(value.recall?.tailRatio) || 0.95,
          minQueryChars: Number(value.recall?.minQueryChars) || 8,
        },
      })
      const base = accepted()
      const draftValue = draft ?? base
      /**
       * Apply one field edit and schedule the write.
       *
       * The form used to require a Save press. That was inconsistent with the
       * workspace block below it (which saves on change) and with every shipped
       * settings section, so both halves now autosave.
       *
       * The write is debounced rather than immediate: a number input fires on
       * every keystroke, and typing "1200" would otherwise persist 1, 12, 120
       * and 1200 — four writes, each a `cordis.patch.yml` rewrite. 400ms is long
       * enough to collapse a burst of typing and short enough to feel instant.
       */
      const setPath = (path, v) => {
        const next = JSON.parse(JSON.stringify(draftValue))
        // path[0] names the block (`recall` / `workspace`) or the top level.
        const parent = path.length > 1 ? next[path[0]] : next
        parent[path[path.length - 1]] = v
        setDraft(next)
        scheduleGlobalSave(next)
      }

      /**
       * Debounced profile write.
       *
       * Kept in a ref so a re-render does not lose a pending timer, and cleared
       * on unmount so a closed panel cannot write after the fiber is gone.
       */
      const globalSaveTimer = react.useRef(undefined)
      const scheduleGlobalSave = (values) => {
        if (!writable) return
        if (globalSaveTimer.current !== undefined) clearTimeout(globalSaveTimer.current)
        globalSaveTimer.current = setTimeout(() => {
          globalSaveTimer.current = undefined
          void commitGlobal(values)
        }, 400)
      }
      react.useEffect(() => () => {
        if (globalSaveTimer.current !== undefined) clearTimeout(globalSaveTimer.current)
      }, [])

      /**
       * Write the whole form to the profile row.
       *
       * One mutate call for all fields: the ops share a revision fence, so a
       * concurrent write cannot land between two fields of the same edit.
       */
      /**
       * Write the profile row, touching only what changed.
       *
       * Two rules, both learned from a real `cordis.patch.yml` getting filled
       * with defaults after one edit:
       *
       * 1. **Only differed fields are sent.** The row started as `recall: {}`;
       *    writing all fourteen fields expanded it into a full listing that no
       *    longer resembles what the user configured.
       * 2. **An empty value is `unset`, never `set`.** `agentId: ""` is not
       *    "unset" — the runtime reads it as an explicit empty id. Clearing a
       *    field must remove the key so the schema default applies.
       *
       * The ops still travel as ONE mutate call so they share a revision fence;
       * a concurrent write cannot land in the middle of an edit.
       */
      const commitGlobal = async (values) => {
        if (!writable) return
        setSaving(true)
        setError(undefined)
        try {
          /** One field, expressed as the op its value deserves. */
          // Blank strings mean "clear this field", and the Host treats an
          // absent key as "use the default" — so drop them rather than storing
          // an empty string, which the runtime would read as an explicit id.
          const cleaned = { ...values }
          if (cleaned.url === '') delete cleaned.url
          if (cleaned.agentId === '') delete cleaned.agentId
          // `recallAgentId` is NOT dropped when blank, unlike the two above.
          // Blank is its meaningful value ("send no filter") and the Host stores
          // only keys differing from the default, so sending '' clears a
          // previous value without writing an empty string to disk. Deleting it
          // here would leave the Host's merge keeping the OLD id, i.e. clearing
          // the field would silently do nothing.
          if (cleaned.secretEnv === '') delete cleaned.secretEnv
          // A debounce collapsing to "nothing changed" must not send an empty
          // write (the Host rejects it and the page would show a failure).
          if (JSON.stringify(cleaned) === JSON.stringify(base)) {
            setGlobalNotice(labels.globalSaved)
            return
          }
          // Merge onto what the Host currently holds: `write-global` replaces
          // the block, so sending only the delta would erase untouched fields.
          const merged = cleaned
          const result = await callRoute('write-global', { config: merged })
          if (result?.ok === false) {
            setError(labels.saveFailed + String(result?.reason ?? 'host refused the write'))
            return
          }
          // Do NOT clear the draft here. A pending keystroke may already have
          // queued a newer draft; dropping it would silently discard the last
          // characters typed. The draft simply converges with `base` once the
          // mirror reflects the write, so the fields converge on committed state.
          setGlobalNotice(labels.globalSaved)
        } catch (cause) {
          setError(labels.saveFailed + (cause instanceof Error ? cause.message : String(cause)))
        } finally {
          setSaving(false)
        }
      }

      /* ---------------- workspace file actions ---------------- *
       *
       * These six buttons are the only place the page touches the filesystem,
       * and they do it through the Host route in lib/workspace-route.js. The
       * page never learns a file path from the user: it sends the directory box
       * (or nothing) and the Host decides which single file that means.
       */
      /**
       * Workspace overrides — saved on change, no button.
       *
       * The earlier design had a directory box plus six buttons. Two problems
       * killed it: the box defaulted to the process directory rather than the
       * workspace the user was looking at (so "save to workspace" wrote
       * somewhere unrelated), and every change needed a manual save, which no
       * other settings section does.
       *
       * Now: pick a workspace, and every edit to the override fields is
       * persisted immediately through the Host store.
       */
      const [wsList, setWsList] = react.useState([])
      const [wsChoices, setWsChoices] = react.useState([])
      const [wsKey, setWsKey] = react.useState(undefined)
      const [wsState, setWsState] = react.useState({ phase: 'loading' })
      const [wsNotice, setWsNotice] = react.useState(undefined)
      const [wsError, setWsError] = react.useState(undefined)
      /** True while the delete request for this workspace is in flight. */
      const [wsBusy, setWsBusy] = react.useState(false)

      /** Load the workspace list and this workspace's stored overrides. */
      const loadWorkspace = async (chosen) => {
        const result = await callRoute('status', chosen === undefined ? {} : { workspace: chosen })
        if (result?.ok === false || result?.storeError) {
          setWsState({ phase: 'error' })
          setWsError(String(result?.storeError ?? result?.reason ?? 'cannot read the workspace store'))
          // Still leave the loading state. Returning here without a `remote`
          // value left the page on "connecting" forever whenever the route was
          // unreachable — including a plain 401 from a browser without a
          // session. A failure must render, showing what went wrong.
          setRemote({})
          return
        }
        setWsList(Array.isArray(result.workspaces) ? result.workspaces : [])
        setWsChoices(
          Array.isArray(result.workspaces)
            ? result.workspaces.map((row) => ({
                path: row.path,
                // The label is what makes "which workspace am I editing"
                // answerable: a title plus the full path, and a marker when the
                // workspace already carries overrides.
                //
                // A stored block whose directory is no longer a DSH workspace
                // gets its own wording. It used to look exactly like a real
                // workspace, which is how a stray `profiles\desktop` block read
                // as "DSH has two workspaces".
                label: row.registered === false
                  ? `${row.path}${labels.wsUnregisteredMark}${labels.wsHasOverrideMark}`
                  : `${row.title !== undefined ? `${row.title}  —  ` : ''}${row.path}${row.customised ? labels.wsHasOverrideMark : ''}`,
                registered: row.registered !== false,
              }))
            : [],
        )
        // Only adopt the Host's answer when the page did not pick: adopting it on
        // every load silently replaced a user's selection with the Host fallback
        // directory, so the next edit was saved to the wrong workspace.
        //
        // The key is ALSO checked against the offered choices. 0.13.3 and below
        // took whatever the Host returned, including a fallback directory that
        // had no option in the list; the select then rendered the first entry
        // while `wsKey` held the fallback, so the page showed "dsh" yet saved
        // into `%DSH_HOME%\profiles\desktop` (0.13.4 fix). A key that is not
        // offered is not a selection.
        if (chosen === undefined) {
          const offered = new Set((Array.isArray(result.workspaces) ? result.workspaces : []).map((row) => row.path))
          const answer = result.workspaceKey
          setWsKey(typeof answer === 'string' && offered.has(answer) ? answer : undefined)
        }
        // This is what lifts the "connecting" placeholder. Without it the page
        // renders its loading text forever even though the route answered.
        setRemote(result.profile ?? {})
        // 0.16.0: the Host reports whether the request channel exists here. It
        // has to come from the route rather than `ctx.get()` on this side,
        // because `promptInject` is a Host service the Client cannot see.
        // `undefined` (a Host too old to report it) leaves the warning off
        // rather than claiming the feature is missing.
        setSlotAvailable(typeof result.slotService === 'boolean' ? result.slotService : undefined)
        setWsState({
          phase: 'ready',
          workspace: result.workspace ?? null,
          storePath: result.storePath,
          profile: result.profile,
          customisedCount: result.workspaceCount ?? 0,
        })
        setWsError(undefined)
      }

      /**
       * One override field changed.
       *
       * Saves the whole override document for this workspace on every edit. The
       * document is tiny (a dozen scalars) and the write is atomic, so a debounce
       * would only add the question "did that land?".
       */
      const saveOverride = async (nextOverride) => {
        if (wsKey === undefined) return
        const cleaned = { ...nextOverride }
        for (const key of Object.keys(cleaned)) {
          if (cleaned[key] === undefined) delete cleaned[key]
        }
        const result = await callRoute('save', { workspace: wsKey, settings: cleaned })
        if (result?.ok === false) {
          setWsError(String(result?.reason ?? 'save failed'))
          return
        }
        setWsState((previous) => ({ ...previous, phase: 'ready', workspace: result.cleared ? null : result.settings }))
        setWsNotice(result.cleared ? labels.wsNowFollowsGlobal : labels.wsSavedNow)
        setWsError(undefined)
        await loadWorkspace(wsKey)
      }

      /**
       * Delete the selected workspace's stored settings.
       *
       * Only that one block is removed — the workspace itself, its sessions and
       * every other workspace's settings stay. Confirmed first because the
       * button sits next to a selector and a stray click would silently drop
       * settings the user cannot see (the file is outside the project).
       */
      const clearThisWorkspace = async () => {
        if (wsKey === undefined || wsBusy) return
        if (typeof window.confirm === 'function' && !window.confirm(labels.wsConfirmClearThis)) return
        setWsBusy(true)
        setWsError(undefined)
        try {
          const result = await callRoute('clear', { workspace: wsKey })
          if (result?.ok === false) {
            setWsError(String(result?.reason ?? 'delete failed'))
            return
          }
          setWsNotice(result.removed === false ? labels.wsNoOverrideToClear : labels.wsClearedThis)
          await loadWorkspace(wsKey)
        } catch (cause) {
          setWsError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setWsBusy(false)
        }
      }

      // Load once on mount, then follow the selected workspace.
      react.useEffect(() => {
        void loadWorkspace(undefined)
      }, [])
      react.useEffect(() => {
        if (wsKey === undefined) return
        void loadWorkspace(wsKey)
      }, [wsKey])

      // The early return sits AFTER every hook on purpose. Returning before them
      // changes the hook count between the loading and loaded renders, which
      // makes React drop the effect that triggers the very load being awaited —
      // the page then sits on "connecting" forever.
      if (remote === null) {
        return react.createElement('p', { className: 'fgf-notice' }, labels.loading)
      }

      const disabled = !writable || saving
      // Whether the selected workspace has anything stored. `status` returns the
      // stored block (null when absent), so this is the Host's own answer rather
      // than a guess from the form.
      const hasOverride = wsState.workspace !== null && wsState.workspace !== undefined
      const recall = draftValue.recall
      return react.createElement(
        'div',
        { className: 'fgf-section' },
        react.createElement('p', { className: 'fgf-intro' }, labels.intro),
        // Surface a failed store read at the TOP: the fields below then show
        // built-in defaults, which look exactly like real settings. Saying so is
        // the difference between "my config is empty" and "the read failed".
        wsState.phase === 'error' && wsError !== undefined
          ? react.createElement('p', { className: 'fgf-error' }, labels.storeUnreachable + wsError)
          : null,
        react.createElement(
          'div',
          { className: 'fgf-block' },
          react.createElement('p', { className: 'fgf-block-label' }, labels.globalBlockLabel),
        react.createElement(Row, { id: 'am-url', title: labels.urlTitle, description: labels.urlDescription },
          react.createElement('input', {
            id: 'am-url', type: 'text', className: 'fgf-input', style: { width: 280 },
            value: draftValue.url, disabled,
            onChange: (e) => setPath(['url'], e.target.value),
          })),
        react.createElement(Row, { id: 'am-secret', title: labels.secretEnvTitle, description: labels.secretEnvDescription },
          react.createElement('input', {
            id: 'am-secret', type: 'text', className: 'fgf-input', style: { width: 220 },
            value: draftValue.secretEnv, disabled,
            onChange: (e) => setPath(['secretEnv'], e.target.value),
          })),
        react.createElement(Row, { id: 'am-ctx', title: labels.contextMaxCharsTitle, description: labels.contextMaxCharsDescription },
          react.createElement(NumberInput, {
            id: 'am-ctx', value: draftValue.contextMaxChars, disabled,
            onCommit: (v) => setPath(['contextMaxChars'], v),
          })),
        react.createElement(Row, { id: 'am-ctx-lessons', title: labels.contextMaxLessonsTitle, description: labels.contextMaxLessonsDescription },
          react.createElement(NumberInput, {
            id: 'am-ctx-lessons', value: draftValue.contextMaxLessons, disabled,
            onCommit: (v) => setPath(['contextMaxLessons'], v),
          })),
        react.createElement(Row, { id: 'am-ctx-budget', title: labels.contextBudgetTitle, description: labels.contextBudgetDescription },
          react.createElement(NumberInput, {
            id: 'am-ctx-budget', value: draftValue.contextBudget, disabled,
            onCommit: (v) => setPath(['contextBudget'], v),
          })),
        react.createElement(Row, { id: 'am-ctx-timeout', title: labels.contextTimeoutTitle, description: labels.contextTimeoutDescription },
          react.createElement(NumberInput, {
            id: 'am-ctx-timeout', value: draftValue.contextTimeoutMs, disabled,
            onCommit: (v) => setPath(['contextTimeoutMs'], v),
          })),
        react.createElement(Row, { id: 'am-fetch-timeout', title: labels.fetchTimeoutTitle, description: labels.fetchTimeoutDescription },
          react.createElement(NumberInput, {
            id: 'am-fetch-timeout', value: draftValue.fetchTimeoutMs, disabled,
            onCommit: (v) => setPath(['fetchTimeoutMs'], v),
          })),
        react.createElement(Row, { id: 'am-agent', title: labels.agentIdTitle, description: labels.agentIdDescription },
          react.createElement('input', {
            id: 'am-agent', type: 'text', className: 'fgf-input', style: { width: 180 },
            value: draftValue.agentId, disabled,
            onChange: (e) => setPath(['agentId'], e.target.value),
          })),
        react.createElement(Row, { id: 'am-recall-agent', title: labels.recallAgentIdTitle, description: labels.recallAgentIdDescription },
          react.createElement('input', {
            id: 'am-recall-agent', type: 'text', className: 'fgf-input', style: { width: 180 },
            // Blank renders as blank, with the placeholder stating what blank
            // MEANS. Showing "owner" here would make "no filter" look like a
            // filter to that id, which is the exact confusion this split fixes.
            placeholder: '留空＝不过滤',
            value: draftValue.recallAgentId, disabled,
            onChange: (e) => setPath(['recallAgentId'], e.target.value),
          })),
        react.createElement('h3', { className: 'fgf-group-title' }, labels.workspaceTitle),
        react.createElement('p', { className: 'fgf-desc' }, labels.workspaceDescription),
        react.createElement(Row, { id: 'am-ws-on', title: labels.workspaceEnabledTitle, description: labels.workspaceEnabledDescription },
          react.createElement('input', {
            id: 'am-ws-on', type: 'checkbox', className: 'fgf-check',
            checked: draftValue.workspace.enabled, disabled,
            onChange: (e) => setPath(['workspace', 'enabled'], e.target.checked),
          })),
        react.createElement(Row, { id: 'am-ws-ep', title: labels.workspaceEndpointTitle, description: labels.workspaceEndpointDescription },
          react.createElement('input', {
            id: 'am-ws-ep', type: 'checkbox', className: 'fgf-check',
            checked: draftValue.workspace.allowEndpointOverride, disabled,
            onChange: (e) => setPath(['workspace', 'allowEndpointOverride'], e.target.checked),
          })),
        react.createElement('h3', { className: 'fgf-group-title fgf-group-title-strong' }, labels.recallTitle),
        react.createElement('p', { className: 'fgf-desc' }, labels.recallDescription),
        react.createElement(Row, { id: 'am-limit', title: labels.limitTitle },
          react.createElement(NumberInput, { id: 'am-limit', value: recall.limit, disabled, onCommit: (v) => setPath(['recall', 'limit'], v) })),
        react.createElement(Row, { id: 'am-max', title: labels.maxCharsTitle },
          react.createElement(NumberInput, { id: 'am-max', value: recall.maxChars, disabled, width: 140, onCommit: (v) => setPath(['recall', 'maxChars'], v) })),
        react.createElement(Row, { id: 'am-entry-max', title: labels.entryMaxCharsTitle, description: labels.entryMaxCharsDescription },
          react.createElement(NumberInput, { id: 'am-entry-max', value: recall.entryMaxChars, disabled, width: 140, onCommit: (v) => setPath(['recall', 'entryMaxChars'], v) })),
        react.createElement(Row, { id: 'am-method', title: labels.methodTitle, description: labels.methodDescription },
          react.createElement('select', {
            id: 'am-method', className: 'fgf-select', style: { width: 180 },
            value: recall.method, disabled,
            onChange: (e) => setPath(['recall', 'method'], e.target.value),
          },
          react.createElement('option', { value: 'smart-search' }, 'smart-search（两跳）'),
          react.createElement('option', { value: 'search' }, 'search（一跳）'))),
        react.createElement(Row, { id: 'am-mode', title: labels.modeTitle, description: labels.modeDescription },
          react.createElement('select', {
            id: 'am-mode', className: 'fgf-select', style: { width: 260 },
            value: recall.mode, disabled,
            onChange: (e) => setPath(['recall', 'mode'], e.target.value),
          },
          react.createElement('option', { value: 'slot-before' }, '不进入历史（用户输入之前）'),
          react.createElement('option', { value: 'slot-after' }, '不进入历史（用户输入之后）'),
          react.createElement('option', { value: 'off' }, '完全关闭召回'))),
        react.createElement('h3', { className: 'fgf-group-title fgf-group-title-strong' }, labels.stateSlotTitle),
        react.createElement('p', { className: 'fgf-desc' }, labels.stateSlotDescription),
        react.createElement(Row, { id: 'am-state-slot', title: '槽位名' },
          react.createElement('input', {
            id: 'am-state-slot', type: 'text', className: 'fgf-input', style: { width: 180 },
            value: recall.stateSlot, disabled,
            placeholder: '留空＝关闭',
            onChange: (e) => setPath(['recall', 'stateSlot'], e.target.value),
          })),
        react.createElement(Row, { id: 'am-state-slot-mode', title: labels.stateSlotModeTitle, description: labels.stateSlotModeDescription },
          react.createElement('div', null,
            react.createElement('select', {
              id: 'am-state-slot-mode', className: 'fgf-select', style: { width: 260 },
              value: recall.stateSlotMode, disabled,
              onChange: (e) => setPath(['recall', 'stateSlotMode'], e.target.value),
            },
            // Ordered by what a reader is most likely to want: the default
            // first, then the two unlogged placements in reading order.
            react.createElement('option', { value: 'history' }, '进入历史（用户输入之前）'),
            react.createElement('option', { value: 'slot-before' }, '不进入历史（用户输入之前）'),
            react.createElement('option', { value: 'slot-after' }, '不进入历史（用户输入之后）')),
            // The fallback is invisible otherwise: the select would keep
            // showing a value the runtime is not honouring.
            slotAvailable === false
              ? react.createElement('p', { className: 'fgf-desc', style: { marginTop: 6 } }, labels.stateSlotModeNoSlot)
              : null)),
        react.createElement(Row, { id: 'am-timeout', title: labels.fetchTimeoutMsTitle },
          react.createElement(NumberInput, { id: 'am-timeout', value: recall.fetchTimeoutMs, disabled, onCommit: (v) => setPath(['recall', 'fetchTimeoutMs'], v) })),
        react.createElement(Row, { id: 'am-qmax', title: labels.queryMaxCharsTitle },
          react.createElement(NumberInput, { id: 'am-qmax', value: recall.queryMaxChars, disabled, onCommit: (v) => setPath(['recall', 'queryMaxChars'], v) })),
        react.createElement(Row, { id: 'am-minconf', title: labels.minConfidenceTitle },
          react.createElement(NumberInput, { id: 'am-minconf', value: recall.minConfidence, disabled, width: 100, onCommit: (v) => setPath(['recall', 'minConfidence'], v) })),
        react.createElement(Row, { id: 'am-lessons', title: labels.includeLessonsTitle, description: labels.includeLessonsDescription },
          react.createElement('input', {
            id: 'am-lessons', type: 'checkbox', className: 'fgf-check',
            checked: recall.includeLessons,
            // Inert under `method: 'search'`: `/search` returns no lessons, so
            // leaving the box live would let a user tick it and then wonder why
            // nothing changed. Disabled rather than hidden keeps the reason
            // visible — the description says which method needs it.
            disabled: disabled || recall.method === 'search',
            onChange: (e) => setPath(['recall', 'includeLessons'], e.target.checked),
          })),
        react.createElement(Row, { id: 'am-tail', title: labels.tailRatioTitle },
          react.createElement(NumberInput, { id: 'am-tail', value: recall.tailRatio, disabled, width: 100, onCommit: (v) => setPath(['recall', 'tailRatio'], v) })),
        react.createElement(Row, { id: 'am-minq', title: labels.minQueryCharsTitle },
          react.createElement(NumberInput, { id: 'am-minq', value: recall.minQueryChars, disabled, onCommit: (v) => setPath(['recall', 'minQueryChars'], v) })),
        // Status line only — the Save/Discard pair is gone because every edit
        // is written 400ms after typing stops. `saving` still shows so a slow
        // host write is visible rather than looking like nothing happened.
        react.createElement(
          'div',
          { className: 'fgf-actions' },
          react.createElement(
            'span',
            { className: 'fgf-notice' },
            error !== undefined
              ? error
              : saving
                ? labels.saving
                : globalNotice ?? labels.autoSaveHint,
          ),
        ),
        ),
        react.createElement(
          'div',
          { className: 'fgf-block' },
        react.createElement('h3', { className: 'fgf-group-title fgf-group-title-lead' }, labels.wsActionsTitle),
        react.createElement('p', { className: 'fgf-desc' }, labels.wsActionsDescription),
        wsState.phase === 'loading'
          ? react.createElement('p', { className: 'fgf-notice' }, labels.loading)
          : react.createElement(
              'div',
              null,
              // Delete action sits ABOVE the picker on its own row. It shared the
              // picker's row at first, which squeezed the title into a vertical
              // stack of single characters.
              wsKey !== undefined && hasOverride
                ? react.createElement(
                    'div',
                    { className: 'fgf-actions fgf-actions-top' },
                    react.createElement('button', {
                      id: 'am-ws-clear',
                      type: 'button',
                      className: 'fgf-button',
                      title: labels.wsClearThis,
                      disabled: wsBusy,
                      onClick: () => { void clearThisWorkspace() },
                    }, wsBusy ? labels.saving : labels.wsClearThis),
                  )
                : null,
              react.createElement(Row, { id: 'am-ws-pick', title: labels.wsPickLabel,
                description: wsChoices.length === 0 ? labels.wsPickEmpty : labels.wsPickHint },
                wsChoices.length === 0
                  ? react.createElement('span', { className: 'fgf-desc' }, labels.wsFollowsGlobal)
                  : react.createElement('select', {
                      id: 'am-ws-pick', className: 'fgf-select', style: { width: 320 },
                      value: wsKey ?? '',
                      onChange: (e) => setWsKey(e.target.value === '' ? undefined : e.target.value),
                    },
                    // An explicit "nothing selected" option. Without it the
                    // browser renders the FIRST entry as selected while `wsKey`
                    // holds a different (or no) value, so the control lies about
                    // which workspace the edits below belong to.
                    react.createElement('option', { key: '', value: '' }, labels.wsPickNone),
                    ...wsChoices.map((choice) => react.createElement('option', { key: choice.path, value: choice.path }, choice.label)),
                  )),
              wsChoices.length > 0
                ? react.createElement('p', { className: 'fgf-desc' }, labels.wsOverrideCount(wsState.customisedCount ?? 0))
                : null,
              // "Nothing selected" is a real state now, so it gets a sentence
              // instead of leaving the panel blank below the picker. The
              // override rows stay hidden until a workspace is chosen: an edit
              // with no target is exactly the write that used to land in the
              // profile directory.
              wsKey === undefined && wsChoices.length > 0
                ? react.createElement('p', { className: 'fgf-notice' }, labels.wsPickRequired)
                : null,
              wsKey !== undefined
                ? react.createElement(
                    'div',
                    null,
                    ...WS_OVERRIDE_FIELDS.map((field) => {
                      const current = field.inRecall
                        ? (wsState.workspace?.recall ?? {})[field.key]
                        : (wsState.workspace ?? {})[field.key]
                      const inherited = field.inRecall ? base.recall[field.key] : base[field.key]
                      const shown = current === undefined ? '' : String(current)
                      // ADDED 0.14.0: endpoint rows are inert until the global
                      // "allow workspace to change daemon / secret" switch is on.
                      // Disabling rather than hiding keeps the capability
                      // discoverable while still making the risk explicit.
                      const endpointLocked = field.requiresEndpoint === true
                        && draftValue.workspace.allowEndpointOverride !== true
                      const onEdit = (raw) => {
                        const stored = wsState.workspace ?? {}
                        const next = { ...stored, recall: { ...(stored.recall ?? {}) } }
                        const target = field.inRecall ? next.recall : next
                        if (raw === '') delete target[field.key]
                        else if (field.kind === 'boolean') target[field.key] = raw === 'true'
                        else if (field.kind === 'number') {
                          const parsed = Number(raw)
                          if (!Number.isFinite(parsed)) return
                          target[field.key] = parsed
                        } else target[field.key] = raw
                        void saveOverride(next)
                      }
                      return react.createElement(Row, {
                        key: field.key,
                        id: `am-ws-${field.key}`,
                        title: field.title,
                        description: endpointLocked
                          ? `${labels.wsFollowsGlobal}: ${String(inherited)} — ${labels.wsEndpointLocked}`
                          : `${labels.wsFollowsGlobal}: ${String(inherited)}`,
                      },
                        field.kind === 'boolean'
                          ? react.createElement('select', {
                              id: `am-ws-${field.key}`, className: 'fgf-select', style: { width: field.width },
                              value: current === undefined ? '' : String(current === true),
                              onChange: (e) => onEdit(e.target.value),
                            },
                            react.createElement('option', { value: '' }, labels.wsFollowsGlobal),
                            react.createElement('option', { value: 'true' }, 'true'),
                            react.createElement('option', { value: 'false' }, 'false'))
                          : field.choices !== undefined
                            // ADDED 0.15.0: an enumerated override renders as a
                            // picker, not a text box. Typing `smrt-search` into
                            // a free-text field would store an unrecognised
                            // value that the runtime then silently coerces back
                            // to the default, which reads like "my override did
                            // nothing". The blank entry means "follow global".
                            ? react.createElement('select', {
                                id: `am-ws-${field.key}`, className: 'fgf-select', style: { width: field.width },
                                value: current === undefined ? '' : String(current),
                                disabled: endpointLocked || disabled,
                                onChange: (e) => onEdit(e.target.value),
                              }, ...field.choices.split('|').map((choice) =>
                                react.createElement(
                                  'option',
                                  { key: choice, value: choice },
                                  choice === '' ? labels.wsFollowsGlobal : choice)))
                            : react.createElement('input', {
                              id: `am-ws-${field.key}`, type: 'text', className: 'fgf-input', style: { width: field.width },
                              placeholder: labels.wsFollowsGlobal,
                              value: shown,
                              disabled: endpointLocked || disabled,
                              onChange: (e) => onEdit(e.target.value.trim()),
                            }))
                    }),
                  )
                : null,
            ),
        // No "clear" buttons: emptying a field already means "follow global",
        // and `save` deletes a workspace block once every key is gone. A button
        // pair for that duplicated the field's own affordance and, as it turned
        // out, shipped with no labels at all.
        wsError !== undefined ? react.createElement('p', { className: 'fgf-error' }, labels.wsStoreError + wsError) : null,
        wsNotice !== undefined ? react.createElement('p', { className: 'fgf-notice' }, wsNotice) : null,
        ),
      )
    }

    /** Mount the stylesheet once per page; remove it when this fiber unloads. */
    const useStyles = (ctx) => {
      ctx.effect(() => {
        const selector = `style[data-plugin-css="${STYLE_ID}"]`
        if (document.querySelector(selector) === null) {
          const tag = document.createElement('style')
          tag.dataset.plugin = '@fgfg163/dsh-agentmemory-plugin'
          tag.dataset.pluginCss = STYLE_ID
          tag.textContent = CSS
          document.head.appendChild(tag)
        }
        return () => {
          const tag = document.querySelector(selector)
          if (tag !== null) tag.remove()
        }
      }, 'agentmemory settings: styles')
    }

    return {
      /**
       * `slots` MUST be declared: the Client hands this module a guarded
       * context, and reading `ctx.slots` without a declaration throws
       * "cannot get property \"slots\" without inject".
       *
       * `configForms` is deliberately NOT declared. It is registered by
       * ui-settings after its remote connection is ready, so a hard injection
       * would park this whole module until then (and forever if the service
       * never appears). `ctx.get()` needs no declaration, so apply polls it.
       */
      inject: ['slots'],
      /**
       * Cordis client apply: register the Settings section.
       *
       * `configForms` may be absent for a while after this module applies, so
       * poll for it; once it exists, `whileServed` watches every candidate
       * namespace spelling and re-runs when the mirror populates.
       */
      apply(ctx) {
        useStyles(ctx)
        let bound = false
        let pollTimer
        let waitedMs = 0
        const formsNow = () => ctx.get('configForms')
        const servedNamespaces = (forms) => {
          if (typeof forms.describe !== 'function') return []
          const view = forms.describe().getSnapshot()?.view
          return (view?.namespaces ?? []).map((row) => row.ns)
        }
        const bind = () => {
          if (bound) return
          const forms = formsNow()
          if (forms === undefined) return
          const served = new Set(servedNamespaces(forms))
          const ns = SETTINGS_NS_CANDIDATES.find((candidate) => served.has(candidate)) ?? SETTINGS_NS
          // The page does not need a ConfigForm scope any more: its data comes
          // from the Host route. The namespace lookup remains only to pick the
          // spelling the host serves, so the tab id matches what it expects.
          bound = true
          const page = () => react.createElement(AgentMemoryPage, { labels: zh })
          ctx.effect(() => {
            const injectSection = ctx.slots.inject('settings.section', () =>
              ctx.slots.register(
                {
                  name: 'settings.section',
                  id: ns,
                  order: 41,
                  label: () => zh.nav,
                },
                page,
              ),
            )
            return () => {
              if (typeof injectSection === 'function') injectSection()
            }
          }, 'agentmemory settings: section')
        }
        const attach = () => {
          if (bound) return
          const forms = formsNow()
          if (forms === undefined) {
            if (waitedMs >= 15000) {
              console.error('agentmemory settings: ctx.configForms never appeared, settings section stays unregistered')
              return
            }
            waitedMs += 250
            pollTimer = setTimeout(attach, 250)
            return
          }
          if (typeof forms.whileServed === 'function') {
            ctx.effect(
              () => forms.whileServed(SETTINGS_NS_CANDIDATES, () => bind()),
              'agentmemory settings: late binding',
            )
          } else {
            bind()
          }
          // A served mirror can lag the service: retry once shortly after.
          setTimeout(bind, 1000)
        }
        ctx.effect(() => {
          attach()
          return () => {
            if (pollTimer !== undefined) clearTimeout(pollTimer)
          }
        }, 'agentmemory settings: bind')
      },
    }
  },
})
