---
title: "Cleaning the LUX Places Graph, Phase 2: Merging Duplicate Places"
pubDate: 2026-06-01
description: "The same real place gets entered into LUX many times under different renderings. Here's how a cheap label heuristic, a recursive merge simulation, and a small model collapsed 97,608 duplicate records into 59,454 places."
author: "William Mattingly"
tags: ["yale", "lux", "graph theory", "data quality"]
draft: true
---

> **Cleaning the LUX places graph** — a series:
> - Phase 1: [Dissolving a 398-node geographic cycle](/blog/dissolving-a-398-node-geographic-cycle-with-gemini-flash-lite)
> - **Phase 2: Merging duplicate places** *(you are here)*
> - Phase 3: [Untangling bad nesting](/blog/cleaning-the-lux-places-graph-phase-3-untangling-bad-nesting)
> - Phase 4: [When places overlap instead of nest](/blog/cleaning-the-lux-places-graph-phase-4-overlap)
> - Companion: [Finding over-merged places with authority divergence](/blog/finding-over-merged-places-in-lux-with-authority-divergence)

In [Phase 1](/blog/dissolving-a-398-node-geographic-cycle-with-gemini-flash-lite) I dissolved the cycles in Yale's [LUX](https://lux.collections.yale.edu/) places graph — the loops where a place ends up listed as part of itself. With the loops gone, the graph is finally safe to walk, and that exposes the next problem hiding underneath them: the same real place entered many times over, each copy rendered a little differently.

This is Phase 2: finding those duplicates and merging them back into one place.

## The problem: one place, many records

LUX aggregates places from many source catalogs, and each catalog writes a name its own way. Under the parent "Calif." you find `Los Angeles`, `Los Angeles (Calif.)`, and the full catalog-path form `North America. USA. California. Los Angeles` — three separate records for one city.

The scale of this is easy to underestimate. The single most-duplicated place I found was **Cincinnati**: 194 records sitting under one parent, 193 of them the byte-identical catalog path `North America. USA. Ohio. Hamilton County. Cincinnati`, plus one lonely `Cincinnati`. Every one of those 194 is the same city.

Duplicates like this quietly corrupt everything downstream. Object counts get split across copies, links that should converge on one place fan out across several, and a user browsing by geography sees the same city listed again and again.

## How it works: a label heuristic, then a model

The instinct is to throw a model at every cluster of look-alike children. But the data's shape argues for a cheap filter first. Empirically, duplicate twins almost never *both* carry an external authority id — the usual pattern is one rich record plus one or more bare ones — so matching on shared ids finds almost nothing. **The label is the dominant signal.**

So the heuristic clusters a parent's children when they share any external id **or** a normalised label. Normalisation strips parenthetical qualifiers like `(Calif.)` and continent-rooted catalog paths, but does **no** substring matching — so `East Los Angeles` never gets collapsed onto `Los Angeles`. They are different places, and they stay different.

A model ([Gemini](https://deepmind.google/technologies/gemini/)) then confirms each cluster. It sees the cluster collapsed to its **distinct renderings** — a cluster of 113 byte-identical labels becomes one rendering, ×113 — with any ids and a Wikidata description attached, and decides which renderings are truly the same place. It is told emphatically that similar-but-different places must stay apart: a county is not the city of the same name, and `Cambridge (Mass.)` is not `Cambridge (England)`. Byte-identical renderings are merged deterministically with **no** API call at all; the model is only spent when there are two or more genuinely distinct renderings to weigh.

## The recursive merge simulation

Before touching any live data, I run a deterministic what-if across the whole cleaned graph — no model involved. The question it answers: *if we applied every heuristic merge, then re-checked, and kept going until nothing new merged, what would the result be?*

The reason it has to recurse is subtle. Merging two duplicate **parents** pools their children into a single sibling set — which can reveal duplicate **grandchildren** that the first pass couldn't see, because they were sitting under different copies of the same parent. It's a union-find graph contraction run to a fixpoint, and every node records the round it first merged, so any round-2-or-later merge is one the recursion uncovered.

On the current data it converges in four rounds:

| Round | Merges | What it found |
|---|---|---|
| 1 | 95,717 | direct duplicates |
| 2 | 1,882 | revealed after parents merged |
| 3 | 9 | revealed after round 2 |
| 4 | 0 | fixpoint reached |

That's **97,608** duplicate records collapsing into **59,454** places, with **1,846** of those groups only forming because of the recursion. And a clean confirmation of the design choice above: every single merge fired on the label signal — the external-id signal triggered *exactly zero* merges that the labels hadn't already caught. On this data, the rendering of the name really is the whole story.

## Picking a survivor, and a built-in confidence check

Each group keeps one **canonical** record to merge the rest into. A record carrying Wikidata or GeoNames wins that slot — those are the authoritative entries — falling back to any authority, then to the record with the most children.

Because every member carries a coordinate parsed from its geometry, each group also reports the spread of its members' coordinates (RMS kilometers from the centroid) as a free confidence score:

| Coordinate spread | Groups | Reading |
|---|---|---|
| exactly 0 km | 8,899 | every copy plotted at the same point — about as confident as a duplicate gets |
| under 1 km | 8,719 | effectively the same spot |
| 1–1,000 km | 14,774 | same place, looser coordinates |
| over 1,000 km | 144 | review by hand — heuristic over-reach or a bad coordinate |

That last bucket is the useful one: a spread of more than 1,000 km usually means the heuristic over-merged, or a coordinate is simply wrong. A flipped longitude sign, for instance, shows up as a roughly 19,000 km spread — impossible to miss.

## What this produces, and what's next

Confirmed groups get contracted to their canonical node, which rebuilds the graph: it drops from about 663,000 edges to roughly 544,000, with around 98,000 records merged away. That **consolidated graph** is the input to the next phase.

There's a nice symmetry worth flagging before moving on. Phase 2 takes many records that are secretly one place and merges them. The [companion divergence post](/blog/finding-over-merged-places-in-lux-with-authority-divergence) does the exact opposite — it finds one record that is secretly *many* places and splits it. Same project, mirror-image problems.

With the duplicates gone, the remaining mess isn't in the nodes anymore — it's in the edges between them: `part_of` links that are redundant, reversed, or geographically impossible. That's [Phase 3](/blog/cleaning-the-lux-places-graph-phase-3-untangling-bad-nesting).
