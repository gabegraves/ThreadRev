# Recent adjacent hackathon winners: evidence and design lessons

Researched September 12, 2026. Scope: events ending July 12–September 12, 2026, inclusive. This uses event dates, not search-engine publication labels. Findings below are organizer- or author-reported; no winning application was executed or independently benchmarked during this research.

## Recommended precedents

| Project | Event and date | Verified award | Demonstrated mechanism and relevance |
| --- | --- | --- | --- |
| TitleWise, Patrick Mitchell | Agent Natives Builders Hackathon, August 26–27, 2026 | External track winner | Document analysis reportedly caught eight planted fraud indicators and avoided flagging a clean title packet. Use both a dangerous engineering revision and an unchanged clean revision in our demo. |
| Climatico, Dalrae Jin | Same event, August 26–27, 2026 | Internal track winner | Autonomous climate investigation followed by recorded actions. Borrow durable result records and visible provenance. |
| Discordance | Owkin Rewiring Biology, July 11–12, 2026; organizer recap July 23 | Second prize | An MCP evidence broker retains conflicting findings, rates source quality/relevance, and escalates excessive uncertainty. Direct precedent for surfacing conflicting engineering requirements. |
| Mrinal Desai's WhatsApp notification router | HackerRank Orchestrate August edition; official archive says ended August 2, 2026 | First place, reported 84.2/100 | Model interpretation feeds deterministic notify/digest/mute decisions personalized to the recipient. Direct precedent for model-derived candidate facts feeding code-enforced verification status. |
| KScope | Owkin Rewiring Biology, July 11–12, 2026; organizer recap July 23 | First prize | Causal probes of frozen pathology models, packaged as evidence for predictions. Useful precedent for making verification a visible product output. |

Award evidence: [Agent Natives organizer results](https://www.immersivecommons.com/events/hackathon), [Owkin organizer recap](https://www.owkin.com/blog/what-was-built-at-the-rewiring-biology-hackathon), [HackerRank organizer page featuring the August winner](https://www.hackerrank.com/hackerrank-orchestrate-september26), [HackerRank event archive](https://www.hackerrank.com/contests).

Date precision: Owkin overlaps the earliest boundary by ending July 12; it began July 11. Agent Natives' event and awards are dated August 27; its results page has no separately stated publication date. HackerRank's organizer page is for the September edition but explicitly identifies its featured winner as the August winner; it is not evidence of a September result. The exact August award-announcement date was not established.

## What the working artifacts add

### TitleWise: a specific document job, with positive and negative controls

Its [public repository](https://github.com/patrickboxfordpartners/titlewise) describes PDF title-commitment analysis producing structured requirements, exceptions, and flags. It lists Anthropic Claude, PDF text extraction, and saved analysis history. This is evidence of a narrow workflow winning with a hosted model; it does not establish CAD competency or general visual extraction accuracy. The eight-indicator result comes from the organizer, not a reproducible benchmark inspected here.

**Our application:** present a source crop and exact dimension or load change that explains a checker failure. Include a clean control so the agent cannot win simply by rejecting everything. Do not imitate TitleWise's unrelated billing or account features.

### Climatico: make completed and refused actions equally inspectable

Its [repository](https://github.com/jin-dalrae/agent-natives-climatico) describes shared durable state across web, REST, MCP, and A2A surfaces, with receipts for accepted and flagged requests. An ingest → audit → settle chain records handoffs. The authors explicitly disclose that one demonstration script's named roles are narration labels in a sequential script, not separately running services. These are useful honesty boundaries: do not turn a dramatic demo into an unsupported swarm claim.

**Our application:** retain the initial calculation, its input revision, the later invalidation event, and the replacement result. Clicking either Slack result should expose the corresponding immutable run evidence. Adopt the visible state transition and provenance pattern; the team does not need eight agents.

### Discordance: disagreement is a useful result

The [organizer recap](https://www.owkin.com/blog/what-was-built-at-the-rewiring-biology-hackathon) describes a persistent evidence layer spanning papers, patient data, protein structures, and patents, queried from K Pro through MCP. Judges reportedly pushed ambiguity cases and valued the functional integration. I did not locate a corroborated public repository in these searches; architecture details beyond the recap remain unverified.

**Our application:** a drawing revision and Slack instruction can disagree. Show both sources, describe the conflict, and withhold a verified status until the authoritative requirement is resolved. Do not silently average values or treat latest timestamp as universal authority.

### WhatsApp router: context changes the correct action

The [winner's own account](https://www.linkedin.com/posts/activity-7491816251678289920-YeQV), republished by HackerRank, says identical message text can require different actions for recipients with different histories. He describes reproducing failures and reverting changes when evaluation regressed. The exact underlying implementation and model choice were not verified.

**Our application:** the same proposed load can pass for one part revision and fail for another. A Slack channel/thread is meaningful because it carries the relevant project history, permissions, decisions, and changed requirements. Keep numerical checks and status assignment in trusted code.

### KScope: a compact evidence card can carry the demo

The [project repository](https://github.com/bmosk54/K-scope) exposes prediction certification through an MCP tool and structured cards. It describes per-claim checks and explicit unsupported/unchecked states. Its dashboard can use mock data shaped like real output, which means a screenshot alone is not execution evidence.

**Our application:** show a small card with current revision, measured value, allowable value, named check, and clickable evidence. Label any cached run as recorded; keep a live requirement-change run as the primary proof.

## Proposed design inference for our engineering demo

These are recommendations drawn from the examples, not a claim that their organizers would award our project:

1. Start inside one existing Slack engineering thread, with a drawing/PDF and a clear question about one bounded mechanical part.
2. Extract the few quantities needed for one real calculation. Present exact source crops, units, revision, and any uncertainty.
3. Run a real tool and independent numerical or analytical checks. Publish the check record as a compact Slack card.
4. Introduce a new load, tolerance, or revision in that same thread. Immediately mark the prior result stale, showing what changed.
5. Rerun the affected calculation and show the new pass/fail result. If documents conflict, show the unresolved conflict instead.
6. Replay the same scenario through the same tool interface, including one clean control and one adversarial or ambiguous case. Report measured outcomes without suggesting they establish general engineering safety.

The differentiator is a useful result that changes correctly when workplace context changes, supported by inspectable execution evidence. Model privacy can be an additional mode once demonstrated. These winners do not establish that a local model, a particular provider, or a large agent fleet wins more often; this is a small selected sample with no causal comparison.

## Exclusions and limits

- **SANS FIND EVIL!:** highly relevant verification architecture, but excluded from the strict recent-event set. Its [official rules](https://findevil.devpost.com/rules) set the build period to April 15–June 15 and originally scheduled results around July 8. An [August 26 winners broadcast](https://www.sans.org/go/find-evil-hackathon-winners) is a later announcement, not an August build event. This is a date trap, not an extra recent hackathon.
- **NandaHack:** [organizer page](https://nandahack.up.railway.app/) says finale July 11, despite an August 4 MIT recap. Outside the requested event-date window.
- **All Things Agentic:** [official rules](https://allthingsagentichackathon.devpost.com/rules) schedule winners for October 8. Submissions are not verified winners as of September 12.
- **JigJoy concurrent-agent hackathon:** [organizer page](https://jigjoy.ai/hackathon-2026) schedules results September 13. Too early to cite winners.
- **Agent Natives Attest and Atlas News Intelligence:** explicitly runners-up, not track winners. Attest's security gates and Atlas's source-linked claims are adjacent ideas, but the award labels should remain accurate. [Results](https://www.immersivecommons.com/events/hackathon)
- No verified recent CAD-specific winning project with a sufficiently documented implementation emerged from this search. The five examples establish adjacent document, scientific evidence, workplace context, and auditability patterns—not proof of engineering-drawing extraction quality.

Searches covered official organizer sites, official Devpost pages, linked project repositories, and author reports corroborated by organizers. Public evidence was adequate for five examples across three events; prototype performance remains reported rather than reproduced.
