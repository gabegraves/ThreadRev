# ThreadRev environment setup

You are setting up the live test environment and the shared GitHub repo for ThreadRev, a hackathon project due 5 PM EDT today, September 12, 2026. You have a browser and a shell. Another agent is building the application code in parallel; do not touch application source. Your job is accounts, credentials, the Slack workspace, and the repo.

## Ground rules

- Read-only outside the resources you create today. Do not post, invite, or install anything into any existing Slack workspace. Create a new one.
- Never paste a token, key, or channel code into a commit, a chat message, a screenshot, or a file other than the gitignored `.env`. Report that a value was set, never the value.
- The private research archive at `~/Documents/ChatGPT/9_12_26_Hackathon` contains real names. Do not copy, reference, or push anything from it.
- If a step is still failing after 45 minutes, stop, report exactly where it failed with the error text, and move to the fallback in step 6.
- Everything you claim done must have evidence: a command output, a status JSON, or a screenshot saved under `~/Desktop/9_12_26_Hackathon/agents-everywhere-starter-kit/research/setup-evidence/`.

## Workspace

Checkout: `~/Desktop/9_12_26_Hackathon/agents-everywhere-starter-kit` (Node 22+, npm installed, `npm run verify` passes offline).
Setup docs to read first: `dev-docs/setup.md`, `dev-docs/troubleshooting.md`, `.agents/skills/channels-setup/` if present.
Platform facts and the fallback Slack manifest: `~/Desktop/9_12_26_Hackathon/agents-everywhere-starter-kit/research/slack-agent-platform.md`.

## Steps

### 1. GitHub repo (already done)

The checkout is already the ThreadRev repo: `origin` is https://github.com/gabegraves/ThreadRev (private), `upstream` is the CopilotKit starter, and `research/` plus `RESEARCH.md` are committed at the repo root. Verify with `git remote -v` and `git log --oneline -3`, then move on. Commit and push after every step below that changes a tracked file.

### 2. Slack workspace

1. In the browser, create a new free Slack workspace named `ThreadRev Demo`. Use the user's email. No other members.
2. Create these public channels: `#ks4-electrical`, `#ks4-strategy-sim`, `#ks4-suspension`, `#ks4-purchasing`, `#general` already exists.
3. Evidence: screenshot of the channel list.

### 3. CopilotKit Intelligence

1. From the checkout root run `npx copilotkit@4.9.60 login` and complete the browser login. If no account exists, create one with the user's email.
2. Run `npm run channel:setup`. Follow every instruction it prints. Name the channel `threadrev`, display name `ThreadRev`, adapter `slack`.
3. When it produces a Slack app manifest or install link, install the app into the `ThreadRev Demo` workspace only.
4. Copy the Channel Code into `CHANNEL_CODE` in `.env`. Create a project-scoped Intelligence API key and set `INTELLIGENCE_API_KEY`.
5. Run `npm run channel:status`. Save the JSON to `research/setup-evidence/channel-status.json` after removing any token-like values. `status` must not be `failed` and the `CLI_CHANNELS_NOT_AUTHENTICATED` error must be gone.

### 4. Model key

1. Ask the user for an OpenAI API key, or confirm one is already in `.env`. Set `MODEL_PROVIDER=openai`, `MODEL=gpt-5.6-sol` unless the user names another model available on their account.
2. Do not test the key by posting to Slack. Verify with `npm run verify` and a single `npm run dev:slack` start that reaches "listening" without errors, then stop it.

### 5. Bot in channels and seed messages

1. In Slack, `/invite @ThreadRev` into all four `ks4-*` channels.
2. Start `npm run dev:slack`. In `#ks4-electrical`, mention the bot once in a fresh thread and confirm it replies. Screenshot the reply. Stop the listener.
3. Do not paste the fixture scripts yet. The application code that reacts to them is not merged. Leave the channels empty apart from the smoke-test thread.

### 6. Fallback if step 3 stalls past 45 minutes

Create the Slack app directly instead: go to `api.slack.com/apps`, create from manifest, paste the JSON manifest from the "Setup" section of `research/slack-agent-platform.md`, install into `ThreadRev Demo`, enable Socket Mode, generate an app-level token with `connections:write`. Put the bot token as `SLACK_BOT_TOKEN` and the app token as `SLACK_APP_TOKEN` in `.env`. Report that the managed path failed and the Bolt fallback is provisioned; do not write Bolt code.

## Report back

One message, in this order:

1. Repo URL, remotes, and the last five commit lines.
2. Slack workspace name and channel list.
3. Which env keys are set (names only) and the sanitized `channel:status` result.
4. Smoke-test result with screenshot path.
5. Anything skipped or failed, with the exact error text and where you stopped.
