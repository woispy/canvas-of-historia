// Systemic events (slice set). Each evaluator is pure:
// (state, world) -> { state, entries }. Entries feed the event log.
// Effects must touch real state — no decorative events.

function fmtDate({ year, month, day }) {
  return `${day}.${month}.${year}`;
}

// S4: first-month Bursa trade boom. Chain: trade volume + → merchant wealth +
// → tax base + → treasury +. (City development + population arrive Phase 7.)
function bursaTradeBoom(state) {
  if (state.tick !== 1) return { state, entries: [] };
  const bonus = 25;
  return {
    state: { ...state, treasury: state.treasury + bonus },
    entries: [
      {
        tick: state.tick,
        date: fmtDate(state.time),
        text: `Bursa trade boom — new markets lift silk and cloth trade (+${bonus} treasury from tax base).`,
      },
    ],
  };
}

export function evaluateEvents(state, world) {
  void world;
  const evaluators = [bursaTradeBoom];
  let current = state;
  const entries = [];
  for (const evaluate of evaluators) {
    const result = evaluate(current);
    current = result.state;
    entries.push(...result.entries);
  }
  return { state: current, entries };
}
