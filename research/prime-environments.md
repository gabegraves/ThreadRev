# Prime environments for engineering documents and CAD

Research date: 2026-09-12. Public, read-only research; no benchmark was executed, package installed, or result reproduced. Environment existence and versions below were verified against the live public Hub API, followed by source inspection. Recommendations are our judgment, not Prime endorsements.

## Decision

**Yes: Prime already hosts directly relevant document extraction, chart extraction, CAD QA, and CAD generation environments.** The best immediate combination is a small document benchmark slice, `benchcad/benchcad-qa` for visual CAD reasoning, and a custom revision-change episode whose geometry checks borrow the narrow design of `bazzouzi/cad-spec`. Use `hubert-marek/agent-diff-bench` only if testing Slack API behavior matters in that episode.

Do not equate a Hub listing with a correct or safe evaluator. Source inspection found important limitations in the extraction and CAD packages. All directly relevant Hub listings below currently declare **VERIFIERS_V0**. New custom work should target `verifiers.v1`; existing environments can be evaluated through the documented legacy bridge or an isolated, pinned v0 environment. Do not make migration of every benchmark a hackathon prerequisite. [Current framework overview](https://github.com/PrimeIntellect-ai/verifiers/blob/main/docs/overview.md), [v1 configuration and legacy bridge](https://github.com/PrimeIntellect-ai/verifiers/blob/main/skills/evaluate-environments/references/REFERENCE.md).

## Verified Hub shortlist

| Exact Hub ID and current version | Task / actual coverage | Scoring | Recommendation |
|---|---|---|---|
| [ob1/omnidocbench](https://app.primeintellect.ai/dashboard/environments/ob1/omnidocbench) `0.1.0` | Page image → Markdown; text, formulas, tables, reading order | Custom edit-distance rewards | Useful starting adapter; prefer current upstream scorer for published model comparisons. Figures are explicitly excluded. |
| [dmnsh001/OCRBench](https://app.primeintellect.ai/dashboard/environments/dmnsh001/OCRBench) `0.1.0` | OCRBench v1/v2 image questions | Lowercased answer matching after extracting `**answer**` | Cheap OCR preflight, not a faithful general substitute for upstream task-specific evaluation. |
| [13point5/chart-extraction](https://app.primeintellect.ai/dashboard/environments/13point5/chart-extraction) `0.1.9` | Line-chart image → structured series/points, using `13point5/line-ex` | Format, legend-name F1, point-count ratio, normalized point proximity | Closest ready Hub task for engineering line charts. Report numeric components separately from formatting credit. |
| [benchcad/benchcad-qa](https://app.primeintellect.ai/dashboard/environments/benchcad/benchcad-qa) `0.1.0` | Four rendered views → numeric dimension/count/ratio answer; `BenchCAD/BenchCAD`, `QA` config | Exact match for count/boolean; `min(pred,gt)/max(pred,gt)` for positive numeric values | Best low-setup CAD preflight. No CAD execution or model judge. Partial credit is not dimensional compliance. |
| [benchcad/benchcad-vision2code](https://app.primeintellect.ai/dashboard/environments/benchcad/benchcad-vision2code) `0.1.0` | Rendered mechanical part → executable CadQuery; `code_gen` config | Executed predicted vs reference STEP, normalized voxel IoU | Relevant generation benchmark, but requires independent isolation and additional absolute-dimension checks. |
| [bazzouzi/cad-spec](https://app.primeintellect.ai/dashboard/environments/bazzouzi/cad-spec) `0.1.0` | Dimensioned text template → mounting plate CadQuery; 7 train / 3 held-out specs | Geometric gates plus six checks; fractional compliance, with 0.05 execution floor | Closest minimal reference for a requirement-to-geometry checker. Very narrow; not document extraction or general CAD verification. |
| [dp-learning-rl/doc-edit](https://app.primeintellect.ai/dashboard/environments/dp-learning-rl/doc-edit) `0.1.3` | Update an authoritative fact throughout a paginated purchase order and derived prose/formulas | Deterministic re-render and line diff; stale-site recall, collateral-edit penalties | Excellent adjacent reference for requirement propagation and stale-state evaluation. Plain text, not visual/CAD. |
| [hubert-marek/agent-diff-bench](https://app.primeintellect.ai/dashboard/environments/hubert-marek/agent-diff-bench) `0.1.16` | Slack/Linear/Box/Calendar replicas; native Bash tool; service filter | Declarative assertions against actual state changes | Best verified Slack API environment; published wrapper uses remote infrastructure by default. |
| [ob1/fox](https://app.primeintellect.ai/dashboard/environments/ob1/fox) `0.1.1` | Nine fine-grained/multi-page document subtasks | Edit similarity, ROUGE-L, exact match, auxiliary NLP metrics | Optional multi-page understanding probe; lexical caption scores do not establish engineering interpretation. |

Two lower-priority matches: [ulrick-bl/ocr-vl](https://app.primeintellect.ai/dashboard/environments/ulrick-bl/ocr-vl) `0.1.0` is multilingual **web UI** OCR, not technical-document parsing; [ashantanu/cad-env](https://app.primeintellect.ai/dashboard/environments/ashantanu/cad-env) `0.1.6` advertises text-to-OpenSCAD with geometric rewards, but its implementation was not audited here.

## Source-level findings that affect the decision

### OmniDocBench wrapper

The [published source](https://api.primeintellect.ai/api/v1/environmentshub/ob1/omnidocbench/@0.1.0/inspect?path=omnidocbench.py) pins upstream helper code to commit `959155a6bd1caabc50d0b68f32b79e82f918c550`, while downloading the HF dataset without a revision pin. It separately computes text, reading-order, formula and table edit-distance rewards. `TEDS` is imported but not used in the reward. This is not the same score as the current upstream headline metric using text accuracy, table TEDS and formula CDM.

The prompt explicitly instructs the model to ignore figure content. Text scoring also excludes figure captions/footnotes and several other categories. The exposed `prompt` argument is not actually used when building the message: the implementation uses `_PROMPT`. Therefore this package cannot establish figure understanding, and the advertised prompt override needs correction for specialist models with their own extraction instructions.

The [upstream repository](https://github.com/opendatalab/OmniDocBench) was updated September 11 with TeleOCR, OvisOCR2 and Unlimited-OCR results, and links an EvalScope integration added July 27. For selecting current OCR models, pin a current upstream code/data pair and use its original metrics. Do not label results from this old custom wrapper “OmniDocBench v1.6/v1.7 leaderboard scores.”

### BenchCAD

The [QA source](https://api.primeintellect.ai/api/v1/environmentshub/benchcad/benchcad-qa/@0.1.0/inspect?path=benchcad_qa.py) packages the composite image as an inline PNG and uses only local answer parsing/scoring after loading the public HF data. This is straightforward to run against either a local image-capable endpoint or a hosted VLM. Original [BenchCAD data](https://huggingface.co/datasets/BenchCAD/BenchCAD) includes 2,400 QA items over 200 parts. Audit a sample before treating all image-only questions as identifiable: some ask about code-construction history or absolute dimensions, which a rendering alone may not uniquely determine.

The [Vision2Code source](https://api.primeintellect.ai/api/v1/environmentshub/benchcad/benchcad-vision2code/@0.1.0/inspect?path=benchcad_vision2code.py) runs model-generated Python in a subprocess with `os.environ.copy()`, then also executes ground-truth code. A timeout and temporary file are not OS isolation. Do not execute this scorer directly in the personal workspace with credentials available. Contain execution separately, pass back a STEP artifact, then run trusted measurement code outside the agent's writable environment.

Its geometric comparison centers and rescales **each** solid by its own longest dimension before voxelization. Consequently a uniformly oversized part can have the same normalized shape score; fine holes and tolerance errors can disappear at coarse resolution. IoU is useful for shape similarity, not sufficient for manufacturing acceptance. The [upstream benchmark](https://github.com/BenchCAD/BenchCAD-main) also provides CodeEdit tasks, which are more relevant to a revision scenario than reconstructing a part from a render.

### cad-spec

Inspected [environment](https://api.primeintellect.ai/api/v1/environmentshub/bazzouzi/cad-spec/@0.1.0/inspect?path=cad_spec/environment.py), [measurement](https://api.primeintellect.ai/api/v1/environmentshub/bazzouzi/cad-spec/@0.1.0/inspect?path=cad_spec/measure.py), [rubric](https://api.primeintellect.ai/api/v1/environmentshub/bazzouzi/cad-spec/@0.1.0/inspect?path=cad_spec/rubric.py), and [tasks](https://api.primeintellect.ai/api/v1/environmentshub/bazzouzi/cad-spec/@0.1.0/inspect?path=cad_spec/tasks.py).

This is a fill-in-the-numbers CadQuery template for a rectangular plate and four-hole pattern, not an open-ended engineering investigation. Gates check a single solid, through holes, nondegenerate hole count, and volume consistency. Requirements check length, width, thickness, hole count, diameter and pattern. Tolerances are fixed demonstration values: 0.5 mm overall/position and 0.2 mm hole diameter. Do not silently reuse those as product acceptance tolerances.

`build()` uses in-process `exec` on generated code; the wrapper is a `SingleTurnEnv` and does not itself establish the isolation mentioned in a source comment. A malicious or accidental script can affect the grader's process. Keep the geometry predicates as a reference, but move candidate execution across a real boundary before relying on them. The environment rebuilds the candidate to award its execution floor, so candidates may execute twice.

### Slack and stale requirements

[AgentDiff's core](https://github.com/agent-diff-bench/agent-diff) supports local Docker deployment of API replicas and deterministic before/after diffs. This is genuinely useful for repeatable messaging tests. The [published Hub wrapper](https://api.primeintellect.ai/api/v1/environmentshub/hubert-marek/agent-diff-bench/@0.1.16/inspect?path=README.md) instead defaults to `https://api.agentdiff.dev`, requires its key, and uses Prime Sandboxes. Setting only a local inference endpoint does not make the run private. Self-hosting the replicas and adapting execution placement are separate tasks.

The [doc-edit package](https://api.primeintellect.ai/api/v1/environmentshub/dp-learning-rl/doc-edit/@0.1.3/inspect?path=README.md) has the closest declared causal structure: change one source fact, recompute dependent values, find all stale occurrences, penalize collateral edits. It does not include Slack, CAD, or simulation. Neither reviewed environment supplies our whole proposed end-to-end episode.

## Better external benchmarks where a new adapter is justified

1. **[CADGenBench](https://github.com/huggingface/cadgenbench)** is unusually well aligned: engineering drawing → STEP, and existing STEP + requested change → edited STEP. It scores validity, shape, mating-interface regions and topology. However, full ground truth is private and official scoring runs on its HF Space. Local sanity checks cannot reproduce its complete official score. Its public [input dataset](https://huggingface.co/datasets/HuggingAI4Engineering/cadgenbench-data) contains 81 fixtures, 49 generation and 32 editing. For a private replay environment, reuse the open scorer with our own ground truth; do not promise offline official CADGenBench scoring. No matching Prime package was verified.
2. **[MechVQA](https://huggingface.co/datasets/XiaofengAlg/MechVQA)** provides released mechanical drawing questions covering dimensions, annotations, reasoning and consistency, with train/test splits and English/Chinese metadata. This is a closer extraction-understanding dataset than generic rendered-part QA. Use the test portion, preserve official scoring separately, and add strict numeric/units checks on a small manually reviewed subset. A ready Prime adapter was not found in the searches performed.
3. **[Prime's current MMMU-Pro implementation](https://github.com/PrimeIntellect-ai/prime-envs/tree/main/environments/multimodal/mmmu_pro)** already uses `verifiers.v1`, inline image content and deterministic option matching. It is a useful tiny implementation reference for wrapping visual questions, not our primary technical-document benchmark. It supports standard/vision variants and subject filtering; the current Hub `anshu/mmmu-pro` listing is separately marked legacy v0, so do not conflate the two implementations.

## Smallest useful evaluation for the hackathon

Recommendation, not work already performed:

- Freeze a 20–30-page slice of current upstream OmniDocBench and a 15–20-item mechanical-drawing slice with reviewed ground truth. Keep original task metrics plus exact critical-number/units accuracy; evaluate full extraction pipelines as well as their recognition models.
- Run a small BenchCAD QA sample to identify obvious visual reasoning failures. Include one deterministic geometry task with known dimensions and explicit tolerances. Treat this as model selection evidence, not general engineering certification.
- Build 5–10 replay episodes using the live tool interface. Include a revision after a pass, a revision during execution, ambiguous tolerance, missing units, wrong CAD revision, conflicting source values, failed solver, and an instruction embedded in a document. Expected state includes obsolete-result invalidation and the correct active source revision.
- Hold authoritative task inputs and checker code outside the candidate's writable runtime. Success requires the artifact to pass trusted checks and the posted status to refer to that exact artifact/revision. An eloquent message or a second model's agreement cannot produce a pass.
- Use cached public assets and a local endpoint for a private-mode run. Verify the actual network behavior of execution, scorer, telemetry and auxiliary model calls; “local model” is only one piece of that claim.

## Reproducible discovery trail

The normal Hub web pages expose little content to a text browser. The public, unauthenticated API used by [Prime CLI](https://github.com/PrimeIntellect-ai/prime-cli/blob/main/packages/prime/src/prime_cli/commands/env.py) supports searching and source inspection. No credentials were read or used.

Example read-only queries:

```sh
curl -s 'https://api.primeintellect.ai/api/v1/environmentshub/?search=cad&limit=100'
curl -s 'https://api.primeintellect.ai/api/v1/environmentshub/?search=ocr&limit=100'
curl -s 'https://api.primeintellect.ai/api/v1/environmentshub/benchcad/benchcad-qa/@0.1.0/inspect?path=benchcad_qa.py'
```

Search terms included `cad`, `ocr`, `document`, `chart`, `slack`, `mmmu`, `engineering`, `drawing`, `designqa`, and `mech`. Public search returned direct matches above; `drawing` and `designqa` returned zero. That is a bounded search result, not proof that no unindexed/private/new environment exists. The Prime community and prime-envs GitHub trees were also inspected. Package versions and implementations should be pinned before any reported run.
