# ThreadRev: two-minute demo video plan

Written 3:40 PM EDT, revised 3:50 PM, 2026-09-12. Deadline 5:00 PM. Sources: `research/hackathon-design.md` (six beats), `submission/description.md` (spoken comparison), `research/handoff-slack-lane.md` A4 (exact messages). Numbers on the cards come from `checkers/check_rc.py`, not the model. Say on camera that this is live Slack delivery.

Two surfaces are on camera. Slack is where Rev, the agent, lives. The web console at http://localhost:3130 is a viewer over the same evidence log (`evidence/log.jsonl`) and shows the real run behind Card 1: finding `fnd-mtyrv4yj-y70h`, bound to revision `2026-09-12T19:21:43.261Z`, 7 workspace searches, one rc check run, the section 4 proposal. Call it "the web console", never "the agent".

## 1. Recording setup

- Slack desktop app (or Chrome signed into https://kestrel-motors.slack.com) full-width on the main display, channel `#ks4-electrical`, thread view open on the right. Live thread: https://kestrel-motors.slack.com/archives/C0C1EDMKKS6/p1789239746015919?thread_ts=1789239746.015919&cid=C0C1EDMKKS6
- Web console in a Chrome window at http://localhost:3130 on the same display, Findings tab open, Evidence graph tab loaded once so it does not render cold on camera. Switch with Cmd+Tab. Only two windows in the Cmd+Tab cycle: Slack and Chrome.
- Overlay (`apps/pet`) in the bottom-right corner, above Slack, always on top. It polls the console's endpoint. Launch from the repo root:
  `npm run dev --workspace pet -- --open -- --endpoint=http://localhost:3130/api/pet/findings`
- QuickTime Player > File > New Screen Recording, microphone on, record the full display at 1440x900 or larger.
- Slack and Chrome zoom 110 percent so cards and graph labels read on a phone.
- One take preferred. If needed, cut in QuickTime with Edit > Trim. No other editing.
- The terminal running `npm run dev:slack` stays off screen. It must never show `.env`.

## 2. Two options

- Option 1, one continuous take. Fresh thread in `#ks4-electrical`: seed message with `fixtures/documents/precharge-review-r2.docx` attached, firmware reply, `@Rev` mention, wait about 40 s for Card 1 and the proposal, correction, Approve. Pick this if more than 30 minutes remain, because it shows the ask and the card arriving live, which is the strongest execution proof. The console cut in beat 3 then shows the new finding, not `fnd-mtyrv4yj-y70h`.
- Option 2, finish the existing thread. Start on the live thread (permalink above) showing Card 1 (`fnd-mtyrv4yj-y70h`) and the "Proposed edit: needs approval" card already there, then post the correction and click Approve live. Pick this if under 30 minutes remain, because it needs only one 40 s model round trip and cannot fail on the first mention.

Either way, beats 4 and 6 are live. In Option 2, beats 1 to 3 are narrated over the already-posted messages while scrolling the thread from the top. In Option 1 the 40 s wait after the mention absorbs the beat 2 and beat 3 narration.

## 3. Shot list

Total 120 s. Trimmed against the first draft to make room for the two console cuts (17 s): beat 1 from 15 s to 8 s (shorter opening line), beat 3 Slack hover from 30 s to 24 s (the "model never wrote a number" sentence moved to the console cut), beat 4 from 25 s to 24 s, beat 5 from 20 s to 16 s (dropped the sentence "The document contradicts itself, its printed result only works with a capacitance the thread already replaced, and the correction that breaks the timer is not in any document yet", which beats 3 and 4 already show on screen).

| Time | On screen | Presenter does | Spoken line |
|---|---|---|---|
| 0-8 s | Slack, `#ks4-electrical`, seed message from Dara with `precharge-review-r2.docx`, Tam's firmware reply in thread. Overlay glyph visible, calm. | Option 1: paste message A, attach the docx, send, then paste B in thread. Option 2: scroll thread to top. | "Kestrel Motors, light electric vehicles. The KS-4 precharge review is about to be signed. Dara says the bus is 680 microfarads. Tam says the firmware timer matches." |
| 8-18 s | The `@Rev` mention in the thread. | Option 1: paste message C, send. Option 2: point at the mention. | "Juno joined in August and has to sign this. She asks Rev, the ThreadRev reviewer, an OpenAI model running through CopilotKit Channels, to check section 3 before she signs." |
| 18-42 s | Card 1 in Slack. Hover the section 3 vs section 2 lines, then the section 4 line, then the question to Dara. | Option 1: wait about 40 s (fill with the spoken line), then hover. Option 2: hover. | "Rev read the thread, opened the doc, ran a local checker. Section 3 says 680, the section 2 diagram says 750, and the printed 2.435 seconds only reproduces at 750. At 680 it is 2.208. Section 4 prints 6.91 seconds, recomputed 6.493. The card names the doc revision and its hash, and asks Dara which capacitance is right." |
| 42-54 s | Cmd+Tab to the web console. Findings row for Card 1 (`fnd-mtyrv4yj-y70h`, 2 s). Click the Evidence graph tab (10 s): the thread messages, the cross-channel search hits in `#ks4-purchasing` and `#ks4-firmware` (7 searches), the document node with revision `2026-09-12T19:21:43.261Z` and its hash, and the check run node. | Click Findings row, click Evidence graph, hover the document node then the check run node. Cmd+Tab back to Slack at 54 s. | "Every card links back to this graph: the messages it read, the searches it ran, the document revision and hash, and the checker run. The model never wrote a number." |
| 54-78 s | Slack. Paste message D. Card 1 marked stale in place. Card 2 arrives. Overlay glyph turns red and hops once when Card 2 lands. Click the glyph, the panel opens showing the finding, the glyph calms. | Paste D, send, wait for Card 2 (about 40 s, the beat 5 line can start as soon as Card 1 shows stale), click the overlay glyph, close the panel. | "Dara corrects it: 820 microfarads, doc will be r3. Card 1 goes stale in place, not deleted. Card 2: at 820, t 99.9 is 2.662 seconds, past the 2.5 second relay timer. The bus is at 99.85 percent when the relay closes. Timer or resistor has to change. And the reviewer follows you to the desktop: the glyph went red because a live discrepancy is unseen. Click it, it calms." |
| 78-94 s | Stale Card 1 above Card 2. No cursor movement. | Hold. | "Slack AI can summarize this thread, and the summary is right: bus 680 microfarads, timer 2.5 seconds, doc matches. It is the wrong answer. ThreadRev recomputed the numbers with a local checker. It bound the card to the document revision and the message it was checked against. And when Dara changed the bus, the old card went stale instead of sitting next to a new summary. Slack keeps the conversation. ThreadRev keeps the decision, what it was decided against, and whether it is still true." |
| 94-100 s | "Proposed edit: needs approval" card. Hover `section 4, line 13: t = 6.91 s → t = 6.493 s`, the checker run id, "Nothing has been written." | Hover. | "The worked example in section 4 is wrong and its input isn't in dispute. So Rev proposes the exact line. It has not written anything." |
| 100-103 s | Cursor on **Approve and write the file**. Hold one second on the "approved, writing" redraw. | Click Approve. | "A person approves." |
| 103-109 s | Card redraws to "Proposed edit: applied" with `precharge-review-r2-proposed.docx` and two hashes, "Source untouched." | Hold. | "It writes a new copy with a new hash. The file Juno signed keeps its hash." |
| 109-114 s | Cmd+Tab to the web console timeline: edit proposed, edit decided, edit applied, with the two hashes. | Scroll the timeline to the three edit events. | "The console shows the same record: proposed, decided, applied, both hashes." |
| 114-120 s | Cmd+Tab back to Slack, applied card in view. | Hold. | "Rev proposes, you decide, the record shows both. Live Slack delivery, OpenAI model through CopilotKit Channels." |

If over 120 s, cut the overlay click (keep the red hop), then the 109-114 s console timeline cut. Never cut the Evidence graph cut, the Approve click, or the applied redraw.

## 4. Exact messages to paste, in order

A. Seed, new top-level message in `#ks4-electrical`, attach `fixtures/documents/precharge-review-r2.docx` (Option 1 only):

```
Precharge board r2 review doc is up. Dropped one film cap, bus is now 680 uF.
```

B. Reply in that thread (Option 1 only):

```
Relay close timer in firmware is 2.5 s, matches the doc.
```

C. Reply in the thread, mentioning the bot (Option 1 only):

```
@Rev can you check section 3 of the r2 doc before I sign the review?
```

D. Reply in the thread (both options):

```
Correction: we are adding a 140 uF snubber bank on the motor controller side. Bus is 820 uF, not 680. Doc will be r3.
```

## 5. Fallback (Path B)

If Card 2 has not posted 90 s after message D: keep Card 1 and the proposal card on screen and say "the correction beat is in the web console." Cmd+Tab to http://localhost:3130, scenario A timeline, and show in order: Card 1 marked STALE, the correction message, Card 2, and the applied edit. Call it the web console or the evidence timeline, never "the agent." Then return to Slack for the Approve click and the redraw (beat 6), and the 109-114 s console cut still applies. Say on camera that the correction beat shown was from the console record, not live delivery.

## 6. Pre-flight checklist

1. `npm run dev:slack` online, log shows `Channel "rev" online`, terminal off screen.
2. Web console open in Chrome at http://localhost:3130, Findings shows `fnd-mtyrv4yj-y70h`, Evidence graph tab loaded once and rendering the document and check run nodes.
3. Overlay running, glyph calm (not red), bottom-right corner, endpoint `http://localhost:3130/api/pet/findings`.
4. No `.env`, token, or key visible in any window that will be on screen. Chrome has only the console tab open.
5. macOS Do Not Disturb on, Slack notifications and sounds off, other workspaces closed.
6. Phone away.
7. Thread scrolled to the top (Option 2, use the permalink) or channel composer focused (Option 1). Messages A to D in a text file ready to paste, docx path in Finder.
8. Microphone level checked with a 5 s test recording, played back.
9. Timer visible on a second device or the menu bar, target 120 s.
10. Save as `submission/threadrev-demo.mov`. Do not `git add` it; as of this commit `.gitignore` has no `.mov` rule, so add one or leave the file unstaged. Upload to YouTube unlisted or Loom, paste the link in `submission/final-submission.md`.

## 7. Post-record

1. Trim to 120 s or less in QuickTime (Edit > Trim), export.
2. Watch once with audio. Confirm the six beats, both console cuts (Evidence graph, timeline), the overlay hop, the Approve click, and the applied redraw are all visible.
3. Confirm no token, key, or `.env` content appears in any frame, including the console and Chrome address bar.
4. Upload (YouTube unlisted or Loom).
5. Paste the link into `submission/final-submission.md`. Another lane owns that file, only the link goes in.

## Live caveats (master session, 3:37 PM)

- Do not restart `npm run dev:slack` and do not edit anything under `apps/channel/src` before recording. The dev script runs with `--watch`, channel state is an in-memory store, and a restart forgets Card 1 and the proposal in the existing thread, so the stale marker and the Approve button stop working there. If a restart happens anyway, record Option 1 (fresh thread) instead.
- Dara's correction was posted in the live thread at 3:27 PM and produced nothing in the following minutes: no stale marker, no Card 2, no event in `evidence/log.jsonl`. The gate accepts that text and the process is connected, so the cause is unknown. The @Rev mention path is proven live. In the recording, after Dara's correction, wait 60 s. If nothing lands, Juno replies in the thread: `@Rev the bus is 820 uF now. Does your card above still hold?` That mention always runs the reviewer. If that also produces nothing within 90 s, use the Path B fallback above.
- The console and the overlay on :3130 read the live log now (`EVIDENCE_LOG` points at `ThreadRev/evidence/log.jsonl`), so the Evidence graph shows the real run behind Card 1, and the glyph is red for that finding until the panel is opened.
- The Chrome profile used by agents is not signed into kestrel-motors.slack.com. The human records from their own Slack sign-in.
