// Bilanciamento: un giocatore attento deve vincere, uno distratto deve perdere spesso.
// `npx vitest run balance --silent=false` stampa anche le statistiche di ogni livello
// (gatesOnly è solo informativo: stando al centro colpisce comunque i muri larghi).
import { describe, expect, it } from 'vitest';
import type { LevelDef } from '../src/core/types';
import { CAMPAIGN } from '../src/data/campaign';
import { gatesOnlyBot, play, randomBot, smartBot, type Bot } from './bots';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

function stats(level: LevelDef, makeBot: (seed: number) => Bot) {
  const games = SEEDS.map(seed => play(level, makeBot(seed), seed));
  const won = games.filter(g => g.status === 'won');
  const avgSoldiers = won.length ? Math.round(won.reduce((a, g) => a + g.player.soldiers, 0) / won.length) : 0;
  const avgProgress = Math.round((games.reduce((a, g) => a + g.progress, 0) / games.length) * 100);
  return { winRate: won.length / games.length, avgSoldiers, avgProgress };
}

const report: Record<string, unknown> = {};

describe.each(CAMPAIGN.map((level, i) => ({ level, i })))('bilanciamento $level.name', ({ level, i }) => {
  const smart = stats(level, () => smartBot);
  const gatesOnly = stats(level, () => gatesOnlyBot);
  const random = stats(level, randomBot);
  report[`L${i + 1} smart`] = smart;
  report[`L${i + 1} gatesOnly`] = gatesOnly;
  report[`L${i + 1} random`] = random;
  if (i === CAMPAIGN.length - 1) console.table(report);

  it('un giocatore attento vince quasi sempre', () => {
    expect(smart.winRate).toBeGreaterThanOrEqual(0.8);
  });

  it('scegliere i gate a caso perde quasi sempre', () => {
    expect(random.winRate).toBeLessThanOrEqual(0.2);
  });

});
