import { deepFreeze } from '../scenario/definition.js';

// Single frozen session root: { id, version, scenario, world, state }.
// Everything downstream (save/load, replay, AI tests) targets this shape.

let nextSessionId = 1;

export function createGameSession({ scenario, world, state }) {
  const session = {
    id: `session-${nextSessionId++}`,
    version: 1,
    scenario: deepFreeze(structuredClone(scenario)),
    world,
    state,
  };
  return deepFreeze(session);
}
