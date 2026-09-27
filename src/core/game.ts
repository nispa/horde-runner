// Simulazione del gioco. Non sa nulla di pixel, canvas o input: riceve comandi e avanza nel tempo.
import {
  applyGate, createRng, firepower, formatGate, formatReward, formationRadius, isGoodGate,
  BULLET_SPEED, FIRE_RANGE, LANE_LIMIT, MAX_BULLETS_PER_VOLLEY, PLAYER_STEER_SPEED, SPAWN_AHEAD,
} from './rules';
import type {
  Bullet, GameEvent, GameStatus, Gate, LevelDef, Player, Wall, WaveDef, Zombie,
} from './types';

export class Game {
  readonly level: LevelDef;
  player: Player;
  gates: Gate[] = [];
  walls: Wall[] = [];
  zombies: Zombie[] = [];
  bullets: Bullet[] = [];
  status: GameStatus = 'playing';
  time = 0;
  kills = 0;

  private pendingWaves: WaveDef[] = [];
  private events: GameEvent[] = [];
  private nextId = 1;
  private rng: () => number;

  constructor(level: LevelDef, seed = 1) {
    this.level = level;
    this.rng = createRng(seed);
    this.player = {
      x: 0, targetX: 0, z: 0,
      soldiers: level.start.soldiers,
      fireRate: level.start.fireRate,
      damage: level.start.damage,
      cooldown: 0,
    };
    for (const e of level.entities) {
      if (e.type === 'gate') this.gates.push({ ...e, id: this.nextId++, passed: false });
      else if (e.type === 'wall') this.walls.push({ ...e, id: this.nextId++, maxHp: e.hp, destroyed: false });
      else this.pendingWaves.push(e);
    }
    this.pendingWaves.sort((a, b) => a.z - b.z);
  }

  /** Comando: dove vuole andare il giocatore nella lane (-1..1). */
  steerTo(x: number): void {
    this.player.targetX = clamp(x, -LANE_LIMIT, LANE_LIMIT);
  }

  /** Restituisce e svuota gli eventi prodotti dall'ultimo consumo. */
  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  get progress(): number {
    return clamp(this.player.z / this.level.length, 0, 1);
  }

  step(dt: number): void {
    if (this.status !== 'playing') return;
    this.time += dt;
    this.movePlayer(dt);
    this.spawnWaves();
    this.moveZombies(dt);
    this.shoot(dt);
    this.moveBullets(dt);
    this.checkGates();
    this.checkWallCrash();
    this.checkZombieContact();

    if (this.player.soldiers <= 0) {
      this.player.soldiers = 0;
      this.status = 'lost';
      this.events.push({ kind: 'end', won: false });
    } else if (this.player.z >= this.level.length) {
      this.status = 'won';
      this.events.push({ kind: 'end', won: true });
    }
  }

  private movePlayer(dt: number): void {
    const p = this.player;
    const dx = p.targetX - p.x;
    const maxStep = PLAYER_STEER_SPEED * dt;
    p.x += clamp(dx, -maxStep, maxStep);
    p.z += this.level.playerSpeed * dt;
  }

  private spawnWaves(): void {
    while (this.pendingWaves.length && this.pendingWaves[0].z - this.player.z < SPAWN_AHEAD) {
      const w = this.pendingWaves.shift()!;
      for (let i = 0; i < w.count; i++) {
        this.zombies.push({
          id: this.nextId++,
          x: clamp((this.rng() * 2 - 1) * w.spread, -LANE_LIMIT, LANE_LIMIT),
          z: w.z + this.rng() * Math.max(4, w.count * 0.2),
          hp: w.hp, maxHp: w.hp, speed: w.speed * (0.8 + this.rng() * 0.4), bite: w.bite ?? 1,
        });
      }
    }
  }

  private moveZombies(dt: number): void {
    const px = this.player.x;
    for (const z of this.zombies) {
      z.z -= z.speed * dt;
      // Deriva lenta verso il giocatore quando è vicino.
      if (z.z - this.player.z < 15) z.x += Math.sign(px - z.x) * Math.min(Math.abs(px - z.x), 0.25 * dt);
    }
    this.zombies = this.zombies.filter(z => z.z > this.player.z - 2);
  }

  private shoot(dt: number): void {
    const p = this.player;
    p.cooldown -= dt;
    while (p.cooldown <= 0) {
      p.cooldown += 1 / p.fireRate;
      const n = Math.min(p.soldiers, MAX_BULLETS_PER_VOLLEY);
      if (n <= 0) return;
      // La potenza totale scala con i soldati, ripartita su un numero limitato di proiettili.
      const dmg = firepower(p.soldiers, p.damage) / n;
      const width = formationRadius(p.soldiers) * 2;
      for (let i = 0; i < n; i++) {
        const offset = n === 1 ? 0 : (i / (n - 1) - 0.5) * width;
        this.bullets.push({ id: this.nextId++, x: p.x + offset, z: p.z + 0.5, damage: dmg });
      }
      this.events.push({ kind: 'shot' });
    }
  }

  private moveBullets(dt: number): void {
    const maxZ = this.player.z + FIRE_RANGE;
    const survivors: Bullet[] = [];
    for (const b of this.bullets) {
      const prevZ = b.z;
      b.z += BULLET_SPEED * dt;
      if (!this.bulletHit(b, prevZ) && b.z < maxZ) survivors.push(b);
    }
    this.bullets = survivors;
  }

  /** Controlla il segmento percorso dal proiettile in questo frame (evita che "salti" i bersagli). */
  private bulletHit(b: Bullet, prevZ: number): boolean {
    for (const w of this.walls) {
      if (w.destroyed || Math.abs(b.x - w.x) > w.width / 2) continue;
      if (w.z >= prevZ && w.z <= b.z + 0.3) {
        w.hp -= b.damage;
        if (w.hp <= 0) this.destroyWall(w);
        else this.events.push({ kind: 'wallHit', x: b.x, z: w.z });
        return true;
      }
    }
    for (const z of this.zombies) {
      if (z.hp <= 0 || Math.abs(b.x - z.x) > 0.08) continue;
      if (z.z >= prevZ - 0.3 && z.z <= b.z + 0.3) {
        z.hp -= b.damage;
        if (z.hp <= 0) {
          this.kills++;
          this.events.push({ kind: 'zombieKilled', x: z.x, z: z.z, bite: z.bite });
        }
        this.zombies = this.zombies.filter(q => q.hp > 0);
        return true;
      }
    }
    return false;
  }

  private destroyWall(w: Wall): void {
    w.destroyed = true;
    w.hp = 0;
    const p = this.player;
    const { kind, value } = w.reward;
    if (kind === 'soldiers') p.soldiers += value;
    else if (kind === 'fireRate') p.fireRate += value;
    else p.damage += value;
    this.events.push({ kind: 'wallDestroyed', x: w.x, z: w.z });
    this.emit(w.x, w.z, formatReward(kind, value), 'good');
  }

  private checkGates(): void {
    const p = this.player;
    for (const g of this.gates) {
      if (g.passed || p.z < g.z) continue;
      g.passed = true;
      const chosen = p.x < 0 ? g.left : g.right;
      p.soldiers = applyGate(p.soldiers, chosen);
      this.events.push({ kind: 'gate', good: isGoodGate(chosen) });
      this.emit(p.x, g.z, formatGate(chosen), isGoodGate(chosen) ? 'good' : 'bad');
    }
  }

  private checkWallCrash(): void {
    const p = this.player;
    const r = formationRadius(p.soldiers);
    for (const w of this.walls) {
      if (w.destroyed || p.z < w.z) continue;
      w.destroyed = true;
      if (Math.abs(p.x - w.x) < w.width / 2 + r) {
        p.soldiers = Math.max(0, p.soldiers - w.crashCost);
        this.events.push({ kind: 'hurt', x: p.x, z: w.z, count: w.crashCost });
        this.emit(p.x, w.z, `-${w.crashCost}`, 'bad');
      }
    }
  }

  private checkZombieContact(): void {
    const p = this.player;
    const r = formationRadius(p.soldiers) + 0.08;
    let hits = 0;
    this.zombies = this.zombies.filter(z => {
      const touching = z.z <= p.z + 0.4 && z.z >= p.z - 1 && Math.abs(z.x - p.x) < r;
      if (touching) hits += z.bite;
      return !touching;
    });
    if (hits > 0) {
      p.soldiers = Math.max(0, p.soldiers - hits);
      this.events.push({ kind: 'hurt', x: p.x, z: p.z, count: hits });
      this.emit(p.x, p.z, `-${hits}`, 'bad');
    }
  }

  private emit(x: number, z: number, text: string, tone: 'good' | 'bad'): void {
    this.events.push({ kind: 'text', x, z, text, tone });
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
