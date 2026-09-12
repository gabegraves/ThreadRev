# Handoff: Slack environment owner and interaction design

Project: ThreadRev, a Slack-native engineering change reviewer. Agents, Everywhere hackathon, deadline 5 PM EDT today, September 12, 2026. Repo: https://github.com/gabegraves/ThreadRev (private, `main`).

You own the place the agent lives. Agents are generating the fixture documents, the checkers, and the app wiring. Nobody else is looking at Slack itself, at what the bot is allowed to do there, or at whether a real engineer would tolerate it in their channel. That judgment is yours.

## Read first

1. `research/synthetic-fixture-spec.md`, sections 3 and 4: the fictional team, channels, engineers, and the two scripted scenarios.
2. `research/slack-agent-platform.md`: what Slack lets a bot see and do, scopes, Socket Mode, card update limits.
3. `research/harness-hermes-vs-channels.md`, "Managed path" and the decision table: what data transits CopilotKit's service.
4. `contracts/examples/finding-scenario-a.json`: the card content the bot will post.
5. `hackathon-overview.md`, judging criteria table. Two of the four criteria are about the environment and the agentic experience.

## Decisions you own

**D-ENV1. Permission and privacy audit.** Before the bot is installed, list every scope the CopilotKit-generated Slack app requests. For each, write whether the demo needs it and what it exposes. Decide which channels the bot is invited to and which it is not. Produce the one paragraph we can say on video and in the description about what the bot can see and where the data goes, and make it true. The managed path routes every message through CopilotKit's service; if that is unacceptable to state on camera, say so now and we switch to the Socket Mode fallback.

**D-ENV2. Realistic workspace.** Build `ThreadRev Demo` so it looks like a working engineering team, not a test bench: channel purposes, pinned messages, a few unrelated threads of normal chatter so the reviewer's silence on them is visible. Seed Scenario A by hand as the engineers in the spec. Keep the timing gaps plausible. Screenshot the state before the bot is invited.

**D-ENV3. When the bot speaks.** The bot listens to every message in its channels. You decide the policy: which message shapes warrant a card, which get nothing, and whether it ever posts outside a thread. Write it as a short list of rules with an example message for each. The rule you are guarding is that a possible contradiction is not automatically a finding. Test it against the unrelated chatter you seeded and against the RC1 clean control. If the bot posts on a clean thread, that is a failure to report, not to explain away.

**D-ENV4. The card in real Block Kit.** Block Kit renders differently from the JSON. Look at the finding card in the actual Slack client on desktop and phone. Decide the field order, what is bold, what collapses, whether the sources are links or text, and what the stale version looks like next to the live one in the same thread. Push back on the contract in `packages/agent-core/src/contracts/finding.ts` if a field is unreadable in practice. Hand the integration owner a screenshot-annotated list of changes, not a description.

**D-ENV5. Failure and cancellation on screen.** The rubric asks how a relevant error or denied action is handled. Pick the one we show: the bot asking a question it cannot resolve (RC2), a stale card being superseded (RC3), or a checker error. Decide what the person sees and what they can do about it.

## Working with the setup agent

Codex is provisioning the workspace and CopilotKit connection from `research/codex-setup-handoff.md`. Either take those steps over yourself or supervise them. You are the account holder's proxy: any install, invite, or token action happens under your eyes. Nothing gets posted to any workspace other than `ThreadRev Demo`.

## Deliverables, committed to the repo

- `research/environment-audit.md`: scopes with need/expose notes, channel membership, the on-camera privacy sentence, the speak/stay-silent rules, and the failure case you chose.
- `research/card-design-notes.md`: annotated screenshots under `research/setup-evidence/`, the field order and rendering decisions, and any contract changes requested.
- A workspace that is ready to record in by 3:30 PM, with Scenario A seeded and screenshots of the pre-bot state.

Commit and push after each deliverable. Small commits.

## Report back

One message at 3:30 PM or sooner: the privacy sentence, the speak/silence rules, what changed in the card, which failure case we show, and anything about the environment that would make you not want this bot in your own team's Slack.
