// Bilanciamento: un giocatore attento deve vincere, uno distratto deve perdere spesso.
// `npm test -- balance` stampa anche le statistiche.
import { describe, expect, it } from 'vitest';
import type { LevelDef } from '../src/core/types';
import level1 from '../src/data/level1.json';
import { gatesOnlyBot, play, randomBot, smartBot, type Bot } from './bots';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

function stats(level: LevelDef, makeBot: (seed: number) => Bot) {
  const games = SEEDS.map(seed => play(level, makeBot(seed), seed));
  const won = games.filter(g => g.status === 'won');
  const avgSoldiers = won.length ? Math.round(won.reduce((a, g) => a + g.player.soldiers, 0) / won.length) : 0;
  const avgProgress = Math.round((games.reduce((a, g) => a + g.progress, 0) / games.length) * 100);
  return { winRate: won.length / games.length, avgSoldiers, avgProgress };
}

describe('bilanciamento livello 1', () => {
  const level = level1 as LevelDef;
  const smart = stats(level, () => smartBot);
  const gatesOnly = stats(level, () => gatesOnlyBot);
  const random = stats(level, randomBot);
  console.table({ smart, gatesOnly, random });

  it('un giocatore attento vince quasi sempre', () => {
    expect(smart.winRate).toBeGreaterThanOrEqual(0.8);
  });

  it('ignorare i muri non basta', () => {
    expect(gatesOnly.winRate).toBeLessThanOrEqual(0.3);
  });

  it('scegliere i gate a caso perde quasi sempre', () => {
    expect(random.winRate).toBeLessThanOrEqual(0.2);
  });
});
