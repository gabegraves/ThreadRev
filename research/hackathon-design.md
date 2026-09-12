# Agents, Everywhere: design recommendation

September 12, 2026. Research-stage proposal, not approved implementation scope. Read alongside [model research](document-cad-models.md), [Prime audit](prime-environments.md), [recent winners](recent-hackathon-winners.md), and the preserved [initial baseline](../RESEARCH.md).

## Outcome to build

**A Slack-native engineering change investigator that shows which earlier conclusions a new requirement invalidates, performs the affected computation, and posts a source-linked check record.**

Keep local inference as a demonstrated deployment mode. The distinguishing interaction is a correct response to evolving workplace context, not a static PDF chatbot, arbitrary CAD generation, or a swarm diagram.

## Exact-event evidence

The [CopilotKit event starter](https://github.com/CopilotKit/agents-everywhere-starter-kit) contains a [rubric summary](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/hackathon-overview.md) and [rules summary](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/hackathon-rules.md), checked against the San Francisco handbook September 11. The global event page returned an access error during research. Local-city rules and deadlines take precedence; the user's city/deadline remain unconfirmed.

The four judging criteria, each 1–5, concern functionality, innovation/theme alignment, technical execution/integration, and usefulness/agentic experience. Any stack is allowed. One surface is enough. Required deliverables include a public repository and two-minute demonstration, plus description/title and an event-tagged public post. Core functionality must be built during the event; reused starter code must be distinguished from original work. No publishing is authorized by this research request.

**Design inference:** spend the demo on a complete contextual interaction and visible evidence. Additional channels or training jobs help only if they improve that interaction.

## First hosted loop, then local parity

**Start the integration with OpenAI using the supplied Slack starter.** Its [channel documentation](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/apps/channel/README.md) already covers thread history, subscriptions, search and native cards; its sample model is `gpt-5.6-sol`. Its actual [agent factory](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/packages/agent-core/src/agent.ts) uses CopilotKit `BuiltInAgent` with a bounded tool loop. It is not evidence that we need to assemble an OpenAI Agents SDK + Hermes + LangGraph stack.

[GPT-6 Astra](https://openai.com/index/gpt-6-astra/) is the newer hosted candidate, with reported CAD reconstruction and scientific-workflow improvements. Test it if the team's API account has access. Keep the starter's documented Sol configuration as a fallback **for the explicitly hosted/public-fixture mode**. Account access, tool compatibility and task latency have not been tested. Provider-reported BenchCAD overlap is not dimensional certification or a controlled comparison with every competitor.

Why hosted first even with the rig: it separates channel/tool/checker bugs from local serving bugs. The dedicated hardware makes local parity a credible near-term milestone, not a reason to delay proving the complete workflow. A local model can replace the investigator once it passes the same tools and checks; private mode must never silently fall back to a hosted model.

Do not run a broad hosted-provider tournament during the event. Compare OpenAI and local Qwen on identical public fixtures first; add Claude/Gemini only if they solve a measured failure or already integrate more reliably. Sponsorship does not establish model superiority or extra judging points.

## Two deployment paths; do not blur their privacy claims

- **Fast event path:** official CopilotKit Slack starter, public synthetic engineering fixture, hosted investigator initially, actual local computation/checks. Its managed Channels/Intelligence connection is another processor. A local model behind that connection does not make the complete application customer-controlled.
- **Customer-controlled path:** directly connected Slack Socket Mode with the agent/runtime and inference on the user's infrastructure. [Hermes Slack support](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/slack) and [local model endpoints](https://hermes-agent.nousresearch.com/docs/integrations/providers) are a reuse option. Select this path first only if demonstrating absence of an additional channel processor is essential. Do not implement both channel stacks during the event by default.

Slack itself is cloud-hosted. Disable hosted embeddings, external research containing private terms, cloud telemetry and auxiliary-model fallback. Verify network policy and actual calls; a configuration badge is not proof. Do not expose an unauthenticated inference endpoint on the public Internet.

## Small harness and verification contract

One investigator, one extraction service, one bounded execution tool, one trusted checker. Add a specialist drawing tool only when required by the chosen fixture. Avoid a general orchestration framework until recovery or durable approvals exceed the starter's capabilities.

Flow:

`Slack revision → source evidence → proposed inputs → isolated computation → trusted checks → revision-bound Slack card`

The minimum tool set can be `read_evidence`, `inspect_geometry`, `run_check`, and `publish_result`; use existing thread/search tools. The model chooses investigative steps. Application code owns permissions, authoritative revision and verification status.

Every critical input carries source hash/revision, page/crop or CAD entity, original value and units. Missing, contradictory or illegible evidence blocks the affected check. The newest Slack message is not automatically authoritative over every controlled engineering document; fixture rules must define authority and ask for resolution when needed.

Run generated code in a disposable isolated runtime without secrets/network access. Keep checker code and expected results outside the candidate's writable environment. Record solver/version, exact inputs, output artifact hash, errors and named checks. For a simple part, use actual geometry measurements and independently implemented analytical calculations. A solver rerun is repeatability, not independent correctness.

Before publishing, atomically check that the run still targets the current requirements revision. A revision during execution makes the run stale even if its calculations pass. Preserve the old evidence record and visibly invalidate the old card; do not overwrite history. Human approval is separate from computed pass/fail.

“Passed” means passed specific checks against explicit assumptions, not unrestricted manufacturing or safety sign-off. The model cannot mint its own verified badge.

## Recommended two-minute demonstration

Scenario A at Kestrel Motors, a fictional maker of light electric city vehicles. The KS-4 precharge board review is about to be signed. Fixture: `fixtures/slack/scenario-a.json`. Cards: `contracts/examples/finding-scenario-a.json` and `finding-scenario-a-superseding.json`. Every number below comes from `checkers/check_rc.py`, none from the model.

1. **0-15 s. The context.** Slack, `#ks4-electrical`. Dara Voss, electrical lead: "Precharge board r2 review doc is up. Dropped one film cap, bus is now 680 uF." with `precharge-review-r2.docx` attached. Tam Holloway, firmware, in thread: "Relay close timer in firmware is 2.5 s, matches the doc." Spoken: a light EV company, a board about to go to production, a review about to be signed.
2. **15-30 s. The ask.** Juno Marsh, who joined in August: "@Rev can you check section 3 of the r2 doc before I sign the review?"
3. **30-60 s. Card 1.** The reviewer reads the thread, opens the doc, runs the checker, posts one card. Section 3 says 680 uF, the section 2 diagram says 750 uF, and the printed 2.435 s only reproduces with 750 uF. At 680 uF it is 2.208 s. Section 4 prints 6.91 s for a 2 mF bank, recomputed 6.493 s. Question to Dara: which capacitance is right. Spoken: the model did not compute a number on this card, a local checker did, and the card names the doc revision and its hash.
4. **60-85 s. The change.** Dara, in thread: "Correction: we are adding a 140 uF snubber bank on the motor controller side. Bus is 820 uF, not 680. Doc will be r3." Card 1 is marked stale in place, not deleted. Card 2: at 820 uF, t_99.9 = 2.662 s, later than the 2.5 s relay timer. The bus is at 99.85 percent when the relay closes. Timer or resistor must change. Bound to Dara's message because r3 does not exist yet.
5. **85-105 s. The Slack comparison.** On screen: Card 1 marked stale above Card 2. Spoken, exact words: "Slack AI can summarize this thread, and the summary is right: bus 680 microfarads, timer 2.5 seconds, doc matches. It is the wrong answer. ThreadRev recomputed the numbers, bound the card to the revision it was checked against, and when Dara changed the bus, the old card went stale instead of sitting next to a new summary. Slack summarizes what was said. ThreadRev keeps what was decided, and what it was decided against." Then, if time allows, the cross-channel variant: the same correction posted two weeks earlier in `#ks4-purchasing` as a snubber order, found by `search_workspace` on the unit `uF`.
6. **105-120 s. Proof it is not theatre.** Replay scorecard for five seconds: clean control stays silent, conflicting evidence asks instead of choosing, mid-run revision is refused before it posts.

Say on screen whether the run is live Slack delivery or the offline replay harness. Do not claim a delivery path that did not run.

## Lessons from actual recent winners

The [source-backed winner research](recent-hackathon-winners.md) covers events ending July 12–September 12, not merely pages published then:

- **TitleWise / Agent Natives, August 26–27:** narrow document job plus a clean negative control. Borrow the control, not unrelated product scaffolding.
- **Climatico / same event:** durable action records. Preserve the invalidated result and the replacement.
- **Discordance, second prize / Owkin, July 11–12:** conflicting evidence and uncertainty are useful outputs. Do not force every episode to end in approval.
- **KScope, first prize / same event:** evidence cards make checks visible. A dashboard using mock data is not execution proof.
- **WhatsApp router / HackerRank August edition, ended August 2:** model interpretation can feed deterministic actions; context changes the right action.

This is a small qualitative set, not evidence that a provider or architectural pattern causes wins. No sufficiently documented recent CAD-specific winner was verified.

## Evaluation sequence

Use current upstream document scoring, a small MechVQA/BenchCAD QA slice, and 5–10 private-compatible custom revision episodes. The [Prime audit](prime-environments.md) identifies actual ready environments and their source-level deficiencies. Keep existing v0 benchmarks isolated/pinned; new episodes may use v1 without migrating everything first.

Choose models using exact critical-field accuracy, correct abstention, revision invalidation, completed checked tasks and latency. Do not optimize a combined reward that lets formatting points compensate for a dangerous numerical error. No fine-tuning, RL training, multi-channel expansion or arbitrary CAD synthesis is necessary for the first complete demo.

## Open design choice

LeMat-Synth introduces a second credible domain: extracting and comparing materials experiments from papers and figures. The current recommendation remains mechanical change verification because that was the prior plan. If the user's real target is materials synthesis rather than mechanical parts, change the fixture and checker explicitly; do not mix both domains into the first two-minute demo.
