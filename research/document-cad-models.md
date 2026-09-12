# Technical-document and CAD models: deeper shortlist

Research date: September 12, 2026. Source inspection only: no model inference, rig connection, or performance reproduction. This updates the initial Mac-focused shortlist in `../RESEARCH.md`.

## Decision

Use specialized extraction as a tool of one investigator, not a collection of competing autonomous agents. Our first local bakeoff should be **OvisOCR2 vs TeleOCR vs PaddleOCR-VL-1.6**, with **MechVL-4B-RL** tested specifically on mechanical-drawing questions and **Qwen3.8-27B** as the investigator. NVIDIA Nemotron Parse 2.0 is the next challenger when text bounding boxes and chart data are important. Native CAD goes through a geometry reader, not OCR.

“Best” currently means the strongest evidence-backed candidates to test, not a measured winner on our documents. General OCR scores cannot settle dimension-to-feature attachment, tolerance interpretation, chart reading, or complete engineering task reliability.

The user's dedicated rig has two RTX PRO 6000 GPUs with 96 GB each, three RTX 3090s, 512 GB DDR4 RAM and an EPYC 7763 CPU. This replaces the observed 64 GiB Mac as the intended compute baseline. No remote access was attempted. Start with separate services on separate GPUs, not a heterogeneous five-GPU model shard.

## Page extraction shortlist

| Candidate / official artifact | What is genuinely useful | Caveat and priority |
|---|---|---|
| [OvisOCR2](https://huggingface.co/ATH-MaaS/OvisOCR2), ~0.8B, Apache-2.0 | July technical report; end-to-end page to Markdown, LaTeX, HTML tables and visual-region crop coordinates. Author score 96.58 on OmniDocBench v1.6. Official vLLM 0.22.1 recipe. | **First integration baseline:** small, single model, direct output. Its sample parser removes image tags by default; use `filter_imgtags=False` to retain figures. Figure boxes are not text-span boxes or figure understanding. |
| [TeleOCR](https://huggingface.co/StarDoc-AI/TeleOCR), ~1.2B, Apache-2.0 | Released August 17 as NaviDC-OCR; renamed September 10. Layout/content extraction with geometric handling for photographed/warped pages. Author score 96.87 on OmniDocBench v1.6. | **First accuracy challenger**, especially camera captures and tables. Includes structured layout/table postprocessing; compare the complete parsing path. Do not interpret training-time self-verification as a reliable runtime checker. |
| [PaddleOCR-VL-1.6](https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6), ~0.9B, Apache-2.0 | Full pipeline handles layout, text, equations, tables, charts and text spotting; author score 96.33 on OmniDocBench v1.6. | **Full-pipeline reference.** Standalone Transformers element recognition is not the full document system. More VRAM does not eliminate integration differences. |
| [NVIDIA Nemotron Parse 2.0](https://huggingface.co/nvidia/NVIDIA-Nemotron-Parse-2.0), <1B | August 3 release; text, semantic classes, reading order and bounding boxes; chart-aware output and chart-to-table representation. NVIDIA deployment documentation. | **Evidence-localization challenger.** OpenMDW-1.1 weights/config; tokenizer CC-BY-4.0. Some documented vLLM versions need a tied-embedding patch. Use the model's postprocessor and original-image coordinate mapping. |
| [Qianfan-OCR](https://huggingface.co/baidu/Qianfan-OCR), 4B language backbone, Apache-2.0 | Document parsing, chart questions and key-information extraction; optional Layout-as-Thought emits layout before the answer. | Useful unified document-understanding challenger, not necessarily the cleanest transcription baseline. Its OmniDocBench v1.5 and chart scores are different tasks from the v1.6 table above. |
| [MonkeyOCRv2-B-Parsing](https://huggingface.co/zenosai/MonkeyOCRv2-B-Parsing), ~0.7B in paper, Apache-2.0 | July release; multilingual and photographed documents; [pipeline](https://github.com/Yuliang-Liu/MonkeyOCRv2) offers deployment options. | Keep as a second-round small-model contender; MDPBench is not directly comparable with OmniDocBench. |
| [LightOnOCR-2-1B](https://huggingface.co/lightonai/LightOnOCR-2-1B), Apache-2.0 | Scientific text/equations and bbox variants; official Apple MPS example. | Useful Mac fallback, no longer the hardware-driven first choice. Its olmOCR score excludes a category; avoid unqualified comparison with olmOCR2. |

The [upstream OmniDocBench repository](https://github.com/opendatalab/OmniDocBench) added TeleOCR/OvisOCR2/Unlimited-OCR results September 11. Its changelog mentions a v1.7 update while the comparison table is captioned `v1.6_full`. Pin code, dataset revision, subset and exact metric. Do not silently relabel every current result “v1.7.” The three scores above are reported v1.6 results, not our measurements; differences under one point do not prove superiority on CAD drawings.

## The strongest mechanical-drawing specialist found

**[XiaofengAlg/MechVL-4B-RL](https://huggingface.co/XiaofengAlg/MechVL-4B-RL)** is substantially better matched than a generically named blueprint checkpoint. Full weights, Apache-2.0, official inference code, SFT and RL checkpoints are available. It specializes Qwen3-VL-4B in drawing recognition, cross-view reasoning and annotation/constraint questions. Its author-reported MechVQA total is 84.85 versus 76.36 for the SFT checkpoint.

The [paper](https://arxiv.org/html/2605.30794v1) and [dataset](https://huggingface.co/datasets/XiaofengAlg/MechVQA) provide important qualifications:

- Approximately 3,281 drawings and 20,778 questions; split at drawing-group level. This is an in-domain trained specialist, not zero-shot generalization.
- Evaluation uses multiple model judges. The total is not strict engineering pass/fail or exact numerical compliance.
- Sources include educational/professional public drawings, not a representative factory archive. Dense, degraded or company-specific drawings may behave differently.
- It does not reconstruct STEP/IGES. The reported baselines predate current Qwen3.8 and GPT-6; its table cannot establish superiority over those models.

**Use:** ask bounded questions about the original full drawing plus relevant high-resolution crop, return candidate facts, and check them against sources/geometry. Compare with Qwen3.8-27B on an unseen, manually labeled sample. Never let the specialist's answer serve as its own acceptance label.

**[eDOCr2](https://github.com/javvi51/edocr2)** is an older but more narrowly targeted alternative for dimension and GD&T recognition. Its [release](https://github.com/javvi51/edocr2/releases) includes separate Keras recognizers for dimensions and geometric tolerances. The [2025 paper](https://www.mdpi.com/2075-1702/13/3/254) and runnable drawing tests make it worth probing if glyph transcription is the main failure. It is not a general investigator or universal drawing interpreter; age alone is not a reason to discard domain-specific OCR.

## CAD is three different jobs

| Job | Appropriate path | What must not be inferred |
|---|---|---|
| Read STEP/DXF geometry and existing metadata | [Open Cascade XDE](https://github.com/Open-Cascade-SAS/OCCT/wiki/xde), [ezdxf dimension entities](https://ezdxf.readthedocs.io/en/stable/dxfentities/dimension.html) | Nominal geometry does not supply missing manufacturing tolerances or original feature history. |
| Understand dimensions/notes on a raster drawing | MechVL + OCR + source crops + domain checks | Similar-looking glyphs, nearby arrows and default units cannot be guessed into authoritative facts. |
| Reconstruct editable CAD from images | A generation model/harness, executed in isolation and measured afterward | Executable code or high normalized shape overlap does not establish absolute scale, fit, material or strength. |

### Verified generation/reconstruction candidates

- **[Autodesk Zero-to-CAD-Qwen3-VL-2B](https://huggingface.co/ADSKAILab/Zero-To-CAD-Qwen3-VL-2B)**: actual Apache-2.0 weights; eight clean rendered views to CadQuery. Authors report 82.1% executable outputs / 0.747 IoU in-domain, dropping to 61.0% / 0.377 on ABC. This is useful as a compact reconstruction specialist, not a dimensioned-paper parser. Its aligned/coarse voxel metric does not certify tolerances.
- **[Ortho2CAD](https://github.com/AdityaJoglekar/Ortho2CAD)**: July research specifically on orthographic drawings, with [released drawing data](https://huggingface.co/datasets/AdityaJoglekar/Ortho2CAD_Orthographic_Drawings), CadQuery inference, and geometry-based refinement. More relevant input modality than clean multi-view renders. The authors' GPT-5.5 refinement result establishes the value of execution feedback, not universal dimensional correctness. Official author model listings and GitHub releases were empty when checked; a community GGUF is not a verified upstream checkpoint.
- **[CADReasoner](https://huggingface.co/kulibinai/cadreasoner)**: Apache-2.0 artifact and [iterative edit harness](https://github.com/zhemdi/CADReasoner), oriented toward reverse engineering meshes/scans using target/current render discrepancies. Not the first tool for tolerances or scientific figures.

For our first demo, prefer **inspect/edit a known simple part** over arbitrary image-to-CAD reconstruction. That produces a measurable engineering result with fewer unconstrained assumptions.

## Other rabbit-hole findings and exclusions

| Candidate | Why keep or exclude |
|---|---|
| [dots.mocr / SVG](https://huggingface.co/dots-studio/dots.mocr) | MIT; structured scientific graphics are interesting. Preserve original figures; generated SVG is not authoritative geometry. Use only if figures are the demonstrated gap. |
| [Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR) | MIT, ~3B; June release and July update; multipage extraction with sliding-window design. Useful for table continuity; “unlimited” is not a guarantee that every serving configuration supports arbitrary PDFs. |
| [Nanonets-OCR2-3B](https://huggingface.co/nanonets/Nanonets-OCR2-3B) | Image descriptions and flowchart-to-Mermaid can enrich retrieval. Generated descriptions need source checks. Do not confuse open weights with hosted OCR2 Plus; commercial licensing was not fully resolved in this inspection. |
| [olmOCR-2](https://huggingface.co/allenai/olmOCR-2-7B-1025) | Its [unit-test-driven training/evaluation](https://allenai.org/blog/olmocr-2) is a useful verification design reference. Not the newest small parser leader or a CAD system. |
| [Docling](https://github.com/docling-project/docling) | Useful document object model and native extraction/layout plumbing. Consider it if we need an ingestion framework; do not combine multiple frameworks merely to invoke one parser. |
| [Chandra OCR 2](https://huggingface.co/datalab-to/chandra-ocr-2) | Restrictive weight terms make it a less straightforward default for an enterprise product, despite useful parsing capability. |
| [MinerU](https://github.com/opendatalab/MinerU) | Strong full pipeline; upgraded main model is MinerU2.5-Pro-2604-1.2B. Current custom license adds conditions; do not assume the repository's historical license still applies. |
| [Jina-OCR-v1 paper](https://arxiv.org/abs/2609.03181) | September paper found, linked weights inaccessible during inspection. No critical-path dependency until access/deployment is verified. |
| [GreenMap Russian blueprint extractor](https://huggingface.co/GreenMap/qwen3-vl-2b-ru-blueprint-extractor) | Narrow wall-type/length extraction from highlighted construction crops; authors explicitly describe it as very raw and not recommended for use. Not our mechanical engineering default. |
| [Bella CAD checkpoint](https://huggingface.co/StoryGold/bella-v1.0-34b) | Sparse evidence; image-to-CadQuery despite extraction framing. Insufficient justification over official specialists. |

Search methodology: official papers/repositories plus public Hugging Face model metadata and cards; keyword searches included OCR, chart, engineering, drawing, CAD and specialist names. Download counts, recent re-uploads, quantizations and suggestive names were not treated as evidence of accuracy. This is a deep bounded search, not proof that every newly uploaded/private checkpoint was covered.

## Proposed selection test — not yet run

1. Freeze 20–30 representative pages: scientific equations, dense tables, figure captions, photographed documents and mechanical drawings. Include original images and source revisions.
2. Run OvisOCR2, TeleOCR and Paddle's full pipeline under their documented settings. Retain all figures and record settings, versions, latency and peak VRAM.
3. For drawing questions, compare MechVL-4B-RL with Qwen3.8-27B and the hosted baseline. Keep MechVQA's original metric separate from exact value/unit/feature attachment checks.
4. Review every critical number used by the demo. Wrong units, wrong feature, wrong revision and unsupported confidence count as failures even when Markdown looks excellent.
5. Run 5–10 requirement-change replays. Measure checked completion, proper abstention, stale-result invalidation, and latency. No fine-tuning until failures reveal a repeatable, trainable gap.

See [Prime source audit](prime-environments.md) for runnable environments and unsafe scorer arrangements; see [hackathon design](hackathon-design.md) for the actual product and demo recommendation.
