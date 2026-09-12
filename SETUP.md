# ThreadRev development environment

Setup date: September 12, 2026. Status: local starter installed; hosted Slack/model connection awaiting user authentication and credentials. This is infrastructure, not an implemented engineering agent.

## Location and provenance

Work from the repository root.

Cloned [CopilotKit's official starter](https://github.com/CopilotKit/agents-everywhere-starter-kit) at `6443333e4b81fd6e21a4f531bdeee3a71eccd7b5`. Upstream Git history and origin are retained. Nothing was committed, pushed, published or submitted. Research remains in [../RESEARCH.md](../RESEARCH.md).

Installed using Node 26.5.0 / npm 11.17.0 on this Mac; upstream requires Node 22+ and provides `.nvmrc` for 22. CopilotKit Channels 0.9.2 and Runtime 1.70.3 remain pinned. Public setup CLI verified as 4.9.60 and pinned in the channel scripts.

## Commands

```sh
cd ThreadRev
npm ci
npm run verify
npm run dev:slack
# Optional inherited browser preview:
npm run dev:web
```

The browser preview binds to `http://127.0.0.1:3100`. It remains the inherited incident demo. It is not evidence that Slack or model inference works. Mobile and optional Auth0 recipes were not installed separately because the selected project surface is Slack.

## Credentials and the next setup gate

Root `.env` exists, is Git-ignored and has owner-only permissions. Fill secrets there, not in chat or source files. The model configuration is `MODEL_PROVIDER=openai`, `MODEL=gpt-5.6-sol`; actual API access is untested. `OPENAI_API_KEY`, `INTELLIGENCE_API_KEY` and `CHANNEL_CODE` initially remain blank. Exa is now configured in the ignored root `.env` (owner-only permissions); a live search returned 10 sources with highlights. The other credentials remain blank.

CopilotKit `whoami` reported **Not logged in**. In this directory, the user must run:

```sh
npx copilotkit@latest login
```

Complete sign-in and tell the agent when it finishes. The vendor setup skill requires the user to handle sign-in. Next, select the intended Intelligence project, confirm the bot display name, Slack workspace and test channel, and authorize the hosted app/channel installation. Do not guess those identities or create resources in whichever workspace happens to be open.

The current setup skill is [channels-setup](.agents/skills/channels-setup/SKILL.md), installed by the vendor's setup command; it reads the live [Channels guide](https://copilotkit.ai/channels-guide.md). It will be discoverable by the coding agent on its next turn. `npm run channel:setup` installs/prints that workflow; it does **not** provision a Channel itself. Continue through the guide's public CLI commands after authentication, using the exact emitted manifest, variable names and resume command.

Managed Slack requires no public tunnel or Socket Mode app token. Intelligence is an additional cloud processor. Browser controls are available to assist after workspace selection and authorization; passwords, MFA and secret copying remain user-owned. Do not expose secret pages to screenshots or tool output.

## Agent instructions and privacy defaults

- `AGENTS.md` links the ThreadRev research and distinguishes inherited tools from planned engineering checks.
- The bundled `build-channels-agent` skill remains intact. The new `channels-setup` skill and its lockfile are project-local; the vendor also created an `agent/skills` compatibility copy.
- The starter's `.mcp.json` retains CopilotKit documentation and Exa MCP declarations. Client support/activation differs; these are not a claim that new MCP tools are active in the current Codex session. No global agent configuration was changed.
- Local `.env` and `.env.example` disable CopilotKit/Next telemetry and set `DO_NOT_TRACK`. These settings are not an outbound-network firewall or proof of a fully private workflow.
- `.copilotkit/artifacts/` is ignored for future provider setup artifacts. Keep non-secret channel declarations tracked when created.
- No GPU rig connection, model-weight download, solver, extraction service, local model adapter or cloud fallback was added. Those need the rig's endpoint/access and the selected engineering fixture.

## Verification and known limitations

Initial `npm run verify`: all workspace typechecks passed; 93 tests passed (37 agent-core, 22 channel, 34 web). These tests are inherited and offline. Production web build passed with an upstream dynamic-dependency warning. Next's root was then explicitly scoped to this checkout to avoid an unrelated home-directory lockfile; final checks are recorded below.

Dependency review: `npm audit` still reports vulnerabilities in the upstream graph, including high-severity PostCSS and Undici advisories. Non-forced remediation attempts did not clear them; no major Next upgrade or CopilotKit pair upgrade was applied. Do not treat this environment as security-cleared for public deployment. Run a fresh audit before deployment; counts can change with registry advisories.

`npm ls @ag-ui/client` resolves one physical 0.0.59 copy but exits with an invalid-range warning from the older `@ag-ui/mcp-middleware` requirement. This is the starter's deliberate override; types/tests pass. Do not remove the override to silence the warning and reintroduce duplicate agent types.

Live completion still requires: successful model request, completed CLI Channel reconciliation, named runtime status `online`, a real user's mention rendering a native card, a subscribed follow-up reply, and silence in an unrelated conversation. None are claimed completed yet.

Final local checks: `npm run verify` again passed all typechecks and 93 tests after configuration changes; `npm run build --workspace web` passed with the known upstream dynamic-dependency warning and no workspace-root warning. The inherited production preview was started on loopback port 3100. Latest audit snapshot: 10 findings (8 moderate, 2 high); not security-cleared. Remediation pruned unused optional OpenTelemetry lock entries but did not resolve the remaining advisories.

## Atlanta credits clarification

The [Atlanta event page](https://atlanta.aitinkerers.org/p/agents-everywhere-bots-channels-more-global-hackathon) promises builder credits/offers **where available**, but does not specify a guaranteed attendee OpenAI key or credit amount. Winner credit prizes are separate. The linked [participant portal](https://atlanta.aitinkerers.org/hackathons/h_pS99rSfunCc) was inaccessible without authorized access during research. Check accepted-attendee instructions or organizers for redemption details.

Either a personal OpenAI key or OpenRouter key can be used. The current `.env` selects OpenAI; to use OpenRouter, set `MODEL_PROVIDER=openrouter`, `OPENROUTER_API_KEY` and an available tool-capable catalog model slug. Neither provider key replaces CopilotKit Intelligence authentication or the Slack installation.

## Exa integration verification

Installed the project-local [build-with-exa skill](.agents/skills/build-with-exa/SKILL.md) from `exa-labs/agent-skills` and followed its search reference. The existing `exa-js` 2.19.0 already resolves to the latest release. Shared `search_web` now uses `/search` with `contents: { highlights: true }`, Exa’s default search mode, and its default result count unless a count is explicitly requested. Removed `EXA_SEARCH_TYPE` and deprecated highlight controls. All returned highlights reach the model; the existing Slack source cards retain their exact links.

`npm run verify` passed all workspace typechecks and 94 offline tests, including an Exa request/validation/error check. A live call through the shared capability returned 10 sources with highlights. No Slack messages were sent: model and managed Channel credentials are still missing. Restart with `npm run dev:slack` once those are configured. This enables web research infrastructure; it does not implement ThreadRev’s planned engineering checks.
