/**
 * Config schema for @fgfg163/dsh-agentmemory-plugin.
 *
 * ## Why most fields are volatile
 *
 * The Settings service only exposes `.volatile()` fields as live form fields;
 * a volatile update re-reads the value in place without remounting the plugin
 * fiber. Every tuning field here (url, contextMaxChars, agentId, the whole
 * `recall` block) is safe to swap live: each read site re-derives its value
 * from `config` or a captured getter, so a form save takes effect on the next
 * request without a restart.
 *
 * ## Secret handling
 *
 * `secretEnv` follows the official credentials seam: configuration carries a
 * REFERENCE (an environment-variable name), never the value. The value is
 * resolved per request through `ctx.credentials.resolve()` and lives in
 * `$DSH_HOME/.credentials.yaml`, so rotating it needs no restart and no edit
 * to any config file. The legacy `secret` (inline value) and `secretFile`
 * (path to a PEM-style file) fields are deliberately NOT declared here: the
 * settings form projects only declared fields, and an undeclared field in the
 * profile patch is preserved verbatim on form saves (projectForm drops only
 * what it does not know, at the form layer — the config-editor write keeps
 * every field the form never received). They remain first-class inputs read
 * by `apply` for existing installations.
 */
import z from '@deepseek-ai/schemastery'

export const Config = z
  .object({
    /** Daemon base URL, without a trailing slash. */
    url: z.string().volatile(),
    /**
     * Credential reference naming the bearer secret, e.g. `AGENTMEMORY_SECRET`.
     * The named secret is stored via the credentials seam and resolved per
     * request; see `apply` in lib/index.js.
     */
    secretEnv: z.string().role('credential-ref').volatile(),
    /** Injected `/context` character ceiling (capture half). */
    contextMaxChars: z.number().step(1).min(1).volatile(),
    /** agentId written into every captured row; must match across machines sharing one daemon. */
    agentId: z.string().volatile(),
    /** Per-turn recall block; every sub-field is volatile (the object itself must NOT be). */
    recall: z
      .object({
        enabled: z.boolean().volatile(),
        /** Result count asked from the daemon. */
        limit: z.number().step(1).min(1).max(20).volatile(),
        /** Character ceiling for the composed block. */
        maxChars: z.number().step(1).min(200).volatile(),
        /** Fetch timeout in milliseconds. */
        fetchTimeoutMs: z.number().step(1).min(100).volatile(),
        /** Character ceiling for the query taken from the user prompt. */
        queryMaxChars: z.number().step(1).min(50).volatile(),
        /** Normalized retrieval-score gate. */
        minConfidence: z.number().min(0).max(1).volatile(),
        /** Prepend lessons in addition to memories. */
        includeLessons: z.boolean().volatile(),
        /** Relative tail cut inside one batch (0–1]. */
        tailRatio: z.number().min(0).max(1).volatile(),
        /** Prompts shorter than this skip recall entirely. */
        minQueryChars: z.number().step(1).min(0).volatile(),
      })
      .loose(),
  })
  .loose()
