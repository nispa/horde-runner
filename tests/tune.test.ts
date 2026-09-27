/// <reference types="node" />
// Strumento di taratura (non è un test): prova moltiplicatori della vita degli zombi.
// Uso: TUNE=1 npx vitest run tune
import { describe, it } from 'vitest';
import type { LevelDef } from '../src/core/types';
import { CAMPAIGN } from '../src/data/campaign';
import { play, randomBot, smartBot } from './bots';

const SCALES = [0.4, 0.5, 0.6, 0.7, 0.8, 1];
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

function scaled(level: LevelDef, k: number): LevelDef {
  return {
    ...level,
    entities: level.entities.map(e => (e.type === 'wave' ? { ...e, hp: Math.max(1, Math.round(e.hp * k)) } : e)),
  };
}

describe.runIf(process.env.TUNE)('taratura', () => {
  it('stampa le statistiche per moltiplicatore', () => {
    const rows: Record<string, string> = {};
    CAMPAIGN.forEach((level, i) => {
      for (const k of SCALES) {
        const lv = scaled(level, k);
        const smart = SEEDS.map(s => play(lv, smartBot, s));
        const rnd = SEEDS.map(s => play(lv, randomBot(s), s));
        const win = (gs: typeof smart) => gs.filter(g => g.status === 'won');
        const avg = (gs: typeof smart) => Math.round(gs.reduce((a, g) => a + g.player.soldiers, 0) / Math.max(1, gs.length));
        const prog = Math.round(smart.reduce((a, g) => a + g.progress, 0) / smart.length * 100);
        rows[`L${i + 1} x${k}`] = `smart ${win(smart).length}/20 (sold. ${avg(win(smart))}, prog ${prog}%)  random ${win(rnd).length}/20`;
      }
    });
    console.table(rows);
  });
});
