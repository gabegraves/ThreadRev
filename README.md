<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/threadrev-logo-dark.svg">
  <img src="assets/threadrev-logo.svg" alt="ThreadRev" width="420">
</picture>

**A Slack-native engineering change reviewer. It reads the thread, searches the rest of the workspace by document and unit, recomputes the numbers, and marks its own findings stale when the inputs change.**

Slack keeps the conversation. ThreadRev keeps the decision, what it was decided against, and whether it is still true.

<img src="assets/hero-scenario-a.png" alt="Card 1 marked STALE after Dara's 820 uF correction, Card 2 posted against her message" width="820">

<sub>Web review console, Scenario A sample. The Slack card is the product; this view reads the same evidence log.</sub>

[What it does](#what-it-does) · [Demo](#the-demo-scenario-a) · [How it works](#how-it-works) · [Versus Slack AI](#what-slack-already-does-and-what-threadrev-adds) · [Why search, not RAG](#why-search-by-identifier-not-rag) · [Status](#status) · [Run it](#run-it) · [Repo map](#repo-map) · [Team](#team-and-working-rules)

</div>

![Agents, Everywhere hackathon](assets/banner.png)

Built during the [Agents, Everywhere](https://aitinkerers.org/hackathons/global/agents-everywhere) hackathon on September 12, 2026, on top of CopilotKit's [agents-everywhere-starter-kit](https://github.com/CopilotKit/agents-everywhere-starter-kit). Inherited code is listed separately in [What we built and what we inherited](#what-we-built-and-what-we-inherited).

## What it does

Engineering teams make decisions in Slack threads and then write documents that quietly disagree with them. A review document prints a result computed from a capacitance the thread already replaced. A simulation request pulls parameters from a sheet that a correction message superseded three weeks earlier. Nobody catches it because nobody rereads the thread.

ThreadRev lives in the channel. When someone asks it to check a document, or when a message changes an input that an earlier finding depended on, it reads the thread, searches every other channel for the document and the values it rests on, and posts one card in the thread:

1. **Discrepancy.** What the document says versus what the thread decided, with the exact line.
2. **Why it matters.** The engineering consequence, in the team's own units.
3. **Sources and versions.** Document name, revision, SHA-256, section locator, and the Slack message timestamp that supersedes it.
4. **Reproduced versus inferred.** Which numbers a checker recomputed, with the run id, and which claims are only read from the text.
5. **What resolves it.** Who can answer, and the question to ask them.

When a later message changes a requirement, the earlier card is marked **stale in place**, never deleted, and a new card bound to the new revision is posted. If a revision lands while a check is running, the result is refused before it posts, kept as a stale record, and rerun.

Two rules shape everything:

- **The model never computes a number that appears on a card.** A local, stdlib-only Python checker does. The card renderer is called only by the `publish_result` tool, which copies numbers from the checker's response.
- **A possible contradiction is not automatically a finding.** The reviewer stays silent on normal chatter, posts a clean card when everything reproduces, and asks instead of deciding when the evidence conflicts.

## The demo: Scenario A

Kestrel Motors is a fictional maker of light electric city vehicles. The KS-4 is its next platform, in development. Dara Voss is the electrical lead and owns the precharge board. Tam Holloway owns firmware, including the relay timer. Juno Marsh joined in August and has to sign the r2 design review. If the relay closes before the bus is charged, every key-on puts the inrush through the main contactor, so the number in the signed review is the number that ships. Channel `#ks4-electrical`, precharge RC timing. Fixture script in [`fixtures/slack/scenario-a.json`](fixtures/slack/scenario-a.json), full spec in [`research/synthetic-fixture-spec.md`](research/synthetic-fixture-spec.md).

1. Dara posts `precharge-review-r2.docx`: "Dropped one film cap, bus is now 680 uF."
2. Tam: "Relay close timer in firmware is 2.5 s, matches the doc."
3. Juno: "@Rev can you check section 3 of the r2 doc before I sign the review?"
4. **Card 1.** The section 3 text says 680 uF, the section 2 diagram says 750 uF, and the printed 2.435 s only reproduces with 750 uF. At 680 uF it is 2.208 s. The section 4 worked example prints 6.91 s; recomputed, 6.493 s. Question to Dara: which capacitance is right. Card content: [`contracts/examples/finding-scenario-a.json`](contracts/examples/finding-scenario-a.json).
5. Dara: "Bus is 820 uF, not 680. Doc will be r3."
6. **Card 1 goes stale. Card 2.** At 820 uF, t_99.9 = 2.662 s, later than the 2.5 s relay timer. The bus reaches 99.85 percent at 2.5 s. The timer or the resistor must change. Bound to Dara's message, because r3 does not exist yet. [`finding-scenario-a-superseding.json`](contracts/examples/finding-scenario-a-superseding.json).

**Scenario A, cross-channel** ([`scenario-a-cross.json`](fixtures/slack/scenario-a-cross.json)). Same thread, but Dara's 820 uF correction was posted two weeks earlier in `#ks4-purchasing`, as an order for a snubber bank, and r2 never mentions it. The thread alone cannot catch this. The reviewer calls `search_workspace` with unit `uF`, gets every capacitance message in the workspace up to the trigger, oldest first, and the card cites the purchasing message by channel and timestamp. Recorded run: [`evals/records/scripted/scenario-a-cross.1.json`](evals/records/scripted/scenario-a-cross.1.json).

Scenario B (stale simulation inputs, `#ks4-strategy-sim`) and three replay cases are also built: a clean control that must produce no discrepancy, a conflicting-evidence case where the reviewer must ask instead of choose, and a mid-run revision where the first result must be refused before it posts. All four have finding examples under [`contracts/examples/`](contracts/examples/).

## How it works

```
Slack thread ──▶ CopilotKit Channels ──▶ review gate (is this a review moment?)
                                              │
                                              ▼
                                   reviewer agent, five tools
        read_thread · search_workspace · read_evidence · run_check · publish_result
                           │                  │                 │
                           ▼                  │                 │
              workspace index (every channel, │                 │
              keyed by document, unit,        │                 │
              quantity words, author)         │                 │
                                              ▼                 ▼
                              checkers/check_rc.py       finding card (Block Kit)
                              checkers/check_route.py    posted in thread, updated
                              stdlib only, JSON in/out   to stale on revision
                                              │
                                              ▼
                                  evidence log (JSONL) ──▶ evidence graph ──▶ web console
```

- **Reviewer tools** in [`apps/channel/src/reviewer-tools.tsx`](apps/channel/src/reviewer-tools.tsx). `read_thread` reads the Slack history; `search_workspace` queries the workspace index outside the thread; `read_evidence` extracts document text and hashes; `run_check` invokes a checker and records the run; `publish_result` is the only path to a card and refuses a result whose requirement revision is no longer current.
- **Workspace index** in [`workspace.ts`](apps/channel/src/workspace.ts). Built once from a Slack export ([`fixtures/workspace/kestrel-workspace.json`](fixtures/workspace/kestrel-workspace.json), five channels, March to August; `WORKSPACE_EXPORT` points at a real export). Every message is indexed by the documents it names, the values it states with their units, the quantity words around them, whether it reads as a change, and its author. A query returns every match at or before the trigger message, oldest first. No embeddings, no ranking, no cap that can drop a correction.
- **Review gate and silence filter** in [`review-moment.ts`](apps/channel/src/review-moment.ts) and [`agent.ts`](apps/channel/src/agent.ts). Most messages get nothing.
- **Revision tracking** in [`revision.ts`](apps/channel/src/revision.ts): a requirement-change message becomes the revision every later card binds to.
- **Checkers** in [`checkers/`](checkers/), contract in [`contracts/checker-io.md`](contracts/checker-io.md). `check_rc.py` does first-order RC timing; `check_route.py` does the constant-speed route energy model. No network, no file writes, no imports outside the standard library.
- **Finding contract** in [`packages/agent-core/src/contracts/finding.ts`](packages/agent-core/src/contracts/finding.ts) and the Slack card in [`finding-card.tsx`](apps/channel/src/finding-card.tsx).
- **Evidence log and graph** in [`packages/agent-core/src/evidence/`](packages/agent-core/src/evidence/). Every message read, document hashed, checker run, card published, and silence decision is appended as an event. The graph builder turns the log into message, document, run, finding, and revision nodes with a downstream walk, so "what did this change invalidate" is a query.
- **Replay harness** in [`apps/channel/src/replay/`](apps/channel/src/replay/). Replays a fixture Slack script through the real channel handlers and real checkers offline, with a scripted agent standing in for the model, and asserts the card that gets posted. This is the contract test for the checker-to-card seam and the scorecard for the three replay cases.
- **Web review console** in [`apps/web/src/components/review-console/`](apps/web/src/components/review-console/), served by [`/api/evidence`](apps/web/src/app/api/evidence/route.ts). A browser view of the thread, the cards, and the evidence graph, polling the live log and falling back to the Scenario A sample. Secondary surface; Slack is the product.

## What Slack already does, and what ThreadRev adds

Slack AI tells you what was said. ThreadRev tells you what was decided, and whether it still holds.

Take the demo thread. Dara posts a review document and says the bus is 680 uF. Tam says the firmware timer is 2.5 s and matches the doc. Ask Slack AI to summarize and it says exactly that. The summary is accurate. It is also wrong, because the document contradicts itself, its printed result only works with a capacitance the thread already replaced, and the correction that breaks the timer has not been written into any document yet.

ThreadRev does three things a summary never does:

1. **It recomputes.** The model reads the numbers, but a local Python checker does the arithmetic and the card copies the checker's output. A summary repeats what the text says. A card says what the text should have said.
2. **It binds the answer to a version.** Every card names the document revision, its SHA-256, and the timestamp of the last message that changed an input. A summary is about "the doc." A card is about this doc, as of that message.
3. **It goes stale.** When Dara changes the bus to 820 uF, the first card is edited to say stale and a new card is posted against her message. In Slack, the old summary and the new one sit side by side and nobody knows which is current.

Slack already covers the generic pitch: [Enterprise search](https://slack.com/features/enterprise-search) searches and summarizes conversations, files, and connected sources, [Slackbot](https://slack.com/help/articles/202026038-How-to-work-with-Slackbot) runs skills and scheduled tasks, and the [Notion integration](https://api.slack.com/marketplace/A049JV0H0KC-notion) edits pages. A Slackbot skill can call a calculator. That is not the difference. The difference is the discipline around the result: hash what was read, tie the answer to a revision, refuse to post if the revision moved mid-check, and mark the old answer stale instead of leaving two truths in the thread.

In one line: **Slack keeps the conversation. ThreadRev keeps the decision, what it was decided against, and whether it is still true.**

| | Slack AI summary or search | ThreadRev card |
|---|---|---|
| Numbers | Repeats what the text says | Recomputed by a stdlib Python checker. The model never writes a number on a card. |
| Version | Answers about "the doc" | Names the docx revision and SHA-256, and binds the card to the message ts of the latest requirement change. |
| Later corrections | The earlier summary stays as written next to the new one | The earlier card is edited to **stale** in place and a new card bound to the new revision is posted. A result whose revision moved mid-run is refused before it posts. |
| Silence | Answers when asked | Stays silent on normal chatter, posts a clean card when everything reproduces, asks instead of deciding when sources conflict. |

What we are building toward, and how much of it exists on `main` today:

| Difference to prove | In practice | Today |
|---|---|---|
| Which decisions still apply | Separate proposals, accepted decisions, and superseded conclusions; tie each to its component and revision | Built narrowly: every card binds to a revision; a later change marks it stale; conflicting sources produce a question, not a pick |
| A reviewable evidence trail | Exact source versions, assumptions, conflicting evidence, and the record of changes | Built: the evidence log records every message read, document hash, checker run, card, and silence decision; the graph answers "what did this change invalidate" |
| Check the underlying work | Reproduce the calculation; keep runnable checks another engineer or agent can inspect | Built: `checkers/`, `run_check`, `publish_result`, run ids on every card |
| Continue existing work correctly | Update the right task, carry unresolved questions forward, never turn a tentative discussion into a decision or open a duplicate | Not built. The historical supplier-acceptance case in the research notes is the target: an old acceptance of one configuration is not approval of the new geometry, and the open confirmation has to travel to the right project |

What we do not claim: a market gap ([`research/engineering-change-competitors.md`](research/engineering-change-competitors.md)), that Slack cannot be configured to approximate this, or that a summary is the wrong tool for open-ended questions. The next proof is the same historical cases run through a configured Slackbot and through ThreadRev. If they tie, the workflow gets built on Slack's tooling and the specialized part is the checker and revision contract.

## Why search by identifier, not RAG

Retrieval-augmented generation stores chunks with embeddings, ranks them by similarity to the question, and puts the top few in the prompt. That is the right tool when the corpus is too large to read and the question is open-ended. It is the wrong tool for a reviewer, for three reasons that shaped this design.

1. **A ranking can drop the one message that matters.** The correction that invalidates a document is a short message, often in the wrong channel, that says "820, not 680." Nothing about it is semantically close to "check section 3 of the r2 doc." ThreadRev searches by the identifiers an engineer would actually grep for: the document name, the unit, the words that name the quantity, the author. It returns every match up to the trigger, so the correction is in the set or it is not in the workspace. There is no similarity score to lose it to.
2. **The model never computes a number.** RAG hands retrieved text to the model and the model reasons over it, arithmetic included. Here the model extracts candidate values, a stdlib Python checker recomputes them, and `publish_result` copies the checker's numbers onto the card. What the model retrieves affects which inputs get checked, never what a result is.
3. **Answers are bound to a revision and go stale.** A RAG answer stands until someone asks again. A ThreadRev card is bound to the timestamp of the latest change it was computed against. When a later message changes that input, the card is marked stale in place and a new one is posted. The evidence log records every message read, including the ones found by search, so "what did this change invalidate" is a graph query.

The workspace index is retrieval. It is retrieval by exact match over a structured index, with a cutoff, with the numbers verified afterward and the result tied to a revision. If two channels describe the same quantity in different words, a synonym layer over the quantity table is the next step, behind the exact match, not in front of it.

## Status

Verified on `main` at 12:35 PM EDT, September 12, 2026, with `npm run verify`:

| Check | Result |
|---|---|
| TypeScript typecheck, all workspaces | pass |
| `agent-core` tests | 52 pass |
| `channel` tests, including the replay harness | 37 pass |
| `web` tests | 34 pass |
| Python checker tests | 10 pass |

What is **not** yet true:

- **Slack is not connected.** The model key, Channel code, and Intelligence key are blank locally. The bot has not posted to a real workspace. Everything above is proven offline through the replay harness. The demo video will state clearly whether it shows live delivery or the harness.
- The web console has no styling yet and is in active development.
- Exa is not used. The inherited web-search capability stays in `agent-core` for its tests only; it is not registered on the reviewer and `EXA_API_KEY` is blank.
- Persistent storage (the Convex decision in [`SCRATCHPAD.md`](SCRATCHPAD.md)) is a recorded direction, not implemented. Evidence lives in a local JSONL file.
- The inherited dependency audit has unresolved advisories. This is not a production or security-cleared deployment.

Live status by lane is in [`STATUS.md`](STATUS.md).

## Run it

Node 22+ and Python 3.

```sh
git clone https://github.com/gabegraves/ThreadRev.git
cd ThreadRev
npm ci
cp .env.example .env
npm run verify          # typecheck, all tests, python checkers, no credentials needed
```

Offline, no accounts:

```sh
npm run test --workspace channel              # includes the replay harness
python3 -m unittest checkers/test_checkers.py
echo '{"checker":"rc","version":"1","inputs":'"$(jq .inputs contracts/examples/checker-rc-request.json)"'}' | python3 checkers/check_rc.py
```

Web console, offline, renders the Scenario A sample:

```sh
npm run dev:web         # http://127.0.0.1:3100
```

Slack, live. Requires a model key (`OPENAI_API_KEY` or `OPENROUTER_API_KEY`), a CopilotKit Intelligence project key, and a Channel code. Setup steps are in [`SETUP.md`](SETUP.md) and the [`.env.example`](.env.example) comments. Managed Channels dial out from this process, so no tunnel is needed.

```sh
npm run channel:status
npm run dev:slack
```

## What we built and what we inherited

Baseline commit is `9ed46e0`. `git diff --name-only 9ed46e0..HEAD` is the authoritative list.

**Built during the event**

| Area | Where |
|---|---|
| Reviewer tools, review gate, silence filter, revision tracking, evidence recorder | `apps/channel/src/reviewer-tools.tsx`, `review-moment.ts`, `agent.ts`, `revision.ts`, `evidence.ts` |
| Workspace index and `search_workspace`, workspace export fixture and generator | `apps/channel/src/workspace.ts`, `fixtures/workspace/`, `fixtures/generate_workspace.py` |
| Finding card and welcome message | `apps/channel/src/finding-card.tsx` |
| Reviewer system prompt | `packages/agent-core/src/reviewer-prompt.ts` |
| Finding, evidence, and checker contracts with examples and tests | `packages/agent-core/src/contracts/`, `contracts/` |
| Evidence log and graph | `packages/agent-core/src/evidence/` |
| Checkers | `checkers/` |
| Document extractor | `extractors/docx_text.py` |
| Fixtures: documents, Slack scripts, checksums, generator | `fixtures/` |
| Replay harness and publish guard | `apps/channel/src/replay/` |
| Evidence API and web review console | `apps/web/src/app/api/evidence/`, `apps/web/src/components/review-console/` |
| Research, design, fixture spec, handoffs | `RESEARCH.md`, `research/` |

**Inherited from the starter**

The CopilotKit Channels runtime wiring, the `BuiltInAgent` loop, the managed-gateway test harness pattern, the shared model configuration, the Exa search capability, the incident-response tools and cards in `apps/channel/src/tools.tsx` and `components.tsx` (no longer registered on the channel, kept for their tests), the web app shell and its follow-up workflow, the mobile app, the developer docs, and the bundled skills under `.agents/`.

## Repo map

```
apps/channel/          Slack agent: reviewer tools, card, gate, replay harness
apps/web/              Web review console and /api/evidence
packages/agent-core/   Contracts, evidence log and graph, prompts, model config
checkers/              Trusted Python checkers and their tests
contracts/             Checker I/O contract and example findings, requests, logs
fixtures/              Synthetic documents, Slack scripts (A, A-cross, B, RC1 to RC3), workspace export
extractors/            Document text extraction
research/              Research, fixture spec, design decisions, lane handoffs
AGENTS.md              Lane ownership, workspace rules, conventions for coding agents
STATUS.md              Live status board, one line per lane
SCRATCHPAD.md          Accepted decisions
SETUP.md               Environment setup record and verification history
SUBMISSION.md          Hackathon submission checklist
```

## Team and working rules

Five lanes work on this repo in parallel: backend, web console, demo and submission, Slack environment, and eval / red team. [`AGENTS.md`](AGENTS.md) has the lane table (who owns which directories), the workspace rules (one checkout per agent, stage by explicit path, `main` must always verify, pull-rebase before push), and the Channels API conventions. [`STATUS.md`](STATUS.md) is the board everyone updates after each push. [`CLAUDE.md`](CLAUDE.md) points Claude Code at both.

## Sponsor technologies

- **CopilotKit Channels** hosts the Slack connection, delivers thread history, and renders the finding card as native Block Kit from one component tree.
- **OpenAI** (or OpenRouter) runs the reviewer agent that decides what to read, which checker to run, and what to ask.

## Research

The reasoning behind the scope, the harness choice, the fixture design, and the competitive audit is in [`RESEARCH.md`](RESEARCH.md) and [`research/`](research/). Start with [`research/hackathon-design.md`](research/hackathon-design.md), [`research/synthetic-fixture-spec.md`](research/synthetic-fixture-spec.md), and [`research/change-agent-novelty-audit.md`](research/change-agent-novelty-audit.md), which names the direct competitors and why we do not claim a market gap.
