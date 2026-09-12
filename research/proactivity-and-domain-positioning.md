# Proactivity and domain positioning

Date: 2026-09-12. Research and proposed product behavior only; no competitor benchmark or implementation.

## Correction to the earlier recommendation

Software technical escalation is an attractive measurable-ROI workflow, but already substantially served. It is not automatically the best new product to build. The earlier recommendation weighted executable verification and accessible fixtures more heavily than differentiation and anticipation of problems.

For a differentiated hackathon hypothesis, prefer testing **pre-build change preflight for an electrical/electromechanical team**: when a proposed part, load or operating-condition change appears in conversation, establish which existing evidence no longer supports the intended build and complete the smallest authorized check. This is not proven whitespace or higher measured ROI. It is narrower than a general engineering agent and does not imply we should replace EDA, CAE or PLM.

## What effective proactivity means

There are three different behaviors:

1. Automatic response: someone reports a problem; the agent answers without a mention.
2. Anticipation: a proposed change or impending commitment causes the agent to discover an unsupported assumption before anyone reports a failure.
3. Follow-through: the agent performs an authorized investigation, tracks the affected decision and revisits it when the underlying evidence changes.

The earlier software escalation example primarily demonstrated the first and third, not strong prevention. Software can also support the second, for example detecting that a proposed retry/configuration change conflicts with an existing load test. The distinction is product behavior, not an intrinsic software/hardware divide.

Proposed mechanism:

- Start with one opted-in project and a small watchlist of critical requirements, exact revisions, qualifying evidence, owners and pending build/test decisions. Slack is an event source, not the complete authoritative state.
- On relevant new/edited messages or connected artifact changes, identify the affected part/test/requirement. Distinguish proposal, question, confirmed decision and reversal. A proposal can warrant a conditional warning without changing the baseline.
- Retrieve only the relevant baseline and evidence; compare conditions and revisions. Missing evidence means unsupported or unknown, not necessarily incorrect.
- Intervene only with a material mismatch, source support and a useful next step. Ask one precise question for consequential ambiguity; silence low-value observations. Deduplicate by underlying issue and update the thread instead of repeating alerts.
- Run preauthorized read-only research and bounded checks. Obtain approval for expensive runs, authoritative changes or external communications. Record actual results and invalidate conclusions when assumptions change. Treat message/document content as evidence, not permission to execute arbitrary instructions.
- Respect access at both retrieval and posting. Source access does not authorize sharing a private-channel finding with another audience. External research queries and compute require explicit data/resource policies.

Hypothetical example: a Slack proposal changes a device from intermittent to continuous operation while a build is planned. The recorded thermal test covers only the old duty cycle. The agent points out that existing qualification does not cover the proposed condition, links the report and build decision, and offers the predefined thermal rerun. It cannot infer failure solely from missing qualification or approve the revised design from an unvalidated simulation. A useful completed intervention includes checked inputs, actual outputs and a precise remaining bench-test requirement.

Current local starter inspection: `apps/channel/src/channel.tsx` subscribes on mention and only runs on non-mentioned messages when the thread is subscribed. It follows an invited conversation; it does not yet implement this proactive project watchlist or ambient decision-checking policy. Removing the subscription guard alone would create indiscriminate responses, not effective proactivity.

## Current competitive coverage

These are relative judgments from public product evidence, not market-share measurements or percentages of a problem solved. Documented capabilities are not independently validated reliability. An undocumented feature is not established absent.

| Domain | Existing coverage | Where a narrower hypothesis could be tested |
|---|---|---|
| Software/platform | Automatic Slack intake, context answers, duplicate checks, code investigations, tickets and PRs are directly documented | A particular team's unresolved cross-system assumption checks; generic escalation automation is a weak novelty pitch |
| Mechanical | AI-assisted simulation setup, runs and reports; established requirement/test traceability | Pre-build conversational changes tied to exact geometry, materials, loads and qualifying evidence across existing tools |
| Electrical/embedded | Contextual PCB checks and cross-agent hardware/firmware revision correction are already documented | Specific substitution or operating-envelope changes across procurement, board, firmware and test evidence; not generic pin-sync or board-review AI |
| Materials R&D | Institutional data retrieval, predictive models, formulation candidates and next-experiment recommendations are established offerings | Whether a proposed experiment reuses comparable evidence under the same composition, processing and measurement conditions; do not treat replication as waste |
| General engineering coordination | Conversation capture, engineering-intent linkage and governed downstream actions are directly marketed | A specific technical outcome and customer integration gap; “Slack decisions to updated plans” is not a sufficient distinction |

### Primary-source evidence

- [Cursor / Amplitude](https://cursor.com/blog/amplitude), April 15, 2026: automatic Slack reports lead to Linear duplicate checks and code investigation, tickets and PRs. A direct substitute for our prior software proposal.
- [Unblocked Slack documentation](https://docs.getunblocked.com/data-sources/slack): continuous authorized message ingestion and configurable answers without mentions. No-mention behavior is not new.
- [SimScale Engineering AI](https://www.simscale.com/product/engineering-ai/): current page says the agent is available to community members and describes CAD inspection/preparation, materials and boundary conditions, launching runs and reports, with API/custom-agent access. The execution layer is not empty territory; no trial was performed.
- [Trace.Space Test Management](https://www.trace.space/blog/test-management-in-trace-space), August 5, 2026: released requirement-linked tests/runs/evidence and APIs for CI/HIL/simulation/bench integration. The agent suggests tests, links and gaps, but does not decide passes or approve results.
- [Flux design-review documentation](https://docs.flux.ai/tutorials/ai-design-reviews): contextual resistor-power, capacitor-voltage and pull-up/down checks. The documented individual AI reviews are manually initiated; DRC runs automatically. Do not conflate the two.
- [Flux MCP documentation](https://docs.flux.ai/reference/flux-mcp-server) and [August 3, 2026 release](https://www.flux.ai/p/blog/summer-2026-updates-flux-mcp-server-and-chat-mode): external agents read live boards/pins, identify conflicts, request schematic changes and regenerate firmware against the read-back revision. This directly challenges a claim that only our agent crosses hardware/software tools.
- [Albert Breakthrough usage documentation](https://support.albertinvent.com/en/articles/10476417), June 9, 2026: embedded chemistry toolkit for property prediction, formulation candidates and experiment planning; learns from recorded results. This is not merely a literature chatbot.
- [Uncountable generative AI documentation](https://www.support.uncountable.com/knowledge-base/uncountable-gen-ai/), August 12, 2026: Bodie runs analysis and experiment-suggestion jobs; MCP supports external-client data queries and experiment/formulation actions. These opt-in capabilities are further evidence that materials platforms already support agent execution.
- [Citrine VirtualLab](https://citrine.io/platform/citrine-virtuallab/): material/formulation search against constraints, expert-informed models, uncertainty-guided experimentation and Python integration. Virtual predictions are not completed physical experiments.
- [Authentise engineering-intent description](https://www.authentise.com/post/engineering-data-isn-t-in-your-plm-why-lost-intent-is-costing-you-more): Whisper captures Slack/email/meeting/document conversations in the background, links knowledge to parts/projects and connects insights to existing systems. This is direct overlap with the general coordination concept. Exact scenario reliability remains untested.

## What actually separates the domains

Additional electrical/materials capabilities and availability caveats are recorded in [the domain evidence audit](domain-proactivity-evidence.md).

Software often offers source-controlled text, executable environments and fast inexpensive feedback. That makes agent work easier to demonstrate and also easier for competitors to provide. Passing tests still does not prove complete correctness.

Physical engineering adds identity and applicability problems: nominal dimensions versus tolerances, material grade and processing history, lot effects, loads and boundary conditions, geometry revisions, test instrumentation and calibration. A correct solver output can answer the wrong physical question. In materials, the next useful experiment may be a replication or uncertainty-reducing measurement rather than a predicted best formulation.

These are sources of integration difficulty and potential specialization, not automatic defensibility. Astra can help reconcile evidence and operate approved tools; it does not supply missing empirical data, calibrated models or engineering authority. Persistent value would have to come from reliable domain-specific evidence links, useful checking policies, customer integrations and measured outcomes—not Slack placement or the model name.

## Practical decision

For buying/deploying an agent quickly, software remains the easier return hypothesis. For choosing a new hackathon product with the user's proactive engineering emphasis, test electrical/electromechanical pre-build preflight, assuming we can supply authoritative fixtures and domain review. Materials requires a lab partner and reliable experiment data; generic mechanical autonomy has a larger verification burden. None of these rankings establishes an unsolved market.

Measure useful interventions before commitment, correct affected-evidence identification, human review burden, actual checked work and closure. Test proposals versus decisions, irrelevant changes, intentional replication, missing evidence, reversals and inaccessible sources—not only obvious planted conflicts.
