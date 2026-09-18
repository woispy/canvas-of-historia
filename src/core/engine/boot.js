import { loadScenario } from '../scenario/loader.js';
import { validateScenario, ScenarioError } from '../scenario/validator.js';
import { bootstrapWorld } from '../world/factory.js';
import { createRuntimeState } from '../state/runtime.js';
import { createGameSession } from './session.js';

// Single orchestrator: load → validate → world → state → session.
// Each stage is wrapped so failures name the stage. Throws, never half-boots.

export async function enterGame(readJson, { scenarioId, countryId }) {
  const stages = {
    load: () => loadScenario(readJson, scenarioId),
    validate: (def) => {
      validateScenario(def);
      return def;
    },
    world: (def) => ({ def, world: bootstrapWorld(def) }),
    state: ({ def, world }) => ({ def, world, state: createRuntimeState(def, countryId) }),
    session: ({ def, world, state }) => createGameSession({ scenario: def.scenario, world, state }),
  };
  let value;
  const order = ['load', 'validate', 'world', 'state', 'session'];
  try {
    for (const name of order) {
      if (name === 'load') value = await stages.load();
      else if (name === 'validate') value = stages.validate(value);
      else value = stages[name](value);
    }
    return value;
  } catch (err) {
    if (err instanceof ScenarioError) throw err;
    throw new ScenarioError('enterGame', [err.message]);
  }
}
