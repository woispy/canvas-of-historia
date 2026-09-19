# Autonomous System — How It Works

Date: 2026-09-18 · Status: active · Scope: `canvas-of-historia` repo only.

## 1. Members

| Member | Model | Mode | Role |
|--------|-------|------|------|
| Orchestrator / `build` | Nemotron 3 Ultra Free | primary | Directs work and owns project state |
| `@architect` | Nemotron 3 Ultra Free | subagent | Cross-domain architecture |
| `@coder` | Muse Spark 1.3 Free | subagent | Primary implementation |
| `@geography` | MiMo V2.5 Free | subagent | Historical geography, geometry, topology |
| `@simulation` | Nemotron 3 Ultra Free | subagent | Simulation systems |
| `@rendering` | Muse Spark 1.3 Free | subagent | Canvas/WebGPU/WebGL |
| `@qa` | Nemotron 3.5 Lightning Free | subagent | Fast tests and regression |
| `@forensic` | Nemotron 3 Ultra Free | subagent | Adversarial validation |
| `@performance` | Nemotron 3 Ultra Free | subagent | Performance, memory, lifecycle |
| `@analyst` | Nemotron 3.5 Lightning Free | subagent | Root-cause analysis |
| `@reviewer` | Muse Spark 1.2 Free | subagent | Final contract review |
| `@local-assist` | Jev 1.13 Free | subagent | Lightweight summaries/fallback |

All model identities are versioned in `.opencode/agents/*.md`. No Ollama/local model is required and no API secret is stored in the repository.

