// AI reactions (slice set). Scripted, deterministic stand-ins for the Phase 13
// per-state AI: same state in → same reaction out. No randomness anywhere.

function fmtDate({ year, month, day }) {
  return `${day}.${month}.${year}`;
}

// S4: after the first tick, Byzantium notes the Ottoman consolidation and
// raises frontier vigilance. Visible in state.postures, reported in the log.
function byzantineVigilance(state) {
  if (state.tick !== 1) return { state, entries: [] };
  if (state.postures.byzantines === 'wary') return { state, entries: [] };
  return {
    state: { ...state, postures: { ...state.postures, byzantines: 'wary' } },
    entries: [
      {
        tick: state.tick,
        date: fmtDate(state.time),
        text: 'Byzantium raises vigilance on the Nicomedian frontier.',
      },
    ],
  };
}

export function evaluateAi(state, world) {
  void world;
  const evaluators = [byzantineVigilance];
  let current = state;
  const entries = [];
  for (const evaluate of evaluators) {
    const result = evaluate(current);
    current = result.state;
    entries.push(...result.entries);
  }
  return { state: current, entries };
}
