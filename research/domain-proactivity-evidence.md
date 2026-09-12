# Electrical and materials proactivity: competitor evidence

Researched 2026-09-12. Official documentation/product pages; no product runs performed. This is a capability audit, not a market-share census. Missing documentation does not prove a missing feature.

## Bottom line

Electrical engineering and materials R&D are not empty AI markets. Their incumbent products already contain meaningful domain state, engineering checks, experiment recommendation engines and increasingly agent-accessible actions. The narrower opportunity to test is **recognizing consequential informal decisions before the authoritative engineering record changes**, then using existing tools to establish the impact. An ambient Slack trigger is a distribution/workflow layer, not proof of unique technical capability.

## Electrical engineering

### Flux: genuine context-aware design checking, not merely chat

Current [AI Design Review documentation](https://docs.flux.ai/tutorials/ai-design-reviews) lists resistor power, pull-up/pull-down configuration, capacitor voltage and parts-availability checks. AI reviews are individually manually triggered to control credit consumption; design-rule checks run automatically with layout updates. Engineers inspect warnings, change the design and rerun checks. This directly overlaps a proposed “check the electrical consequences of a change” agent, although the documented initiating workflow is inside Flux, not ambient Slack.

Its [MCP documentation](https://docs.flux.ai/reference/flux-mcp-server) goes further: an external client reads live PCB components/nets/pins, generates firmware mappings, detects an incorrectly connected peripheral, asks the Flux agent to change the schematic, rereads the revision and updates firmware. Access scopes distinguish reads, writes and paid agent runs. The docs require review of generated changes and real-hardware firmware validation. This is a documented cross-tool engineering loop, not merely roadmap language; execution quality was not tested. No reviewed source establishes an out-of-box Slack-message-to-independent-validation workflow. Flux could also be an execution integration for us rather than something to rebuild.

### Altium: structured change propagation already exists

[Requirements & Systems Portal scripting documentation](https://www.altium.com/documentation/altium-365/requirements-systems-portal/scripting-module) describes Python/Octave execution, saved runs and automations that rerun calculations when defined inputs change. A provided automation example adds warnings to child requirements when the parent changes. These are configurable platform capabilities/examples, not an LLM independently understanding Slack. Important availability caveat: this page is dated September 30, 2025 and currently sits under **Requirements & Systems Portal (Legacy)** in navigation; do not assume identical capabilities or entitlements in the replacement Requirements Portal. Nonetheless, “changed input triggers affected calculation and warning” is not new as a category.

### CELUS: requirements-to-electronics workflow

[Design Studio documentation](https://www.celus.io/knowledge/step-1-design-studio-welcome-screen) describes a Design Assistant accepting natural-language goals or uploaded sketches and creating a modular architecture; the platform exports CAD deliverables and a PDF summary. This is an available documented product workflow, not evidence that all generated electronics are physically correct. The observed trigger is a user starting/designing a project. No reviewed evidence demonstrates continuous Slack-decision monitoring, independent verification of arbitrary existing designs, or a closed-loop qualification guarantee.

## Materials and chemical R&D

### Uncountable: prior-work reuse plus actual next-experiment tooling

[ML documentation, March 11, 2026](https://www.support.uncountable.com/knowledge-base/uncountable-ai-for-experimental-design/) describes models trained on historical formulation/process/test data, diagnostics, constrained next-experiment recommendations and exploration/exploitation. This directly serves reducing uninformative experimental repetitions; it is not a generic LLM guessing properties.

[Generative AI documentation, August 12, 2026](https://www.support.uncountable.com/knowledge-base/uncountable-gen-ai/) documents Bodie running analysis/suggestion jobs, finding indexed files, drafting notebooks and making platform edits. It also documents alternative-ingredient research, PDF parsing and MCP access through external AI clients to query data, create experiments and update formulations. These features are opt-in. The reviewed docs demonstrate executable in-platform/external-client workflows, not an ambient Slack watcher. We must not pitch “find prior experiments and suggest the next one” as unserved, nor assume a stronger general model replaces these structured records and predictive models.

### Albert Invent: strong institutional-knowledge overlap, documentation conflict

[Ask Albert help, July 2, 2026](https://support.albertinvent.com/en/articles/9967554) describes contextual chat search over notebooks, raw materials, formulations, property results and batch tasks with cited records. It explicitly lists limitations including exact stored-unit matching, a top-100 relevant-record window and no outside-Albert search. In contrast, the current [Ask Albert product page](https://www.albertinvent.com/ask-albert) advertises CAS/SharePoint connections, reports, analysis, visualization and patent review. Treat the discrepancy as a version/availability question for a product demo, not proof either describes every deployment. Both show direct overlap with institutional knowledge and reduced repeated research. Neither reviewed source establishes ambient Slack inference and independently checked correction.

### Citrine: mature domain optimization, not Slack coordination

The [Citrine platform description](https://citrine.io/why-citrine/) documents sequential-learning experiment recommendations, reformulation alternatives for supply constraints, prediction uncertainty, and combining expert formulas with data-driven models. It describes reuse across teams and connecting materials to process/measurement provenance through GEMD. These are offered product capabilities, with no independent performance replication here. Scenario: a target property or ingredient availability changes, and scientists rank replacement formulations/experiments under constraints. The reviewed source does not establish autonomous Slack listening or permissioned cross-system corrections. It does establish that intelligent experiment selection and scientific-memory reuse are established competitors, not untouched whitespace.

## What actually separates the domains (inference)

- Electrical has relatively discrete part numbers, netlists, pin mappings, datasheet constraints and useful deterministic checks. Context still includes layout, transients, thermal conditions and exact variants; a passing text/datasheet check is not qualification.
- Materials centers on composition, processing, measurement protocol, batch provenance and uncertainty. A repeated experiment may be a necessary replicate or a changed-process test. Useful intervention requires distinguishing these, not semantic deduplication.
- Domain products own authoritative structured state and specialized evaluators. A new Slack layer must earn its keep by catching consequential intent before that state is updated, selecting the correct existing evaluator and coordinating a scoped correction.
- A reasonable demo is “new message → explicit changed assumption → affected evidence → bounded check → source-backed intervention.” This is our proposed implementation boundary, not a demonstrated competitor gap or a claim that Astra alone guarantees correctness.
