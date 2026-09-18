// Mutable runtime state, derived from scenario + player choice.
// This is the save/load target (serialization arrives Phase 15).

export function createRuntimeState(def, playerCountryId) {
  if (!def.scenario.states.some((s) => s.id === playerCountryId)) {
    throw new Error(`unknown player country: ${playerCountryId}`);
  }
  const { year, month, day } = def.scenario.startDate;
  return {
    time: { year, month, day },
    playerCountryId,
    tick: 0,
    treasury: 2500,
    postures: {},
    log: [],
  };
}
