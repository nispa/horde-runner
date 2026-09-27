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
export const BOSS_RADIUS = 0.45; // più largo della formazione massima (0.35): la squadra allineata lo colpisce tutta
/** Secondi tra un morso e l'altro del boss a contatto. */
export const BOSS_BITE_INTERVAL = 0.6;
/** Ondate più vicine di così (in metri) contano come un'unica orda nell'HUD. */
export const HORDE_GAP = 12;
/** Da quanti metri gli zombi iniziano a inseguire lateralmente la squadra, e a che velocità (lane/s). */
export const ZOMBIE_CHASE_DISTANCE = 22;
export const ZOMBIE_CHASE_SPEED = 0.55;
export const BRUTE_CHASE_SPEED = 0.45;
/** Portata del contatto oltre il bordo della formazione (lane); i bruti arrivano più lontano. */
export const ZOMBIE_REACH = 0.08;
export const BRUTE_EXTRA_REACH = 0.12;

/** Punteggio arcade. */
export const SCORE = {
  zombie: 10,
  brute: 50,
  crate: 25,
  /** Masso o corvo abbattuto. */
  hazard: 15,
  boss: 2000,
  /** Bonus velocità: parte da `bossSpeedMax` e cala di `bossSpeedPerSecond` al secondo di scontro. */
  bossSpeedMax: 3000,
  bossSpeedPerSecond: 150,
  /** Per ogni soldato vivo al traguardo. */
  survivor: 100,
};

export interface ScoreStats {
  zombies: number;
  brutes: number;
  crates: number;
  hazards: number;
  bossKilled: boolean;
  /** Durata dello scontro col boss in secondi (se abbattuto). */
  bossSeconds: number;
  /** Soldati vivi al traguardo (0 se la partita è persa). */
  survivors: number;
}

export interface ScoreLine { label: string; count: number; points: number }

/** Scompone il punteggio in voci (per la schermata finale) e ne calcola il totale. */
export function computeScore(s: ScoreStats): { lines: ScoreLine[]; total: number } {
  const lines: ScoreLine[] = [
    { label: 'Zombi', count: s.zombies, points: s.zombies * SCORE.zombie },
    { label: 'Bruti', count: s.brutes, points: s.brutes * SCORE.brute },
    { label: 'Casse', count: s.crates, points: s.crates * SCORE.crate },
  ];
  if (s.hazards > 0) lines.push({ label: 'Massi e corvi', count: s.hazards, points: s.hazards * SCORE.hazard });
  if (s.bossKilled) {
    lines.push({ label: 'Boss', count: 1, points: SCORE.boss });
    const speed = Math.max(0, Math.round(SCORE.bossSpeedMax - s.bossSeconds * SCORE.bossSpeedPerSecond));
    lines.push({ label: 'Bonus velocità', count: Math.round(s.bossSeconds), points: speed });
  }
  if (s.survivors > 0) lines.push({ label: 'Sopravvissuti', count: s.survivors, points: s.survivors * SCORE.survivor });
  return { lines, total: lines.reduce((a, l) => a + l.points, 0) };
}

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
