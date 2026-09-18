import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { enterGame } from '../../src/core/engine/boot.js';
import { advanceMonth } from '../../src/core/engine/tick.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fsReader = async (rel) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));

async function freshOttoman() {
  return enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
}

describe('tick + determinism (S4)', () => {
  it('advances one month and keeps the session frozen', async () => {
    const next = advanceMonth(await freshOttoman());
    assert.deepEqual(next.state.time, { year: 1326, month: 5, day: 7 });
    assert.equal(next.state.tick, 1);
    assert.ok(Object.isFrozen(next) && Object.isFrozen(next.state));
  });

  it('fires the Bursa boom (treasury effect) and the Byzantine reaction', async () => {
    const next = advanceMonth(await freshOttoman());
    assert.equal(next.state.treasury, 2525);
    assert.equal(next.state.postures.byzantines, 'wary');
    const texts = next.state.log.map((e) => e.text).join(' | ');
    assert.ok(texts.includes('Bursa trade boom'));
    assert.ok(texts.includes('Byzantium raises vigilance'));
  });

  it('rolls December into January of the next year', async () => {
    let session = await freshOttoman();
    for (let i = 0; i < 8; i++) session = advanceMonth(session);
    assert.deepEqual(session.state.time, { year: 1326, month: 12, day: 7 });
    session = advanceMonth(session);
    assert.deepEqual(session.state.time, { year: 1327, month: 1, day: 7 });
  });

  it('is deterministic: same seed, same ticks, same state', async () => {
    let a = await freshOttoman();
    let b = await freshOttoman();
    for (let i = 0; i < 3; i++) {
      a = advanceMonth(a);
      b = advanceMonth(b);
    }
    assert.deepEqual(a.state, b.state);
  });
});
