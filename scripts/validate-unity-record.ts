import { readFile } from 'node:fs/promises';
import { decodeRecord } from '../src/match/record';
const { record, game } = decodeRecord(await readFile('.openai/unity-roundtrip.json', 'utf8'));
if (record.actions.length !== 15 || game.phase !== 'finished') throw new Error('Unity record replay diverged.');
console.log(`Unity → original TypeScript replay passed: ${record.actions.length} plies, ${JSON.stringify(game.result)}`);
