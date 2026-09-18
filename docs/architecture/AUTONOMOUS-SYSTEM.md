# Autonomous System — How It Works

Date: 2026-09-18 · Status: active · Scope: `canvas-of-historia` repo only.

## 1. Members

| Member | Engine | Mode | Can edit code | Can run commands | May write |
|--------|--------|------|---------------|------------------|-----------|
| Orchestrator (this session, `build`) | Muse Spark | primary | yes | yes | everything (no push without approval) |
| `@coder` | qwen3-coder-480b (NVIDIA) | subagent | yes | yes, except `git push*` (ask) | everything except push |
| `@analyst` | deepseek-v3.2 (NVIDIA) | subagent | only `docs/work-log/` | `git log/diff/status` free, rest ask | work-log |
| `@reviewer` | mistral-large-3 (NVIDIA) | subagent | only `docs/work-log/` | no | work-log |
| `@local-assist` | llama3.1:8b (Ollama, on this PC) | subagent | only `docs/work-log/` | `git log/diff/status` free, rest ask | work-log |

Config lives in `.opencode/agents/*.md` (versioned). Provider/auth stays
global; the repo holds no secrets. Local engine needs `ollama serve` running.

## 2. The loop (every task runs this)

```text
1. ORCHESTRATOR reads docs/STATUS.md → picks ONE next task
2. @coder implements (max 40 steps) → leaves changes uncommitted
3. @reviewer checks diff → PASS or RED (file:line findings)
4. if RED → @analyst finds root cause → @coder fixes (back to 3)
5. ORCHESTRATOR runs npm test → green required
6. ORCHESTRATOR updates docs/STATUS.md + work-log, proposes commit
7. HUMAN approves push (agents never push on their own)
```

One task per coder run. Scope expansion is forbidden by agent prompt.

## 3. Continuity (how nobody loses the plot)

- `AGENTS.md` auto-loads into every agent, every session.
- `docs/STATUS.md` is the single source of truth (phase, done, next, open).
- Every run ends with a dated `docs/work-log/` entry (goal, changes, tests, open).
- Bigger calls become `docs/adr/ADR-NNN` records.
- A returning agent (including the orchestrator after compaction/restart)
  re-orients via AGENTS.md → STATUS.md → linked work-logs. No chat memory needed.

## 4. Quota economics

NVIDIA models share one quota pool; each agent step spends it. Controls:
`steps` caps per agent (coder 40, analyst 20, reviewer 15, local-assist 10),
small single tasks, no polling loops. `@local-assist` is quota-free and doubles
as offline fallback when NVIDIA quota is exhausted. Long autonomous runs are
batched by the human, never left open-ended.

## 5. Human gates (what the system will NOT do alone)

- Never `git push`, never commit secrets, never touch other repos
  (`../opencode/historia-ai` is read-only reference).
- Never message external chats (ChatGPT web etc.) — delivery ends at a
  ready-to-paste brief.
- RED verdicts stop the line; fixes need a new coder run, not silent edits.
- Brief §87 applies: a feature is done only when its DATA → SYSTEM → RUNTIME →
  UI → TEST chain (and later RENDERING → PERFORMANCE → MEMORY) is verified.

## 6. How to operate it

- In OpenCode TUI: `@coder <task>`, `@reviewer check the diff`, `@analyst <failure>`,
  `@local-assist summarize STATUS`. Tab switches primary agents.
- Headless: `opencode run -m nvidia/<model> --agent <name> "<task>"` from repo root.
- First live demonstration: slice step S1 (1326 seed + `enterGame` chain).
