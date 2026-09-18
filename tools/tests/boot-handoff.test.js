import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { enterGame } from '../../src/core/engine/boot.js';
import { getProvince, provincesOfState, worldCounts } from '../../src/core/world/queries.js';
import { ScenarioError } from '../../src/core/scenario/validator.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fsReader = async (rel) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));

describe('boot handoff (S1)', () => {
  it('enterGame boots the 1326 Ottoman session', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    assert.equal(session.version, 1);
    assert.deepEqual(session.state.time, { year: 1326, month: 4, day: 7 });
    assert.equal(session.state.playerCountryId, 'ottomans');
    assert.ok(Object.isFrozen(session), 'session root is frozen');
    assert.deepEqual(worldCounts(session.world), { states: 4, anchors: 17, provinces: 6, cities: 6 });
    const bursa = getProvince(session.world, 'bursa');
    assert.equal(bursa.ownerStateId, 'ottomans');
    assert.equal(provincesOfState(session.world, 'ottomans').length, 1);
  });

  it('rejects an unknown player country', async () => {
    await assert.rejects(
      enterGame(fsReader, { scenarioId: '1326', countryId: 'romans' }),
      (err) => err instanceof ScenarioError && err.stage === 'enterGame',
    );
  });

  it('rejects a broken definition at validate stage', async () => {
    const broken = async (rel) => {
      const data = await fsReader(rel);
      if (rel.endsWith('scenario.json')) return { ...data, states: [] };
      return data;
    };
    await assert.rejects(
      enterGame(broken, { scenarioId: '1326', countryId: 'ottomans' }),
      (err) => err instanceof ScenarioError && err.stage === 'validate',
    );
  });
});
