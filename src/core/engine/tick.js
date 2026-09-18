import { deepFreeze } from '../scenario/definition.js';
import { evaluateEvents } from '../../systems/events/events.js';
import { evaluateAi } from '../../systems/ai/reactions.js';

// Monthly tick. Immutable update: returns a NEW frozen session (same id),
// so history can be kept by holding past sessions — the future replay hook.
// Order per tick: time → AI reacts → events fire → entries appended to the log.

function nextMonth({ year, month, day }) {
  if (month === 12) return { year: year + 1, month: 1, day };
  return { year, month: month + 1, day };
}

export function advanceMonth(session) {
  const ticked = {
    ...session.state,
    time: nextMonth(session.state.time),
    tick: session.state.tick + 1,
    postures: { ...session.state.postures },
    log: [...session.state.log],
  };
  const afterAi = evaluateAi(ticked, session.world);
  const afterEvents = evaluateEvents(afterAi.state, session.world);
  const entries = [...afterAi.entries, ...afterEvents.entries];
  const state = deepFreeze({
    ...afterEvents.state,
    log: Object.freeze([...afterEvents.state.log, ...entries.map((e) => Object.freeze({ ...e }))]),
  });
  return deepFreeze({ ...session, state });
}
