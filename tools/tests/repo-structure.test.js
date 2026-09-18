import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const required = [
  'package.json',
  'vite.config.js',
  'index.html',
  'AGENTS.md',
  'opencode.json',
  'src/main.js',
  'docs/STATUS.md',
  'docs/architecture/SYSTEM-ARCHITECTURE.md',
  'docs/contracts/scenario.schema.json',
  'docs/contracts/province.schema.json',
  'docs/contracts/city.schema.json',
  'docs/contracts/land.schema.json',
  'docs/contracts/coastline.schema.json',
  'docs/contracts/terrain.schema.json',
  'docs/roadmap/VERTICAL-SLICE-1326.md',
  'docs/vision/MASTER-BRIEF-v1.md',
  'data/scenarios/1326',
  'tools/tests',
];

describe('repo structure contract (phase 0)', () => {
  for (const rel of required) {
    it(`has ${rel}`, () => {
      assert.ok(existsSync(path.join(root, rel)), `missing: ${rel}`);
    });
  }
});
