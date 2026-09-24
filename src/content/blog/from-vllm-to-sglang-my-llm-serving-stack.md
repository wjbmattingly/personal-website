---
title: "From vLLM to SGLang: Rethinking My LLM Serving Stack"
pubDate: 2026-07-06
description: "Why I moved off vLLM for serving models on my NVIDIA Ada 5000 workstation and Yale's Bouchet cluster, switched to SGLang, and settled on LM Studio with MLX for my Mac — plus the SSH port-forwarding trick that lets my laptop talk to a GPU node."
author: "William Mattingly"
tags: ["llm", "infrastructure", "bouchet", "sglang"]
draft: true
---

Most of the machine learning I write about here — [parsing millions of names](/blog/parsing-3-6-million-historical-names-with-small-models), [splitting over-merged places](/blog/finding-over-merged-places-in-lux-with-authority-divergence) — depends on one unglamorous thing: a server that takes a prompt and returns tokens. I run those servers in three different places, and I recently changed the software I use in all three. This post is about what I switched to, and why.

## What "serving" a model actually means

When people say they are *running* a local model, they usually mean one of two things. Either they are calling a model once from a script, or they are standing up an **inference server**: a long-running process that loads the model weights into GPU memory once and then answers many requests over HTTP. The second is what you want for any real workload, because loading a multi-billion-parameter model takes time and memory you don't want to pay for on every call.

The happy convention in this space is that almost every serving framework exposes an **OpenAI-compatible API**. You point any OpenAI client at `http://your-server/v1`, and it works as if you were calling OpenAI — except the model is yours, running on your hardware, with no per-token bill. That compatibility is what makes swapping the underlying engine painless: my application code never changes, only the server behind the endpoint does.

I serve models in three contexts:

- my **Mac** (Apple Silicon), for local development and quick experiments;
- a **workstation with an NVIDIA RTX 5000 Ada** GPU, for heavier local jobs;
- **[Bouchet](https://docs.ycrc.yale.edu/clusters/bouchet/)**, Yale's research computing cluster, with H200 GPUs, for anything at scale.

For a long time the NVIDIA boxes — the workstation and Bouchet — both ran [vLLM](https://github.com/vllm-project/vllm). That is what changed.

## The catalyst: Bouchet got a kernel upgrade

The thing that finally pushed me to re-evaluate was infrastructure, not software. Yale upgraded **SLURM** (the cluster's job scheduler) and the underlying **Linux kernel** on Bouchet.

That sounds like a sysadmin footnote, but it mattered a lot. Modern GPU serving frameworks ship as prebuilt Python wheels compiled against recent CUDA, driver, and system-library versions. On an older kernel, those wheels often refuse to install or crash at runtime, and you end up doing what I had been doing for a year: hacky workarounds — pinning ancient versions, building from source, or wrapping everything in a container just to get a compatible environment. Every vLLM upgrade was a small adventure.

After the upgrade, the modern stack simply *works*. Recent CUDA wheels install cleanly, the new SLURM handles GPU allocations more gracefully, and I no longer need any of the contortions. That removed the one thing that had been keeping me on a frozen, carefully-pinned vLLM setup — and freed me to try the framework I actually wanted.

## Why I left vLLM

I want to be fair to vLLM: it is excellent, and it earned its place as the default. It pioneered **PagedAttention** — managing the model's key-value cache like virtual memory so the GPU wastes far less space — and **continuous batching**, which keeps the GPU busy by slotting new requests into a running batch instead of waiting for the whole batch to finish. Its throughput is superb, model support is broad, and the community is enormous.

My problem was never performance. It was that vLLM had become **temperamental** in day-to-day use. It moves fast and is sensitive to its environment: a mismatch between the CUDA version, the driver, the kernel, or one of a dozen dependencies, and the server would fail to start or fall over mid-run. On a workstation I control that is annoying; on a shared cluster, where I don't own the drivers or the kernel, it was a recurring tax on getting anything done. I wanted something that installs cleanly on a modern stack and stays up.

## SGLang

The framework I moved to is [SGLang](https://github.com/sgl-project/sglang). It is a fast serving runtime in the same class as vLLM, with two things that fit my work especially well.

The first is **RadixAttention**. Where vLLM's PagedAttention optimizes memory *within* the processing of requests, SGLang additionally keeps a radix tree of previously-seen prompt prefixes and **reuses their KV cache across requests**. In plain terms: if a thousand calls all begin with the same long system prompt and JSON schema — which is exactly what my structured-extraction jobs look like — SGLang computes that shared prefix once and reuses it, instead of re-processing it every single time. For repetitive, templated workloads the speedup is real and free.

The second is **fast structured generation**. SGLang has first-class, high-performance constrained decoding: you hand it a JSON schema (or a regex/grammar) and it guarantees the output conforms, quickly. My pipelines live or die on getting clean, parseable JSON and YAML out of small models — the [name parser](/blog/parsing-3-6-million-historical-names-with-small-models) and the [authority-divergence adjudicator](/blog/finding-over-merged-places-in-lux-with-authority-divergence) both depend on it — so a server that makes schema-constrained decoding a core, fast feature is a direct win.

On top of that, throughput is competitive with (and on many of my workloads, better than) vLLM, it exposes the same OpenAI-compatible endpoint, and — the part that started all this — it installed cleanly on the upgraded Bouchet without a single hack.

### vLLM vs SGLang, briefly

| | vLLM | SGLang |
|---|---|---|
| Core memory trick | PagedAttention | PagedAttention **+ RadixAttention** (cross-request prefix reuse) |
| Structured/JSON output | Supported | First-class and very fast |
| Raw throughput | Excellent | Excellent, often better with shared prefixes |
| Maturity / community | Largest, most tutorials | Newer but growing fast |
| My experience installing | Temperamental, env-sensitive | Clean on a modern kernel |
| API | OpenAI-compatible | OpenAI-compatible |

vLLM is still a great choice, especially if you value the largest ecosystem. For *my* mix — heavy structured extraction with lots of shared prompt prefix, on hardware I want to stop fighting — SGLang is the better fit.

## Reaching a cluster GPU from my laptop

Here is the workflow that makes Bouchet genuinely pleasant to use. I want to develop on my Mac but run the model on a cluster H200, without "being on" the HPC for every request. The trick is an **SSH port-forward** (a tunnel) to the GPU node.

First, on an allocated GPU node, I launch SGLang bound to all interfaces and note the node's cluster IP:

```bash
# inside a SLURM allocation on a GPU node
python -m sglang.launch_server \
    --model-path Qwen/Qwen3.5-4B \
    --host 0.0.0.0 --port 30000

# in another shell on the same node, get its address:
hostname -i        # e.g. 10.181.42.7
```

Then, from my Mac, I forward a local port straight to that node through the login host:

```bash
# on my laptop: localhost:30000 -> 10.181.42.7:30000 on the cluster
ssh -N -L 30000:10.181.42.7:30000 netid@bouchet.ycrc.yale.edu
```

Now `http://localhost:30000/v1` on my laptop *is* the SGLang server running on the H200. Any OpenAI client — a script, a notebook, an app — talks to it directly, and I never copy code onto the cluster or sit in an interactive shell to send requests. The exact same pattern works for the RTX 5000 Ada workstation; it is just a shorter tunnel to a machine on my own network.

## The Mac: LM Studio and MLX

The Mac is a different story, and here simplicity won outright. I no longer run a heavyweight GPU server on Apple Silicon at all — I use [LM Studio](https://lmstudio.ai/).

LM Studio is a desktop app that downloads models, runs them, and exposes the same OpenAI-compatible server with a toggle. Crucially, on Apple Silicon it runs models natively through [**MLX**](https://github.com/ml-explore/mlx), Apple's array framework built for the M-series chips' unified memory. That means the model uses the Mac's shared CPU/GPU memory efficiently and runs genuinely fast, with none of the CUDA-era environment wrangling — because there is no CUDA. I click a model, click "start server," and point my code at `http://localhost:1234/v1`.

**Advantages:** dead simple, no dependency management, a GUI model browser, native MLX performance on Apple Silicon, and a one-click OpenAI endpoint that drops into the same client code as everything else. For local prototyping it is the fastest path from idea to running model I have used.

**Disadvantages:** it is a single-machine, single-user tool, not a high-throughput production server — it has no continuous batching or prefix-cache cleverness to rival SGLang, so it is wrong for serving many concurrent users or grinding through millions of records. It is also a closed-source desktop application, which means less low-level control and tuning than an open framework. For me that is a fine trade: the Mac is for *developing* a pipeline, not for running it at scale.

## My setup now

So the stack sorted itself into three clean lanes:

| Where | Framework | Why |
|---|---|---|
| Mac (Apple Silicon) | LM Studio + MLX | Simplest possible local dev; native, fast on Apple Silicon |
| RTX 5000 Ada workstation | SGLang | Clean install, prefix caching, fast structured output |
| Bouchet (H200) | SGLang | Same engine as the workstation; installs cleanly post-upgrade; reached over an SSH tunnel |

The win isn't any single benchmark. It's that I now use **one serving engine (SGLang) across both NVIDIA contexts**, develop against it through a tiny LM Studio server on the Mac, and reach the cluster over a port-forward — all behind the same OpenAI-compatible endpoint, so my application code is identical no matter which lane it runs in. A kernel upgrade I didn't ask for turned out to be the nudge that simplified the whole thing.
