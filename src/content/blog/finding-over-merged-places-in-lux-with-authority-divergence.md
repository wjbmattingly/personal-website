---
title: "Finding Over-Merged Places in LUX with Authority Divergence"
pubDate: 2026-06-29
description: "How we found thousands of LUX place records that quietly fuse two different real-world places into one — using free heuristics to gather the evidence and an open-source Qwen model on a single H200 to adjudicate the splits."
author: "William Mattingly"
tags: ["yale", "lux", "linked open data", "machine learning"]
image: "/images/blog/lux-divergence-pyrenees.jpg"
imageAlt: "The divergence app showing the LUX 'Pyrenees' record split into two places — the European mountain range (Spain) and a county in Australia — 16,815 km apart, with the authorities clustered and an LLM verdict of conflation."
draft: true
---

> **Cleaning the LUX places graph** — a series:
> - Phase 1: [Dissolving a 398-node geographic cycle](/blog/dissolving-a-398-node-geographic-cycle-with-gemini-flash-lite)
> - Phase 2: [Merging duplicate places](/blog/cleaning-the-lux-places-graph-phase-2-merging-duplicates)
> - Phase 3: [Untangling bad nesting](/blog/cleaning-the-lux-places-graph-phase-3-untangling-bad-nesting)
> - Phase 4: [When places overlap instead of nest](/blog/cleaning-the-lux-places-graph-phase-4-overlap)
> - **Companion: Finding over-merged places with authority divergence** *(you are here)*

The four phases of cleaning Yale's [LUX](https://lux.collections.yale.edu/) places graph — [dissolving cycles](/blog/dissolving-a-398-node-geographic-cycle-with-gemini-flash-lite), [merging duplicates](/blog/cleaning-the-lux-places-graph-phase-2-merging-duplicates), [untangling nesting](/blog/cleaning-the-lux-places-graph-phase-3-untangling-bad-nesting), and [reclassifying overlaps](/blog/cleaning-the-lux-places-graph-phase-4-overlap) — all diagnose problems from the *shape* of the graph: how places point at one another. This companion piece is about a problem the structure can't see, because it lives in a record's *external* links: **over-merges**, where a single LUX record secretly stands for two completely different places on opposite sides of the planet.

It is, quite precisely, the mirror image of [Phase 2](/blog/cleaning-the-lux-places-graph-phase-2-merging-duplicates). There, the job was to find many records that are secretly one place and *merge* them. Here, the job is to find one record that is secretly many places and *split* it. And like the duplicate work, the fix is a case study in doing something cheaply at scale: free heuristics to find and frame the evidence, and an open-source language model running locally to make the final call.

## Authorities and linked open data

First, some background, because the whole problem grows out of how cultural heritage data is connected.

LUX is built on **linked open data**. The core idea is that every real-world thing — a person, an object, a place — gets a stable web address (a URI) maintained by some **authority**: an independent, curated reference catalog. For places, the major authorities are [Wikidata](https://www.wikidata.org/), [GeoNames](https://www.geonames.org/), [Who's on First](https://whosonfirst.org/), the Getty [Thesaurus of Geographic Names](https://www.getty.edu/research/tools/vocabularies/tgn/) (TGN), and the [Library of Congress](https://id.loc.gov/). Each authority publishes its own record for, say, the Pyrenees, at its own URI.

A LUX place record knits these together in an `equivalent` block. When a record lists a Wikidata URI *and* a GeoNames URI *and* a Who's on First URI, it is making a strong claim: **all of these authorities are describing the same real-world place.** That linkage is what lets LUX pull a coherent picture together from dozens of independent catalogs.

The trouble is that the claim is not always true.

## What an over-merge looks like

Place names are spectacularly ambiguous. There is a Pyrenees in Spain and a [Pyrenees Shire](https://www.google.com/maps/place/Pyrenees+Shire) in Victoria, Australia. There is a Guadalcanal in Spain and a Guadalcanal in the Solomon Islands. Macau is a region of China, a commune in the Gironde in France, *and* a municipality in Brazil.

When records get merged — automatically or by hand — these collisions sometimes get stitched into a single LUX place. The result is a record whose `equivalent` block points at authorities for **two (or more) genuinely different places**. Anything downstream that trusts that record now believes the Spanish Pyrenees and the Australian shire are one location. Maps break, queries return nonsense, and the error is invisible unless you go and read each authority's own description.

Sometimes the over-merge hides inside an otherwise-correct record. In [Phase 4](/blog/cleaning-the-lux-places-graph-phase-4-overlap) I flagged **Andes** as a genuine overlap — a range that really does span Venezuela, Bolivia, and Ecuador. But that same record also carried a stray link to [Andes, New York](https://en.wikipedia.org/wiki/Andes,_New_York). The multi-country span is real; the New York village fused into it is an over-merge. Catching that second problem is exactly what this step does.

We wanted to find every record like this across LUX and propose how to split it back apart.

## Why not just ask a frontier model?

The obvious approach is to hand each suspicious record to a large frontier model and ask "is this one place or several?" The problem is scale. About **141,000** LUX place records carry more than one external authority — those are the only records that *can* over-merge, and every one of them is a candidate. Reasoning over 141k records with a commercial API, especially once you include each authority's full description, is both slow and genuinely expensive, and you would be paying that cost again every time the data refreshes.

So we split the work into a cheap part and a smart part.

## The cheap part: measuring divergence

For every eligible record, a heuristic gathers the evidence — no API key, no model. It asks each external authority for its **own** name, description, coordinates, and country, and caches every URI's answer so each is fetched only once, ever. Then it computes two simple measures of disagreement:

- **Geo divergence** — the farthest great-circle distance between any two authorities' coordinates. If Wikidata puts the place in Europe and Who's on First puts it in Australia, that distance is enormous.
- **Text divergence** — each authority's description is embedded with a small sentence-transformer model ([`all-MiniLM-L6-v2`](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)), and we take the largest pairwise cosine distance between them.

Then the authorities are **clustered into the distinct places they actually point at**, with geography treated as the ground truth: two sources that both carry coordinates are grouped purely by how far apart they sit. The Spanish Pyrenees and the Australian shire fall into two clusters thousands of kilometers apart. The biggest cluster is the one to keep; every other cluster is a proposed break.

This stage is essentially free, and it does the heavy lifting of assembling, normalizing, and pre-sorting the evidence. It is also revealing on its own: across the run, **1,662** records have authorities that disagree on location by more than 100 km, and **355** disagree by more than 1,000 km — distances that are very hard to explain as anything but two different places.

But geography alone misses the subtle cases. Two authorities can sit almost on top of each other and still be different things — a **municipality** versus the **city** at its center, for example. That is where a model earns its keep.

## The smart part: an open-source model on Bouchet

For the adjudication we used an open-source model: **Qwen3.6 35B A3B** (`qwen3.6-35b-a3b`), a mixture-of-experts model with 35B total parameters but only ~3B active per token, which makes it fast to run. We served it on a single **H200 GPU on [Bouchet](https://docs.ycrc.yale.edu/clusters/bouchet/)**, Yale's research computing cluster, behind an OpenAI-compatible endpoint. Because the model runs on hardware we already have, the reasoning step costs no per-token API fees — we can run it across all of LUX, and re-run it whenever the data changes, without watching a meter.

The model receives the structured evidence the heuristic assembled: every authority, each with a stable handle (`A1`, `A2`, `A3`, …), its name, description, country, and coordinates. Its job is to partition those authorities into the distinct real-world places they describe, assign **every** authority to exactly one place, and return a strict JSON verdict — whether the record is a conflation, how many places it should become, and the reasoning for each.

Giving each authority a handle and requiring all of them to be accounted for is what keeps the model honest: we can check that its answer references only authorities we actually sent and that none were dropped or invented.

The payoff is that the model catches exactly the cases geometry can't. Take a real verdict from the run — the record labeled "Trikkaion Municipality" in Greece. Its three authorities sit within a couple of kilometers of each other, so geo divergence is nearly zero. The model still correctly separated it into two places: the **municipality** of Trikala (a Wikidata and a Who's on First record) and the **city** of Trikala (a GeoNames record), because it understood that a municipality and the city at its heart are related but distinct administrative entities.

## The results

Running the full pipeline over LUX, the model adjudicated **120,954** records that had enough authority data to compare, and flagged **14,794** of them — about **12%** — as genuine over-merges that should be split.

The shape of those splits:

| Splits into | Records |
|---|---|
| 2 distinct places | 12,407 |
| 3 distinct places | 1,599 |
| 4 distinct places | 241 |
| 5 or more | 108 |

The long tail goes all the way up to a single record standing in for **17** different places. The vast majority, though, are clean two-way splits — one record that was always really two.

The most extreme cases by geographic disagreement read like a list of the world's most reused place names. Every one of these is a real over-merge the run surfaced:

| LUX record | Conflated places | Apart |
|---|---|---|
| Pyrenees | Pyrenees (Spain) · Pyrenees (Australia) | 16,815 km |
| Guadalcanal | Guadalcanal (Spain) · Guadalcanal (Solomon Islands) | 16,555 km |
| Macao | Macau (China) · Macau (France) · Macau (Brazil) | — |
| Trinidad | Trinidad (Philippines) · Trinidad and Tobago · Trinidad (island) | — |
| Thrace | Thrace (Greece/Bulgaria/Turkey) · Mount Thrace (Antarctica) · Thracia (Ancient Rome) | — |

Each flagged record comes with a concrete, reviewable proposal: which authorities to keep together as the primary place, which to break off, and the model's reason for every decision — exactly the form a curator needs to act on it.

## The takeaway

The pattern here is the same one I keep coming back to. A frontier model *could* do this, but doing it across 141k records would be slow and costly. By spending the effort up front on cheap, deterministic heuristics — fetching and caching each authority once, measuring divergence, and clustering by geography — we turned a vague "go read everything" problem into a tightly framed question that a small, open-source model running on a single H200 could answer well, at scale, and for free.

The over-merges have been hiding in LUX precisely because catching them means cross-checking what several independent authorities each *actually* say. Now we have a list, a proposed split for every record on it, and a pipeline we can re-run as the data grows.
