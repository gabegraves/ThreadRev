# Local serving on the available NVIDIA rig

Research date: 2026-09-12. Hardware supplied by the user: 2 × RTX PRO 6000 96 GB, 3 × RTX 3090, 512 GB DDR4, EPYC 7763. No rig access, weight download, installation or benchmark execution was performed. Assuming the 96 GB cards are RTX PRO 6000 **Blackwell**; confirm exact SKU, driver and PCIe topology at setup.

## Recommendation

Start with **Qwen3.8-27B in BF16 on one 96 GB card**. Its complete checkpoint tensor payload is about 51.75 GiB, leaving substantial room for vision processing and runtime state. Keep the second 96 GB card for the drawing specialist or a comparative model. The 3090s can serve compatible OCR/embedding workers independently. Do not initially combine all five heterogeneous cards into one tensor-parallel group.

**Qwen3.8-Flash-Next is a credible experiment on this rig, but not a straightforward FP8 drop-in or an Apache-licensed upgrade.** Its NVFP4 variant has a published SGLang recipe specifically for one RTX PRO 6000 plus CPU embedding offload. That makes it worth a bounded bakeoff once the baseline works. Selection still depends on our CAD/document/tool-use tasks, especially quantized visual accuracy.

No clearly superior, permissively licensed larger VLM was established by this bounded audit. Qwen3.5-122B-A10B-FP8 and GLM-4.6V-FP8 are deployable-looking comparison candidates, not evidence-backed upgrades over Qwen3.8-27B for this workflow.

## Exact weight sizes

Read from each official HF `model.safetensors.index.json` metadata, then cross-checked against the sum of actual `.safetensors` file sizes from the HF API (`?blobs=true`). GB below is decimal; GiB is bytes / 2^30. These are **checkpoint payloads, not peak GPU memory requirements**. Shard headers, loading buffers, vision activations, CUDA graphs, KV/recurrent state and allocator overhead add memory; some engines omit optional MTP weights or offload tensors.

| Checkpoint | Index `total_size` bytes | Payload GiB | Actual tensor-file bytes | License |
|---|---:|---:|---:|---|
| [Qwen/Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B/blob/main/model.safetensors.index.json) BF16 | 55,562,855,904 | 51.747 | 55,563,006,776 | Apache-2.0 |
| [Qwen/Qwen3.8-Flash-Next](https://huggingface.co/Qwen/Qwen3.8-Flash-Next/blob/main/model.safetensors.index.json) BF16 | 359,999,963,128 | 335.276 | Not separately summed in this audit | Qwen Community 1.0 |
| [Qwen/Qwen3.8-Flash-Next-FP8](https://huggingface.co/Qwen/Qwen3.8-Flash-Next-FP8/blob/main/model.safetensors.index.json) | 185,502,232,570 | 172.762 | 185,523,317,458 | Qwen Community 1.0 |
| [nvidia/Qwen3.8-Flash-Next-NVFP4](https://huggingface.co/nvidia/Qwen3.8-Flash-Next-NVFP4/blob/main/model.safetensors.index.json) | 132,639,846,394 | 123.530 | 132,680,249,378 | Custom / upstream restrictions |
| [Qwen/Qwen3.5-122B-A10B-FP8](https://huggingface.co/Qwen/Qwen3.5-122B-A10B-FP8/blob/main/model.safetensors.index.json) | 127,152,313,312 | 118.420 | 127,163,011,832 | Apache-2.0 |
| [zai-org/GLM-4.6V-FP8](https://huggingface.co/zai-org/GLM-4.6V-FP8/tree/main) | **Unreliable: index reports only 83,858,880** | **102.450 from files** | **110,004,730,904** across 41 shards | MIT |

The GLM mismatch is a useful warning: parameter counts and index metadata alone can mislead. The reported total file size is a stronger lower bound here. Do not repeat the 84 MB index value as the model size.

Observed HF revisions:

- Qwen3.8-27B: `1d4bf0f2ff6012fd82039f2fa52739d0dd7c60c0`
- Qwen3.8-Flash-Next-FP8: `236dfdf285828023ca3bcd3f37366c58a3469b13`
- NVIDIA Flash-Next NVFP4: `fc694b54fb0174e0913e6adf86691ef85a4ead47`
- Qwen3.5-122B-A10B-FP8: `a099dee70ccfcd8d5dda56aaa0b60cb8ecadabc9`
- GLM-4.6V-FP8: `33172e26eb88482cf3d0a36fced01d05454734ec`

## Flash-Next: what the hardware can actually support

The [official model card](https://huggingface.co/Qwen/Qwen3.8-Flash-Next) specifies 125B main-model parameters with 6B activated, **plus 51B n-gram embedding parameters and 4B MTP**. “6B active” describes per-token computation, not weight residency. BF16 exceeds the two 96 GB cards before runtime overhead. FP8 barely fits their nominal aggregate capacity and is not established as an ordinary all-GPU deployment on this exact pair.

The [vLLM recipe](https://recipes.vllm.ai/Qwen/Qwen3.8-Flash-Next), updated September 10, uses a dedicated `vllm/vllm-openai:qwen38-flash-next` image. Its validated minimum FP8 TP2 deployment is **GB300**, not RTX PRO 6000. It supports NVIDIA CPU offload of the n-gram embedding through `VLLM_PLE_CPU_OFFLOAD=1`; pipeline parallelism is initially unsupported. Plain TP8 conflicts with the official FP8 quantization block dimensions, so its H200 eight-GPU recipe uses expert parallelism. Thus “add the three 3090s” is not a validated path.

The [SGLang cookbook](https://docs.sglang.io/cookbook/autoregressive/Qwen/Qwen3.8-Flash-Next) is more directly useful: it reports a **single RTX PRO 6000 Blackwell** NVFP4 deployment, with the 47.7 GiB FP8 embedding table in pinned CPU RAM. After loading temporaries are collected, it reports 74.7 GiB resident without speculative decoding, 81.8 GiB with it, against 94.2 GiB process-usable VRAM. Host requirements include at least 64 GB free RAM and unlimited container memlock. The specific image is `lmsysorg/sglang:dev-qwen38-next-local`, build `4ccff141db`; the earlier launch image lacks its mixed-precision loader. This is a real published hardware-specific result, but it is a development build and its numeric/text results do not validate our visual workload. The user's 512 GB RAM exceeds the cited offload requirement; exact latency remains unmeasured on the EPYC/PCIe setup.

A future FP8 TP2 + CPU embedding-offload experiment may be preferable for precision, but this audit did not find a validated recipe for that exact RTX pair. First prove startup, image inputs, tool calls and memory headroom with a short document; then expand context and concurrency. Keep speculative decoding off initially to reduce variables.

## License affects product positioning

The current [Qwen Community License 1.0](https://huggingface.co/Qwen/Qwen3.8-Flash-Next/blob/main/LICENSE) requires a separate license for commercial use when the licensee or an affiliate conducts a Model-as-a-Service or AI Work Assistant business, with an internal-use exception. Its definition also excludes single-purpose tools, assistants primarily serving domains other than coding/office productivity, and incidental assistant features in other products. Both official BF16 and FP8 LICENSE files had the same SHA-256: `a0dc422560841fd68e06d974907f8b4c709bca44a67daad2b528437bdf676c08`.

Our narrow engineering-verification product might fall within a domain exception, but this is **not established merely by naming it an engineering agent**. A Slack productivity/coding positioning may point the other way. Do not call the model Apache-2.0, unrestricted, or categorically prohibited for this project. Use the Apache-2.0 27B baseline while resolving the intended commercial product's treatment before depending on Flash-Next.

## Permissive larger comparison candidates

**Qwen3.5-122B-A10B-FP8:** 118.42 GiB payload is a plausible TP2 fit with substantially more headroom than Flash-Next FP8. The [official vLLM recipe](https://recipes.vllm.ai/Qwen/Qwen3.5-122B-A10B) validates FP8 TP2 on H200; exact RTX PRO 6000 deployment still needs checking. The older model's larger parameter count does not establish better CAD extraction, agent reliability, or total task latency than 3.8-27B.

**GLM-4.6V-FP8:** 102.45 GiB of shard files; MIT; native multimodal tool calling and document understanding. The [official card](https://huggingface.co/zai-org/GLM-4.6V-FP8) documents vLLM/SGLang support. It is a reasonable independent-family visual challenger on the two large cards, but no current head-to-head engineering result justifies calling it superior here.

The [Qwen3.8-27B serving recipe](https://recipes.vllm.ai/Qwen/Qwen3.8-27B) covers the native multimodal architecture and `qwen3` reasoning / `qwen3_coder` tool parsing, while explicitly limiting its own verification claims to text serving. Preserve the vision tower; do not copy a text-only `--language-model-only` optimization into document processing. Start at bounded context and low concurrency, retain BF16 accuracy as the reference, and measure task completion rather than isolated token throughput.
