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
    /**
     * Ceiling on the `## Lessons Learned` bullets kept from the injected
     * `/context` block (0.14.0).
     *
     * The daemon decides how many lessons go into the session-start block and
     * hard-codes ten; `/context` takes only a whole-block token `budget`, so
     * there is no request-side way to ask for fewer. The plugin trims the
     * rendered block instead.
     *
     * 0 (default) means "do not trim" — the pre-0.14.0 behaviour. Trimming
     * saves no daemon token budget (the block was already selected), it only
     * shortens what the model actually reads.
     *
     * ADDED 0.14.0: this value is now ALSO sent to the daemon as `maxLessons`
     * on the `/context` request, so the daemon selects that many bullets to
     * begin with (the daemon itself caps at whatever its patch allows; the
     * upstream default is ten). Trimming still applies afterwards.
     */
    contextMaxLessons: z.number().step(1).min(0).volatile(),
    /**
     * Token budget asked from the daemon for the `/context` call (0.14.0).
     *
     * The daemon's `mem::context` takes a whole-block token `budget` and drops
     * any block that does not fit INSIDE it — a lesson block that overshoots is
     * skipped entirely rather than truncated, so a bigger `maxLessons` needs a
     * bigger budget to actually arrive. Without this field the daemon falls
     * back to its own TOKEN_BUDGET (20000 on the current deployment), which
     * fits about 23 lessons.
     *
     * 0 or absent means "send no budget" and let the daemon use its default.
     */
    contextBudget: z.number().step(1).min(0).volatile(),
    /**
     * Timeout in ms for the `/context` (and `/session/start`) daemon call
     * (0.14.0).
     *
     * These two carry the whole injected block, so they are the slowest calls
     * the plugin makes: 20 lessons measured ~59.9e3 chars / ~20e3 tokens and
     * took 370-510 ms on an idle LAN. The shared 1500 ms ceiling left under 3x
     * headroom, and a timeout is not retried with a smaller request — the whole
     * memory injection is silently skipped for that session.
     *
     * 0 or absent means the historical 1500 ms.
     */
    contextTimeoutMs: z.number().step(1).min(0).volatile(),
    /**
     * Timeout in ms for every other daemon call: capture (`/observe`),
     * `/session/end`, and the bootstrap request (0.14.0).
     *
     * Kept separate from `contextTimeoutMs` because a slow capture should give
     * up quickly (it is fire-and-forget and there are retries), while a slow
     * context is worth waiting for. 0 or absent means 1500 ms.
     */
    fetchTimeoutMs: z.number().step(1).min(0).volatile(),
    /**
     * agentId WRITTEN into every captured row (0.13.2 split this from the read
     * side). The daemon copies the session's id onto each observation, so this
     * one field decides what future rows are labelled. Machines sharing one
     * daemon should keep it identical, otherwise the same person is filed under
     * two ids.
     */
    agentId: z.string().volatile(),
    /**
     * agentId used to FILTER the per-turn recall query (0.13.2).
     *
     * Separate from `agentId` because the two directions are not symmetric:
     * writing is the daemon inheriting the session's id, reading is a hard
     * equality filter (`record.agentId !== filterAgentId` drops the row) that
     * also hides every historical row carrying a different or absent id.
     * Empty means "send no filter" — the pre-0.13.2 behaviour, and the safe
     * default for a store that already holds rows under several ids.
     * `*` asks the daemon for a wildcard read.
     */
    recallAgentId: z.string().volatile(),
    /**
     * Workspace (per-directory) override block.
     *
     * DSH's own configuration layers are all profile-scoped, so nothing in the
     * host can vary a plugin's settings by the directory a session runs in. This
     * block turns that layer on and says how to find it. The file itself is
     * read by `lib/workspace-store.js`.
     */
    workspace: z
      .object({
        /** Master switch for the whole layer. */
        enabled: z.boolean().volatile(),
        /**
         * Whether a workspace file may change `url` / `secretEnv`.
         *
         * Off by default: a cloned repository is untrusted input, and letting it
         * choose the daemon or the credential would redirect captured prompts.
         */
        allowEndpointOverride: z.boolean().volatile(),
      })
      .loose(),
    /** Per-turn recall block; every sub-field is volatile (the object itself must NOT be). */
    recall: z
      .object({
        enabled: z.boolean().volatile(),
        /** Result count asked from the daemon. */
        limit: z.number().step(1).min(1).max(20).volatile(),
        /** Character ceiling for the composed block. */
        maxChars: z.number().step(1).min(200).volatile(),
        /**
         * Character ceiling for ONE recalled entry (0.15.0).
         *
         * `recall.js` has always clipped each entry to `DEFAULT_ENTRY_MAX_CHARS`
         * (400), but the field was never declared here, so the host form never
         * projected it and every install silently used 400. A single verbose
         * memory (they run to several thousand characters) would then eat the
         * whole `maxChars` budget and crowd out the rest of the batch.
         */
        entryMaxChars: z.number().step(1).min(20).volatile(),
        /**
         * Which daemon endpoint the per-turn recall uses (0.15.0).
         *
         * `smart-search` (default, the historical behaviour) is two hops:
         * `{query}` returns `{obsId, score}` only, then `{expandIds}` fetches
         * the bodies. `search` is one hop and carries the bodies inline
         * (`format: 'full'`), at the cost of the daemon doing its own budget
         * trimming rather than the plugin asking for exactly `limit` hits.
         *
         * Both accept `targetLayer` / `agentId` / `limit`, so the scope of the
         * query is unchanged; only the round-trip count differs.
         */
        method: z.string().volatile(),
        /**
         * Where the recalled block lands relative to the user's prompt (0.15.0).
         *
         * `after` (default) appends behind every existing message: cheapest for
         * the provider prefix cache, because everything before it stays
         * byte-identical turn to turn. `before` puts it ahead of the prompt,
         * which reads more naturally to the model but perturbs the cached
         * prefix position.
         *
         * Placed per-slot: `promptInject.registerBefore/registerAfter` fix a
         * slot's placement at registration and freeze it, so both slots are
         * registered and the inactive one renders null.
         */
        placement: z.string().volatile(),
        /**
         * What to do when `@fgfg163/dsh-prompt-slot` is NOT installed (0.15.0).
         *
         * The recall half normally rides the slot service's `request` channel,
         * which never writes to the session log. In a profile without that
         * bundle there is no such channel, and the only remaining place to put
         * the block is a `user/message` in `decision.messages` — logged, and
         * therefore part of the conversation history forever.
         *
         * `inject` (default) does that: the feature keeps working, at the cost
         * of permanent history growth. `off` keeps the log clean and drops
         * per-turn recall entirely in such a profile.
         */
        withoutSlot: z.string().volatile(),
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
