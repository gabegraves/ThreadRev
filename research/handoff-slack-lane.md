# Handoff: Slack lane (A1 to A4)

Written 1:15 PM EDT, 2026-09-12. Deadline 5:00 PM. Path B checkpoint is 3:00 PM: if `npm run dev:slack` has not printed `online` by then, tell Gabe and stop; the demo lane records the offline harness instead.

You are a computer-use agent. Your job is to get ThreadRev posting a real finding card in a real Slack workspace, then prove it with a screenshot. Nothing else. Do not touch code outside `.env` unless step A4 fails for a reason in the code, and then report before editing.

## Ground truth you should not rediscover

- Repo: `~/Desktop/9_12_26_Hackathon/ThreadRev`, branch `main`, pushed. `npm run verify` is green (56 + 44 + 34 + 10 tests). Everything works offline through the replay harness. Nothing has ever posted to a live Slack workspace.
- `.env` exists at the repo root, git-ignored, owner-only. `MODEL_PROVIDER=openai`, `MODEL=gpt-5.6-sol`, `LOG_LEVEL=debug`, `PORT=3000`. Blank: `OPENAI_API_KEY`, `CHANNEL_CODE`, `INTELLIGENCE_API_KEY`.
- `npm run channel:status` at 1:09 PM returned `CLI_CHANNELS_PROJECT_NOT_SELECTED`. No hosted Intelligence project is selected in this directory. CopilotKit CLI is not logged in.
- The server (`apps/channel/src/server.ts`) exits with code 1 unless the channel status is exactly `online`. `ready()` resolving is not proof of life.
- The bot runs the reviewer on every @-mention. On other messages it runs only if the text passes the regex gate in `apps/channel/src/review-moment.ts` (words like review, check, doc, correction, "is now", uF values do not count on their own, but "bus is now 680 uF" passes on "is now").
- `read_evidence` reads documents by filename from `fixtures/documents/` on this machine. It does not download from Slack. The Slack message must name the file `precharge-review-r2.docx` (uploading the real file from `fixtures/documents/` is best, since `read_thread` reports uploaded file names; naming it in the text also works).
- `search_workspace` reads `fixtures/workspace/kestrel-workspace.json` on this machine by default. No Slack history outside the thread is needed for the demo.
- The vendor setup skill is `.agents/skills/channels-setup/SKILL.md`. It contains no steps. It tells you to fetch `https://copilotkit.ai/channels-guide.md` and follow it. Verify the body is markdown, starts with `# Build and prove a CopilotKit Channels agent`, and has five `## Phase` headings. A missing page returns HTTP 200 with HTML. If you do not get the guide, stop and say so.

## Rules

- Never paste, echo, log, or screenshot a key value. Write keys into `.env` with an editor or `sed`, then verify with `grep -c '^OPENAI_API_KEY=.\+' .env` (prints 1 when set).
- Never run `git add .env`. Never commit anything. Gabe commits.
- Passwords, MFA, OAuth consent screens, and OpenAI billing are the human's. When you reach one, stop, say exactly which screen you are on, and wait.
- Do not create resources in whichever Slack workspace happens to be open. Confirm the workspace name with the human first (Q1 below).
- One workspace, one channel, one bot. Do not retry a failed `channels add` with a new name; check `npm run channel:status` first, the first one may exist.

## Questions to settle with the human before A2

- Q1. Which Slack workspace and who is admin there? The bot install needs workspace admin approval. Test channel name: `#ks4-electrical` (create it if missing).
- Q2. Bot display name: `Rev` (people type `@Rev`). Channel code for the CLI: `rev`. The project is still ThreadRev; only the bot is Rev.
- Q3. Whose OpenAI key, and does it have credit? If none, use OpenRouter: set `MODEL_PROVIDER=openrouter`, `OPENROUTER_API_KEY=...`, `MODEL=openai/gpt-5.6-sol`.

## A1. CopilotKit login and project select

Run in the repo directory. Both are interactive and open a browser.

```sh
cd ~/Desktop/9_12_26_Hackathon/ThreadRev
npx --yes copilotkit@4.9.60 login
npx --yes copilotkit@4.9.60 whoami
npx --yes copilotkit@4.9.60 project select
```

Gate: `whoami` shows a logged-in account and `project select` reports a selected project. Then:

```sh
npm run channel:status
```

Gate: the `error` block no longer says `CLI_CHANNELS_PROJECT_NOT_SELECTED`. A `setup_required` status at this point is expected, not a failure.

## A2. Create the Channel, install to Slack, fill the two keys

Fetch and follow `https://copilotkit.ai/channels-guide.md`. Do not substitute remembered steps. The commands below are what `.env.example` documents for the manual path, for orientation only; the guide wins on conflict.

```sh
npm run channel:setup
# or by hand:
npx --yes copilotkit@4.9.60 channels add --name rev --display-name "Rev" --adapter slack --json
```

The wizard emits a Slack app manifest already pointed at the managed request URL. Expected human-owned screens in order: Slack "create app from manifest", pick workspace (Q1), "Install to workspace" consent. Stop at each and hand over.

Then write into `.env`:

- `CHANNEL_CODE=` the Channel Code, character for character, lowercase, digits, single hyphens. Must equal the name the CLI reports.
- `INTELLIGENCE_API_KEY=` a project-scoped key created under API Keys in the Intelligence sidebar. It looks like `cpk-{projectId}_...`. A key without that shape fails activation with `ChannelConfigError`.

Gate:

```sh
npm run channel:status
```

Must report the channel and an `online` or equivalent provisioned state per the guide. If it says `setup_required`, the Slack install is unfinished; reread the guide's phase on provider setup.

## A3. Model key

Write `OPENAI_API_KEY=` into `.env` (or the OpenRouter trio from Q3). Verify without printing:

```sh
grep -c '^OPENAI_API_KEY=.\+' .env
```

Gate: a real model call. Cheapest check is starting the server in A4 and mentioning the bot. If the first mention produces a provider error in the server log (401, 404 model not found, insufficient_quota), report the error line verbatim minus any key, and stop.

Note: `gpt-5.6-sol` has never been called from this repo. If the provider rejects the model name, tell Gabe before changing `MODEL`.

## A4. Run live and get Card 1

Terminal 1, leave running:

```sh
cd ~/Desktop/9_12_26_Hackathon/ThreadRev
npm run dev:slack
```

Gate: the log prints

```
✓ Channel "rev" online — listening on :3000
```

If it prints `Channel is not online:` and exits, paste the JSON status line into your report. That is A2 unfinished.

In Slack, as the human or a test user, in `#ks4-electrical`:

1. `/invite @Rev`. The bot should post its welcome message (`reviewerWelcome` in `apps/channel/src/finding-card.tsx`). Screenshot it. This is proof the socket delivers.
2. Post the seed message as a new top-level message, and attach the file `fixtures/documents/precharge-review-r2.docx` from this machine:
   `Precharge board r2 review doc is up. Dropped one film cap, bus is now 680 uF.`
   This message passes the gate ("is now"). The bot may reply in-thread already. That is acceptable; if it posts a card here, note it, but the scripted trigger is step 4.
3. Reply in that thread:
   `Relay close timer in firmware is 2.5 s, matches the doc.`
4. Reply in the thread, mentioning the bot:
   `@Rev can you check section 3 of the r2 doc before I sign the review?`
5. Wait up to 90 s. Expected Card 1: section 3 says 680 uF, section 2 diagram says 750 uF, printed 2.435 s reproduces only at 750 uF, at 680 uF it is 2.208 s, section 4 prints 6.91 s and recomputes to 6.493 s, question to Dara about which capacitance is right. Reference: `contracts/examples/finding-scenario-a.json`. Screenshot the card.
6. Reply in the thread:
   `Correction: we are adding a 140 uF snubber bank on the motor controller side. Bus is 820 uF, not 680. Doc will be r3.`
7. Expected: Card 1 edited in place to a stale marker, Card 2 posted: at 820 uF t_99.9 = 2.662 s, later than the 2.5 s timer, bus reaches 99.85 percent at 2.5 s. Reference: `contracts/examples/finding-scenario-a-superseding.json`. Screenshot both.
8. After Card 1 (step 5) Rev may also post "Proposed edit: needs approval" for section 4: `t = 6.91 s` → `t = 6.493 s`, with Approve and Reject buttons. Screenshot it. Click **Approve and write the file** as the human. Expected: the card redraws to "Proposed edit: applied" with the new file name `precharge-review-r2-proposed.docx` and two hashes, and that file appears in `fixtures/documents/` (git-ignored). Screenshot the redrawn card. If the model does not propose, that is a prompt gap; note it, do not force it.

Gate for done: screenshots of welcome, Card 1, stale Card 1 plus Card 2, and the server log from the mention through `publish_result`. The live evidence log is written to `evidence/evidence-log.jsonl` (git-ignored); copy it to the scratchpad and name the path in the report.

## Report format

Post to Gabe in this order, one line each, `[V]` for things you saw happen, `[U]` for anything you did not verify:

- A1 whoami account (name only), project selected.
- A2 channel code as set, `channel:status` overall state.
- A3 provider, model, first model call succeeded or the error line.
- A4 online line seen, welcome posted, Card 1 posted, Card 1 stale, Card 2 posted.
- Screenshots: paths.
- Anything you changed outside `.env`.
- Where you are stuck, the exact screen or log line, and what you need from the human.

## Known gaps you may hit

- Untracked `agent/skills/channels-setup/SKILL.md` at the repo root differs from `.agents/skills/...`. It is stray output from an earlier setup run. Ignore it. Use `.agents/`.
- `channel:status` warns `hosted_gateway_ws_url_missing`. On the managed path this warning is expected and not a blocker. Do not set `INTELLIGENCE_GATEWAY_WS_URL` unless the guide says to.
- The reviewer's first live model run has never happened. If the model calls `read_evidence` with a name other than `precharge-review-r2.docx` (for example a Slack file id), the tool returns an error and the card will not post. Report the tool error line; that is a prompt fix for Gabe, not for you.
- Slack thread messages from the bot count as `isBot` and never re-trigger the gate. Human messages in other channels the bot is invited to will run the gate; keep it invited to one channel.
