# AI Model Routing — Canvas of Historia

## Inference lanes

Canvas of Historia uses two complementary inference lanes:
1. OpenCode Zen — general hosted agent pool.
2. NVIDIA NIM — NVIDIA model lane for high-throughput reasoning/coding and, where available, multimodal workloads.

Ollama is intentionally retired.

## NVIDIA NIM configuration

OpenCode supports NVIDIA NIM through the `nvidia` provider with a custom base URL. NIM exposes an OpenAI-compatible `/v1` API.

Set these outside Git:

```powershell
$env:NVIDIA_NIM_BASE_URL="http://localhost:8000/v1"
$env:NVIDIA_API_KEY="..."
```

For a self-hosted NIM, the API key can be omitted when the deployment does not require one.

Before using NIM agents, verify:

```powershell
curl http://localhost:8000/v1/health/ready
curl http://localhost:8000/v1/models
```

The served model name must match the model expected by the OpenCode provider. NVIDIA documents `NIM_SERVED_MODEL_NAME` for explicitly controlling that name.

## Routing policy

- `@nim-reasoning`: difficult architecture, forensic analysis, long-context reasoning.
- `@nim-coder`: implementation and long-running coding tasks.
- Zen agents remain available as the general fallback/parallel lane.
- The Director chooses the lane based on task type, endpoint readiness, and measured benchmark results.
- Never silently switch a NIM task after a model-not-found error; surface the mismatch and re-route explicitly.

## Benchmark requirement

Before making permanent routing decisions, benchmark code generation/editing, repository navigation, tool calling, long-context architecture review, historical-data reasoning, structured JSON output, latency/throughput, and failure recovery.

The benchmark result becomes the source of truth for model routing, not model-name assumptions.