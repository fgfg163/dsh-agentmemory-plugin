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
.fgf-row-text{flex:1 1 auto;min-width:180px}
.fgf-control{flex-wrap:wrap;justify-content:flex-end}
.fgf-row-text{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}
.fgf-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}
.fgf-desc{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}
.fgf-control{display:flex;align-items:center;gap:8px;flex:none}
.fgf-input,.fgf-select{box-sizing:border-box;height:36px;border-radius:var(--dsw-radius-md);border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;padding:0 12px;min-width:0}
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
.fgf-error{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.fgf-notice{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
`

    const zh = {
      nav: 'AgentMemory 记忆',
      autoSaveHint: '改动自动保存（停止输入约 0.4 秒后写入）',
      globalSaved: '全局配置已保存',
      intro: '捕获与每轮召回的连接参数。改动即时生效，不重启插件；密钥轮换同样免重启。',
      globalBlockLabel: '全局 · 对所有工作区生效',
      storeUnreachable: '读不到设置存储，下面显示的是内置默认值，改动可能无法保存：',
      urlTitle: 'Daemon 地址',
      urlDescription: 'AgentMemory 守护进程的 HTTP 基址，不带尾部斜杠。',
      secretEnvTitle: '密钥引用名',
      secretEnvDescription: '凭据存储里的密钥名称（如 AGENTMEMORY_SECRET）。只存名字，不存密钥值；值在「凭据存储」里管理。',
      contextMaxCharsTitle: '上下文注入上限',
      contextMaxCharsDescription: '每会话 /context 注入内容的字符上限（capture 半边）。',
      agentIdTitle: 'agentId',
      agentIdDescription: '写入每条记录的 agent id。共用同一 daemon 的机器必须一致。',
      workspaceTitle: '工作空间配置',
      workspaceDescription: '按工作区（目录）保存的覆盖，存在 DSH 的数据目录里，改动即存，不写进项目仓库。',
      workspaceEnabledTitle: '启用工作空间覆盖',
      workspaceEnabledDescription: '关闭时所有会话都用全局值，已有覆盖保留但不生效。',
      workspaceEndpointTitle: '允许工作区改 daemon / 密钥',
      workspaceEndpointDescription: '默认关闭：一个工作区不该把本机捕获的对话改发到别的地址。只在完全信任的目录上打开。',
      wsActionsTitle: '按工作区覆盖',
      wsActionsDescription: '每个工作区可以有自己的 daemon、上下文上限、agentId 与召回参数。下面的覆盖项改一下就存，不用点保存；没改的项跟随上面的全局值。',
      wsPickLabel: '当前工作区',
      wsPickEmpty: '没有可用的工作区；先在侧边栏添加一个',
      wsPickHint: '选一个工作区来编辑它的覆盖；没有覆盖的也能选，改了就会创建。',
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
      recallDescription: '以下参数作用于每一轮的检索注入。',
      limitTitle: '结果条数',
      maxCharsTitle: '注入块上限',
      fetchTimeoutMsTitle: '抓取超时 (ms)',
      queryMaxCharsTitle: '查询截断',
      minConfidenceTitle: '置信度闸门',
      includeLessonsTitle: '附带 lessons',
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
     */
    const WS_OVERRIDE_FIELDS = [
      { key: 'agentId', title: 'agentId', kind: 'string', inRecall: false },
      { key: 'contextMaxChars', title: '上下文注入上限', kind: 'number', inRecall: false },
      { key: 'limit', title: '结果条数', kind: 'number', inRecall: true },
      { key: 'maxChars', title: '注入块上限', kind: 'number', inRecall: true },
      { key: 'minQueryChars', title: '最短查询长度', kind: 'number', inRecall: true },
      { key: 'minConfidence', title: '置信度闸门', kind: 'number', inRecall: true },
      { key: 'includeLessons', title: '附带 lessons', kind: 'boolean', inRecall: true },
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
        agentId: typeof value.agentId === 'string' ? value.agentId : '',
        workspace: {
          enabled: value.workspace?.enabled !== false,
          allowEndpointOverride: value.workspace?.allowEndpointOverride === true,
        },
        recall: {
          limit: Number(value.recall?.limit) || 5,
          maxChars: Number(value.recall?.maxChars) || 4000,
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
                label: `${row.title !== undefined ? `${row.title}  —  ` : ''}${row.path}${row.customised ? labels.wsHasOverrideMark : ''}`,
              }))
            : [],
        )
        // Only adopt the Host's answer when the page did not pick: adopting it on
        // every load silently replaced a user's selection with the Host fallback
        // directory, so the next edit was saved to the wrong workspace.
        if (chosen === undefined) setWsKey(result.workspaceKey ?? undefined)
        // This is what lifts the "connecting" placeholder. Without it the page
        // renders its loading text forever even though the route answered.
        setRemote(result.profile ?? {})
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
        react.createElement(Row, { id: 'am-agent', title: labels.agentIdTitle, description: labels.agentIdDescription },
          react.createElement('input', {
            id: 'am-agent', type: 'text', className: 'fgf-input', style: { width: 180 },
            value: draftValue.agentId, disabled,
            onChange: (e) => setPath(['agentId'], e.target.value),
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
        react.createElement(Row, { id: 'am-timeout', title: labels.fetchTimeoutMsTitle },
          react.createElement(NumberInput, { id: 'am-timeout', value: recall.fetchTimeoutMs, disabled, onCommit: (v) => setPath(['recall', 'fetchTimeoutMs'], v) })),
        react.createElement(Row, { id: 'am-qmax', title: labels.queryMaxCharsTitle },
          react.createElement(NumberInput, { id: 'am-qmax', value: recall.queryMaxChars, disabled, onCommit: (v) => setPath(['recall', 'queryMaxChars'], v) })),
        react.createElement(Row, { id: 'am-minconf', title: labels.minConfidenceTitle },
          react.createElement(NumberInput, { id: 'am-minconf', value: recall.minConfidence, disabled, width: 100, onCommit: (v) => setPath(['recall', 'minConfidence'], v) })),
        react.createElement(Row, { id: 'am-lessons', title: labels.includeLessonsTitle },
          react.createElement('input', {
            id: 'am-lessons', type: 'checkbox', className: 'fgf-check',
            checked: recall.includeLessons, disabled,
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
                    ...wsChoices.map((choice) => react.createElement('option', { key: choice.path, value: choice.path }, choice.label)),
                  )),
              wsChoices.length > 0
                ? react.createElement('p', { className: 'fgf-desc' }, labels.wsOverrideCount(wsState.customisedCount ?? 0))
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
                        description: `${labels.wsFollowsGlobal}: ${String(inherited)}`,
                      },
                        field.kind === 'boolean'
                          ? react.createElement('select', {
                              id: `am-ws-${field.key}`, className: 'fgf-select', style: { width: 140 },
                              value: current === undefined ? '' : String(current === true),
                              onChange: (e) => onEdit(e.target.value),
                            },
                            react.createElement('option', { value: '' }, labels.wsFollowsGlobal),
                            react.createElement('option', { value: 'true' }, 'true'),
                            react.createElement('option', { value: 'false' }, 'false'))
                          : react.createElement('input', {
                              id: `am-ws-${field.key}`, type: 'text', className: 'fgf-input', style: { width: 220 },
                              placeholder: labels.wsFollowsGlobal,
                              value: shown,
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
