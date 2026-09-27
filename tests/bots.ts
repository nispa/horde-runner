// Bot per testare il bilanciamento dei livelli senza grafica.
import { Game } from '../src/core/game';
import { applyGate, firepower } from '../src/core/rules';
import type { LevelDef } from '../src/core/types';

export type Bot = (g: Game) => number;

/** Sceglie il gate migliore e abbatte solo i muri che riesce a rompere in tempo. */
export const smartBot: Bot = g => {
  const p = g.player;
  const gate = g.gates.find(q => !q.passed && q.z > p.z);
  const wall = g.walls.find(w => !w.destroyed && w.z > p.z);
  if (gate && (!wall || gate.z < wall.z) && gate.z - p.z < 8) {
    return applyGate(p.soldiers, gate.left) >= applyGate(p.soldiers, gate.right) ? -0.5 : 0.5;
  }
  if (wall && wall.z - p.z < 26) {
    const dps = firepower(p.soldiers, p.damage) * p.fireRate;
    const time = (wall.z - p.z) / g.level.playerSpeed;
    return dps * time * 0.8 > wall.hp ? wall.x : -wall.x;
  }
  return 0;
};

/** Sceglie i gate migliori ma ignora i muri (resta al centro). */
export const gatesOnlyBot: Bot = g => {
  const p = g.player;
  const gate = g.gates.find(q => !q.passed && q.z > p.z);
  if (gate && gate.z - p.z < 8) {
    return applyGate(p.soldiers, gate.left) >= applyGate(p.soldiers, gate.right) ? -0.5 : 0.5;
  }
  return 0;
};

/** Sceglie i gate a caso. */
export function randomBot(seed: number): Bot {
  let side = 0.5;
  let lastGate = -1;
  let s = seed;
  return g => {
    const gate = g.gates.find(q => !q.passed && q.z > g.player.z);
    if (gate && gate.id !== lastGate) {
      lastGate = gate.id;
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      side = (s >> 16) % 2 ? 0.5 : -0.5;
    }
    return side;
  };
}

export function play(level: LevelDef, bot: Bot, seed: number): Game {
  const g = new Game(level, seed);
  for (let i = 0; i < 60 * 180 && g.status === 'playing'; i++) {
    g.steerTo(bot(g));
    g.step(1 / 60);
  }
  return g;
}
