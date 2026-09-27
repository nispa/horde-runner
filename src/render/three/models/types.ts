// Interfaccia dei "pacchetti modelli": come vengono costruiti personaggi e oggetti in 3D.
// Il renderer non sa se un soldato è fatto di cubi (voxel) o è un modello GLB: lo chiede al pacchetto.
// Per aggiungere uno stile nuovo basta implementare ModelPack e registrarlo in models/index.ts.
import type * as THREE from 'three';
import type { HazardKind, LevelTheme, WeaponId } from '../../../core/types';

/** Unità del mondo 3D: 1 = 1 metro. La strada va da −ROAD_HALF a +ROAD_HALF sull'asse X. */
export const ROAD_HALF = 4;

export type CrowdKind = 'soldier' | 'zombie' | 'brute';

/** Una folla di personaggi uguali disegnata in blocco (instancing: pochi draw call anche con centinaia). */
export interface Crowd {
  readonly object: THREE.Object3D;
  /** Posiziona il personaggio i-esimo. `walk` è la fase dell'animazione di camminata (radianti),
   *  `tint` un moltiplicatore di colore (es. ferito = più scuro). */
  set(i: number, x: number, z: number, facing: number, scale: number, walk: number, tint?: THREE.Color): void;
  /** Quanti personaggi disegnare (i primi `n`). */
  setCount(n: number): void;
  /** Da chiamare dopo aver aggiornato le istanze del fotogramma. */
  commit(): void;
  dispose(): void;
}

/** Oggetto singolo animabile (boss, pickup, oggetti lanciati). */
export interface Prop {
  readonly object: THREE.Object3D;
  /** Animazione nel tempo (secondi) e parametro libero (es. fase della camminata). */
  animate?(time: number, param?: number): void;
  dispose(): void;
}

export interface ModelPack {
  readonly id: string;
  /** Carica le risorse (texture, modelli). Chiamato una volta prima di giocare. */
  load(): Promise<void>;
  createCrowd(kind: CrowdKind, max: number): Crowd;
  createBoss(): Prop;
  createHazard(kind: HazardKind): Prop;
  createPickup(weapon: WeaponId): Prop;
  /** Una cassa (blocco) di lato `size` metri. */
  createCrate(size: number): Prop;
  /** Terreno ai lati della strada e oggetti di scena per un livello. */
  createScenery(theme: LevelTheme, length: number): THREE.Object3D;
}
