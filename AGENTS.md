# Canvas of Historia — Agent Guide

> This file is auto-loaded as project instructions for every agent.
> Game brief arrives separately from the user; until then, no game code is written.

## Project

- Fresh start. Remote: `woispy/canvas-of-historia`. Summaries in Turkish; code and technical detail in English.
- Reference project (READ-ONLY): `../opencode/historia-ai` — study its systems and docs, never copy files blindly, never commit there.
- Historia AI continues separately and is unrelated to this repo's future.

## Team

- Orchestrator (primary `build` agent): splits work, dispatches subagents, merges results, owns `docs/STATUS.md`.
- `@coder`: implements exactly one task per run. Never pushes to any remote.
- `@analyst`: diagnoses failures, proposes the next 1-3 tasks. May write only to `docs/work-log/`.
- `@reviewer`: PASS/RED contract and layering review. May write only to `docs/work-log/`.
- `@local-assist`: lightweight hosted helper for summaries, status reports, and simple codebase questions. Escalates hard tasks instead of guessing.
- `@nim-coder`: NVIDIA NIM coding workhorse.
- `@nim-reasoning`: NVIDIA NIM high-reasoning specialist.
- NVIDIA NIM is a first-class inference lane; Ollama/local LLM is not used.

## Continuity discipline (mandatory for every run)

1. Start by reading `docs/STATUS.md` (plus linked work-log entries if needed).
2. End by appending a dated entry to `docs/work-log/YYYY-MM-DD-<slug>.md`: goal, changes, test results, open items.
3. If project state changed, propose the `docs/STATUS.md` update; the orchestrator applies it.
4. Bigger decisions go to `docs/adr/ADR-NNN-<slug>.md` and are referenced from `docs/STATUS.md`.

## Local-first

- All development and tests run locally (Node 24, npm). AI inference uses OpenCode Zen hosted models plus NVIDIA NIM. NIM may be hosted by NVIDIA or self-hosted through an OpenAI-compatible /v1 endpoint; no Ollama/local LLM is required. GitHub is mirror + backup; CI is added later when the project matures. See `docs/adr/ADR-001-local-first-workflow.md`.
- Never push without explicit user approval. Never commit secrets (`*.env`, API keys, tokens).
