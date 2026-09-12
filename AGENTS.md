# Notes for coding agents

Four people and their agents work on this repo in parallel until 5:00 PM EDT on 2026-09-12. Read this section, then [STATUS.md](STATUS.md), before editing anything.

## Who is working on what

| Lane | Owner | Owns | Does not touch |
|---|---|---|---|
| Backend / reviewer | Gabe | `apps/channel/`, `packages/agent-core/`, `checkers/`, `extractors/`, `contracts/`, `fixtures/` | `apps/web/`, `submission/` |
| Web console | fill in | `apps/web/` | everything else; `contracts/` and `packages/agent-core/src/contracts/` are read-only inputs |
| Demo and submission | fill in | `submission/`, `SUBMISSION.md`, `research/handoff-*.md`, `research/setup-evidence/` | all code |
| Slack environment and credentials | fill in | local `.env` (never committed), `research/environment-audit.md`, `research/card-design-notes.md` | all code |

Lane handoffs: [research/handoff-frontend-demo.md](research/handoff-frontend-demo.md) (state of the project, demo story, video plan), [research/handoff-demo-narrative.md](research/handoff-demo-narrative.md), [research/handoff-slack-environment.md](research/handoff-slack-environment.md), [research/handoff-openai-key.md](research/handoff-openai-key.md).

If you need a change outside your lane, write the request to the owner and keep working. Do not make the edit. The seam between lanes is the contracts: `contracts/` and `packages/agent-core/src/contracts/`. Only the backend lane edits them, and announces every change in `STATUS.md`.

## Workspace rules

- One checkout per person or agent. Never run two agents in the same working tree. On a shared machine use `git worktree add ../ThreadRev-<lane> -b <lane>`.
- Stage by explicit path: `git add <file>`. Never `git add -A` or `git add .`. Never commit files outside your lane, even if they show up as modified or untracked.
- Commit every completed unit of work, then `git pull --rebase origin main && git push origin main`. Small commits. Never end a task with uncommitted work. Never force-push `main`.
- `main` must pass `npm run verify` at all times. Whoever pushes is responsible for it passing afterward. If it fails because of another lane's files, tell that owner in `STATUS.md`; do not fix their files.
- Before starting, read `STATUS.md`. When you finish a unit of work, update your lane's line: what you pushed, what you are editing next, what you are blocked on.
- Never commit `.env`, tokens, screenshots containing secrets, or anything from the private research archive outside this repo. No co-author trailers on commits.
- The project name is ThreadRev. Do not rename, reorganize, or clean up files outside your lane.
- Report only what you verified. Say which command you ran.

## ThreadRev workspace

Read [SCRATCHPAD.md](SCRATCHPAD.md) for accepted project decisions, including Convex storage scope and its implementation boundaries.

This checkout is ThreadRev, a Slack-native engineering change reviewer built on the CopilotKit starter. Built during the event: `apps/channel/src/reviewer-tools.tsx`, `finding-card.tsx`, `review-moment.ts`, `revision.ts`, the silence filter in `agent.ts`, `checkers/`, `extractors/`, `contracts/`, `fixtures/`, `apps/channel/src/replay/`, and `packages/agent-core/src/reviewer-prompt.ts`. Inherited: everything else, including the incident tools and components in `tools.tsx` and `components.tsx`, which are no longer registered on the channel but remain for their tests. The reviewer never computes a number it shows; `publish_result` copies numbers from a checker run and is the only path to a card.

Start with [SETUP.md](SETUP.md). The research and proposed design live in [../RESEARCH.md](../RESEARCH.md) and [../research/hackathon-design.md](../research/hackathon-design.md), outside this checkout. Preserve them. Use the Slack template first; web is an optional local preview, not another required product surface.

For Exa API changes, follow [.agents/skills/build-with-exa/SKILL.md](.agents/skills/build-with-exa/SKILL.md) as the canonical API guide.

Reuse existing tools and dependencies before adding new ones. Keep credentials in ignored local environment files, never in prompts, committed files or logs. No automatic cloud fallback may be introduced for a future private mode. Do not access the GPU rig until its connection details are supplied.

## Upstream conventions

Read [hackathon-overview.md](hackathon-overview.md), [hackathon-rules.md](hackathon-rules.md), and [using-sponsor-tools.md](using-sponsor-tools.md), then the chosen app README in `apps/channel`, `apps/web`, or `apps/mobile`. Build the team's own workflow; the incident app is infrastructure reference code.

CopilotKit powers the Slack and web templates. The mobile starting point in `apps/mobile` has its own install and environment; follow its README for setup and checks.

Read `.agents/skills/build-channels-agent/SKILL.md` before touching anything in
`apps/channel/`. It carries the verified API surface; the most common
failure mode in this codebase is inventing a plausible-looking Channels API.

Hard-won rules that are easy to get wrong here:

- **`@ag-ui/client` must stay deduped.** The root `package.json` pins it via
  `overrides` to the exact version `@copilotkit/runtime` declares. Two copies
  produce two `AbstractAgent` types and every `createChannel({ agent })` fails
  on a private `_debug` property. If you bump `@copilotkit/runtime`, re-check
  `npm ls @ag-ui/client` and update the override.
- **`@copilotkit/channels` and `@copilotkit/runtime` are a tested pair.** Bump
  together, keep them exact.
- **Files containing JSX must be `.tsx`**, and the tsconfig must set
  `jsxImportSource: "@copilotkit/channels"`. This is not React.
- **`maxSteps` defaults to 1** on `BuiltInAgent`. Any agent with tools needs more,
  or it calls one tool and stops before seeing the result.
- **Do not add `identifyUser` to `CopilotRuntime`.** It belongs on
  `createChannel`, and must be absent on a Channels-only runtime.
- **Handlers return `void`.** `thread.post()` returns a `MessageRef`, so a
  concise arrow body fails under `strict`. Use a block body and `await`.
- **Never invent a component or prop.** The vocabulary is fixed — see
  `references/ui-components.md` in the skill.
- Run `npm run typecheck` before claiming anything works.
