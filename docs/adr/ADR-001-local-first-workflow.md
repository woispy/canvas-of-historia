# ADR-001: Local-first workflow with GitHub as mirror

Date: 2026-09-18
Status: Accepted

## Context

The project starts from an empty repo. The agent team runs on limited shared
model quota. Early iteration speed matters more than clean-room verification,
and there is no CI pipeline yet.

## Decision

1. All development and tests run locally (Node 24, npm 11).
2. OpenCode Zen hosted models are the default inference layer; no local LLM runtime is required.
3. GitHub (`woispy/canvas-of-historia`) is used as mirror + backup only.
3. No agent pushes without explicit user approval.
4. A fast local test gate is added with the first scaffold; GitHub Actions CI
   (layered: fast PR gate + slow nightly) is added later, once the project
   structure stabilizes.
5. Model assignments are versioned in `.opencode/agents/*.md`; provider credentials remain outside the repository.

## Consequences

- (+) Fast feedback, no CI queue waits, no CI minutes spent during scaffolding.
- (+) Agent quota is spent on real work, not on polling remote state.
- (-) "Works on my machine" risk until CI exists; mitigated by `package-lock.json`,
      a pinned Node version, and reviewer layering checks.
