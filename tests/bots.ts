// Bot per testare il bilanciamento dei livelli senza grafica.
import { Game } from '../src/core/game';
import { applyGate, firepower } from '../src/core/rules';
import type { LevelDef, WeaponId } from '../src/core/types';
import { WEAPONS } from '../src/core/weapons';

export type Bot = (g: Game) => number;

/** Classifica delle armi, dalla peggiore alla migliore. */
export const WEAPON_RANK: WeaponId[] = ['rifle', 'shotgun', 'minigun', 'rocket'];

const LOOKAHEAD = 8;

/** Sceglie il gate migliore, prende le armi migliori (scansando le peggiori)
 *  e abbatte solo i muri che riesce a rompere in tempo. */
export function makeSmartBot(rank: WeaponId[] = WEAPON_RANK): Bot {
  return g => {
    const p = g.player;
    const gate = g.gates.find(q => !q.passed && q.z > p.z);
    const pickZ = Math.min(...g.pickups.filter(k => !k.taken && k.z > p.z).map(k => k.z));
    const wall = g.walls.find(w => !w.destroyed && w.z > p.z);

    if (gate && gate.z <= pickZ && gate.z - p.z < LOOKAHEAD) {
      return applyGate(p.soldiers, gate.left) >= applyGate(p.soldiers, gate.right) ? -0.5 : 0.5;
    }
    if (Number.isFinite(pickZ) && pickZ - p.z < LOOKAHEAD) {
      const here = g.pickups.filter(k => !k.taken && k.z === pickZ);
      const best = here.reduce((a, b) => (rank.indexOf(b.weapon) > rank.indexOf(a.weapon) ? b : a));
      if (rank.indexOf(best.weapon) > rank.indexOf(p.weapon)) return best.x;
      // Nessuna arma migliore: passa lontano da quelle presenti.
      return here[0].x > 0 ? -0.8 : 0.8;
    }
    if (wall && wall.z - p.z < WEAPONS[p.weapon].range) {
      const w = WEAPONS[p.weapon];
      const dps = firepower(p.soldiers, p.damage) * w.damageMul * w.wallMul * p.fireRate * w.rateMul;
      const time = Math.max(0, wall.z - p.z) / g.level.playerSpeed;
      // Se non riesce ad abbatterlo lo aggira (un muro centrale si aggira su un lato).
      return dps * time * 0.8 > wall.hp ? wall.x : wall.x === 0 ? 0.8 : -wall.x;
    }
    return 0;
  };
}

export const smartBot = makeSmartBot();

/** Sceglie i gate migliori ma ignora muri e armi (resta al centro). */
export const gatesOnlyBot: Bot = g => {
  const p = g.player;
  const gate = g.gates.find(q => !q.passed && q.z > p.z);
  if (gate && gate.z - p.z < LOOKAHEAD) {
    return applyGate(p.soldiers, gate.left) >= applyGate(p.soldiers, gate.right) ? -0.5 : 0.5;
  }
  return 0;
};

/** Sceglie i gate (e quindi le armi sul suo lato) a caso. */
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
  for (let i = 0; i < 60 * 240 && g.status === 'playing'; i++) {
    g.steerTo(bot(g));
    g.step(1 / 60);
  }
  return g;
}
