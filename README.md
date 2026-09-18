# Canvas of Historia (CoH)

Historical grand-strategy sandbox. First production scenario: **7 April 1326**
(Bursa freshly under Ottoman control; history is the start condition, the
player's decisions fork into alternate history from there).

- Vision draft: `docs/vision/MASTER-BRIEF-v1.md`
- Architecture: `docs/architecture/SYSTEM-ARCHITECTURE.md`
- Vertical slice: `docs/roadmap/VERTICAL-SLICE-1326.md`
- Contracts: `docs/contracts/`
- Agent team + workflow: `AGENTS.md` (auto-loaded), current state: `docs/STATUS.md`

## Local-first workflow (ADR-001)

```sh
npm install   # once
npm run dev   # local dev server (port 5174)
npm test      # node:test suites
```

GitHub is mirror + backup; no pushes without explicit approval. CI arrives
once the structure stabilizes.

## Documentation discipline

Every run starts from `docs/STATUS.md` and ends with a dated entry in
`docs/work-log/`. Decisions go to `docs/adr/`.
