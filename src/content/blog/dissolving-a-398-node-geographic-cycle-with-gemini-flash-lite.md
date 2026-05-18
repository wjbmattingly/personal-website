---
title: "Dissolving a 398-Node Geographic Cycle with Gemini Flash Lite"
pubDate: 2026-05-18
description: "How we found, visualized, and automatically fixed a massive circular reference in the LUX places hierarchy — for about three cents."
author: "William Mattingly"
tags: ["yale", "graph theory", "lux"]
image: "/images/blog/scc0.jpg"
draft: true
---

## The Problem

[LUX](https://lux.collections.yale.edu/) is Yale's cultural heritage platform. It aggregates millions of objects and places into a massive database. Each place has a `part_of` array pointing to its geographic parents: a town links to a county, a county to a state, and so on.

Semantically, this should form a **directed acyclic graph (DAG)**—a clean hierarchy with no loops. Because we source 600,000 places from various files, that hierarchy is difficult to maintain. Loops slip in, leading to infinite UI chains:

```
California → New Mexico → Sierra County → United States → New Mexico → Sierra County → United States → ...
```

Naive code that walks this chain spins forever. Worse, the loop poisons every descendant; any place that lists a cyclic node as an ancestor gets caught in the error.

## Step 1: Finding the Cycles — Tarjan's SCC

My first task was to find every cycle without loading 600,000 records into memory. This was a 2.7 GB JSONL file. I stored the `child → parent` relationships in a **CSR (Compressed Sparse Row)** format—a pair of NumPy arrays that represents a sparse adjacency matrix efficiently. The result, `graph.npz`, is only a few megabytes.

I then ran **Tarjan's strongly connected components (SCC) algorithm** on that CSR graph. Any SCC with two or more members is a cycle, as every member can reach every other member—a structural impossibility in a valid hierarchy.

Tarjan's algorithm is O(V + E). It processed 577,612 nodes and 639,844 edges in seconds.

**Results:**

| Metric | Value |
|--------|-------|
| Total cyclic SCCs found | 2,881 |
| Total places stuck in cycles | 6,573 |
| Largest SCC (SCC 0) | 398 places |
| Bad edges inside SCC 0 | 890 |
| Downstream descendants of SCC 0 | 458,214 |

That last number is the blast radius: 458,214 places—nearly 80% of the database—contain a member of SCC 0 in their ancestor chain. SCC 0 included major hubs like Switzerland, Brazil, and Mexico City.

## Step 2: Understanding What We Found

I outputted the data as CSV and JSONL files to understand better the SCCs and their downstream implications. To triage these, I built two LLM-based tools:

- `llm_judge_edge`: Sends a suspect edge to Gemini with full records to determine if it is a valid `part_of` relationship, a duplicate, or unrelated.
- `llm_flag_parents`: Sends a place and all its parents to the model to identify which geographic links are incorrect.

Each call costs less than a penny, making them perfect for spot-checking bad edges.

## Step 3: Visualizing the Mess — A Flask App

To see the graph before editing it, I built a small Flask app backed by Cytoscape.js. It features three views:

1. A table of all 2,881 SCCs ranked by size.
2. The induced subgraph of an SCC. It highlights bad edges and uses Johnson's algorithm to identify specific loops.
3. A BFS (breadth-first search) neighborhood view that expands ancestors and descendants interactively.

The app loads the full graph in two seconds, keeping navigation responsive even with 600,000 nodes.

## Step 4: The First LLM Pass — Bulk Dissolution

Manual triage for 890 edges wasn't realistic. I sent the entire SCC 0 subgraph to Gemini in one prompt.

The prompt included:
- The data model context (DAG rules).
- Every node with its label and UUID.
- Every intra-SCC edge.
- A requirement to maintain connectivity.
- A structured JSON response schema.

The 17,000-token prompt fit easily within Gemini Flash Lite's context window. The result was a proposed 129 deletions for about $0.005. I ran another script to simulate these changes; SCC 0 shattered into 23 smaller fragments.

## Step 5: Iterative Fragment Dissolution

I built an orchestrator to process the remaining fragments recursively:

1. Apply proposed deletions to the in-memory graph.
2. Re-run Tarjan to find remaining fragments.
3. Call Gemini for each fragment.
4. Cache results to save costs on subsequent runs.

This reduced the cycle fragments from 23 to 11. Then, I hit a snag.

## Step 6: Debugging the UUID Hallucination

Round 3 stalled because the LLM was padding 8-character UUID prefixes with zeros when asked for full UUIDs (e.g., returning `96479c30-0000...` instead of the actual ID). 

The fix was a simple lookup adjustment: always resolve the ID using the first 8 characters, regardless of the returned length.

## Step 7: Full Dissolution

After the fix, the final assessment confirmed the result:

```
  Original members : 398
  Edges deleted    : 204
  Blast radius     : 458,214 → 458,202
  Heir fragments   : 0
```

SCC 0 is gone. Total cost across all rounds: approximately $0.03.

## Step 8: Before/After Visualization

The Flask app now includes a comparison view. Users can toggle between the original cyclic graph (red) and the patched, acyclic graph (blue/green). Seeing the "hairball" collapse into a clean tree structure provided clear validation of the fix.

## How the Blast Radius Works

You might notice the blast radius only dropped by 12. This is expected. The metric tracks how many places had a cyclic node in their ancestry. Because SCC 0 included major countries, most of the database was "under" them. Dissolving the cycle doesn't remove the geographic relationship—it just removes the loop. The hierarchy is now valid, and the contamination is gone.

## What This Enables

- Infinite loop errors during path-walking are gone.
- Hierarchy-dependent features like breadcrumbs and faceted filters are stable for nearly 500,000 places.
- The 2,880 remaining smaller SCCs can now be processed using the same automated pipeline.

**Model:** `gemini-3.1-flash-lite-preview` via Vertex AI.
