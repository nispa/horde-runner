/// <reference types="node" />
// Strumento di analisi (non è un test): traccia i soldati del bot attento lungo un livello.
// Uso: TRACE=2 npx vitest run trace --silent=false   (numero del livello)
import { describe, it } from 'vitest';
import { Game } from '../src/core/game';
import { firepower } from '../src/core/rules';
import { CAMPAIGN } from '../src/data/campaign';
import { smartBot } from './bots';

describe.runIf(process.env.TRACE)('traccia', () => {
  it('stampa soldati e potenza a ogni entità', () => {
    const level = CAMPAIGN[Number(process.env.TRACE) - 1];
    const g = new Game(level, 1);
    const marks = [...level.entities].sort((a, b) => a.z - b.z);
    const rows: string[] = [];
    let next = 0;
    while (g.status === 'playing') {
      g.steerTo(smartBot(g));
      g.step(1 / 60);
      while (next < marks.length && g.player.z >= marks[next].z + 3) {
        const e = marks[next++], p = g.player;
        const what = e.type === 'wave' ? `wave ${e.count}x${e.hp}${e.bite ? ` bite${e.bite}` : ''}` : e.type === 'wall' ? `wall hp${e.hp} ${e.reward.kind}` : 'gate';
        rows.push(`z${String(e.z).padStart(4)} ${what.padEnd(22)} → soldati ${String(p.soldiers).padStart(4)}  dps ${Math.round(firepower(p.soldiers, p.damage) * p.fireRate)}`);
      }
    }
    rows.push(`fine: ${g.status} a z=${Math.round(g.player.z)}`);
    console.log(rows.join('\n'));
  });
});
