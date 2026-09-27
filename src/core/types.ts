// Tipi condivisi tra dati, core e renderer.
// Coordinate astratte: x = posizione nella lane (-1 sinistra, +1 destra), z = metri percorsi.

export type GateOp = { op: '+' | '-' | 'x' | '/'; value: number };

export type RewardKind = 'soldiers' | 'fireRate' | 'damage';

export interface GateDef {
  type: 'gate';
  z: number;
  left: GateOp;
  right: GateOp;
}

export interface WallDef {
  type: 'wall';
  z: number;
  x: number;
  width: number;
  hp: number;
  /** Soldati persi se ci si schianta contro il muro senza abbatterlo. */
  crashCost: number;
  reward: { kind: RewardKind; value: number };
}

export interface WaveDef {
  type: 'wave';
  z: number;
  count: number;
  hp: number;
  speed: number;
  /** Larghezza della zona di spawn (0..1). */
  spread: number;
  /** Soldati uccisi da ogni zombi che raggiunge la squadra (default 1: >1 = "bruto"). */
  bite?: number;
}

export type LevelEntity = GateDef | WallDef | WaveDef;

/** Ambientazione: suggerimento per il renderer (il core la ignora). */
export type LevelTheme = 'grass' | 'dirt' | 'concrete' | 'sand' | 'snow';

export interface LevelDef {
  name: string;
  theme?: LevelTheme;
  length: number;
  playerSpeed: number;
  start: { soldiers: number; fireRate: number; damage: number };
  entities: LevelEntity[];
}

// --- Stato runtime ---

export interface Player {
  x: number;
  targetX: number;
  z: number;
  soldiers: number;
  fireRate: number;
  damage: number;
  cooldown: number;
}

export interface Gate extends GateDef {
  id: number;
  passed: boolean;
}

export interface Wall extends WallDef {
  id: number;
  maxHp: number;
  destroyed: boolean;
}

export interface Zombie {
  id: number;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  bite: number;
}

export interface Bullet {
  id: number;
  x: number;
  z: number;
  damage: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';

/** Eventi che il core emette e che il renderer traduce in testi, suoni ed effetti. */
export type GameEvent =
  | { kind: 'text'; x: number; z: number; text: string; tone: 'good' | 'bad' }
  | { kind: 'shot' }
  | { kind: 'wallHit'; x: number; z: number }
  | { kind: 'wallDestroyed'; x: number; z: number }
  | { kind: 'zombieKilled'; x: number; z: number; bite: number }
  | { kind: 'hurt'; x: number; z: number; count: number }
  | { kind: 'gate'; good: boolean }
  | { kind: 'end'; won: boolean };

export type TextEvent = Extract<GameEvent, { kind: 'text' }>;
