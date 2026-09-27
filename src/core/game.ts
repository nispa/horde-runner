// Simulazione del gioco. Non sa nulla di pixel, canvas o input: riceve comandi e avanza nel tempo.
import {
  applyGate, computeScore, createRng, firepower, formatGate, formatReward, formationRadius, isGoodGate,
  BOSS_BITE_INTERVAL, BOSS_HOLD_DISTANCE, BOSS_RADIUS, BRUTE_CHASE_SPEED, BRUTE_EXTRA_REACH, FLANK_CUT_DISTANCE,
  FLANK_OFFSET, FLANK_SPEED, HORDE_GAP, LANE_LIMIT, LUNGE_DISTANCE, LUNGE_SPEED,
  ZOMBIE_CHASE_DISTANCE, ZOMBIE_CHASE_SPEED, ZOMBIE_REACH, ZOMBIE_STYLE_SHARE, PLAYER_STEER_SPEED, SPAWN_AHEAD,
} from './rules';
import type { ScoreStats } from './rules';
import { HAZARD, isLobbed, stepGround, stepLob } from './hazards';
import type {
  AttackDef, Boss, BossDef, Bullet, GameEvent, GameStatus, Gate, Hazard, LevelDef, Pickup, Player, Wall, WaveDef, Zombie,
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
  /** Oggetti lanciati dai nemici. */
  hazards: Hazard[] = [];
  boss: Boss | null = null;
  status: GameStatus = 'playing';
  time = 0;
  kills = 0;
  /** Statistiche per il punteggio arcade. */
  readonly stats: ScoreStats = { zombies: 0, brutes: 0, crates: 0, hazards: 0, bossKilled: false, bossSeconds: 0, survivors: 0 };

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
    for (const z of this.zombies) if (z.horde >= 0) left.add(z.horde);
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
    this.updateThrows(dt);
    this.moveHazards(dt);
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
        const x = clamp((this.rng() * 2 - 1) * w.spread, -LANE_LIMIT, LANE_LIMIT);
        this.zombies.push({
          id: this.nextId++,
          x, homeX: x,
          z: w.z + this.rng() * Math.max(4, w.count * 0.2),
          hp: w.hp, maxHp: w.hp, speed: w.speed * (0.8 + this.rng() * 0.4), bite: w.bite ?? 1, horde: w.horde,
          // Primo lancio poco dopo essere entrati a tiro (sfalsato tra i nemici), poi ogni `every` secondi.
          throws: w.throws, throwTimer: w.throws ? 0.3 + this.rng() * Math.min(2, w.throws.every) : 0,
          ...this.zombieBrain(w.bite ?? 1),
        });
      }
    }
    const d = this.bossDef;
    if (d && !this.boss && d.z - this.player.z < SPAWN_AHEAD) {
      this.boss = {
        id: this.nextId++, name: d.name, x: 0, z: d.z, hp: d.hp, maxHp: d.hp,
        speed: d.speed, bite: d.bite, active: true, dead: false, biteTimer: 0,
        attacks: d.attacks ?? [], attackTimers: (d.attacks ?? []).map(a => a.every * 0.5),
      };
      this.events.push({ kind: 'bossSpawn', name: d.name });
    }
  }

  private moveZombies(dt: number): void {
    const px = this.player.x;
    for (const z of this.zombies) {
      z.z -= z.speed * dt;
      this.steerZombie(z, px, dt);
    }
    this.zombies = this.zombies.filter(z => z.z > this.player.z - 2);
  }

  /** Sceglie il comportamento di uno zombi appena comparso (con il generatore casuale del livello). */
  private zombieBrain(bite: number): Pick<Zombie, 'style' | 'side'> {
    const r = this.rng();
    const side = this.rng() < 0.5 ? -1 : 1;
    if (bite > 1) return { style: 'lane', side };
    if (r < ZOMBIE_STYLE_SHARE.chase) return { style: 'chase', side };
    if (r < ZOMBIE_STYLE_SHARE.chase + ZOMBIE_STYLE_SHARE.flank) return { style: 'flank', side };
    return { style: 'lane', side };
  }

  /** Movimento laterale secondo il comportamento: insieme formano un'orda meno prevedibile
   *  di una semplice fila davanti alla squadra (che sarebbe facile da falciare). */
  private steerZombie(z: Zombie, px: number, dt: number): void {
    const dz = z.z - this.player.z;
    const toward = (target: number, speed: number) => {
      z.x += Math.sign(target - z.x) * Math.min(Math.abs(target - z.x), speed * dt);
    };
    if (z.style === 'chase') {
      if (dz < ZOMBIE_CHASE_DISTANCE) toward(px, z.bite > 1 ? BRUTE_CHASE_SPEED : ZOMBIE_CHASE_SPEED);
    } else if (z.style === 'flank') {
      if (dz > FLANK_CUT_DISTANCE) {
        // Resta ai lati della squadra, dal lato più comodo (se il bordo è troppo vicino cambia lato).
        let target = px + z.side * FLANK_OFFSET;
        if (Math.abs(target) > LANE_LIMIT) target = px - z.side * FLANK_OFFSET;
        if (dz < ZOMBIE_CHASE_DISTANCE + 8) toward(clamp(target, -LANE_LIMIT, LANE_LIMIT), FLANK_SPEED);
      } else toward(px, FLANK_SPEED);
    } else {
      // Sulla propria corsia, barcollando; da vicino si lancia verso la squadra.
      if (dz < LUNGE_DISTANCE) toward(px, z.bite > 1 ? BRUTE_CHASE_SPEED : LUNGE_SPEED);
      else toward(z.homeX + Math.sin(this.time * 1.5 + z.id) * 0.05, 0.3);
    }
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
    for (const h of this.hazards) {
      if (!h.alive || isLobbed(h.kind) || Math.abs(b.x - h.x) > HAZARD.radius[h.kind] + 0.04) continue;
      if (h.z >= prevZ - 0.4 && h.z <= b.z + 0.4) {
        if (b.splash) return this.explode(b, h.z), true;
        this.damageHazard(h, h.kind === 'boulder' ? b.damage * b.wallMul : b.damage);
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
    for (const h of this.hazards) {
      if (h.alive && !isLobbed(h.kind) && Math.abs(h.x - b.x) < r + HAZARD.radius[h.kind] && Math.abs(h.z - z) < dz) {
        this.damageHazard(h, h.kind === 'boulder' ? b.damage * b.wallMul : b.damage);
      }
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

  private damageHazard(h: Hazard, dmg: number): void {
    h.hp -= dmg;
    if (h.hp > 0) return;
    h.alive = false;
    this.stats.hazards++;
    this.events.push({ kind: 'hazardKilled', hazard: h.kind, x: h.x, z: h.z });
  }

  // --- Attacchi a distanza dei nemici ---

  /** Bruti con `throws` e boss lanciano a intervalli regolari quando la squadra è a tiro. */
  private updateThrows(dt: number): void {
    const p = this.player;
    for (const z of this.zombies) {
      if (!z.throws) continue;
      const dz = z.z - p.z;
      if (dz < 5 || dz > 28) continue;
      z.throwTimer -= dt;
      if (z.throwTimer <= 0) {
        z.throwTimer = z.throws.every;
        this.launch(z.throws, z.x, z.z);
      }
    }
    const b = this.boss;
    // Il boss lancia solo da lontano: a contatto con la squadra morde e basta.
    if (!b || !b.active || b.dead || b.z - p.z > 30 || b.z - p.z < 4) return;
    b.attacks.forEach((a, i) => {
      b.attackTimers[i] -= dt;
      if (b.attackTimers[i] <= 0) {
        b.attackTimers[i] = a.every;
        // Parte 3 m davanti al boss: fuori dal raggio delle esplosioni che lo colpirebbero.
        this.launch(a, b.x, b.z - 3);
      }
    });
  }

  private launch(a: AttackDef, fromX: number, fromZ: number): void {
    const p = this.player;
    const base = {
      kind: a.kind, x: fromX, z: fromZ, height: 0, fromX, fromZ, toX: fromX, toZ: fromZ, t: 0, duration: 1,
      vz: 0, phase: 0, hp: a.hp ?? 1, maxHp: a.hp ?? 1, damage: a.damage ?? 1, alive: true,
    };
    const lead = this.bossFight ? 0 : this.level.playerSpeed * HAZARD.lobTime;
    if (a.kind === 'rock') {
      // Mira dove sarà la squadra all'atterraggio: spostandosi di lato la si schiva.
      this.hazards.push({ ...base, id: this.nextId++, toX: p.x, toZ: p.z + lead, duration: HAZARD.lobTime });
    } else if (a.kind === 'zombie') {
      // Atterra poco davanti alla squadra: se non la centra diventa uno zombi da abbattere.
      // Mai oltre chi lancia: deve atterrare tra lui e la squadra.
      const toX = clamp(p.x + (this.rng() - 0.5) * 0.6, -LANE_LIMIT, LANE_LIMIT);
      const toZ = Math.min(p.z + lead + 4 + this.rng() * 6, fromZ - 1);
      this.hazards.push({ ...base, id: this.nextId++, toX, toZ, duration: HAZARD.lobTime });
    } else if (a.kind === 'boulder') {
      // Rotola lungo la corsia in cui si trova la squadra al momento del lancio.
      this.hazards.push({ ...base, id: this.nextId++, x: p.x, toX: p.x, vz: -HAZARD.boulderSpeed });
    } else {
      const n = a.count ?? 1;
      for (let i = 0; i < n; i++) {
        const x = clamp(fromX + (i - (n - 1) / 2) * 0.15, -LANE_LIMIT, LANE_LIMIT);
        this.hazards.push({ ...base, id: this.nextId++, x, toX: x, z: fromZ - i * 0.6, vz: -HAZARD.crowSpeed, phase: i * 1.3 });
      }
    }
    this.events.push({ kind: 'throw', hazard: a.kind, x: fromX, z: fromZ });
  }

  private moveHazards(dt: number): void {
    const p = this.player;
    const reach = formationRadius(p.soldiers);
    for (const h of this.hazards) {
      if (!h.alive) continue;
      const r = HAZARD.radius[h.kind] + reach;
      if (isLobbed(h.kind)) {
        if (!stepLob(h, dt)) continue;
        h.alive = false;
        const hit = Math.abs(h.x - p.x) < r && Math.abs(h.z - p.z) < 1.5;
        this.events.push({ kind: 'hazardLand', hazard: h.kind, x: h.x, z: h.z, hit });
        if (hit) this.hurt(h.damage, h.z);
        else if (h.kind === 'zombie') {
          this.zombies.push({
            id: this.nextId++, x: h.x, z: h.z, hp: h.hp, maxHp: h.hp, speed: 2.5, bite: 1, horde: -1, throwTimer: 0,
            style: 'chase', homeX: h.x, side: 1,
          });
        }
      } else {
        stepGround(h, dt, p.x);
        if (h.z < p.z - 2) h.alive = false;
        else if (Math.abs(h.z - p.z) < 0.6 && Math.abs(h.x - p.x) < r) {
          h.alive = false;
          this.hurt(h.damage, h.z);
        }
      }
    }
    this.hazards = this.hazards.filter(h => h.alive);
  }

  private hurt(count: number, z: number): void {
    const p = this.player;
    p.soldiers = Math.max(0, p.soldiers - count);
    this.events.push({ kind: 'hurt', x: p.x, z, count });
    this.emit(p.x, z, `-${count}`, 'bad');
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
    const r = formationRadius(p.soldiers) + ZOMBIE_REACH;
    let hits = 0;
    this.zombies = this.zombies.filter(z => {
      // I bruti hanno braccia lunghe: passargli accanto di striscio non basta.
      const reach = r + (z.bite > 1 ? BRUTE_EXTRA_REACH : 0);
      const touching = z.z <= p.z + 0.4 && z.z >= p.z - 1 && Math.abs(z.x - p.x) < reach;
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
