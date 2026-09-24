---
title: "Cleaning the LUX Places Graph, Phase 4: When Places Overlap Instead of Nest"
pubDate: 2026-06-15
description: "Mountain ranges, seas, and watersheds don't nest inside one parent — they span several. Here's how we found 8,308 places in LUX that need an 'overlaps' relationship instead of 'part_of'."
author: "William Mattingly"
tags: ["yale", "lux", "graph theory", "data quality"]
draft: true
---

> **Cleaning the LUX places graph** — a series:
> - Phase 1: [Dissolving a 398-node geographic cycle](/blog/dissolving-a-398-node-geographic-cycle-with-gemini-flash-lite)
> - Phase 2: [Merging duplicate places](/blog/cleaning-the-lux-places-graph-phase-2-merging-duplicates)
> - Phase 3: [Untangling bad nesting](/blog/cleaning-the-lux-places-graph-phase-3-untangling-bad-nesting)
> - **Phase 4: When places overlap instead of nest** *(you are here)*
> - Companion: [Finding over-merged places with authority divergence](/blog/finding-over-merged-places-in-lux-with-authority-divergence)

The first three phases of cleaning Yale's [LUX](https://lux.collections.yale.edu/) places graph all assumed the same picture of the world: every place nests inside exactly one chain of larger places. [Phase 1](/blog/dissolving-a-398-node-geographic-cycle-with-gemini-flash-lite) removed loops, [Phase 2](/blog/cleaning-the-lux-places-graph-phase-2-merging-duplicates) merged duplicates, and [Phase 3](/blog/cleaning-the-lux-places-graph-phase-3-untangling-bad-nesting) stripped the bad `part_of` edges. Most places really do nest. But some genuinely don't — and forcing *those* into a single parent is the error this phase corrects.

## The problem: places that span, not nest

A mountain range crosses several states. A sea touches a dozen countries. The Four Corners region sits exactly where Utah, Colorado, Arizona, and New Mexico meet. None of these is "part of" any one parent — each spans several at once. The honest relationship isn't `part_of`; it's `overlaps`.

In the raw graph these places have several parents, which looks like the bad nesting from Phase 3. The difference is that here the multiple parents are *correct* — the place really does belong to all of them, partially. The job of this phase is to tell the two situations apart: a place with a tangle of wrong parents (fix the edges) versus a place that genuinely spans several (change the relationship).

## How it works

Working on the consolidated graph, I flag any node with **two or more mutually-incomparable parents whose centroids are far apart**.

"Mutually incomparable" is the key idea. I keep only the *maximal* (outermost) parents and drop any parent that already nests inside another. So Madrid — whose parents chain Community of Madrid → Spain — collapses to a single container and is **not** flagged, because it really does nest. But Four Corners keeps `{Utah, Colorado, Arizona}`, because none of those contains the others. That one rule is what separates a normal nested place from a genuine spanner.

Two refinements sharpen the ranking. A feature keyword in the label — *range*, *sea*, *basin*, *river*, *peninsula*, and so on — raises a candidate's score, since those words describe exactly the kind of thing that spans. And spreads close to half the globe are flagged as suspect: they're usually an antimeridian averaging artifact, where a centroid computed across the date line lands in the wrong ocean. Those get pushed down the list rather than trusted.

## The results

The pass surfaced **8,308** candidates, with just **102** flagged as centroid artifacts — a clean signal. The feature-type breakdown reads like a gazetteer of things that span:

| Feature type | Candidates |
|---|---|
| river | 523 |
| region | 159 |
| mountains | 123 |
| bay | 111 |
| valley | 65 |
| gulf | 35 |
| sea | 26 |
| strait | 24 |
| *(no keyword)* | 6,918 |

The named examples are exactly what you'd hope to see. Every one of these came straight out of the run:

- **Andes** — Venezuela, Bolivia, Ecuador
- **Saint Elias Mountains** — British Columbia, Alaska, Yukon
- **Jordan River Valley** — Syria, Israel, Palestine, Lebanon
- **Tagus River Watershed** — Spain and Portugal
- **Black Sea Coast** — Turkey, Ukraine, Russia
- plus the **Pyrenees**, the **Iberian Peninsula**, **Delaware Bay** (Delaware and New Jersey), and the **Four Corners Region** itself

Each candidate can be mapped — the place at its centre with dashed lines reaching out to every region it overlaps — so confirming "yes, that really does span those four states" takes a glance rather than a query. The map is also where the suspect-centroid flag earns its keep: a watershed whose computed centre lands mid-ocean because its members straddle the date line is obvious the moment you see the dashed lines shoot halfway around the planet, and it can be set aside instead of mistaken for a real intercontinental span.

The downstream payoff is concrete. Once the Andes carries an `overlaps` relationship to Venezuela, Bolivia, and Ecuador rather than a forced `part_of` to one of them, a query for objects associated with any of those countries can correctly surface the range, and a query for the range can correctly reach into all three. The same holds for a sea touching a dozen coastlines or a river valley running through four countries — the relationship finally matches the geography instead of flattening it.

## The Andes, twice

Andes is worth dwelling on, because it shows up in two different parts of this project at once. Here in Phase 4 it's a legitimate overlap — a range that genuinely spans Venezuela, Bolivia, and Ecuador. But its parent list *also* contains "N.Y." — a stray link to [Andes, New York](https://en.wikipedia.org/wiki/Andes,_New_York), a completely different place that got fused into the same record.

That stray parent isn't an overlap to reclassify; it's an over-merge to split. One LUX record is carrying both a real multi-country span *and* a buried second place. The span is this phase's job; the buried second place is the job of the [companion divergence post](/blog/finding-over-merged-places-in-lux-with-authority-divergence). Seeing both problems sitting in a single record is a good reminder that these passes are complementary, not competing.

## Wrapping the structural pass

Converting these edges from `part_of` to `overlaps` lets LUX represent ranges, seas, and watersheds for what they are, instead of pretending each belongs to one arbitrary parent.

It also closes the loop on the structural cleanup. Across four phases we removed the cycles, merged the duplicates, stripped the broken nestings, and reclassified the genuine spanners — everything that can be diagnosed from the *shape* of the graph. What's left is the one question structure alone can't answer: when a record cites several external authorities, do those authorities even agree it's a single place? That's the [authority-divergence companion](/blog/finding-over-merged-places-in-lux-with-authority-divergence) to this series.
