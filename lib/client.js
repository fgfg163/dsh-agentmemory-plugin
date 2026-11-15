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

    /** Row/control styles copied from the Harness settings sections. */
    const CSS = `
.fgf-section{box-sizing:border-box;display:flex;flex-direction:column;max-width:720px;width:100%;color:var(--dsw-alias-label-primary)}
.fgf-intro{margin:0 0 4px;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:22px}
.fgf-group-title{margin:20px 0 0;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}
.fgf-row{display:flex;align-items:center;gap:24px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.fgf-row:last-of-type{border-bottom:none}
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
.fgf-button{box-sizing:border-box;height:32px;padding:0 14px;border-radius:var(--dsw-radius-md);border:.5px solid var(--dsw-alias-border-l3);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;cursor:pointer}
.fgf-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.fgf-button:disabled{opacity:.5;cursor:not-allowed}
.fgf-button-primary{border-color:transparent;background:var(--dsw-alias-brand-primary-new-colorprimary-new-color);color:#fff}
.fgf-error{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.fgf-notice{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
`

    const zh = {
      nav: 'AgentMemory 记忆',
      intro: '捕获与每轮召回的连接参数。改动即时生效，不重启插件；密钥轮换同样免重启。',
      urlTitle: 'Daemon 地址',
      urlDescription: 'AgentMemory 守护进程的 HTTP 基址，不带尾部斜杠。',
      secretEnvTitle: '密钥引用名',
      secretEnvDescription: '凭据存储里的密钥名称（如 AGENTMEMORY_SECRET）。只存名字，不存密钥值；值在「凭据存储」里管理。',
      contextMaxCharsTitle: '上下文注入上限',
      contextMaxCharsDescription: '每会话 /context 注入内容的字符上限（capture 半边）。',
      agentIdTitle: 'agentId',
      agentIdDescription: '写入每条记录的 agent id。共用同一 daemon 的机器必须一致。',
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
      readOnly: '当前组合对该配置只读（home 层或命令行覆盖优先）。',
      saveFailed: '保存失败：',
      save: '保存',
      saving: '保存中…',
      discard: '放弃修改',
    }

    const useSnapshot = (scope) => {
      const [snapshot, setSnapshot] = react.useState(() => scope.getSnapshot())
      react.useEffect(() => scope.subscribe(() => setSnapshot(scope.getSnapshot())), [scope])
      return snapshot
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

    /** The section page body for one bound settings scope. */
    const AgentMemoryPage = ({ scope, labels }) => {
      const snapshot = useSnapshot(scope)
      const [draft, setDraft] = react.useState(null)
      const [saving, setSaving] = react.useState(false)
      const [error, setError] = react.useState(undefined)

      if (snapshot.status === 'loading' || snapshot.value === undefined) {
        return react.createElement('p', { className: 'fgf-notice' }, labels.loading)
      }
      const writable = snapshot.writable === true
      const value = snapshot.value
      const accepted = () => ({
        url: typeof value.url === 'string' ? value.url : '',
        secretEnv: typeof value.secretEnv === 'string' ? value.secretEnv : '',
        contextMaxChars: Number(value.contextMaxChars) || 64000,
        agentId: typeof value.agentId === 'string' ? value.agentId : '',
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
      const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(base)
      const setPath = (path, v) => {
        const next = JSON.parse(JSON.stringify(draftValue))
        const parent = path.length > 1 ? next.recall : next
        parent[path[path.length - 1]] = v
        setDraft(next)
      }

      const save = async () => {
        if (!writable || draft === null) return
        setSaving(true)
        setError(undefined)
        try {
          // One mutate call: revision-guarded, all-or-nothing per field.
          const ok = await scope.mutate([
            { op: 'set', path: ['url'], value: draftValue.url },
            { op: 'set', path: ['secretEnv'], value: draftValue.secretEnv },
            { op: 'set', path: ['contextMaxChars'], value: draftValue.contextMaxChars },
            { op: 'set', path: ['agentId'], value: draftValue.agentId },
            { op: 'set', path: ['recall', 'limit'], value: draftValue.recall.limit },
            { op: 'set', path: ['recall', 'maxChars'], value: draftValue.recall.maxChars },
            { op: 'set', path: ['recall', 'fetchTimeoutMs'], value: draftValue.recall.fetchTimeoutMs },
            { op: 'set', path: ['recall', 'queryMaxChars'], value: draftValue.recall.queryMaxChars },
            { op: 'set', path: ['recall', 'minConfidence'], value: draftValue.recall.minConfidence },
            { op: 'set', path: ['recall', 'includeLessons'], value: draftValue.recall.includeLessons },
            { op: 'set', path: ['recall', 'tailRatio'], value: draftValue.recall.tailRatio },
            { op: 'set', path: ['recall', 'minQueryChars'], value: draftValue.recall.minQueryChars },
          ])
          if (!ok) setError(labels.saveFailed + 'host refused the write')
          setDraft(null)
        } catch (cause) {
          setError(labels.saveFailed + (cause instanceof Error ? cause.message : String(cause)))
        } finally {
          setSaving(false)
        }
      }

      const disabled = !writable || saving
      const recall = draftValue.recall
      return react.createElement(
        'div',
        { className: 'fgf-section' },
        react.createElement('p', { className: 'fgf-intro' }, labels.intro),
        !writable && snapshot.revision !== undefined
          ? react.createElement('p', { className: 'fgf-notice' }, labels.readOnly)
          : null,
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
        react.createElement('h3', { className: 'fgf-group-title' }, labels.recallTitle),
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
        react.createElement(
          'div',
          { className: 'fgf-actions' },
          react.createElement('button', {
            type: 'button',
            className: 'fgf-button fgf-button-primary',
            disabled: !dirty || disabled,
            onClick: () => { void save() },
          }, saving ? labels.saving : labels.save),
          dirty && !saving
            ? react.createElement('button', {
                type: 'button',
                className: 'fgf-button',
                onClick: () => setDraft(null),
              }, labels.discard)
            : null,
          error !== undefined ? react.createElement('span', { className: 'fgf-error' }, error) : null,
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
          const scope = typeof forms.get === 'function' ? forms.get(ns) : undefined
          if (scope === undefined) return
          bound = true
          const page = () =>
            react.createElement(AgentMemoryPage, { scope, labels: zh })
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
