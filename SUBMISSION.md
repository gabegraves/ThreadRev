# Submission checklist

Choose your city on the [global event page](https://aitinkerers.org/hackathons/global/agents-everywhere). Use that city's participant portal for the submission deadline and published judging criteria, and its handbook for eligibility and required deliverables. See [hackathon-rules.md](hackathon-rules.md) for the agent-readable summary.

Final text, links, live-versus-sample table, and verify counts are in [submission/final-submission.md](submission/final-submission.md).

## Build eligibility

- [x] Our submitted project is a net-new build created during the official hackathon period
- [x] Its core functionality was built during the event; we are not resubmitting or extending a pre-existing project and entering it as new
- [x] We identify inherited templates, libraries, prompts, components, and starter code separately from our event work

**What we inherited**
<!-- Include this starter kit and any reused examples. -->

CopilotKit agents-everywhere-starter-kit at `6443333e4b81fd6e21a4f531bdeee3a71eccd7b5` (78 commits, last dated 2026-09-11): Channels runtime wiring, `BuiltInAgent` loop, gateway test harness pattern, shared model config, Exa capability (unused), the incident tools and cards in `apps/channel/src/tools.tsx` and `components.tsx` (unregistered, kept for tests), the web app shell, the mobile app, developer docs, bundled skills under `.agents/`, and this checklist template.

**What we built during the hackathon**
<!-- Describe the new core interaction and point to its implementation. Running the supplied incident demo alone does not establish a new project. -->

A Slack reviewer, @Rev, that recomputes a document's numbers with a local checker, binds the card to the revision it checked, marks it stale when an input changes, and proposes a document edit that only writes after a human clicks Approve. Baseline commit `9ed46e0`, 106 commits since, all on 2026-09-12. Implementation: `apps/channel/src/reviewer-tools.tsx` (six tools), `review-moment.ts`, `revision.ts`, `finding-card.tsx`, `workspace.ts`, `apps/channel/src/replay/`, `packages/agent-core/src/{contracts,evidence,reviewer-prompt.ts}`, `checkers/`, `fixtures/`, `apps/web/src/components/review-console/`, `apps/pet/`. Per-directory commit counts are in `submission/final-submission.md`.

## Title and description

**What you built**
<!-- Explain the complete interaction your demo shows. -->

Juno mentions @Rev in `#ks4-electrical` asking it to check section 3 of `precharge-review-r2.docx`. Rev reads the thread, extracts and hashes the document, runs `check_rc.py`, and posts Card 1: the section 3 text says 680 uF, the diagram says 750 uF, the printed 2.435 s only reproduces at 750 uF (680 uF gives 2.2077 s), and the section 4 worked example's 6.91 s recomputes to 6.4933 s. It then posts a proposed-edit card for the 6.91 s line with Approve and Reject. When Dara corrects the bus to 820 uF, Card 1 is marked stale in place and Card 2 posts against her message: t_99.9 = 2.662 s, past the 2.5 s relay timer. Card 1 and the proposal card ran live in Slack today; the stale marker, Card 2, and the Approve click are the beats being posted live at submission time.

**Who it is for**
<!-- Name a person in a concrete situation. -->

Juno Marsh, an engineer who joined Kestrel Motors (fictional, light electric city vehicles) in August and has to sign the KS-4 precharge board r2 design review. The thread says the bus is 680 uF and the firmware relay timer matches. If the number in the signed review is wrong, the relay closes before the bus is charged and every key-on puts inrush through the main contactor.

**Why the context matters**
<!-- What did the agent know or do because it lived in this surface? -->

Because Rev lives in the thread it knows which message last changed an input, so it can bind a card to that message and mark the card stale when a later message supersedes it. It searches the other channels by document name and unit, so a correction posted weeks earlier in `#ks4-purchasing` reaches the card. A standalone chatbox given the document would check it against itself and pass it. Slack AI summarizes the thread accurately and still gives the wrong answer.

**Sponsor technologies used**
<!-- Name the tools you actually used and the visible contribution of each. -->

OpenAI `gpt-5.6-sol` runs the reviewer agent: it decides what to read, which checker to run, what to ask, and when to propose an edit, and never computes a number that lands on a card. CopilotKit Channels hosts the Slack connection, delivers thread history, renders the finding card and the Approve/Reject card as native Block Kit, and routes the button clicks back. No other sponsor tools; Exa is not registered.

## Evidence for the judging criteria

Judges score each of the four official criteria from 1–5. This checklist helps you gather evidence; it does not guarantee a score. A working starter is a foundation for your own project.

| Official criterion | Show in your project and demo |
|---|---|
| Core Requirements & Functionality | Run one complete workflow in the intended environment, from user request through tools to a verified result. Repeat it with live integrations; offline tests alone do not prove the deployed flow. |
| Innovation & Theme Alignment | Show the surrounding context before the prompt and explain the original interaction it enables. Compare with the context removed: what value would a standalone chatbox lose? |
| Technical Execution & Integration | Show how tools, data, and the environment connect. Demonstrate a relevant failure or cancellation path and explain recovery, state persistence, and integration limits. |
| Usefulness & Agentic Experience | Identify the user and problem, show a meaningful action in the surface, and demonstrate clear feedback and appropriate user control. Explain what work the agent saves. |

- [x] We can point to visible evidence for every criterion
- [x] We distinguish live services, sample data, session-only state, and standalone recipes
- [x] Sponsor technologies contribute to the workflow; their count is not a judging criterion

## Public repository

- [ ] A new participant can run the quickstart from a clean clone (not re-run from a clean clone at submission time)
- [x] The README lists the credentials and separate processes required
- [ ] `npm run verify` passes; optional recipe checks pass if used (fails in this checkout at the `pet` typecheck because `electron` is not installed; `npm test` 192 pass and checkers 12 pass, see `submission/final-submission.md`)
- [x] `.env`, tokens, generated traces with sensitive data, and account secrets are excluded (`.env`, `.env.*`, `.copilotkit/` in `.gitignore`; only `.env.example` tracked)
- [x] Sample data, session-only state, and unimplemented integrations are clearly labeled

## Two-minute demo video

- [ ] Show the surface and existing context before the prompt
- [ ] Demonstrate one complete interaction
- [ ] Show a visible result: an actual record, local state change, or research source links
- [ ] If showing an approval, distinguish the decision from execution and demonstrate the resulting behavior
- [ ] State which sponsor technologies made the interaction possible
- [ ] Keep the video within the event's limit and check audio

See [demo prompts](dev-docs/demo-prompts.md) for a reproducible incident workflow.

## Social post and final submission

- [ ] Follow the organizer's posting and sponsor-tagging instructions
- [ ] Link the public repository and video (repository link ready; video link is `TODO paste link`)
- [x] Credit the sponsors you used and applicable local partners (draft post in `submission/final-submission.md`)
- [ ] Check the live integration once more before recording or submitting
- [ ] Inspect the repository, video and screenshots for secrets

Prepare the post and submission for a human to publish; running the starter kit
does not publish either automatically.
