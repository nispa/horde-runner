// Fisica degli oggetti lanciati dai nemici: funzioni pure, senza stato del gioco.
import type { Hazard, HazardKind } from './types';

/** Parametri per tipo: velocità, raggio d'impatto, altezza del lancio. */
export const HAZARD = {
  /** Durata del volo di rocce e zombi lanciati (secondi). */
  lobTime: 1.4,
  lobHeight: 5,
  /** Raggio d'impatto in unità di lane. */
  radius: { rock: 0.14, zombie: 0.12, boulder: 0.18, crow: 0.06 } as Record<HazardKind, number>,
  boulderSpeed: 9,
  crowSpeed: 7,
  /** Ampiezza e frequenza dello zig-zag dei corvi. */
  crowWiggle: 0.25,
  crowWiggleFreq: 4,
} as const;

export function isLobbed(kind: HazardKind): boolean {
  return kind === 'rock' || kind === 'zombie';
}

/** Avanza un oggetto in volo; restituisce true quando atterra. */
export function stepLob(h: Hazard, dt: number): boolean {
  h.t = Math.min(1, h.t + dt / h.duration);
  h.x = h.fromX + (h.toX - h.fromX) * h.t;
  h.z = h.fromZ + (h.toZ - h.fromZ) * h.t;
  h.height = 4 * HAZARD.lobHeight * h.t * (1 - h.t);
  return h.t >= 1;
}

/** Avanza masso o corvo verso la squadra. I corvi inseguono lateralmente con uno zig-zag. */
export function stepGround(h: Hazard, dt: number, targetX: number): void {
  h.t += dt;
  h.z += h.vz * dt;
  if (h.kind === 'crow') {
    const drift = Math.sign(targetX - h.toX) * Math.min(Math.abs(targetX - h.toX), 0.5 * dt);
    h.toX += drift;
    h.x = h.toX + Math.sin(h.t * HAZARD.crowWiggleFreq + h.phase) * HAZARD.crowWiggle;
    h.height = 1.2 + Math.sin(h.t * 6 + h.phase) * 0.2;
  }
}
