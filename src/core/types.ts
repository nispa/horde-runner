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
  /** Se presente, ogni zombi dell'ondata lancia questo attacco. */
  throws?: AttackDef;
}

export type HazardKind = 'rock' | 'zombie' | 'boulder' | 'crow';

/** Attacco a distanza di un nemico o di un boss. */
export interface AttackDef {
  kind: HazardKind;
  /** Secondi tra un lancio e l'altro. */
  every: number;
  /** Soldati uccisi all'impatto (roccia, masso, corvo). */
  damage?: number;
  /** Vita di ciò che si può abbattere (zombi lanciato, masso, corvo). */
  hp?: number;
  /** Quanti ne lancia per volta (corvi). */
  count?: number;
}

/** Arma raccoglibile sulla strada: si prende passandoci sopra. */
export interface WeaponPickupDef {
  type: 'weapon';
  z: number;
  x: number;
  weapon: WeaponId;
}

/** Boss di fine livello: la squadra si ferma e lo affronta finché non muore. */
export interface BossDef {
  type: 'boss';
  z: number;
  name: string;
  hp: number;
  speed: number;
  /** Soldati divorati a ogni morso quando raggiunge la squadra. */
  bite: number;
  /** Attacchi a distanza del boss. */
  attacks?: AttackDef[];
}

export type LevelEntity = GateDef | WallDef | WaveDef | WeaponPickupDef | BossDef;

export type WeaponId = 'rifle' | 'minigun' | 'shotgun' | 'rocket';

export interface WeaponDef {
  name: string;
  icon: string;
  /** Moltiplicatori rispetto alla cadenza e al danno della squadra. */
  rateMul: number;
  damageMul: number;
  /** Moltiplicatore del danno contro i bersagli grossi: muri, casse e boss. */
  wallMul: number;
  /** Proiettili massimi per raffica (ognuno può avere più pallini). */
  maxBullets: number;
  pellets: number;
  /** Apertura del ventaglio dei pallini (unità di lane al secondo). */
  spread: number;
  /** Gittata in metri (≤ FIRE_RANGE). */
  range: number;
  speed: number;
  /** Raggio dell'esplosione in unità di lane (0 = nessuna esplosione). */
  splash: number;
}

/** Ambientazione: suggerimento per il renderer (il core la ignora). */
export type LevelTheme = 'grass' | 'dirt' | 'concrete' | 'sand' | 'snow';

export interface LevelDef {
  name: string;
  theme?: LevelTheme;
  length: number;
  playerSpeed: number;
  start: { soldiers: number; fireRate: number; damage: number; weapon?: WeaponId };
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
  weapon: WeaponId;
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
  /** Orda di appartenenza (per l'HUD). */
  horde: number;
  throws?: AttackDef;
  throwTimer: number;
  /** Comportamento: chi insegue, chi resta sulla sua corsia, chi aggira ai lati (vedi rules.ts). */
  style: ZombieStyle;
  /** Corsia "di casa" (per chi non insegue) e lato scelto per aggirare (−1 / +1). */
  homeX: number;
  side: number;
}

export type ZombieStyle = 'chase' | 'lane' | 'flank';

/** Oggetto lanciato dai nemici. Le rocce e gli zombi volano a parabola (non si possono colpire);
 *  massi e corvi si muovono sulla strada e si possono abbattere. */
export interface Hazard {
  id: number;
  kind: HazardKind;
  x: number;
  z: number;
  /** Altezza da terra in metri (solo per il disegno). */
  height: number;
  /** Traiettoria a parabola: partenza, arrivo e avanzamento 0..1. */
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  t: number;
  duration: number;
  /** Movimento su strada (masso, corvo). */
  vz: number;
  phase: number;
  hp: number;
  maxHp: number;
  damage: number;
  alive: boolean;
}

export interface Pickup extends WeaponPickupDef {
  id: number;
  taken: boolean;
}

export interface Boss {
  id: number;
  name: string;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  bite: number;
  /** In campo (è entrato nella zona di spawn). */
  active: boolean;
  dead: boolean;
  biteTimer: number;
  attacks: AttackDef[];
  attackTimers: number[];
}

export interface Bullet {
  id: number;
  weapon: WeaponId;
  x: number;
  z: number;
  /** Velocità laterale (pallini del fucile a pompa). */
  vx: number;
  damage: number;
  wallMul: number;
  splash: number;
  speed: number;
  /** Gittata misurata dalla posizione attuale della squadra (non dal punto di sparo). */
  range: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';

/** Eventi che il core emette e che il renderer traduce in testi, suoni ed effetti. */
export type GameEvent =
  | { kind: 'text'; x: number; z: number; text: string; tone: 'good' | 'bad' }
  | { kind: 'shot'; weapon: WeaponId }
  | { kind: 'explosion'; x: number; z: number; radius: number }
  | { kind: 'weaponPickup'; x: number; z: number; weapon: WeaponId }
  | { kind: 'bossSpawn'; name: string }
  | { kind: 'bossHit'; x: number; z: number }
  | { kind: 'bossKilled'; x: number; z: number }
  | { kind: 'throw'; hazard: HazardKind; x: number; z: number }
  | { kind: 'hazardLand'; hazard: HazardKind; x: number; z: number; hit: boolean }
  | { kind: 'hazardKilled'; hazard: HazardKind; x: number; z: number }
  | { kind: 'wallHit'; x: number; z: number }
  | { kind: 'wallDestroyed'; x: number; z: number }
  | { kind: 'zombieKilled'; x: number; z: number; bite: number }
  | { kind: 'hurt'; x: number; z: number; count: number }
  | { kind: 'gate'; good: boolean }
  | { kind: 'end'; won: boolean };

export type TextEvent = Extract<GameEvent, { kind: 'text' }>;
