/// <reference types="node" />
// Strumento di taratura (non è un test): cerca la vita del boss per cui il bot attento
// vince circa l'85% delle partite. Uso: BOSS_TUNE=1 npx vitest run boss-tune --silent=false
import { describe, it } from 'vitest';
import type { LevelDef } from '../src/core/types';
import { CAMPAIGN } from '../src/data/campaign';
import { play, randomBot, smartBot } from './bots';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const TARGET = 0.85;

function withBossHp(level: LevelDef, hp: number): LevelDef {
  return { ...level, entities: level.entities.map(e => (e.type === 'boss' ? { ...e, hp } : e)) };
}

function winRate(level: LevelDef, bot = smartBot): number {
  return SEEDS.filter(s => play(level, bot, s).status === 'won').length / SEEDS.length;
}

describe.runIf(process.env.BOSS_TUNE)('taratura boss', () => {
  it('stampa la vita consigliata per ogni boss', () => {
    const rows: Record<string, unknown> = {};
    CAMPAIGN.forEach((level, i) => {
      let lo = 100, hi = 50000;
      for (let k = 0; k < 12; k++) {
        const mid = Math.round((lo + hi) / 2);
        if (winRate(withBossHp(level, mid)) >= TARGET) lo = mid; else hi = mid;
      }
      const hp = Math.round(lo / 50) * 50;
      const tuned = withBossHp(level, hp);
      rows[`L${i + 1}`] = { hp, smart: winRate(tuned), random: SEEDS.filter(s => play(tuned, randomBot(s), s).status === 'won').length / 20 };
    });
    console.table(rows);
  });
});
