# LLM Wiki

A pattern for building personal knowledge bases using LLMs.

Source: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
Author: Andrej Karpathy
Date ingested: 2026-04-06

This is an idea file, it is designed to be copy pasted to your own LLM Agent (e.g. OpenAI Codex, Claude Code, OpenCode / Pi, or etc.). Its goal is to communicate the high level idea, but your agent will build out the specifics in collaboration with you.

## The core idea

Most people's experience with LLMs and documents looks like RAG: you upload a collection of files, the LLM retrieves relevant chunks at query time, and generates an answer. This works, but the LLM is rediscovering knowledge from scratch on every question. There's no accumulation.

The idea here is different. Instead of just retrieving from raw documents at query time, the LLM **incrementally builds and maintains a persistent wiki** — a structured, interlinked collection of markdown files that sits between you and the raw sources. The knowledge is compiled once and then *kept current*, not re-derived on every query.

**The wiki is a persistent, compounding artifact.** The cross-references are already there. The contradictions have already been flagged. The synthesis already reflects everything you've read.

## Architecture

Three layers: **Raw sources** (immutable), **The wiki** (LLM-maintained markdown), **The schema** (conventions + workflows).

## Operations

- **Ingest**: Process new sources, update wiki pages, maintain cross-references
- **Query**: Search the wiki, synthesize answers, optionally file valuable results back
- **Lint**: Health-check for contradictions, stale claims, orphans, missing connections

## Why it works

Humans handle curation and thinking; LLMs handle bookkeeping. Maintenance burden approaches zero because LLMs don't tire or forget cross-references.
