# ThreadRev: final submission

Prepared 3:45 PM EDT, 2026-09-12, for the Agents, Everywhere hackathon. Facts here match `README.md` and `submission/description.md`; where they disagree, this file is the later one.

## Title

ThreadRev

## Tagline

Slack keeps the conversation. ThreadRev keeps the decision, what it was decided against, and whether it is still true.

## Description

**What we built.** ThreadRev is a Slack-native engineering change reviewer, the bot @Rev. Asked to check a document, or when a message changes an input an earlier finding used, it reads the thread, searches other channels for the values, recomputes them with a local Python checker, and posts one card: the discrepancy, why it matters, sources with revision and hash, which numbers were reproduced versus inferred, and who can resolve it. When a printed result does not reproduce it proposes the edit and waits for approval.

**Who it is for.** Juno Marsh joined Kestrel Motors in August and has to sign the KS-4 precharge board review. The thread says the bus is 680 uF and the firmware timer matches. The printed result only reproduces at 750 uF, and a later correction to 820 uF pushes charge time past the relay timer, so every key-on puts inrush through the main contactor.

**Why the context matters.** Slack AI tells you what was said. ThreadRev tells you what was decided and whether it still holds. A summary of this thread is accurate and wrong. ThreadRev recomputes instead of repeating, binds every card to the revision and message it was checked against, and marks the old card stale when an input changes.

**What verified means.** The named checks passed against the stated inputs. Not sign-off, not a claim about hardware. The model never writes a number on a card. Edits go into a new copy, the original keeps its hash.

**Live.** Card 1 and the proposed-edit card were posted by the live model in a real Slack workspace today.

## Repository

https://github.com/gabegraves/ThreadRev (branch `main`)

Web console, public: https://threadrev-web.vercel.app (a viewer over the same evidence log, not the agent).

## Demo video

https://www.youtube.com/watch?v=GkOk1QYSLWg

## Sponsor technologies

| Sponsor | Visible contribution |
|---|---|
| OpenAI | Model `gpt-5.6-sol` runs the reviewer agent: decides what to read, which checker to run, what to ask, and when to propose an edit. It never computes a number that lands on a card. |
| CopilotKit Channels | Hosts the Slack connection, delivers thread history to the agent, renders the finding card and the Approve/Reject proposal card as native Block Kit from one component tree, and routes the button clicks back. |

No other sponsor tools are used. The inherited Exa search capability is not registered on the reviewer and `EXA_API_KEY` is blank.

## What we inherited

CopilotKit `agents-everywhere-starter-kit` at `6443333e4b81fd6e21a4f531bdeee3a71eccd7b5` (78 commits, the last dated 2026-09-11). From it: the CopilotKit Channels runtime wiring, the `BuiltInAgent` loop, the managed-gateway test harness pattern, the shared model configuration in `packages/agent-core/src/model.ts`, the Exa search capability, the incident-response tools and cards in `apps/channel/src/tools.tsx` and `components.tsx` (no longer registered on the channel, kept for their tests), the web app shell and its follow-up workflow, the mobile app under `apps/mobile`, the developer docs, and the bundled skills under `.agents/`. `SUBMISSION.md` and `hackathon-rules.md` are the starter's templates.

## What we built during the event

Baseline commit `9ed46e0` at 11:00 AM EDT 2026-09-12. 106 commits on `main` since then, all dated today. `git diff --name-only 9ed46e0..HEAD` is the authoritative list.

| Area | Where | Event commits touching it |
|---|---|---|
| Reviewer agent: six tools (`read_thread`, `search_workspace`, `read_evidence`, `run_check`, `publish_result`, `propose_edit`), review gate, silence filter, revision tracking, finding card, replay harness | `apps/channel/src/` | 12 |
| Finding, evidence, and checker contracts; evidence log and graph; reviewer prompt | `packages/agent-core/src/contracts/`, `packages/agent-core/src/evidence/`, `packages/agent-core/src/reviewer-prompt.ts` | 12 |
| Python checkers (`check_rc.py`, `check_route.py`) and the approved-edit writer (`apply_docx_edit.py`) | `checkers/` | 3 |
| Web review console and `/api/evidence`, `/api/pet/findings` | `apps/web/src/components/review-console/`, `apps/web/src/app/api/` | 43 |
| Desktop overlay (Electron) | `apps/pet/` | 4 |
| Fixtures: Kestrel Motors documents, Slack scripts, workspace export, generator | `fixtures/` | 7 |
| Eval records and scripted runs | `evals/` | 8 |
| Research, fixture spec, design decisions, handoffs | `RESEARCH.md`, `research/` | see log |

## Live versus sample

| Part | Status |
|---|---|
| @Rev mention in `#ks4-electrical`, Kestrel Motors workspace (kestrel-motors.slack.com), 19:22:30Z today | Live Slack, live model (`gpt-5.6-sol` via CopilotKit Channels). Card 1 posted 40 s after the mention, finding `fnd-mtyrv4yj-y70h` bound to the thread revision, followed by the proposed-edit card (section 4, `t = 6.91 s` to `6.4933 s`, Approve/Reject). Not a script. |
| Card 1 stale marker, Card 2 (Dara's 820 uF correction), Approve click | Planned live beats, being posted by a human at the time of writing. Not claimed as live here. |
| Kestrel Motors, its people, documents, and Slack history | Fictional sample data. `fixtures/` and `fixtures/workspace/kestrel-workspace.json`. |
| Workspace index for `search_workspace` | Built from the fixture Slack export. Exact-match structured index, not embeddings. `WORKSPACE_EXPORT` can point at a real export. |
| Web console at https://threadrev-web.vercel.app | Public deploy. Reads the evidence log; falls back to the Scenario A sample when no live log is present. Not the agent. |
| Desktop overlay (`apps/pet`) | Local Electron app, session-only. Polls `/api/pet/findings`. Glyph color follows finding severity. |
| Evidence log | Local JSONL file, session-only. No persistent store. |
| Scenario B, Scenario A cross-channel, and the three replay cases (clean control, conflicting evidence, mid-run revision) | Offline replay harness with a scripted agent standing in for the model. Recorded under `evals/records/scripted/`. |
| Approved edit output (`<doc>-proposed.docx`) | Written locally on Approve. Source file never modified. Proven in replay tests; live Approve click pending at time of writing. |

## Verification

Run at 3:40 PM EDT, 2026-09-12, on `main` in the submission checkout.

`npm run verify` (typecheck, then tests, then checkers) **fails** at the `pet` typecheck. `apps/pet` declares `electron` 36.9.5 as a devDependency and this checkout has not installed it (`node_modules/electron` absent). Verbatim head of the failure:

```
> pet@0.1.0 typecheck
> tsc --noEmit && tsc --noEmit -p tsconfig.renderer.json

src/main.ts(33,8): error TS2307: Cannot find module 'electron' or its corresponding type declarations.
src/main.ts(139,54): error TS2503: Cannot find namespace 'Electron'.
src/main.ts(191,37): error TS2503: Cannot find namespace 'Electron'.
src/main.ts(232,23): error TS2503: Cannot find namespace 'Electron'.
src/main.ts(243,15): error TS7006: Parameter 'item' implicitly has an 'any' type.
...
src/preload.ts(7,44): error TS2307: Cannot find module 'electron' or its corresponding type declarations.
npm error Lifecycle script `typecheck` failed with error:
```

`agent-core`, `channel`, and `web` typechecks passed before `pet` ran. A fresh `npm ci` should install `electron` and clear this; not re-run here for time.

`npm test` and `npm run test:checkers`, run separately in the same checkout, both exit 0:

| Package | Tests | Pass | Fail |
|---|---|---|---|
| `agent-core` | 56 | 56 | 0 |
| `channel` (replay harness, publish guard, edit approval) | 48 | 48 | 0 |
| `web` | 35 | 35 | 0 |
| `pet` | 53 | 53 | 0 |
| Python checkers and editor (`checkers/test_checkers.py`) | 12 | 12 | 0 |

Total: 204 tests, 0 failures.

## Social post draft

ThreadRev: a Slack-native engineering change reviewer. @Rev reads the thread, searches the workspace by unit, recomputes with a local checker, and marks its card stale when inputs change. Built with @CopilotKit and @OpenAI. https://github.com/gabegraves/ThreadRev
