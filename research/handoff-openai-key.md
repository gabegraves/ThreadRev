# Handoff: OpenAI access for ThreadRev

Project: ThreadRev, Agents, Everywhere hackathon, deadline 5 PM EDT today, September 12, 2026. Repo checkout: `~/Desktop/9_12_26_Hackathon/ThreadRev`. You have a browser and a shell.

Goal: a working `OPENAI_API_KEY` in the root `.env`, proven with one live model call, without the key ever leaving `.env`. Secondary: finish the two CopilotKit steps that block the Slack listener, since you will be in those dashboards anyway.

Current state, checked at 11:45 AM:

- `.env` has `MODEL_PROVIDER=openai` and `MODEL=gpt-5.6-sol`. `OPENAI_API_KEY`, `CHANNEL_CODE`, and `INTELLIGENCE_API_KEY` are empty.
- CopilotKit CLI is signed in. `npm run channel:status` now fails with `CLI_CHANNELS_PROJECT_NOT_SELECTED`: a project must be selected and a Channel created.

## Ground rules

- Never paste the key into chat, a commit, a screenshot, a log, or any file other than `.env`. `.env` is gitignored; confirm with `git check-ignore .env` before writing to it.
- Report that a value was set, never the value. Mask it in any output you show.
- Use the user's own OpenAI account unless the hackathon credits are actually redeemable today. Do not create accounts in anyone else's name.

## Part 1. Get the key

### 1a. Check for hackathon credits first (10 minutes, then move on)

1. Open the user's city participant portal from https://aitinkerers.org/hackathons/global/agents-everywhere. The Atlanta portal is https://atlanta.aitinkerers.org/hackathons/h_pS99rSfunCc; use the user's actual city.
2. Look for an OpenAI credit code, a link to join a sponsored OpenAI organization, or organizer instructions. `SETUP.md` section "Atlanta credits clarification" records that the event page promises credits only "where available" and specifies no amount.
3. If a redemption path exists, follow it in the browser and note which OpenAI organization it lands in. If not found within 10 minutes, use the personal account and say so in the report.

### 1b. Create the key

1. Sign in at https://platform.openai.com. Confirm the organization and project shown in the top-left selector. Use a project named `ThreadRev` if you can create one; otherwise the default project.
2. Billing: https://platform.openai.com/settings/organization/billing/overview. The account must have a positive balance or a payment method. A key on an unfunded account returns HTTP 429 with `insufficient_quota`. If a card needs adding, that is the user's action; ask them.
3. Create a key at https://platform.openai.com/api-keys, name it `threadrev-hackathon`, permissions "All" or at least "Model capabilities: write", project-scoped.
4. Write it into `.env` with a command that never echoes it, for example:

```bash
cd ~/Desktop/9_12_26_Hackathon/ThreadRev
read -s -p "OPENAI_API_KEY: " K; echo
sed -i '' "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=$K|" .env; unset K
grep -c '^OPENAI_API_KEY=sk-' .env    # prints 1 if set, never prints the key
```

### 1c. Confirm the model is available to this account

`gpt-5.6-sol` is the kit's configured model. Verify it exists on this account before anything else:

```bash
cd ~/Desktop/9_12_26_Hackathon/ThreadRev
node --env-file=.env -e '
const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });
const j = await r.json();
if (!r.ok) throw new Error(`HTTP ${r.status}: ${JSON.stringify(j.error?.code)}`);
const ids = j.data.map(m => m.id);
console.log("configured:", process.env.MODEL, "available:", ids.includes(process.env.MODEL));
console.log("gpt-5/gpt-6 family:", ids.filter(i => /^gpt-[56]/.test(i)).sort().join(", "));
'
```

If `available: false`, pick the newest tool-capable model from the printed list, set `MODEL=` in `.env` to it, and say which one you chose and why. Do not pick a model that lacks tool calling; the reviewer depends on four tools.

### 1d. One live call

Run the "First call" block from `using-sponsor-tools.md`, section OpenAI. It must print a text answer. Then confirm usage shows in the right project at https://platform.openai.com/usage. Save the answer text (not the key) to `research/setup-evidence/openai-first-call.txt`.

## Part 2. Unblock the Slack listener while you are there

1. `npx copilotkit@4.9.60 projects list` (or the command the CLI suggests) and select or create a project named `ThreadRev`.
2. `npm run channel:setup`. Name the channel `threadrev`, display name `ThreadRev`, adapter `slack`. Follow what it prints. Install the generated Slack app only into the `ThreadRev Demo` workspace the environment owner created; if that workspace does not exist yet, stop here and report.
3. Put the Channel Code into `CHANNEL_CODE` and a project-scoped Intelligence key into `INTELLIGENCE_API_KEY` in `.env`, same masked method as above.
4. `npm run channel:status` must no longer report `failed`. Save the JSON, with any token-like values removed, to `research/setup-evidence/channel-status.json`.
5. `npm run dev:slack` must reach "Channel ... online". Stop it with Ctrl-C. Do not post to Slack yet.

## Report back

One message:

1. Where the key came from: hackathon credits (which org) or personal account.
2. Which model is set in `.env` and whether it is the kit default.
3. The first-call result: one line of the answer, HTTP status, and the project name usage appeared under.
4. Env keys now set, names only.
5. Channel status result and whether `dev:slack` reached online.
6. Anything that needs the user personally: adding a payment method, choosing a city portal, approving a Slack install.
