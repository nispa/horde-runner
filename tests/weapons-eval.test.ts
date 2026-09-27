/// <reference types="node" />
// Strumento di analisi (non è un test): quanto rende ogni arma su ogni livello.
// Uso: WEAPONS_EVAL=1 npx vitest run weapons-eval --silent=false
import { describe, it } from 'vitest';
import type { WeaponId } from '../src/core/types';
import { CAMPAIGN } from '../src/data/campaign';
import { makeSmartBot, play, smartBot } from './bots';

const IDS: WeaponId[] = ['rifle', 'minigun', 'shotgun', 'rocket'];
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

describe.runIf(process.env.WEAPONS_EVAL)('valutazione armi', () => {
  it('stampa vittorie e soldati finali per arma iniziale', () => {
    const rows: Record<string, Record<string, string>> = {};
    CAMPAIGN.forEach((level, i) => {
      rows[`L${i + 1}`] = {};
      for (const weapon of IDS) {
        const lv = { ...level, start: { ...level.start, weapon } };
        const games = SEEDS.map(s => play(lv, smartBot, s));
        const won = games.filter(g => g.status === 'won');
        const avg = Math.round(won.reduce((a, g) => a + g.player.soldiers, 0) / Math.max(1, won.length));
        const prog = Math.round(games.reduce((a, g) => a + g.progress, 0) / games.length * 100);
        rows[`L${i + 1}`][weapon] = `${won.length}/20 s${avg} p${prog}%`;
      }
    });
    console.table(rows);
  });

  it('stampa le vittorie con diverse preferenze di arma', () => {
    const prefs: Record<string, WeaponId[]> = {
      'preferisce razzi': ['rifle', 'shotgun', 'minigun', 'rocket'],
      'preferisce mitra': ['rifle', 'shotgun', 'rocket', 'minigun'],
      'preferisce pompa': ['rifle', 'rocket', 'minigun', 'shotgun'],
      'ignora le armi': ['shotgun', 'minigun', 'rocket', 'rifle'],
    };
    const rows: Record<string, Record<string, string>> = {};
    CAMPAIGN.forEach((level, i) => {
      rows[`L${i + 1}`] = {};
      for (const [name, rank] of Object.entries(prefs)) {
        const games = SEEDS.map(s => play(level, makeSmartBot(rank), s));
        rows[`L${i + 1}`][name] = `${games.filter(g => g.status === 'won').length}/20`;
      }
    });
    console.table(rows);
  });
});
