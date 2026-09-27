import { describe, expect, it } from 'vitest';
import { qualifyingRank, TABLE_SIZE, type ScoreEntry } from '../src/platform/highscores';

const table = (scores: number[]): ScoreEntry[] => scores.map(score => ({ initials: 'AAA', score, date: '' }));

describe('classifica', () => {
  it('trova la posizione giusta', () => {
    const t = table([900, 700, 500]);
    expect(qualifyingRank(t, 1000)).toBe(0);
    expect(qualifyingRank(t, 800)).toBe(1);
    expect(qualifyingRank(t, 100)).toBe(3); // c'è ancora posto
  });

  it('a pari punteggio vince chi c\'era prima', () => {
    expect(qualifyingRank(table([900, 700]), 700)).toBe(2);
  });

  it('a tabella piena un punteggio basso non entra', () => {
    const full = table(Array.from({ length: TABLE_SIZE }, (_, i) => 1000 - i * 10));
    expect(qualifyingRank(full, 5)).toBe(-1);
    expect(qualifyingRank(full, 0)).toBe(-1);
  });
});
