# Slack decision-change competitors: adversarial audit

Checked 2026-09-12. Question: has an agent that catches Slack decisions invalidating an existing plan and coordinates the correction already been solved? This note covers Slack-native startups and recent hackathon projects; parallel research covers Align and established PM/engineering platforms.

## Verdict

The broad concept is demonstrably not new. Multiple products directly target decision contradictions, supersession, stale instructions, and correction workflows. Public evidence does **not** establish that one product reliably closes every desired loop in production. That is a reliability/coverage uncertainty, not evidence of an empty market. Do not dismiss broad competitors by adding CAD simulation requirements absent from the quoted problem.

## Strongest overlaps

### 1. Lock — concrete open-source decision/conflict workflow

[Official repository](https://github.com/uselock/lock) documents Slack thread extraction, typed decisions, conflict and supersession detection, a pre-commit human warning, lineage, coding-agent checks, and advisory PR comments. MIT code plus self-hosting instructions are available. Jira/Figma references can be attached. This is a substantive partial solution, not merely a ticket notification integration. Its public workflow does not establish automatic edits to the affected Jira requirements/task descriptions or tracking accepted remediation to completion.

I inspected [conflict-service.ts](https://github.com/uselock/lock/blob/main/packages/core/src/services/conflict-service.ts): vector search or text-similarity candidate retrieval, followed by LLM relationship classification. It distinguishes potential conflict and supersession. Candidate limits and thresholds mean this is not proof of universal conflict recall; no runtime benchmark was performed.

I also inspected [Slack add-link.ts](https://github.com/uselock/lock/blob/main/packages/slack/src/actions/add-link.ts): Add Jira/Add Linear opens a modal and records a reference on the Lock record. It does not update that external ticket. [confirm-commit.ts](https://github.com/uselock/lock/blob/main/packages/slack/src/actions/confirm-commit.ts) records the decision and replaces the Slack preview with its result.

Self-hosted application does not imply local inference: the documented providers are Anthropic/OpenAI. [README](https://github.com/uselock/lock)

### 2. Setlyr — almost exact proposed loop, early-stage evidence

[Official site](https://setlyr.ai/) describes Slack/doc/system-event decision capture; structured ownership, evidence, constraints and confidence; deterministic contradiction/drift/reversal checks; role-aware routing; approval/audit; a decision-validity endpoint for agents. It explicitly says the endpoint is **not a runtime access gate**. Consequential status changes and external briefings require logged human approval.

Important availability qualifier: the same site says it is seeking design partners. The offered initial pilot is a founder session tracing two or three decisions, with no integration required. Thus the precise problem is being pursued commercially, but the public page is not proof of deployed end-to-end task-system correction. It also says capture is explicit, not ambient surveillance.

### 3. PushContext — direct live contradiction detection, correction not established

[Official site](https://pushcontext.com/) markets proactive decision context pushed into live Slack discussions, prior-decision recall, decision graph conflict/evolution tracking, and Slack/Jira/GitHub/Google Workspace integrations. It lists Confluence, Notion, Linear and Asana as coming soon. VPC/on-prem options are advertised. Its numerical latency/confidence/savings figures were not reproduced.

The [context-graph article](https://pushcontext.com/resources/blog/how-to-build-a-context-graph) describes decision traces containing assumptions, evidence, follow-up work, affected entities and lineage; example relationships include supersedes/refines/depends_on. It discusses exceptions that remain until parity is verified. This substantially overlaps the evidence/dependency model. I did not find public docs showing assignment approval, corrective tracker writeback, or closure verification.

### 4. Nairi — correction can already follow a Slack contradiction

[Company-brain use case](https://nairi.ai/use-cases/company-brain) explicitly describes an engineer correcting a stale wiki answer in Slack, then the agent opening a wiki PR or maintenance ticket. It connects knowledge sources and Jira/Linear/GitHub/Slack action tools via MCP, cites conflicting docs, and asks confirmation before writes by default. It also supports rules describing ownership/escalation and scheduled jobs.

This is a direct substitute for a user-invoked Slack decision-to-document-correction flow. The described trigger is an ask-channel conversation/user correction, not demonstrated automatic impact analysis across all affected plans. A self-hosted daemon and open-weight provider option are advertised; Slack delivery still routes through Nairi's backend. The page is vendor product documentation, not our tested integration.

### 5. Enji — monitoring plus configurable corrective workflow

[PM Agent](https://enji.ai/features/pm-agent/) connects Jira/Slack/GitHub/meetings, maintains project-specific context, resolves identities, and advertises continuous Signals that monitor user-defined risk conditions. Example: notice promised partner documentation has not arrived and notify the responsible party. It advertises on-prem/local-model operation.

[Process Builder](https://enji.ai/features/process-builder/) executes named multi-step flows: create Jira ticket, write description, notify Slack, assign to sprint and link to Epic. This establishes coordinated action capabilities, but the inspected pages do not demonstrate generic semantic detection of a Slack decision contradicting an existing approved requirement followed by automatic invocation of the proper corrective flow.

### 6. RhinoAgents — broad marketed scope/approval/writeback overlap

[AI Project Manager](https://www.rhinoagents.com/ai-employees/ai-project-manager) advertises reading Slack discussions for scope creep/unclear requirements, identifying downstream blockers, updating Jira/Asana/Linear, proposing reassignment or sprint changes, one-click Slack approvals, and modification audit trails. This covers much of the broad proposed outcome at a marketing level. The page's mock interactions and numerical claims (early-warning accuracy/latency/delivery probabilities) are not independently verified. No source-level or live-product audit was performed, so do not call this a proven complete solution.

## Recent adjacent hackathon overlap

### Slack Compass — July 12, 2026

[Author's Devpost submission](https://devpost.com/software/slack-compass-brqylp) describes missing-stakeholder detection, past-decision validity and supersession, REUSE/REOPEN when assumptions change, cross-team contradictions with evidence, and an alert-to-resolve watch lifecycle. Crucial limitation disclosed by the author: Jira/GitHub/CRM lifecycle integration is future work; current checks use chat evidence. [Public source repository exists](https://github.com/nag-gude/slack-compass); I opened its repository but did not execute or audit all code. This is a recent competing hackathon concept, not evidence of production completion or a winner.

### Verdict Memory — June 3, 2026

[Author's Devpost submission](https://devpost.com/software/verdict-memory) captures owners/reasoning/source threads, warns when a discussion reverses or reopens decisions, and uses confirmation cards. However, the author explicitly lists live Slack MCP wiring so cards/alerts post in real channels as future work. It is prototype evidence, not a complete Slack integration. The linked GitHub URL failed to open in the research browser.

### SyncSpace — July 31, 2026

[Author's Devpost submission](https://devpost.com/software/hackalakaboomboom) describes an Alignment Radar that catches conflicting dates, cited insight store, role-aware briefings and decision flow. Live Slack/Discord connectors and suggested reconciliation are explicitly future work. This shows recent concept-level overlap, not a complete service; no winner claim verified.

## What is and is not justified

- Justified: there are existing partial solutions and direct commercial competitors for the exact semantic problem, including publicly inspectable implementation.
- Not justified: “Nobody catches when a Slack decision invalidates the plan,” “local is unique,” or “adding approval makes it new.”
- Not established by this audit: a production-ready, broadly reliable system that detects the right changed decision, identifies every affected artifact, obtains legitimate approval/owner acceptance, performs corrections, and confirms closure against authoritative evidence.
- A further claim of opportunity needs a narrow customer workflow and comparative test. Do not redefine “completely solved” as flawless; no real product meets that standard.

No signup, purchase, installation, contact, or external write performed. Research notes only.
