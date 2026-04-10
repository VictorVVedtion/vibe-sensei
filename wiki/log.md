# Wiki Log

Append-only chronological record of wiki operations.

## [2026-04-06] init | Wiki initialized

Created wiki instance for Vibe Sensei trading knowledge base.
Structure: schema, index, log, raw/, pages/.
Pattern: [LLM Wiki by Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

## [2026-04-06] ingest | Karpathy LLM Wiki gist

Source: `raw/karpathy-llm-wiki-gist.md`
The foundational pattern document. Three-layer architecture (raw → wiki → schema), three operations (ingest, query, lint). Wiki as persistent compounding artifact.
Pages touched: schema.md (created), overview.md (created).

## [2026-04-06] seed | 8 Legendary master pages

Created master pages for all 8 Legendary-tier guardians + Nassim Taleb (Epic, but foundational concept author):
jesse-livermore, george-soros, warren-buffett, benjamin-graham, jim-simons, nassim-taleb, sun-tzu, satoshi-nakamoto, john-von-neumann.
Each page includes: philosophy, key trades/contributions, connections to other masters, relevance to Vibe Sensei.

## [2026-04-06] seed | 5 core concept pages

Created: position-sizing, reflexivity, kelly-criterion, margin-of-safety, antifragility.
These are the recurring themes across all 68 masters. Every master page cross-references at least one concept page.

## [2026-04-06] seed | 3 ghost cautionary pages

Created: ftx-collapse, three-arrows-capital, ltcm-collapse.
Each analyzed through the wiki's concept framework (reflexivity, position-sizing, antifragility). LTCM↔3AC parallel documented.

## [2026-04-06] seed | 1 comparison page

Created: value-vs-momentum (Buffett vs. Livermore). Includes synthesis via Soros/Druckenmiller and crypto application. Connected to debate engine in src/buddy/debate.ts.
