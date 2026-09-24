---
title: "Dissolving a 398-Node Geographic Cycle with Gemini Flash Lite"
pubDate: 2026-05-18
description: "How we found, visualized, and automatically fixed a massive circular reference in the LUX places hierarchy — for about three cents."
author: "William Mattingly"
tags: ["yale", "graph theory", "lux"]
image: "/images/blog/scc0.jpg"
draft: false
---

> **Cleaning the LUX places graph** — a series:
> - **Phase 1: Dissolving a 398-node geographic cycle** *(you are here)*
> - Phase 2: [Merging duplicate places](/blog/cleaning-the-lux-places-graph-phase-2-merging-duplicates)
> - Phase 3: [Untangling bad nesting](/blog/cleaning-the-lux-places-graph-phase-3-untangling-bad-nesting)
> - Phase 4: [When places overlap instead of nest](/blog/cleaning-the-lux-places-graph-phase-4-overlap)
> - Companion: [Finding over-merged places with authority divergence](/blog/finding-over-merged-places-in-lux-with-authority-divergence)

## The Problem

[LUX](https://lux.collections.yale.edu/) is Yale's cultural heritage platform. It aggregates millions of objects and places into a massive database. Each place has a `part_of` array pointing to its geographic parents: a town links to a county, a county to a state, and so on.

Conceptually, this should form a **directed acyclic graph**, often shortened to **DAG**. In plain language, that means every place can point upward to broader places, but the chain should never circle back to something it has already visited.

A healthy chain might look like this:

```text
New Haven → Connecticut → United States → North America
```

The direction is always "is part of." New Haven is part of Connecticut, Connecticut is part of the United States, and the United States is part of North America.

With more than 600,000 places coming from many source files, though, the hierarchy is difficult to keep perfectly clean. A single mistaken relationship can create a loop:

```text
California → New Mexico → Sierra County → United States → New Mexico → Sierra County → United States → ...
```

Once a loop exists, anything that tries to follow the hierarchy upward can get trapped. A page rendering breadcrumbs, a search filter building geographic facets, or a data pipeline calculating ancestors may keep walking forever unless it has extra protections.

The worst part is that the damage spreads. If a place sits beneath one of the cyclic nodes, then its ancestry is also contaminated. It may not be part of the original mistake, but it inherits the broken path.

## Step 1: Find the Cycles

The first job was not to fix anything. It was to answer a simpler question:

> Where are the loops?

The input was a 2.7 GB file of place records. Each record could contain one or more `part_of` links, which become arrows in the graph:

```text
child place → parent place
```

Instead of thinking about the records as documents, we should think of them as they are represented in LUX, that is as a network. Every place is a point. Every `part_of` relationship is an arrow. Framing this as a network problem makes it possible to ask graph questions rather than manually inspect hundreds of thousands of records.

To find cycles, I used **strongly connected components**. A strongly connected component is a group of nodes where every member can reach every other member by following arrows. In a normal geographic hierarchy, that should never happen. If a city can eventually lead back to itself through its parents, the hierarchy is broken.

The cycle finder produced this summary:

| Metric | Value |
|--------|-------|
| Places checked | 577,612 |
| Parent links checked | 639,844 |
| Cyclic groups found | 2,881 |
| Places stuck inside cycles | 6,573 |
| Largest cyclic group | 398 places |
| Links inside the largest group | 890 |
| Places affected downstream | 458,214 |

The largest group became the priority. It contained 398 places and included major geographic hubs like Switzerland, Brazil, and Mexico City.

That last number, 458,214, is the **blast radius**. It means nearly 80% of the database had at least one member of this bad group somewhere in its ancestry chain.

## Step 2: Understanding What We Found

Finding a cycle tells you where the structure is broken, but not which relationship caused the break.

A 398-place cycle is not one mistake. It is a knot of many relationships, some correct and some incorrect. The key question becomes:

> Which arrows should be removed so the hierarchy becomes valid again?

To make that question easier to answer, I exported the cycle data into reviewable files. The goal was to inspect the places, their labels, their identifiers, and the parent links connecting them.

I also used Gemini as a review assistant for two kinds of judgment:

| Review task | Question being asked |
|-------------|----------------------|
| Edge review | "Does this specific child-parent relationship make geographic sense?" |
| Parent review | "Given this place and all of its listed parents, which parents look wrong?" |

This was not asking the model to magically fix the database. It was using the model as a fast triage layer: provide the relevant records, ask a narrow question, require structured output, and then verify the proposed changes against the graph.

Each review cost less than a penny, which made it practical to spot-check many suspect relationships.

## Step 3: Visualize the Knot

Before deleting anything, I needed to see the shape of the problem.

I built a small browser-based graph viewer for the place hierarchy. It had three main views:

1. A ranked list of every cyclic group, from largest to smallest.
2. A focused view of one cyclic group, showing only the places and links involved in that knot.
3. An expandable neighborhood view, so I could walk outward to see ancestors and descendants around a suspicious place.

This mattered because graph errors are hard to understand as rows in a file. A mistaken relationship might look harmless in isolation, but visually it can be the one arrow that turns a tree into a loop.

The viewer made the largest component look exactly like what it was: a hairball. Hundreds of places were tangled together because the hierarchy had lost its one-way upward shape.

## Step 4: Ask Gemini for a First Pass

The largest cyclic group had 890 internal links. Reviewing each one by hand would have been slow and error-prone.

Instead, I sent Gemini the whole 398-place subgraph and asked for a proposed set of relationship deletions.

The prompt included:

- The rule that the final result must be a hierarchy without loops.
- Every place in the group, including its label and identifier.
- Every `part_of` link inside the group.
- A requirement to preserve meaningful geographic connectivity where possible.
- A structured response format listing only the links to remove.

The prompt was about 17,000 tokens, which fit comfortably inside Gemini Flash Lite's context window.

The model proposed 129 deletions. The cost was roughly half a cent.

I did not apply those changes blindly. First, I simulated them against the graph and re-ran the cycle detection. That first pass broke the original 398-place knot into 23 smaller cyclic fragments. It was not finished, but it had converted one large, confusing problem into several smaller ones.

## Step 5: Repeat on the Remaining Fragments

After the first pass, the workflow became iterative:

1. Start with the current graph.
2. Apply the proposed deletions in memory.
3. Re-check the graph for remaining cycles.
4. Send each remaining fragment back to Gemini for another focused review.
5. Cache the model's answers so repeated runs did not repeat the same paid work.

This is the important conceptual move: the goal was not to ask for one perfect answer. The goal was to create a loop of propose, test, narrow, and repeat.

Each round made the problem smaller. The first pass reduced one giant component to 23 fragments. The next rounds reduced those fragments further.

Then the process hit a small but interesting failure.

## Step 6: Fix the Identifier Problem

Some model responses returned malformed identifiers. The source data used long UUIDs, but the model sometimes saw an 8-character prefix and padded the rest with zeros, producing something that looked like a UUID but was not the real identifier.

Conceptually, this is a common issue when using language models with exact identifiers. Models are good at reasoning over labels and relationships, but exact opaque strings need extra care.

The fix was to make identifier matching more forgiving while still keeping it deterministic:

- Treat the first 8 characters as the stable reference.
- Resolve that prefix back to the real full identifier from the source data.
- Never trust a newly generated UUID-shaped string unless it matches an existing record.

After that adjustment, the remaining fragments could be processed reliably.

## Step 7: Confirm The Cycle Is Gone

At the end, the largest cyclic group had been dissolved:

```text
Original places in the knot: 398
Relationships removed:      204
Remaining cyclic fragments:  0
Approximate model cost:      $0.03
```

The most important number is the third one: zero remaining cyclic fragments. The 398-place knot no longer existed as a loop.

**Update**: We've now broken all SCCs in LUX and the cost was $6.46.

## Step 8: Compare Before And After

The graph viewer includes a comparison mode. It can show the original cyclic graph and the patched graph side by side.
That visual check is useful because a cycle fix should not merely satisfy an algorithm. It should also make sense to a human reviewer. The before view showed a dense red tangle. The after view showed the same data opening back up into a directional hierarchy.

## How the Blast Radius Works

One surprising result is that the blast radius barely changed:

```text
458,214 affected places → 458,202 affected places
```

That may look disappointing at first, but it is expected.

The blast radius measured how many places had one of the cyclic nodes somewhere in their ancestry. Because the broken component included major countries and regions, a huge portion of the database was naturally "under" those places.

Dissolving the cycle does not remove Brazil, Switzerland, Mexico City, or the descendants beneath them. It removes the circular logic that made those ancestry chains unsafe to traverse.

So the right success measure is not whether the blast radius collapses to zero. The right measure is whether those places can now be walked through safely without encountering a loop.

## What This Enables

This repair unlocked several practical improvements:

- Ancestor chains can be followed without infinite loops.
- Breadcrumbs and geographic facets can be generated more reliably.
- Nearly 500,000 affected place records now sit under a valid hierarchy.
- The same workflow can be reused for the 2,880 smaller cyclic groups that remain.

The broader lesson is that LLMs can be useful for data repair when the task is framed carefully. They should not be handed the database and asked to improvise. They work best when the surrounding system provides the graph structure, constrains the question, validates the answer, and repeats the process until the data satisfies the underlying rules.

**Model:** `gemini-3.1-flash-lite-preview` via Vertex AI.
