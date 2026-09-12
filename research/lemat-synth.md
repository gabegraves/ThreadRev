# LeMat-Synth: extraction design assessment

Researched September 12, 2026. Paper: [arXiv:2510.26824v2](https://arxiv.org/abs/2510.26824), revised August 30, 2026. Inspected main text, relevant supplementary methods/benchmarks in the full 93-page PDF, official documentation, HF artifacts, and parser source. Code observations below refer to commit [`e4bacbcbac084544ca68d48242336c2e36f6ee15`](https://github.com/LeMaterial/lematerial-llm-synthesis/tree/e4bacbcbac084544ca68d48242336c2e36f6ee15), dated September 10. Nothing was installed or benchmarked.

## Verdict

This is a strong architectural precedent for our technical-document layer: separate document parsing, figure digitization, entity linking, and validation. It is a modular application and dataset, not one general-purpose extraction model. Its existing chemistry schema is not a CAD representation. Reuse the relevant components and evidence discipline; benchmark the extractor choices on our documents before adopting the full package.

## What actually ships

The [Apache-2.0 parser repository](https://github.com/LeMaterial/lematerial-llm-synthesis) exposes a Python library, CLI, notebooks, configurable extractors, and case studies. Synthesis outputs associate materials, procedural steps, conditions, performance curves, and judge scores. The Hugging Face [LeMat-Synth dataset](https://huggingface.co/datasets/LeMaterial/LeMat-Synth) is gated: viewing its contents requires accepting access conditions. A linked [paper corpus](https://huggingface.co/datasets/LeMaterial/LeMat-Synth-Papers) supplies source material. Neither is a model checkpoint.

The actual specialized checkpoint is [`amayuelas/plot-visualization-florence-2-lora-32`](https://huggingface.co/amayuelas/plot-visualization-florence-2-lora-32): a rank-32 adapter over `microsoft/Florence-2-base-ft`, trained to detect subplots and label them quantitative or qualitative. Its model card provides CUDA inference and an MIT license label. It finds regions; a separate VLM reads numerical curves. It does not recover STEP topology, CAD constraints, dimensions, or tolerances.

## Paper results and their limits

The paper evaluates text extraction on 80 expert-annotated procedures from 36 papers. Humans ranked Sonnet 4.6 highest (3.67/5); Qwen3.5-397B-A17B scored 3.25 and was deployed for cost. The best judge's ICC was only 0.276, with wide uncertainty. [Paper §§2.5–3.1, supplement S3](https://arxiv.org/pdf/2510.26824v2)

Thermocatalysis, 23 papers, LLM-matched series:

| VLM | Precision | Recall | F1 | Normalized RMSE |
| --- | ---: | ---: | ---: | ---: |
| Qwen3.5-397B-A17B | .817 | .586 | .682 | .076 |
| Claude Sonnet 4.6 | .669 | .704 | .686 | .140 |
| Gemini 3 Flash | .760 | .375 | .502 | .048 |

RMSE covers different matched subsets, so lowest error does not mean best coverage. Fuzzy and LLM-matched recalls use different denominators. Superconductivity combines Qwen temperature reads with Sonnet digitization and DeepSeek linking. Source fidelity is evaluated, not scientific truth; device assemblies are outside scope. [Paper Table S21, S8, §§2.2, 3.5](https://arxiv.org/pdf/2510.26824v2)

Interpretation: this supports evaluating multiple extractors on a task-specific labeled set. It does not establish a universal best VLM or a sufficient engineering verification gate.

## Local inference: possible, with a concrete integration gap

| Component | What the inspected implementation does | Consequence |
| --- | --- | --- |
| PDF parsing | `DoclingPDFExtractor` exports Markdown with embedded images; factory also offers Mistral OCR API. | A local PDF path exists. Use Docling in private mode. |
| Subplot detection | Florence loads HF base weights and adapter; supports CUDA, MPS, or CPU. | Local specialized vision inference exists. Cache weights before private operation. |
| Text/material extraction and judges | DSPy/LiteLLM with configurable `api_base`. Registry entries for Qwen/DeepSeek point to OpenRouter. | Open-weight selection does not itself imply local inference. Explicitly redirect every stage. |
| Plot digitization | CLI's performance branch instantiates `ClaudeLinePlotDataExtractor` directly. | A CLI `api_base` override does not redirect this visual path. |
| Alternative plot digitizer | `LiteLLMPlotDataExtractor` accepts `model`, `api_base`, `api_key`, and multimodal image input. | Reuse this existing implementation through Python composition or a small CLI integration change, then test against the local endpoint. |

Sources: [Docling implementation](https://github.com/LeMaterial/lematerial-llm-synthesis/blob/e4bacbcbac084544ca68d48242336c2e36f6ee15/src/llm_synthesis/transformers/pdf_extraction/docling_pdf_extractor.py), [Florence implementation](https://github.com/LeMaterial/lematerial-llm-synthesis/blob/e4bacbcbac084544ca68d48242336c2e36f6ee15/src/llm_synthesis/models/florence.py), [model registry](https://github.com/LeMaterial/lematerial-llm-synthesis/blob/e4bacbcbac084544ca68d48242336c2e36f6ee15/src/llm_synthesis/utils/llms.py), [CLI construction](https://github.com/LeMaterial/lematerial-llm-synthesis/blob/e4bacbcbac084544ca68d48242336c2e36f6ee15/src/llm_synthesis/cli.py), [generic plot extractor](https://github.com/LeMaterial/lematerial-llm-synthesis/blob/e4bacbcbac084544ca68d48242336c2e36f6ee15/src/llm_synthesis/transformers/plot_extraction/litellm_plot_data_extraction.py).

Current CLI defaults differ from the paper and portions of the docs: Gemini handles synthesis/material extraction and judging, Gemini handles linking, Sonnet handles plots, Docling handles PDFs, and DINO is the default segmenter. Inspect the pinned [CLI configuration](https://github.com/LeMaterial/lematerial-llm-synthesis/blob/e4bacbcbac084544ca68d48242336c2e36f6ee15/examples/config/cli.yaml) rather than assuming the publication's deployed setup is the package default. No local runtime compatibility or throughput was demonstrated here.

## Figure/table provenance: useful structure, incomplete audit trail

`FigureInfo` retains encoded image, a figure reference, character position, and nearby context. `MaterialPlotEntry` retains plot index/reference, series name, coordinates, axes/units, and a confidence label. [Figure schema](https://github.com/LeMaterial/lematerial-llm-synthesis/blob/e4bacbcbac084544ca68d48242336c2e36f6ee15/src/llm_synthesis/models/figure.py), [performance schema](https://github.com/LeMaterial/lematerial-llm-synthesis/blob/e4bacbcbac084544ca68d48242336c2e36f6ee15/src/llm_synthesis/models/performance.py)

The linker validates proposed series and material names against supplied lists, with a chemistry-specific check for concrete doping instances. This reduces invented identifiers; it cannot prove that two real identifiers are correctly associated. [Linker source](https://github.com/LeMaterial/lematerial-llm-synthesis/blob/e4bacbcbac084544ca68d48242336c2e36f6ee15/src/llm_synthesis/transformers/performance_linking/series_material_linker.py)

A key gap: Florence's `Detection` contains a pixel bounding box, but the HF figure extractor converts detections to `FigureInfo` without retaining that box; it sets character position to zero and contexts to empty strings. That branch also invokes ResNet classification even when Florence segmentation is selected. Thus the single-pass model's capabilities are not identical to the surrounding default pipeline behavior. [HF figure extractor](https://github.com/LeMaterial/lematerial-llm-synthesis/blob/e4bacbcbac084544ca68d48242336c2e36f6ee15/src/llm_synthesis/transformers/figure_extraction/hf_figure_extractor.py)

Tables appear as a possible figure class and Docling supplies table parsing, but the specialized numerical output shown here is a line-plot schema. I did not establish a dedicated table-cell provenance benchmark or CAD/GD&T benchmark. The absence of page/box fields in these specific output types means we should explicitly retain original-page coordinates and document revision in our own evidence record.

## Smallest useful adaptation for this hackathon

1. Keep original engineering PDFs and page coordinates alongside parsed text and figure crops.
2. Define only the entities the selected calculation needs: part/revision, load, dimension, unit, tolerance, material property, and cited evidence.
3. Use the generic plot extractor only if a needed value actually lives in a performance curve. Run separate candidate reads on the same crop and compare with labeled values.
4. Keep native CAD geometry extraction separate. A plot detector and chemistry ontology do not replace an engineering geometry parser.
5. Check that entity references, units, and input revisions agree before calculation. Ambiguous evidence prevents a verified status.
6. Use trusted numerical checks for engineering acceptance. A model judge may flag questionable extraction; its score cannot certify a solver result or override a failed check.

With the supplied GPU resources, the available local model shortlist can be much larger than a laptop-only shortlist, but copying LeMat's Qwen397B/OpenRouter configuration would neither prove local deployment nor settle the best model. The reusable contribution is the separation of extraction, linking, and checking, tested against human-labeled examples.
