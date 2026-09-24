---
title: "Cleaning the LUX Places Graph, Phase 3: Untangling Bad Nesting"
pubDate: 2026-06-08
description: "With cycles dissolved and duplicates merged, the remaining mess is in the edges: part_of links that are redundant, reversed, or geographically impossible. Four heuristic passes flagged 130,737 of them."
author: "William Mattingly"
tags: ["yale", "lux", "graph theory", "data quality"]
draft: true
---

> **Cleaning the LUX places graph** — a series:
> - Phase 1: [Dissolving a 398-node geographic cycle](/blog/dissolving-a-398-node-geographic-cycle-with-gemini-flash-lite)
> - Phase 2: [Merging duplicate places](/blog/cleaning-the-lux-places-graph-phase-2-merging-duplicates)
> - **Phase 3: Untangling bad nesting** *(you are here)*
> - Phase 4: [When places overlap instead of nest](/blog/cleaning-the-lux-places-graph-phase-4-overlap)
> - Companion: [Finding over-merged places with authority divergence](/blog/finding-over-merged-places-in-lux-with-authority-divergence)

The first two phases of cleaning Yale's [LUX](https://lux.collections.yale.edu/) places graph worked on the **nodes**: [Phase 1](/blog/dissolving-a-398-node-geographic-cycle-with-gemini-flash-lite) removed the cyclic loops, and [Phase 2](/blog/cleaning-the-lux-places-graph-phase-2-merging-duplicates) merged duplicate records into single places. Phase 3 turns to the **edges** — the `part_of` links themselves — and the many ways they go wrong without ever forming a loop or a duplicate.

## The problem: links that don't make sense

A `part_of` edge says "this place sits inside that one." Plenty of them are simply wrong. A place like Oregon (Illinois) ends up declared part of Illinois, Ogle County, *and* Oregon-Nashua Township all at once. Oregon (Ohio) is declared part of a place literally named "Oregon." None of these creates a cycle, and none is a duplicate — so the first two phases sail right past them — but every one bloats the ancestry of everything beneath it and produces nonsense breadcrumbs and facets.

This phase runs on the **consolidated graph** that Phase 2 produced, where every duplicate is already collapsed to one node. That ordering matters: if the duplicates were still separate, a bad edge pointing at one copy of a parent could hide a perfectly correct edge pointing at another.

## How it works: four heuristic passes, in order

I flag bad edges with four passes, run in a deliberate sequence — the clearly-wrong edges have to be stripped *before* the redundancy pass, because a bad edge can otherwise make a perfectly correct edge look redundant.

**1. Same name.** A child declared part of a parent with the same name. This is almost always a self-reference that slipped in during merging.

**2. Size inversion.** A child that is geographically *bigger* than its parent. The trick is how "size" is measured: a place's radius is the spread of its own children's coordinates, not its raw child count — a province naturally has more cities than a country has provinces, so counting children would mislead.

**3. Geo outlier.** A child sitting far outside the cloud of its parent's *other* children — the classic signature of two same-named places being confused.

**4. Redundant.** The transitive reduction: an edge to a parent that's already reachable through a longer, more specific path. This is the bulk of the noise by a wide margin.

The ordering is not cosmetic. Take Oregon (Illinois), which is declared part of Illinois, Ogle County, *and* Oregon-Nashua Township simultaneously. The link to the same-named township is plainly wrong and gets stripped first. Only after that does the redundancy pass look at what remains — and correctly sees that the edge to Illinois is redundant, because Oregon already reaches Illinois through Ogle County. Run those passes in the other order and the redundancy check, confused by the bad township edge, could easily flag the wrong link. Cleaning the obvious mistakes before measuring redundancy is what keeps the four passes from interfering with each other.

All four are deterministic heuristics — no model required, because each signal is precise enough to stand on its own. (A model is reserved for the genuinely ambiguous residual: when a place has several legitimate-looking parents and you have to decide which one is the true geographic container.)

## The results

Across the consolidated graph, the four passes flagged **130,737** bad edges. Each row below is a real example pulled straight from the run:

| Signal | Flagged | Example | Why it's wrong |
|---|---|---|---|
| redundant | 113,609 | Norwood → Ontario | Ontario is already reachable through Norwood's county |
| same_name | 11,547 | Marsh Baldon → Marsh Baldon | a place declared part of itself by name |
| geo_outlier | 5,336 | Northumberland → Ontario | the child sits 5,271 km from the parent's centre, vs a 704 km median for its siblings — the English Northumberland filed under Canadian Ontario |
| size_inversion | 245 | Ohio → Sedgwick County | Ohio spans ~502 km, the county ~71 km — more than 6× too big to fit inside it |

Each flagged edge carries its signal, the child and parent, a plain-language reason, and signal-specific evidence — the exact distances and radii, or the longer path that makes a redundant edge redundant — so every flag is reviewable rather than a black-box verdict.

The redundant pass dominates, and that's the headline: roughly **114,000** edges that were adding nothing but length to ancestry chains. Removing a redundant edge is provably lossless — the parent it points at is still reachable through the longer, more specific path, so nothing that could be reached before becomes unreachable. It is pure simplification. The geo-outlier and size-inversion passes are smaller but sharper — they catch the genuinely *wrong* parents, the ones that put an English county in Canada, and removing those actually changes what a place is part of.

These four signals also feed each other in review. A link that trips both the geo-outlier and the size-inversion checks is almost certainly two same-named places confused for one — which is a hint that the record may need not just an edge fix but a split, the problem the [divergence companion](/blog/finding-over-merged-places-in-lux-with-authority-divergence) takes up.

## Why it matters, and what's next

Stripping these edges does two things at once. The redundant cuts make every ancestry chain shorter and cleaner, so breadcrumbs and geographic facets stop repeating ancestors. The outlier and inversion cuts remove parents that were simply false, so the chains that remain are *true*.

After three phases — no loops, no duplicates, no broken nesting — the graph finally behaves like a clean hierarchy. Which surfaces the last structural question: some places legitimately relate to more than one parent, not by mistake, but because they genuinely span several at once. A mountain range crosses state lines; a sea touches many countries. Forcing those into a single `part_of` chain is itself the error. Handling them is [Phase 4](/blog/cleaning-the-lux-places-graph-phase-4-overlap).
