# Harness comparison: Hermes Agent vs CopilotKit Channels vs plain Bolt

Date: 2026-09-12. Time-boxed ~15 min. Claims marked [V] were read directly from the cited source today; [U] means not verified.
Kit root: a sibling checkout of `agents-everywhere-starter-kit` (paths below are relative to it).

## Option A: Hermes Agent (Nous Research)

Sources: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/slack , https://hermes-agent.nousresearch.com/docs/user-guide/configuration , https://hermes-agent.nousresearch.com/docs/user-guide/features/cron , https://hermes-agent.nousresearch.com/docs/user-guide/features/memory , https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp , https://hermes-agent.nousresearch.com/docs/user-guide/features/skills , https://hermes-agent.nousresearch.com/docs/developer-guide/architecture , https://hermes-agent.nousresearch.com/docs/developer-guide/tools-runtime , https://hermes-agent.nousresearch.com/docs/getting-started/installation , https://github.com/NousResearch/hermes-agent

### A1. Slack gateway
- Transport: Socket Mode (WebSocket), no public endpoint. Deps pinned `slack-bolt==1.30.0`, `slack-sdk==3.43.0` (pyproject.toml line 202, raw.githubusercontent.com/NousResearch/hermes-agent/main/pyproject.toml). [V]
- Env (`~/.hermes/.env`): `SLACK_BOT_TOKEN` (xoxb-), `SLACK_APP_TOKEN` (xapp-, `connections:write`), `SLACK_ALLOWED_USERS` (comma-separated member IDs), optional `SLACK_HOME_CHANNEL`. [V] slack docs page
- Default behavior: DMs always answered; channels only on @mention; once a thread is active the bot follows without fresh mentions. [V]
- Proactive listening without mention: `config.yaml` -> `platforms.slack.require_mention: true` (default), `free_response_channels: []` (channels exempt from mention), `allowed_channels: []` (whitelist, empty = all), `strict_mention: false`, `rich_blocks`. Setting `require_mention: false` or listing the channel in `free_response_channels` makes it respond to every top-level message in that channel. [V] configuration page
- Needed Slack events: `message.im`, `message.channels`, `message.groups`, `app_mention`. Manifest generator: `hermes slack manifest --agent-view --write`. [V]
- Caveat: "responds to every message" means the whole agent loop runs on every message. There is no documented "listen silently, act only when a heuristic fires" hook; that logic would have to live in the system prompt or a plugin hook. [U] (not found in the pages fetched)

### A2. Custom tools
- Core registry: any `tools/*.py` with a top-level `registry.register()` call is auto-discovered. `registry.register(name, toolset, schema, handler, check_fn, requires_env, is_async, description, emoji)`. Handler is dispatched as `registry.dispatch(name, args, **kwargs)` and must return a result string (JSON string is the convention; dispatch wraps errors as JSON). [V] tools-runtime page
- So: a tool can run arbitrary local Python and return structured output, but as `json.dumps(dict)`, not a native dict. [V]
- Plugins: `~/.hermes/plugins/` (user) or `.hermes/plugins/` (project) "register tools, hooks, and CLI commands through a context API". Exact `register(ctx)` file shape not confirmed; /docs/plugins is a catalog page. [U]
- MCP: `mcp_servers.<name>.command/args/env` (stdio) or `.url/headers` (HTTP); tools exposed as `mcp_<server>_<tool>`, `tools.include/exclude` filters. [V] mcp page
- Skills: `~/.hermes/skills/<name>/SKILL.md` with frontmatter, optional `scripts/` dir the agent runs via its terminal tool. [V] skills page

### A3. Model providers
- `~/.hermes/config.yaml`: `model: <provider>/<id>`; custom OpenAI-compatible: `providers.custom.base_url: http://localhost:8000/v1`, `providers.custom.api_key`, `model: custom/<name>`; env fallbacks `OPENAI_BASE_URL`, `OPENAI_API_KEY`. Works for vLLM/Ollama/LM Studio (docs name them). [V]
- Auxiliary: `auxiliary.vision.{api_key,base_url}`, `auxiliary.compression.{model,provider,base_url}`; compression defaults to main model. [V] No explicit "fallback model" key found. [U]
- Precedence: CLI args > config.yaml > .env > defaults. [V]

### A4. Scheduling and persistence
- `cronjob` tool + `hermes cron create|list|pause|resume|run|remove|edit`, `/cron add`. Formats: `in 30m`, `every 1d`, natural language, cron expr, ISO. Delivery targets `slack` (home channel) or `slack:#channel`; jobs run in isolated background sessions and post without a user prompt. Jobs in `~/.hermes/cron/jobs.json`, history `~/.hermes/cron/executions.db`; survive restarts. [V] cron page
- Sessions: SQLite `~/.hermes/state.db` (FTS5); memory `~/.hermes/memories/MEMORY.md` (2,200 chars) and `USER.md` (1,375 chars). Docs warn not to point two processes at one home dir. [V] memory page
- Known cron+Slack bug: issue #86264 "cron delivery synthesizes invalid Slack thread_ts from non-Slack origin thread_id" (open). [V] gh search

### A5. Posting
- `reply_in_thread: true` default, `reply_to_mode: first|all|off`, `reply_broadcast`. Files: `files:read`/`files:write` scopes, `send_message` tool accepts `MEDIA:<path>`. Formatting: mrkdwn default, `rich_blocks` for Block Kit-ish headers/dividers/lists/tables. Streaming via `chat.startStream`/`appendStream` when `streaming.enabled: true`; progressive message editing supported. [V] slack page
- Not found: an agent-callable "edit message X" or "mark card stale" tool. Block Kit is generated by Hermes from markdown, not authored by you. [U]

### A6. Install footprint
- `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`; installer pulls Python 3.11 via uv, Node v26, ripgrep, ffmpeg; code at `~/.hermes/hermes-agent/`, binary `~/.local/bin/hermes`, data `~/.hermes/`. `requires-python = ">=3.11,<3.14"` (pyproject line 15). Docs claim "under two minutes"; most-reported friction is `hermes: command not found` (shell reload). [V]
- Post-install: `hermes model`, `hermes tools`, `hermes gateway setup`, then Slack app manifest, Socket Mode token, install, `.env`, `hermes gateway`, `/invite`. Realistic first Slack reply: 30-60 min if the Slack app creation goes cleanly. [U] estimate
- Open Slack bugs that could bite today: #106849 Socket Mode watchdog leaves slack_bolt retrying on a closed session until restart (2026-09-09); #86228 `SLACK_CLIENT_ID/SECRET` in .env silently drops all inbound events; #96384 forwarded messages lose text and files. [V] gh search, 71 open issues with "slack" in title.

### A7. License and maturity
- MIT, 244,799 stars, created 2025-07-22, last push 2026-09-12, 42,376 open issues. Releases: v2026.9.11, v2026.9.7, v2026.8.31, v2026.8.27, v2026.8.19 (roughly weekly). [V] `gh api repos/NousResearch/hermes-agent`

## Option B: CopilotKit Channels starter (`apps/channel`)

### B1. Mention, subscribe, proactive
- `channel.onMention` subscribes the thread then runs the agent: `apps/channel/src/channel.tsx:53-56`. `channel.onMessage` runs the agent only if `thread.isSubscribed()`: `channel.tsx:60-64`. Comment at `channel.tsx:58-59`: non-mentioned turns "only ever reach onMessage — gate them on the flag or the agent will answer every message in every channel it has been invited to". [V]
- So yes: `onMessage` fires for every message the Channel sees (SKILL.md:317 "any message the Channel sees"). Drop the `isSubscribed` gate, or call `thread.subscribe()` from `onWelcome`, and the agent runs on every message in every channel the bot is invited to, no mention needed. `subscribe/unsubscribe/isSubscribed` is a "persisted per-conversation flag" (SKILL.md:387). [V]
- Reading the thread: `thread.getMessages()` is capability-gated and returns `[]` where unsupported (SKILL.md:388, 396); `read_thread` handles the empty case at `tools.tsx:34-40`. [V]
- Handlers get `{ thread, message }` only, no user (SKILL.md:327). [V]

### B2. What the managed Intelligence path is
- "You run the agent, the tools, the business logic, and a long-running process. CopilotKit Intelligence owns the platform credentials, ingress, and delivery." (SKILL.md:50-52). "A CopilotKit Intelligence API key is required (free tier available). There is no standalone or DIY way to run a Channel." (SKILL.md:94-95). [V]
- Slack tokens live in Intelligence; your process has none (SKILL.md:103-105, README.md:30). Delivery is "signed HTTPS ingress into Intelligence plus an outbound gateway socket" (SKILL.md:194-195). Lifecycle events "land in Intelligence history and are available on replay" (SKILL.md:601-602). So every Slack message text, your agent's outputs, and tool-call lifecycle pass through CopilotKit's hosted service. [V]
- Direct adapter (`slack({ botToken, appToken })`, Socket Mode) exists (SKILL.md:171-187) but "does not avoid needing Intelligence — the runtime still owns the lifecycle" (SKILL.md:163-164). Self-hosted Intelligence URLs are env overrides only (SKILL.md:213-214); no self-host instructions in the kit. [V]
- Tool handlers run in your Node process (`tools.tsx:34`, `:63`), so a tool can `child_process.spawn("python", ...)` or call a local HTTP server. Nothing in the kit does this today. [V] for handler locality, the Python bridge is yours to write.
- Node.js 22+ required (SKILL.md:53, dev-docs/setup.md:5). [V]

### B3. Tool and card definitions
- Tool: `defineChannelTool({ name, description, parameters: z.object(...), async handler(args, { thread, user, actor, signal, platform }) })`, return raw data, it is JSON-stringified for the agent: `apps/channel/src/tools.tsx:29-41` (read_thread), `:48-127` (propose_action), SKILL.md:432-448. [V]
- Card as agent-callable tool: `defineChannelComponent({ name, description, parameters, render(args) => <Message>...</Message> })`: `components.tsx:43-80` (IncidentCard), `:86-123` (Timeline). Registered via `components: [IncidentCard, Timeline]` at `channel.tsx:29`; JSX primitives `Message, Header, Section, Markdown, Fields, Field, Context, Divider, Actions, Button, Table, Row, Cell` (`components.tsx:11-26`). One tree renders as Slack Block Kit (`components.tsx:8-9`). [V]
- Buttons carry inline `onClick` handlers that receive the live thread (`tools.tsx:103-120`); the SDK retains handlers after message replacement (`tools.tsx:64-65`). [V]

### B4. Card update / stale marking
- `thread.update(ref, ui)` replaces a posted message; `thread.delete(ref)` removes one; `thread.post` returns a `MessageRef` (SKILL.md:378-380). Used in the kit at `tools.tsx:79-82` (`ctx.thread.update(ctx.message.ref, ...)`) inside a button click. [V]
- Updating a card the agent drew via `defineChannelComponent` later (from a different run) requires you to have kept the `MessageRef`; components' `render` returns JSX and the kit shows no path to capture that ref. Workable pattern: post cards from a `defineChannelTool` handler with `thread.post(...)`, store the ref keyed by change id in `thread.setState` (SKILL.md:392) or your own map, then `thread.update` when a later message invalidates it. Whether a `MessageRef` stays valid across process restarts is not shown in the kit. [U]

### B5. Model provider swap
- `packages/agent-core/src/model.ts:25-35`: providers are `openai`, `openrouter`, `anthropic`, `google` via `MODEL_PROVIDER` + `*_API_KEY`; anything else throws. Anthropic works with `MODEL_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `MODEL=<id>` (returns `"anthropic:<id>"`, `model.ts:60`). [V]
- No local OpenAI-compatible endpoint path exists: `createOpenAI({ baseURL })` is hardcoded to `https://openrouter.ai/api/v1` (`model.ts:46-47`). Adding a `local` branch that calls `createOpenAI({ baseURL: process.env.OPENAI_BASE_URL, apiKey })` and returns `.chat(modelId)` is a ~10-line edit. [V]
- MCP servers attach at `packages/agent-core/src/agent.ts:42`; `maxSteps: 10` at `:36`. [V]

### B6. Setup still needed for live Slack
1. `npm install`, `.env` with `MODEL_PROVIDER`, key, `MODEL` (dev-docs/setup.md:7-18). 2. `npm run channel:setup` or `npx copilotkit@latest channels add --name ... --adapter slack --json` (setup.md:41-49). 3. Create the Slack app from the generated manifest and install to the workspace (setup.md:51). 4. `CHANNEL_CODE` must match the Intelligence Channel Code exactly (setup.md:52, channel.tsx:17-20). 5. Project-scoped `INTELLIGENCE_API_KEY` (setup.md:53). 6. `npm run dev:slack`, `/invite @bot`, mention in a thread (setup.md:54-55, README.md:26-30). 7. `npm run channel:status` to confirm not `setup_required` (setup.md:58, SKILL.md:301). Two listeners on one Channel compete for deliveries (setup.md:61). [V]

## Option C: plain Bolt + direct SDK loop
Bolt (JS or Python) in Socket Mode gives `message` events for every channel the bot is in with `channels:history`, `chat.update` for card edits, native Block Kit, and file upload, with no third party in the data path and the model call being a 30-line tool loop against OpenAI/Anthropic or a local `base_url`. Cost: you write the tool loop, thread-context fetch (`conversations.replies`), state store, and card builders yourself (roughly 300-500 lines), and you get no agent memory, no cron, no cross-platform rendering. Versus A you lose the packaged agent and gain full control of when the model runs. Versus B you lose JSX cards and Intelligence history but the Python computation becomes in-process. Slack app creation time is the same as A. [U] line estimates.

## Decision table

| Criterion | A: Hermes | B: Channels starter | C: Bolt + SDK |
|---|---|---|---|
| Proactive channel listening (no mention) | Yes via `free_response_channels` / `require_mention: false`; full agent runs per message [V] | Yes: `onMessage` fires on every message; remove `isSubscribed` gate (`channel.tsx:60-64`) [V] | Yes: `message` event with `channels:history` [V] Slack API |
| Local Python tool execution | Native: Python handler, must return string/JSON [V]; plugin dir shape [U] | Node handler; spawn Python or call local HTTP [V] handler runs locally | In-process if Bolt Python [V] |
| Card update / invalidation | Message editing for streaming; no agent-callable edit tool found [U] | `thread.update(ref, ui)` [V]; ref persistence across restarts [U] | `chat.update` with stored `ts` [V] |
| Setup time today | Install ~2 min claimed; Slack app + tokens + gateway 30-60 min [U]; plus learning plugin API | Kit already cloned and runs; Intelligence account + Channel + Slack app ~30-45 min [U] | Slack app + Socket Mode ~20 min, then write the loop (~1-2 h) [U] |
| Privacy / customer-controlled path | Fully local: tokens in `~/.hermes/.env`, local model via `providers.custom` [V] | All Slack traffic transits CopilotKit Intelligence; no DIY mode (SKILL.md:94-95) [V] | Fully local [V] |
| Risk of losing the day to integration | Medium-high: 42k open issues, active Socket Mode reconnect bug #106849, cron-to-Slack thread bug #86264, undocumented plugin shape [V] | Low-medium: code path exists and is demoed; risk concentrated in Channel Code / Intelligence provisioning (`setup_required`) [V] | Low integration risk, high build cost; every feature is hand-written [U] |

## Recommendation for today
Build on B. The proactive path is a two-line change (`channel.tsx:60-64`), cards and `thread.update` exist and are demonstrated in `tools.tsx:79-82`, and `read_thread` already gives thread context. Put the change-analysis computation in a local Python process and call it from a `defineChannelTool` handler over localhost. Add a `local` provider branch to `model.ts` only if the demo needs a local model; otherwise use Anthropic or OpenAI via existing env keys.

Defer: Hermes (its strengths are cron, memory, and a fully local stack, none of which the demo needs by 5 PM, and its Slack layer has open reconnect bugs); self-hosted Intelligence; MessageRef persistence across restarts (keep the listener running for the demo); Option C as the fallback only if Intelligence provisioning is still `setup_required` after 45 minutes.

First hour checklist: `npm install` -> `.env` -> `npm run channel:setup` -> Slack app from manifest -> `CHANNEL_CODE` + `INTELLIGENCE_API_KEY` -> `npm run dev:slack` -> `npm run channel:status` -> `/invite` -> mention once. Only then edit `channel.tsx`.
