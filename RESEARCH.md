# ThreadRev: research baseline and decisions

Date: 2026-09-12
Status: Research recommendations, not benchmarked results or a finalized implementation plan.
Purpose: Preserve the initial conclusions and track the follow-up research for the Agents, Everywhere hackathon.

Environment setup now lives in [SETUP.md](SETUP.md). The official starter is cloned and installed; local typechecks, 93 offline tests and a production web build pass. Live Slack/model connection remains pending user authentication/credentials. The inherited dependency audit has unresolved findings; this is not a production security sign-off.

## Current recommendation after deeper research

**Proactivity/positioning refinement:** [the domain comparison](research/proactivity-and-domain-positioning.md) separates easy-to-measure deployment ROI from a differentiated product to build. Software escalation is directly served already. For the user's prevention-first hackathon emphasis, the stronger hypothesis to test is electrical/electromechanical pre-build change preflight, conditional on authoritative artifacts and domain review—not generic PCB checks or hardware/firmware synchronization, which also have direct competitors. This is a proposal, not an approved pivot or proven market gap.

**Latest ROI recommendation (proposed, not an approved domain pivot):** start with software/platform technical escalations: proactively check prior resolutions or produce a runnable bug reproduction before senior-engineer handoff. This has the strongest expected near-term measurable return under our current access constraints, but direct competition is substantial. Hardware's strongest bounded alternative is electronics component-substitution preflight; broad mechanical/CAD simulation needs authoritative design data and calibrated models. See [software-versus-hardware comparison, Astra fit, ROI assumptions and build-versus-buy gate](research/astra-roi-recommendation.md). Earlier domain-specific demo choices below are historical alternatives until a target is selected.

**Competitive correction:** the [adversarial change-agent audit](research/change-agent-novelty-audit.md) found close direct competitors, including Throughpoint, Align, Authentise Whisper and Trace.Space. The broad Slack decision → impact → coordinated correction idea is not a defensible novelty claim. Even stale-test evidence and local deployment have substantial overlap. No competitor has been benchmarked on our fixture; product differentiation remains unvalidated.

Updated September 12 after reviewing the exact event starter/rules, current HF specialists, live Prime environment source, the supplied LeMat-Synth paper, and the user's dedicated hardware. The initial sections below are retained as history; this section supersedes their first-choice deployment recommendations.

- **Hardware:** use the user's dedicated rig: 2 × RTX PRO 6000 96 GB, 3 × RTX 3090, 512 GB DDR4, EPYC 7763. No rig access or benchmarks performed. Start Qwen3.8-27B BF16 on one 96 GB card; use independent specialist services rather than one five-GPU shard.
- **Page extraction:** first compare OvisOCR2, TeleOCR and PaddleOCR-VL-1.6. OvisOCR2 is the simplest initial end-to-end integration; TeleOCR is the newest high-scoring challenger found. Retain image regions explicitly. NVIDIA Nemotron Parse 2.0 is a strong evidence-localization/chart challenger.
- **Mechanical drawings:** MechVL-4B-RL is the best-matched released specialist found, with official full weights and a mechanical-drawing benchmark. Its judge-based, in-domain score is not engineering certification or proof it beats current frontier models. Native STEP/DXF should be parsed directly.
- **Larger local investigator:** Flash-Next has a documented RTX PRO 6000 NVFP4 + CPU embedding-offload recipe, making it feasible to test. Development-build dependencies and its conditional custom license keep it off the initial critical path. More parameters are not a demonstrated task-level upgrade.
- **LeMat-Synth:** excellent modular extraction/linking reference, not a single OCR model or CAD parser. Its Florence subplot adapter is reusable. Current CLI plot extraction and incomplete bbox propagation need attention before a private, source-grounded deployment.
- **First complete demo:** OpenAI through the official CopilotKit Slack starter on public fictional data, with real computation and a trusted checker; then run the same workflow locally. The starter uses GPT-5.6 Sol; test GPT-6 Astra if the team's account supports it. The managed channel path is not fully customer-controlled. Hermes/direct Socket Mode remains the alternative when that boundary is essential.
- **Prime:** actual document, chart and CAD environments DO exist. Source audits found legacy v0 versions, incomplete figure scoring and unsafe generated-code execution in some CAD scorers. Use bounded pinned benchmarks plus a small new revision-replay environment; do not trust listings as verification guarantees.
- **Demo core:** source-linked input → actual calculation/geometry check → trusted result card → changed Slack requirement → immediate invalidation → checked replacement. Include a clean control and an unresolved-conflict case. No fine-tuning or agent swarm initially.

Detailed, durable research:

1. [Document/CAD model shortlist and exclusions](research/document-cad-models.md)
2. [LeMat-Synth paper and source assessment](research/lemat-synth.md)
3. [GPU memory, serving recipes and larger-model tradeoffs](research/hardware-local-serving.md)
4. [Prime environments and source-level scoring/security audit](research/prime-environments.md)
5. [Recent adjacent winners, with award/date evidence](research/recent-hackathon-winners.md)
6. [Exact-event design, harness, verification and demo recommendation](research/hackathon-design.md)
7. [Slack project-management competitors and requirement-change use-case hypothesis](research/slack-project-management-market.md)
8. [Adversarial audit: is the change-agent problem already solved?](research/change-agent-novelty-audit.md)
9. [Astra ROI recommendation: software versus hardware](research/astra-roi-recommendation.md)
10. [Software workflow ROI evidence and limitations](research/engineering-agent-roi-evidence.md)
11. [Hardware workflow ROI evidence and limitations](research/hardware-agent-roi-evidence.md)

These are researched recommendations, not an implemented system or measured model ranking. The research/brainstorm process narrowed scope to one contextual engineering loop, separated hosted integration from local deployment, and kept verification outside model authority. The mechanical-versus-materials-science fixture remains a product choice; the supplied LeMat paper does not silently replace the original mechanical/CAD focus.

## Product direction

### User-confirmed principle: proactive help inside ongoing work

Clarified September 12: the agent should operate where people already work, initially Slack. It should proactively notice inconsistent messages, conflicting engineering decisions and potentially repeated work, then offer useful next actions such as research, fact-checking or launching a simulation. It must not depend on someone already knowing there is a problem and tagging the bot. Project-management synchronization is one possible follow-through, not the whole product.

Working interpretation for the next design discussion (not implemented or a blanket execution authorization):

- Bring evidence with the intervention: what changed, the relevant earlier decision/result, why it matters now, and a concrete next action.
- Compare assumptions, revisions and conditions before calling work redundant. Repeating an experiment may be justified replication or newly necessary validation.
- Be selective: scoped opted-in channels/projects, deduplicated thread-level interventions, and silence when there is no meaningful new information. A possible contradiction is not automatically an error or an authorized change.
- Separate initiative from authority. Read-only checks within approved data scope can be preauthorized; external research may disclose queries. Simulations need explicit resource/tool limits, and expensive runs or changes to authoritative records require the appropriate approval.
- Track whether an offered action actually resolves uncertainty or avoids unnecessary work. Alert volume is not a success measure. A simulated result is not a physical test or engineering sign-off.

This requirement does not undo the competitive audit: proactivity and the broad decision-correction loop are not established novelty. The next comparison should assess timely, evidence-backed intervention and useful task completion in the actual workflow, not only ticket updates.

A Slack-native engineering agent that investigates source documents, runs a bounded experiment, produces independently checked results, and invalidates affected results when requirements change. Inference can run under customer control. Slack itself remains a cloud service.

The proposed differentiator is a complete, inspectable engineering workflow with replayable evaluation. Local inference is a deployment option whose full data path must be checked; it is not sufficient by itself to establish privacy.

## Initial model shortlist

These recommendations were based on official model cards, papers, and project documentation inspected on September 12, 2026. No weights were downloaded or benchmarked on project documents. Author-reported scores from different benchmarks are not directly comparable.

| Role | Candidate | Evidence and recommendation | Limitation |
|---|---|---|---|
| Investigator and visual reasoning | [Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B) | August release; native vision and agent capabilities. Initial first choice over Qwen3.6-27B. | Some reported evaluations use custom harnesses, revised tasks, or internal datasets; engineering reliability remains untested. |
| General document extraction | [PaddleOCR-VL-1.6](https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6) | Approximately 1B; text, formulas, tables, charts, and text spotting. Authors report 96.33 on OmniDocBench v1.6. | Full page parsing requires its pipeline; standalone Transformers example handles elements. Mac deployment needs separate validation. |
| Mac extraction baseline | [LightOnOCR-2-1B and bbox variants](https://huggingface.co/lightonai/LightOnOCR-2-1B) | Scientific PDFs, LaTeX, tables, scans, and image bounding boxes. Official example supports MPS. | Bounding boxes preserve figures but do not establish their meaning. |
| Small OCR challenger | [MonkeyOCRv2-B-Parsing](https://huggingface.co/zenosai/MonkeyOCRv2-B-Parsing) | Approximately 0.7B in the paper; July release. Authors report 83.3 on MDPBench across 17 languages and digital/photographed documents. | Different evaluation from Paddle; test exact checkpoint and pipeline on our pages. |
| Figures and structured graphics | [dots.mocr / dots.mocr-svg](https://huggingface.co/dots-studio/dots.mocr) | Approximately 3B; parsing plus scientific graphics/chart conversion to SVG. | Authors acknowledge graphics robustness limitations. SVG reconstruction is not authoritative CAD geometry. |

Other candidates examined:

- [Chandra OCR 2](https://huggingface.co/datalab-to/chandra-ocr-2): difficult-layout contender; weights have modified OpenRAIL commercial and competitive-use restrictions.
- [MinerU](https://github.com/opendatalab/MinerU): complete parsing pipeline; current documentation identifies MinerU2.5-Pro-2604-1.2B as its upgraded main VLM. Its [custom Apache-based license](https://github.com/opendatalab/MinerU/blob/master/LICENSE.md) adds commercial thresholds and online-service attribution obligations. Compare the whole pipeline, not just model weights.
- [Jina-OCR-v1 paper](https://arxiv.org/abs/2609.03181): September paper verified; linked model weights were inaccessible during the initial search. Do not depend on it until access and deployment are verified.
- [Florence-2 engineering-drawing fine-tuning research](https://arxiv.org/abs/2411.03707): evidence that specialization can improve GD&T extraction. A maintained downloadable checkpoint with suitable coverage was not verified.

Do not fine-tune initially. First identify recurring failures on a labeled sample, such as symbol recognition or attaching tolerances to the wrong feature.

## Document and CAD handling

| Input | Proposed treatment |
|---|---|
| Report or datasheet PDF | Extract text, equations, tables, and figure crops with source locations. |
| Scanned engineering drawing | Use cropped visual evidence for dimensions, symbols, notes, and relationships; flag ambiguity. |
| Native STEP or DXF | Read geometry and available metadata directly; use the agent to investigate and explain. |

[Open Cascade XDE](https://github.com/Open-Cascade-SAS/OCCT/wiki/xde) supports STEP assemblies and available dimensions, tolerances, and datums. [ezdxf](https://ezdxf.readthedocs.io/en/stable/dxfentities/dimension.html) exposes DXF entities and dimension information, with limitations around dimensional constraints. Actual metadata depends on the source file. Do not infer missing tolerances from nominal geometry.

## Initial harness recommendation

- Serving: MLX with vision support on Mac; vLLM on NVIDIA. [Qwen MLX conversion](https://huggingface.co/mlx-community/Qwen3.8-27B-8bit) and [official Qwen serving instructions](https://huggingface.co/Qwen/Qwen3.8-27B) exist. End-to-end image and tool-call compatibility is untested.
- Slack agent: [Hermes Agent](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/slack), based on documented Socket Mode, threads, file support, [local endpoints](https://hermes-agent.nousresearch.com/docs/integrations/providers), and extensible tools. Initial fastest-path recommendation, subject to hackathon-specific research.
- Alternative orchestration: [LangGraph persistence and interrupts](https://docs.langchain.com/oss/python/langgraph/persistence) if durable approval/cancellation/recovery dominates. Avoid stacking two orchestrators before a need is demonstrated.
- Evaluation: [Prime verifiers v1](https://www.primeintellect.ai/blog/verifiers-v1), which separates tasksets, harnesses, and runtimes, including local subprocess and Docker. Announcement describes v1 as a preview and legacy as frozen; pin a tested version.

Private mode must cover auxiliary models, fallback, retrieval, tools, telemetry, and posting permissions. [Hermes configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration) exposes separate auxiliary and fallback settings. Enforce network restrictions as well as configuration. Keep checker rules and authoritative result records outside the agent's writable workspace.

## Proposed verification contract

“Verified” means passed named checks against identified inputs. It does not mean unrestricted engineering approval.

1. Evidence validity: critical inputs retain source revision, page/crop or CAD entity, original value, and units. Missing/conflicting values prevent a verified result.
2. Execution validity: record actual inputs, solver version, outputs, and completion status. Requirement changes invalidate affected results, including changes arriving during execution.
3. Engineering validity: trusted code checks units, constraints, boundary conditions, and relevant physical invariants. Use independently implemented analytical comparisons and convergence checks where applicable.
4. Publication validity: application code derives verification status from the checker record. The agent cannot award itself a pass. Human approval is distinct.

A second model may critique evidence or reasoning; agreement is not a numerical acceptance criterion. Repeating the same solver establishes repeatability, not independent correctness. Prime provides evaluation infrastructure, not our domain-specific correctness checks.

## Initial proposed demo and evaluation

Hardware observed locally: Apple Silicon, 64 GiB unified memory. This is a provisional baseline, not a confirmed deployment choice; a question about available dedicated GPU hardware remains unanswered.

Initial Mac candidate: Qwen3.8-27B MLX + LightOnOCR-2 bbox + Hermes + one bounded calculation with trusted checks + local verifiers taskset.

NVIDIA comparison: prioritize PaddleOCR-VL-1.6 versus MonkeyOCRv2 for extraction. Add dots.mocr only if figure interpretation is the demonstrated failure.

Test approximately 20 labeled engineering pages and 10 replay scenarios before choosing a winner. Include changed loads, stale revisions, missing units, ambiguous tolerances, failed simulations, and instructions embedded in documents. Measure critical-field accuracy, correct abstention, invalidation, completed checked tasks, latency, and peak memory. This is a proposed test, not completed validation.

## Follow-up research log

- Resolved: the supplied project is [LeMat-Synth](https://arxiv.org/abs/2510.26824); see its detailed assessment above.
- Search Hugging Face more deeply for technical-document extraction, CAD understanding, specialized models, datasets, and runnable evaluations.
- Determine whether Prime's live Hub contains a suitable ready-made environment, rather than assuming the framework alone solves the task.
- Research the exact hackathon: Agents, Everywhere: Bots, Channels, & More — Global Hackathon, September 12, 2026.
- Research verified winners of adjacent hackathons within the previous two months (July 12–September 12, 2026); distinguish winners from submissions and finalists.
- Decide whether the first demo should use OpenAI or another hosted model, with local inference as a comparison or later milestone.

Initial event sources found, not yet fully analyzed:

- [Organizer event](https://aitinkerers.org/hackathons/global/agents-everywhere)
- [CopilotKit event starter](https://github.com/CopilotKit/agents-everywhere-starter-kit)
- [AI Tinkerers announcement](https://www.linkedin.com/posts/ai-tinkerers_openai-x-ai-tinkerers-agents-everywhere-activity-7500318074558889984-gzRP)

The requested research is now captured in the linked reports and the current recommendation at the top. Remaining uncertainties are the exact local-city deadline, representative project documents, rig runtime compatibility, API account access, measured task performance, and the final mechanical-versus-materials fixture. Preserve the distinction between researched capability, proposed design, and tested behavior.
