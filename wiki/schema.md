# Vibe Sensei Wiki — Schema

This file tells the LLM how the wiki is structured, what conventions to follow, and what workflows to use when ingesting sources, answering queries, or maintaining the wiki.

## Purpose

This wiki is a persistent, compounding knowledge base for **trading, investing, and market wisdom**. It draws from the philosophies of Vibe Sensei's 68 master guardians — historical traders, investors, philosophers, and scientists whose strategies and failures form the backbone of the guardian system.

The wiki sits between raw sources (articles, papers, transcripts, books) and the user. Knowledge is compiled once and kept current, not re-derived on every query.

## Directory Structure

```
wiki/
├── schema.md          # This file — wiki conventions and workflows
├── index.md           # Content catalog — updated on every ingest
├── log.md             # Chronological operation log (append-only)
├── raw/               # Immutable source documents (the LLM reads, never modifies)
│   └── assets/        # Downloaded images and attachments
└── pages/             # LLM-maintained wiki pages
    ├── overview.md    # High-level synthesis of the entire wiki
    ├── masters/       # One page per master guardian (philosophy, strategy, key trades)
    ├── concepts/      # Trading concepts, strategies, mental models
    ├── markets/       # Market events, crises, regime changes
    ├── comparisons/   # Cross-master and cross-strategy comparisons
    └── ghosts/        # Cautionary tales from crypto's fallen
```

## Page Format

Every wiki page uses this structure:

```markdown
---
title: Page Title
type: master | concept | market | comparison | ghost | overview
tags: [relevant, tags]
sources: [list of raw source filenames]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# Page Title

Brief summary (2-3 sentences).

## Sections

Content organized by topic. Use `[[wiki-links]]` for cross-references to other pages.

## See Also

- [[related-page-1]]
- [[related-page-2]]
```

## Conventions

- **Wiki links**: Use `[[page-name]]` syntax (Obsidian-compatible). Page names use kebab-case.
- **Citations**: Reference raw sources as `[source: filename.md]` inline.
- **Contradictions**: When sources disagree, note both positions explicitly: `> **Contradiction**: Source A claims X, but Source B argues Y.`
- **Confidence levels**: For synthesized claims, optionally note confidence: `(high confidence — 3+ sources agree)` or `(speculative — single source)`.
- **No hallucination**: If the wiki doesn't have enough information to answer, say so. Don't fabricate.
- **Master voice**: Pages in `masters/` should capture the master's actual philosophy and known quotes, not invented personality.

## Workflows

### Ingest

When the user adds a new source to `raw/` and asks to ingest it:

1. Read the source document fully.
2. Discuss key takeaways with the user.
3. Create or update a summary page in `pages/`.
4. Update relevant entity, concept, and master pages across the wiki.
5. Update `index.md` with new/modified pages.
6. Append an entry to `log.md`.
7. Update `pages/overview.md` if the new source shifts the big picture.

A single source may touch 5-15 wiki pages. Prefer one-at-a-time ingestion with user involvement.

### Query

When the user asks a question against the wiki:

1. Read `index.md` to find relevant pages.
2. Read those pages.
3. Synthesize an answer with citations to wiki pages and raw sources.
4. If the answer is valuable and reusable, offer to file it as a new wiki page.

### Lint

Periodic health-check. Look for:

- Contradictions between pages
- Stale claims superseded by newer sources
- Orphan pages with no inbound links
- Important concepts mentioned but lacking their own page
- Missing cross-references
- Data gaps that could be filled with research

### Update Master Pages

When new information about a master guardian is ingested:

1. Update the master's page in `pages/masters/`.
2. Update any comparison pages that include this master.
3. Check if the master's known trades or philosophy connect to existing concept pages.
4. Update the ghost page if the master has a cautionary tale.

## Categories

| Category | Directory | Description |
|----------|-----------|-------------|
| Masters | `pages/masters/` | One page per guardian — biography, philosophy, key trades, risk style |
| Concepts | `pages/concepts/` | Trading strategies, mental models, risk frameworks |
| Markets | `pages/markets/` | Historical events, crises, regime changes |
| Comparisons | `pages/comparisons/` | Cross-master debates, strategy matchups |
| Ghosts | `pages/ghosts/` | Cautionary tales — what went wrong and why |
| Overview | `pages/overview.md` | Living synthesis of the entire knowledge base |

## Integration with Vibe Sensei

This wiki feeds the guardian system. Master pages inform persona responses. Concept pages ground the risk checks. Ghost pages power the warning system. The wiki is the knowledge layer behind the characters.

When updating `src/buddy/` code (personas, quotes, ghost warnings), cross-reference with wiki pages for accuracy.
