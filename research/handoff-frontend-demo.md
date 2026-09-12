# Handoff: frontend and demo video lanes

Written 2026-09-12 12:10 PM EDT. Deadline 5:00 PM EDT today. Repo https://github.com/gabegraves/ThreadRev, branch `main`, HEAD `11f44ba`. Local checkout `~/Desktop/9_12_26_Hackathon/ThreadRev`. Paste this whole file into your coding agent before it does anything.

## 1. What ThreadRev is

ThreadRev is a Slack-native engineering change reviewer for an electric vehicle company. It reads a channel, and when a document, revision, or request disagrees with what the thread already decided, it posts one finding card in the thread: the discrepancy, why it matters, sources with versions, what was reproduced by a checker versus inferred, and what resolves it. When a later message changes an input, the old card is marked stale in place and a new card bound to the new revision is posted. The model never computes a number that appears on a card. A local Python checker does, and `publish_result` is the only path to a card.

Built on the CopilotKit agents-everywhere-starter-kit. Slack via CopilotKit Channels (managed, no tunnel). Hackathon judging: four criteria scored 1 to 5, listed in `hackathon-overview.md`. Required deliverables: title, written description, two-minute video, public social post.

## 2. Where we stand, verified at 12:05 PM

- F1. Backend is real and tested. `agent-core` 56 tests pass, `channel` 44 tests pass, Python checkers 10 tests pass, both TypeScript workspaces typecheck. The replay harness runs the real reviewer tools and real checkers against fixture Slack scripts offline.
- F2. Slack is not connected. In `.env`, `OPENAI_API_KEY`, `CHANNEL_CODE`, and `INTELLIGENCE_API_KEY` are blank. No message has ever been posted to Slack by the bot. No Slack demo workspace has been confirmed to exist. `research/setup-evidence/` is empty. This is the single biggest risk to the video.
- F3. A web review console is being written right now by another agent in `apps/web/src/components/review-console/`. Eleven files, all uncommitted, no CSS yet, and the web workspace typecheck currently fails on `review-console.tsx`. As of 12:12 PM that agent also rewrote `apps/web/src/app/page.tsx` to mount `ReviewConsole`, replacing the inherited incident page, also uncommitted. Do not edit, commit, or delete those files until that agent commits. Coordinate through Gabe.
- F4. The evidence API at `apps/web/src/app/api/evidence/route.ts` is committed and returns the Scenario A sample graph when the live log is empty.
- F5. No submission material exists yet. `SUBMISSION.md` is the unfilled starter checklist. No description, shot list, social post, or inherited-versus-built list has been written.
- F6. Exa search is configured and verified live, but is not registered on the reviewer and is not part of the demo.

## 3. What was built during the event

Event work, all under the repo root:

| Area | Files |
|---|---|
| Reviewer tools and agent | `apps/channel/src/reviewer-tools.tsx`, `agent.ts` (silence filter), `review-moment.ts`, `revision.ts`, `evidence.ts` |
| Finding card (Slack Block Kit) | `apps/channel/src/finding-card.tsx` |
| Contracts | `packages/agent-core/src/contracts/finding.ts`, `contracts/evidence.ts`, `contracts/checker-io.md`, examples in `contracts/examples/` |
| Evidence log and graph | `packages/agent-core/src/evidence/log.ts`, `graph.ts` |
| Checkers | `checkers/check_rc.py`, `check_route.py`, stdlib only |
| Fixtures | `fixtures/slack/*.json`, `fixtures/documents/*.docx|xlsx`, `fixtures/SHA256SUMS` |
| Replay harness | `apps/channel/src/replay/` |
| Reviewer prompt | `packages/agent-core/src/reviewer-prompt.ts` |
| Research and design | `RESEARCH.md`, `research/` |

Inherited: everything else, including the incident tools in `apps/channel/src/tools.tsx` and `components.tsx`, the web incident page, and the mobile app. Baseline commit is `9ed46e0`. `git diff --name-only 9ed46e0..HEAD` is the authoritative list.

## 4. The demo story: Scenario A

Full spec in `research/synthetic-fixture-spec.md` section 4. Card content in `contracts/examples/finding-scenario-a.json` and `finding-scenario-a-superseding.json`. Slack script in `fixtures/slack/scenario-a.json`.

Channel `#ks4-electrical`. Precharge RC timing, `t_99.9 = R * C * 6.907755`, R = 470 ohm.

1. Dara Voss posts `precharge-review-r2.docx`: "Dropped one film cap, bus is now 680 uF."
2. Tam Holloway: "Relay close timer in firmware is 2.5 s, matches the doc."
3. Juno Marsh, trigger: "@reviewer can you check section 3 of the r2 doc before I sign the review?"
4. Card 1: section 3 text says 680 uF, section 2 diagram says 750 uF, printed 2.435 s reproduces only with 750 uF. With 680 uF it is 2.208 s. Section 4 example prints 6.91 s, recomputed 6.493 s. Question to Dara: which capacitance is right.
5. Dara, requirement change: "Bus is 820 uF, not 680. Doc will be r3."
6. Card 1 is marked stale in the thread. Card 2: at 820 uF, t_99.9 = 2.662 s, which is later than the 2.5 s relay timer. Bus reaches 99.85 percent at 2.5 s. Firmware timer or resistor must change. Bound to Dara's message, not to a document, because r3 does not exist yet.

That is the whole two minutes: context, trigger, verified card, change, stale card, new card. Scenario B (stale simulation inputs) is stretch and stays out of the video unless Scenario A is recorded and safe.

### 4a. Scenario B and replay cards, for the frontend

Added 12:20 PM, commit `01c9466`. Every number below was produced by running `checkers/check_route.py`; run ids are in each file. Document sources carry the real values from `fixtures/SHA256SUMS`. Slack scripts in `fixtures/slack/scenario-b.json`, `rc2-conflict.json`, `rc3-midrun.json`. Channel `#ks4-strategy-sim`. Model: `E = (m * g * Crr + 0.5 * rho * CdA * v^2) * d`, 220 km at 22 m/s, pack 5.2 kWh.

| File | Card | Bound to | Question | Use it to render |
|---|---|---|---|---|
| `contracts/examples/finding-scenario-b.json` | `fnd-b-40-001`, live | Juno's trigger `1786472100.000800` | to Juno Marsh | a live card whose conclusion flips between two document versions (v2-0 feasible at 2.825 kWh, v2-1 not at 3.045 kWh, budget 2.912) |
| `contracts/examples/finding-scenario-b-stale.json` | `fnd-b-40-001`, stale | same trigger | none | the same card after Milo's 35 percent message: same id, same run id, `why_it_matters` names the successor |
| `contracts/examples/finding-scenario-b-superseding.json` | `fnd-b-35-002`, live, supersedes `fnd-b-40-001` | Milo's change `1786474920.000900` | none | a superseding card where the conclusion no longer flips (budget 3.172, v2-1 feasible) |
| `contracts/examples/finding-rc2-conflict.json` | `fnd-rc2-001`, live | Juno's trigger | to Milo Trent | a card that computes two candidate masses (318 and 310 kg) and asks instead of choosing |

Scenario B thread order: Milo posts v2-0 (July 3), Milo posts v2-1 and says "Use v2-1 for anything after today" (July 24), Ines confirms 318 kg in thread, Juno's trigger names the July 3 sheet (August 11 13:15), Milo's change to end SoC 35 percent (14:02, threaded under the trigger). RC2 adds Milo's July 30 "v2-1 mass may be 8 kg high" message. RC3 is the same thread with the 14:02 message injected mid-run; its stale record is `finding-scenario-b-stale.json` and its live card is `finding-scenario-b-superseding.json`.

Card shapes the console must handle, all present across the examples: `status: stale`, `supersedes`, `question` present and absent, `discrepancy: "none"` (RC1), `reproduced` entries with and without `printed`/`matches`, five sources on one card, and `inferred` with three entries.

## 5. Frontend lane

Owner decides, but here is what exists and what is missing.

- The Slack card is the primary surface. It renders through `apps/channel/src/finding-card.tsx` using the CopilotKit Channels component vocabulary. Read `.agents/skills/build-channels-agent/SKILL.md` before touching it. Never invent a component or prop.
- The web review console is a secondary surface: a browser view of the evidence graph, thread, and findings, polling `/api/evidence` every 5 seconds. Another agent owns it until it commits. After that, the open work is: CSS for the `ck-tr-*` classes in `apps/web/src/app/globals.css`, a passing web typecheck, and a decision on whether it appears in the video at all. It runs with `npm run dev:web` on `http://127.0.0.1:3100`.
- Do not add a third surface. Do not add dependencies without asking.

## 6. Demo video lane

Deliverables, committed under `submission/`:

- `submission/video-shotlist.md`: timestamps, what is on screen, exact words spoken.
- `submission/description.md`: 250 words. Claim the specific thing: the bot knew the later message superseded the document because it read the thread, and it recomputed instead of trusting the printed number. Say what verified means and does not mean. Say what the bot cannot see. Do not claim a market gap. Competitors are in `research/change-agent-novelty-audit.md`.
- `submission/social-post.md`: tag the partners named in `hackathon-rules.md`. No repo link until the repo is public.
- `submission/inherited-vs-built.md`: from `git diff --name-only 9ed46e0..HEAD`, refreshed before submission.
- `submission/rubric-self-score.md`: at 3:00 PM, score 1 to 5 per criterion as a hostile judge, one sentence of evidence each, name the one change that moves the lowest score most.
- `SUBMISSION.md` filled in.

Shot plan starting point, from `research/hackathon-design.md`:

| Time | On screen |
|---|---|
| 0 to 20 s | Slack channel with the seeded thread and the r2 doc, before the bot is invited. Say who Juno is and what signing a review means. |
| 20 to 55 s | Juno's trigger. Card 1 posts. Zoom on reproduced values and the checker run id. |
| 55 to 95 s | Dara's 820 uF message. Card 1 turns stale. Card 2 posts with the timer violation. |
| 95 to 120 s | One sentence on what a standalone chatbox would have lost. Optional: replay scorecard or web console for a few seconds, labeled as recorded, not live. |

Recording plan depends on F2. Two paths:

- Path A, live Slack. Needs an OpenAI key, a CopilotKit project and Channel, a `ThreadRev Demo` workspace, and the bot installed there. Steps are in `research/handoff-openai-key.md` and `research/handoff-slack-environment.md`. Nobody has confirmed any of these are done. Ask Gabe for status before planning around it.
- Path B, fallback. Record the replay harness output and the web console rendering the Scenario A sample, and say on camera that Slack delivery is shown from the offline harness. Do not present Path B as live Slack.

Video rules from `hackathon-rules.md`: two minutes, one complete interaction, visible result, state which sponsor technologies made it possible, no secrets on screen. An approval is not evidence that an action executed.

## 7. Rules for everyone

- Commit and push to `origin main` after every completed unit of work. Small commits. Never end with uncommitted work. Do not commit another lane's uncommitted files.
- Never commit `.env`, tokens, or anything from `~/Documents/ChatGPT/9_12_26_Hackathon`. That directory is a private archive with real names. It must not appear in the repo, the video, or screenshots.
- No co-author trailers on commits.
- Use the name ThreadRev everywhere. ThreadLab is the old name.
- Run `npm run verify` before claiming anything works. If it fails on the web workspace because of the review console in flight, run `npm run typecheck --workspace agent-core --workspace channel` and `npm run test --workspace agent-core --workspace channel` and say that is what you ran.
- Label claims: verified yourself, delegated with sources, or unverified. Do not promote unverified to fact.
- Fictional engineers in the fixture are Dara Voss, Tam Holloway, Juno Marsh, Milo Trent, Ines Calder. Do not paraphrase fixture message text.

## 8. Read first, in order

1. `AGENTS.md`, then `SCRATCHPAD.md`.
2. `research/synthetic-fixture-spec.md` sections 3 to 5.
3. `contracts/examples/finding-scenario-a.json` and `finding-scenario-a-superseding.json`. Frontend also: the four Scenario B and RC2 cards in section 4a.
4. `hackathon-overview.md` judging table, `hackathon-rules.md`, `SUBMISSION.md`.
5. `research/handoff-demo-narrative.md` and `research/handoff-slack-environment.md` for the decisions those lanes own.
6. Frontend only: `.agents/skills/build-channels-agent/SKILL.md`, `apps/channel/src/finding-card.tsx`, `apps/web/src/app/api/evidence/route.ts`.

## 9. Commands

```sh
cd ~/Desktop/9_12_26_Hackathon/ThreadRev
npm ci
npm run verify                      # typecheck + tests + python checkers
npm run dev:web                     # browser preview on http://127.0.0.1:3100
npm run dev:slack                   # needs the three blank .env keys filled
npm run test --workspace channel    # includes the replay harness
python3 -m unittest checkers/test_checkers.py
```

## 10. Open questions for Gabe

- Q1. Is there an OpenAI key and a CopilotKit Channel yet, or is Path B the plan?
- Q2. Does the `ThreadRev Demo` Slack workspace exist, and who is the account holder?
- Q3. Which agent owns the web review console, and when does it commit?
- Q4. Does the web console appear in the video at all?
