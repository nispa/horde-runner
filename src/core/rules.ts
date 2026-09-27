// Regole pure: funzioni senza stato, facili da testare e da tradurre in C#/C++.
import type { GateOp, RewardKind } from './types';

export const LANE_LIMIT = 0.9;
export const PLAYER_STEER_SPEED = 4;
/** Portata di tiro in metri: deve restare sotto la distanza visibile del renderer (32 m),
 *  così muri e zombi si vedono arrivare prima di poter essere colpiti. */
export const FIRE_RANGE = 26;
export const SPAWN_AHEAD = 35;
/** La squadra si ferma quando il boss è entro questa distanza. */
export const BOSS_HOLD_DISTANCE = 20;
/** Metà larghezza del boss in unità di lane. */
export const BOSS_RADIUS = 0.35;
/** Secondi tra un morso e l'altro del boss a contatto. */
export const BOSS_BITE_INTERVAL = 0.6;
/** Ondate più vicine di così (in metri) contano come un'unica orda nell'HUD. */
export const HORDE_GAP = 12;

export function applyGate(soldiers: number, gate: GateOp): number {
  switch (gate.op) {
    case '+': return soldiers + gate.value;
    case '-': return Math.max(0, soldiers - gate.value);
    case 'x': return soldiers * gate.value;
    case '/': return Math.floor(soldiers / gate.value);
  }
}

export function formatGate(gate: GateOp): string {
  return `${gate.op === 'x' ? '×' : gate.op === '/' ? '÷' : gate.op}${gate.value}`;
}

export function isGoodGate(gate: GateOp): boolean {
  return gate.op === '+' || gate.op === 'x';
}

export function formatReward(kind: RewardKind, value: number): string {
  switch (kind) {
    case 'soldiers': return `+${value} soldati`;
    case 'fireRate': return `+${value} cadenza`;
    case 'damage': return `+${value} danno`;
  }
}

/** Danno totale di una raffica: cresce meno che linearmente, così una folla enorme non è invincibile. */
export function firepower(soldiers: number, damage: number): number {
  return damage * Math.pow(soldiers, 0.75);
}

/** Raggio della formazione in unità di lane: cresce con la radice del numero di soldati. */
export function formationRadius(soldiers: number): number {
  return Math.min(0.35, 0.04 * Math.sqrt(soldiers));
}

/** Generatore pseudo-casuale deterministico (mulberry32): stesse partite con lo stesso seed. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
