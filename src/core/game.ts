// Simulazione del gioco. Non sa nulla di pixel, canvas o input: riceve comandi e avanza nel tempo.
import {
  applyGate, computeScore, createRng, firepower, formatGate, formatReward, formationRadius, isGoodGate,
  BOSS_BITE_INTERVAL, BOSS_HOLD_DISTANCE, BOSS_RADIUS, HORDE_GAP, LANE_LIMIT, PLAYER_STEER_SPEED, SPAWN_AHEAD,
} from './rules';
import type { ScoreStats } from './rules';
import type {
  Boss, BossDef, Bullet, GameEvent, GameStatus, Gate, LevelDef, Pickup, Player, Wall, WaveDef, Zombie,
} from './types';
import { WEAPONS } from './weapons';

export class Game {
  readonly level: LevelDef;
  player: Player;
  gates: Gate[] = [];
  walls: Wall[] = [];
  pickups: Pickup[] = [];
  zombies: Zombie[] = [];
  bullets: Bullet[] = [];
  boss: Boss | null = null;
  status: GameStatus = 'playing';
  time = 0;
  kills = 0;
  /** Statistiche per il punteggio arcade. */
  readonly stats: ScoreStats = { zombies: 0, brutes: 0, crates: 0, bossKilled: false, bossSeconds: 0, survivors: 0 };

  private pendingWaves: (WaveDef & { horde: number })[] = [];
  /** Numero totale di orde del livello (per l'HUD). */
  readonly totalHordes: number;
  private bossDef: BossDef | null = null;
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
      weapon: level.start.weapon ?? 'rifle',
      cooldown: 0,
    };
    for (const e of level.entities) {
      if (e.type === 'gate') this.gates.push({ ...e, id: this.nextId++, passed: false });
      else if (e.type === 'wall') this.walls.push({ ...e, id: this.nextId++, maxHp: e.hp, destroyed: false });
      else if (e.type === 'weapon') this.pickups.push({ ...e, id: this.nextId++, taken: false });
      else if (e.type === 'boss') this.bossDef = e;
      else this.pendingWaves.push({ ...e, horde: 0 });
    }
    this.pendingWaves.sort((a, b) => a.z - b.z);
    // Ondate vicine (es. zombi + bruti a pochi metri) contano come un'unica orda.
    let horde = -1;
    let lastZ = -Infinity;
    for (const w of this.pendingWaves) {
      if (w.z - lastZ > HORDE_GAP) horde++;
      w.horde = horde;
      lastZ = w.z;
    }
    this.totalHordes = horde + 1;
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

  /** Orde non ancora sconfitte: in arrivo o con zombi ancora in campo. */
  get hordesLeft(): number {
    const left = new Set<number>();
    for (const w of this.pendingWaves) left.add(w.horde);
    for (const z of this.zombies) left.add(z.horde);
    return left.size;
  }

  /** Zombi ancora da affrontare: in campo più quelli delle ondate non ancora arrivate. */
  get zombiesLeft(): number {
    return this.zombies.length + this.pendingWaves.reduce((a, w) => a + w.count, 0);
  }

  /** Punteggio attuale (i sopravvissuti si aggiungono al traguardo). */
  get score(): number {
    return computeScore(this.stats).total;
  }

  /** Vero mentre la squadra è ferma a combattere il boss. */
  get bossFight(): boolean {
    const b = this.boss;
    return !!b && b.active && !b.dead && b.z - this.player.z < BOSS_HOLD_DISTANCE;
  }

  step(dt: number): void {
    if (this.status !== 'playing') return;
    this.time += dt;
    this.movePlayer(dt);
    this.spawn();
    this.moveZombies(dt);
    this.moveBoss(dt);
    if (this.bossFight) this.stats.bossSeconds += dt;
    this.shoot(dt);
    this.moveBullets(dt);
    this.checkGates();
    this.checkPickups();
    this.checkWallCrash();
    this.checkZombieContact();
    this.checkBossContact(dt);

    if (this.player.soldiers <= 0) {
      this.player.soldiers = 0;
      this.status = 'lost';
      this.events.push({ kind: 'end', won: false });
    } else if (this.player.z >= this.level.length) {
      this.status = 'won';
      this.stats.survivors = this.player.soldiers;
      this.events.push({ kind: 'end', won: true });
    }
  }

  private movePlayer(dt: number): void {
    const p = this.player;
    const dx = p.targetX - p.x;
    const maxStep = PLAYER_STEER_SPEED * dt;
    p.x += clamp(dx, -maxStep, maxStep);
    if (!this.bossFight) p.z += this.level.playerSpeed * dt;
  }

  private spawn(): void {
    while (this.pendingWaves.length && this.pendingWaves[0].z - this.player.z < SPAWN_AHEAD) {
      const w = this.pendingWaves.shift()!;
      for (let i = 0; i < w.count; i++) {
        this.zombies.push({
          id: this.nextId++,
          x: clamp((this.rng() * 2 - 1) * w.spread, -LANE_LIMIT, LANE_LIMIT),
          z: w.z + this.rng() * Math.max(4, w.count * 0.2),
          hp: w.hp, maxHp: w.hp, speed: w.speed * (0.8 + this.rng() * 0.4), bite: w.bite ?? 1, horde: w.horde,
        });
      }
    }
    const d = this.bossDef;
    if (d && !this.boss && d.z - this.player.z < SPAWN_AHEAD) {
      this.boss = {
        id: this.nextId++, name: d.name, x: 0, z: d.z, hp: d.hp, maxHp: d.hp,
        speed: d.speed, bite: d.bite, active: true, dead: false, biteTimer: 0,
      };
      this.events.push({ kind: 'bossSpawn', name: d.name });
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

  private moveBoss(dt: number): void {
    const b = this.boss;
    if (!b || b.dead) return;
    const p = this.player;
    // Avanza fino a raggiungere la squadra e la insegue lateralmente.
    b.z = Math.max(p.z + 0.8, b.z - b.speed * dt);
    b.x += Math.sign(p.x - b.x) * Math.min(Math.abs(p.x - b.x), 1.0 * dt);
  }

  private shoot(dt: number): void {
    const p = this.player;
    const w = WEAPONS[p.weapon];
    p.cooldown -= dt;
    while (p.cooldown <= 0) {
      p.cooldown += 1 / (p.fireRate * w.rateMul);
      const n = Math.min(p.soldiers, w.maxBullets);
      if (n <= 0) return;
      // La potenza totale scala con i soldati, ripartita tra proiettili e pallini.
      const dmg = (firepower(p.soldiers, p.damage) * w.damageMul) / (n * w.pellets);
      const width = formationRadius(p.soldiers) * 2;
      for (let i = 0; i < n; i++) {
        const offset = n === 1 ? 0 : (i / (n - 1) - 0.5) * width;
        for (let j = 0; j < w.pellets; j++) {
          const fan = w.pellets > 1 ? (j / (w.pellets - 1) - 0.5) * 2 * w.spread : w.spread ? (this.rng() * 2 - 1) * w.spread : 0;
          this.bullets.push({
            id: this.nextId++, weapon: p.weapon, x: p.x + offset, z: p.z + 0.5, vx: fan,
            damage: dmg, wallMul: w.wallMul, splash: w.splash, speed: w.speed, range: w.range,
          });
        }
      }
      this.events.push({ kind: 'shot', weapon: p.weapon });
    }
  }

  private moveBullets(dt: number): void {
    const survivors: Bullet[] = [];
    for (const b of this.bullets) {
      const prevZ = b.z;
      b.z += b.speed * dt;
      b.x += b.vx * dt;
      if (!this.bulletHit(b, prevZ) && b.z < this.player.z + b.range && Math.abs(b.x) < 1.1) survivors.push(b);
    }
    this.bullets = survivors;
  }

  /** Controlla il segmento percorso dal proiettile in questo frame (evita che "salti" i bersagli). */
  private bulletHit(b: Bullet, prevZ: number): boolean {
    for (const w of this.walls) {
      if (w.destroyed || Math.abs(b.x - w.x) > w.width / 2) continue;
      if (w.z >= prevZ && w.z <= b.z + 0.3) {
        if (b.splash) return this.explode(b, w.z), true;
        this.damageWall(w, b.damage * b.wallMul, b.x);
        return true;
      }
    }
    const boss = this.boss;
    if (boss && !boss.dead && Math.abs(b.x - boss.x) < BOSS_RADIUS && boss.z >= prevZ - 0.5 && boss.z <= b.z + 0.5) {
      if (b.splash) return this.explode(b, boss.z), true;
      this.damageBoss(b.damage * b.wallMul, b.x);
      return true;
    }
    for (const z of this.zombies) {
      if (z.hp <= 0 || Math.abs(b.x - z.x) > 0.08) continue;
      if (z.z >= prevZ - 0.3 && z.z <= b.z + 0.3) {
        if (b.splash) return this.explode(b, z.z), true;
        this.damageZombie(z, b.damage);
        this.zombies = this.zombies.filter(q => q.hp > 0);
        return true;
      }
    }
    return false;
  }

  /** Esplosione di un razzo: danneggia tutto ciò che è nel raggio. */
  private explode(b: Bullet, z: number): void {
    const r = b.splash;
    const dz = 2;
    this.events.push({ kind: 'explosion', x: b.x, z, radius: r });
    for (const q of this.zombies) {
      if (Math.abs(q.x - b.x) < r && Math.abs(q.z - z) < dz) this.damageZombie(q, b.damage);
    }
    this.zombies = this.zombies.filter(q => q.hp > 0);
    for (const w of this.walls) {
      if (!w.destroyed && Math.abs(w.x - b.x) < w.width / 2 + r && Math.abs(w.z - z) < dz) this.damageWall(w, b.damage * b.wallMul, b.x);
    }
    const boss = this.boss;
    if (boss && !boss.dead && Math.abs(boss.x - b.x) < r + BOSS_RADIUS && Math.abs(boss.z - z) < dz) this.damageBoss(b.damage * b.wallMul, b.x);
  }

  private damageZombie(z: Zombie, dmg: number): void {
    if (z.hp <= 0) return;
    z.hp -= dmg;
    if (z.hp <= 0) {
      this.kills++;
      if (z.bite > 1) this.stats.brutes++;
      else this.stats.zombies++;
      this.events.push({ kind: 'zombieKilled', x: z.x, z: z.z, bite: z.bite });
    }
  }

  private damageWall(w: Wall, dmg: number, x: number): void {
    w.hp -= dmg;
    if (w.hp <= 0) this.destroyWall(w);
    else this.events.push({ kind: 'wallHit', x, z: w.z });
  }

  private damageBoss(dmg: number, x: number): void {
    const b = this.boss!;
    b.hp -= dmg;
    this.events.push({ kind: 'bossHit', x, z: b.z });
    if (b.hp <= 0) {
      b.hp = 0;
      b.dead = true;
      this.kills++;
      this.stats.bossKilled = true;
      this.events.push({ kind: 'bossKilled', x: b.x, z: b.z });
      this.emit(b.x, b.z, `${b.name} abbattuto!`, 'good');
    }
  }

  private destroyWall(w: Wall): void {
    w.destroyed = true;
    this.stats.crates++;
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

  private checkPickups(): void {
    const p = this.player;
    const r = formationRadius(p.soldiers) + 0.15;
    for (const k of this.pickups) {
      if (k.taken || p.z < k.z) continue;
      k.taken = true; // raccolta o mancata: in ogni caso non torna più
      if (Math.abs(p.x - k.x) > r) continue;
      p.weapon = k.weapon;
      p.cooldown = 0;
      this.events.push({ kind: 'weaponPickup', x: k.x, z: k.z, weapon: k.weapon });
      this.emit(k.x, k.z, WEAPONS[k.weapon].name, 'good');
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

  /** Il boss a contatto divora soldati a intervalli regolari. */
  private checkBossContact(dt: number): void {
    const b = this.boss;
    const p = this.player;
    // È enorme: quando raggiunge la squadra la morde ovunque si trovi (niente schivate infinite).
    if (!b || b.dead || b.z - p.z > 1.2) return;
    b.biteTimer -= dt;
    if (b.biteTimer > 0) return;
    b.biteTimer = BOSS_BITE_INTERVAL;
    p.soldiers = Math.max(0, p.soldiers - b.bite);
    this.events.push({ kind: 'hurt', x: p.x, z: p.z, count: b.bite });
    this.emit(p.x, p.z, `-${b.bite}`, 'bad');
  }

  private emit(x: number, z: number, text: string, tone: 'good' | 'bad'): void {
    this.events.push({ kind: 'text', x, z, text, tone });
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
