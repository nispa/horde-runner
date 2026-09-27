// Mondo 3D di un livello: costruisce la scena e la sincronizza con lo stato del core a ogni fotogramma.
// È l'equivalente 3D di GameScene (Phaser): la logica resta tutta in core/, qui si decide solo "come appare".
// Tutti i modelli vengono chiesti al pacchetto modelli (models/), così lo stile è intercambiabile.
import * as THREE from 'three';
import type { Game } from '../../core/game';
import { isLobbed, HAZARD } from '../../core/hazards';
import { formatGate, formationRadius, isGoodGate } from '../../core/rules';
import type { GameEvent, GateOp, HazardKind, LevelDef, Wall, WeaponId } from '../../core/types';
import { disposeTree } from './models/voxel';
import { ROAD_HALF, type Crowd, type ModelPack, type Prop } from './models/types';
import { roadTexture, textSprite } from './textures';

const MAX_SOLDIERS = 80;
const MAX_ZOMBIES = 320;
const MAX_BRUTES = 60;
const MAX_BULLETS = 300;
const MAX_PARTICLES = 500;
const MAX_DECALS = 80;
/** Metri visibili davanti e dietro la squadra (oltre non si disegna nulla). */
const VIEW_AHEAD = 45;
const VIEW_BEHIND = 12;

const BULLET_COLOR: Record<WeaponId, number> = { rifle: 0xffd84a, minigun: 0x9fe8ff, shotgun: 0xffb050, rocket: 0xff5a3a };
const BULLET_SIZE: Record<WeaponId, [number, number, number]> = {
  rifle: [0.07, 0.07, 0.35], minigun: [0.05, 0.05, 0.4], shotgun: [0.09, 0.09, 0.09], rocket: [0.16, 0.16, 0.6],
};

/** Conversione dalle coordinate del core (x lane −1..1, z metri) al mondo 3D (X, Z metri; avanti = −Z). */
export const wx = (x: number) => x * ROAD_HALF;
export const wz = (z: number) => -z;

interface WallView { group: THREE.Group; crates: Prop[]; hp: { sprite: THREE.Sprite; set: (t: string) => void } }
interface HazardView { prop: Prop; marker?: THREE.Mesh }
interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; size: number; color: THREE.Color }

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const v3 = new THREE.Vector3();
const s3 = new THREE.Vector3();
const tint = new THREE.Color();

export class World3D {
  readonly scene = new THREE.Scene();
  readonly sun = new THREE.DirectionalLight(0xffffff, 2.2);
  readonly ambient = new THREE.HemisphereLight(0xdfefff, 0x5a4a3a, 1.4);

  private soldiers: Crowd;
  private zombies: Crowd;
  private brutes: Crowd;
  private boss: Prop | null = null;
  private gates = new Map<number, THREE.Group>();
  private walls = new Map<number, WallView>();
  private pickups = new Map<number, Prop>();
  private hazards = new Map<number, HazardView>();
  private bullets: THREE.InstancedMesh;
  private particles: THREE.InstancedMesh;
  private particleData: Particle[] = [];
  private decals: THREE.InstancedMesh;
  private decalCount = 0;
  private disposables: { dispose(): void }[] = [];

  constructor(private pack: ModelPack, private level: LevelDef) {
    const theme = level.theme ?? 'grass';
    const sky = theme === 'snow' ? 0xcfe0ee : theme === 'sand' ? 0xf0d8a8 : 0x9ad0f0;
    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.Fog(sky, 45, 95);

    // Luci: cielo + sole con ombre, che segue la squadra (vedi update).
    this.sun.position.set(8, 20, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -22, right: 22, top: 30, bottom: -30, near: 1, far: 60 });
    this.scene.add(this.ambient, this.sun, this.sun.target);

    // Strada con asfalto a pixel, traguardo a scacchi, terreno e scenario dal pacchetto modelli.
    const roadLen = level.length + 120;
    const roadTex = roadTexture();
    roadTex.repeat.set(1, roadLen / 8);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, roadLen), new THREE.MeshLambertMaterial({ map: roadTex }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.001, wz(level.length / 2 - 20));
    road.receiveShadow = true;
    this.scene.add(road);
    this.scene.add(finishLine(level.length));
    this.scene.add(pack.createScenery(theme, level.length));

    this.soldiers = pack.createCrowd('soldier', MAX_SOLDIERS);
    this.zombies = pack.createCrowd('zombie', MAX_ZOMBIES);
    this.brutes = pack.createCrowd('brute', MAX_BRUTES);
    this.scene.add(this.soldiers.object, this.zombies.object, this.brutes.object);
    this.disposables.push(this.soldiers, this.zombies, this.brutes);

    this.bullets = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_BULLETS);
    this.particles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), MAX_PARTICLES);
    const decalGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.decals = new THREE.InstancedMesh(decalGeo, new THREE.MeshLambertMaterial({ color: 0x5a1010, transparent: true, opacity: 0.75, depthWrite: false }), MAX_DECALS);
    for (const m of [this.bullets, this.particles, this.decals]) {
      m.frustumCulled = false;
      m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(m);
    }
  }

  /** Sincronizza la scena con lo stato della partita. `time` in secondi (per le animazioni). */
  update(game: Game, dt: number, time: number): void {
    const pz = game.player.z;
    const visible = (z: number) => z > pz - VIEW_BEHIND && z < pz + VIEW_AHEAD;

    // Il sole segue la squadra, così le ombre sono sempre nitide dove si gioca.
    this.sun.position.set(8, 20, wz(pz) + 6);
    this.sun.target.position.set(0, 0, wz(pz) - 8);

    this.syncSquad(game, time);
    this.syncZombies(game, time, visible);
    this.syncBoss(game, time);
    this.syncGates(game, visible);
    this.syncWalls(game, visible);
    this.syncPickups(game, time, visible);
    this.syncHazards(game, time);
    this.syncBullets(game);
    this.updateParticles(dt);
  }

  private syncSquad(game: Game, time: number): void {
    const p = game.player;
    const n = Math.min(p.soldiers, MAX_SOLDIERS);
    const r = formationRadius(p.soldiers);
    for (let i = 0; i < n; i++) {
      // Disposizione "a girasole" (angolo aureo), come nel 2D.
      const ang = i * 2.39996;
      const rad = r * Math.sqrt((i + 0.5) / n);
      this.soldiers.set(i, wx(p.x + Math.cos(ang) * rad), wz(p.z + Math.sin(ang) * rad * 3), 0, 1.25, time * 12 + i);
    }
    this.soldiers.setCount(n);
    this.soldiers.commit();
  }

  private syncZombies(game: Game, time: number, visible: (z: number) => boolean): void {
    let nz = 0;
    let nb = 0;
    for (const z of game.zombies) {
      if (!visible(z.z)) continue;
      const wounded = z.hp < z.maxHp * 0.5;
      tint.setScalar(wounded ? 0.6 : 1);
      // Barcollano: piccola rotazione e passo lento. Guardano verso la squadra (+Z = indietro).
      const facing = Math.PI + Math.sin(time * 3 + z.id) * 0.2;
      if (z.bite > 1 && nb < MAX_BRUTES) this.brutes.set(nb++, wx(z.x), wz(z.z), facing, 1.3 * (1 + (z.bite - 1) * 0.3), time * 5 + z.id, tint);
      else if (nz < MAX_ZOMBIES) this.zombies.set(nz++, wx(z.x), wz(z.z), facing, 1.3, time * 6 + z.id, tint);
    }
    this.zombies.setCount(nz);
    this.brutes.setCount(nb);
    this.zombies.commit();
    this.brutes.commit();
  }

  private syncBoss(game: Game, time: number): void {
    const b = game.boss;
    if (!b || !b.active || b.dead) {
      if (this.boss) this.boss.object.visible = false;
      return;
    }
    if (!this.boss) {
      this.boss = this.pack.createBoss();
      this.boss.object.scale.setScalar(3.2);
      this.scene.add(this.boss.object);
      this.disposables.push(this.boss);
    }
    this.boss.object.visible = true;
    this.boss.object.position.set(wx(b.x), 0, wz(b.z));
    this.boss.object.rotation.y = Math.PI + Math.sin(time * 2) * 0.1;
    this.boss.animate?.(time, time * 3);
  }

  private syncGates(game: Game, visible: (z: number) => boolean): void {
    for (const g of game.gates) {
      let view = this.gates.get(g.id);
      if (!g.passed && visible(g.z)) {
        if (!view) {
          view = gateModel(g.left, g.right);
          view.position.z = wz(g.z);
          this.gates.set(g.id, view);
          this.scene.add(view);
        }
      } else if (view) {
        this.scene.remove(view);
        disposeTree(view);
        this.gates.delete(g.id);
      }
    }
  }

  private syncWalls(game: Game, visible: (z: number) => boolean): void {
    for (const w of game.walls) {
      let view = this.walls.get(w.id);
      if (!w.destroyed && visible(w.z)) {
        if (!view) {
          view = this.wallModel(w);
          this.walls.set(w.id, view);
          this.scene.add(view.group);
        }
        view.hp.set(String(Math.ceil(w.hp)));
      } else if (view) {
        if (w.hp <= 0) this.burst(wx(w.x), 0.8, wz(w.z), 40, 0xc68a4a, 5, ROAD_HALF * w.width / 2);
        this.scene.remove(view.group);
        view.crates.forEach(c => c.dispose());
        disposeTree(view.hp.sprite);
        this.walls.delete(w.id);
      }
    }
  }

  private wallModel(w: Wall): WallView {
    const group = new THREE.Group();
    group.position.set(wx(w.x), 0, wz(w.z));
    const width = w.width * ROAD_HALF * 2;
    const count = Math.max(1, Math.round(width / 1.2));
    const size = width / count;
    const crates: Prop[] = [];
    for (let i = 0; i < count; i++) {
      const c = this.pack.createCrate(size);
      c.object.position.x = -width / 2 + size * (i + 0.5);
      group.add(c.object);
      crates.push(c);
    }
    const icon = w.reward.kind === 'soldiers' ? '+' : w.reward.kind === 'fireRate' ? '>>' : '!';
    const hp = textSprite('', 0.8, { color: '#ffffff' });
    hp.sprite.position.y = size + 0.7;
    const reward = textSprite(`${icon}${w.reward.value} ${w.reward.kind === 'soldiers' ? 'SOLDATI' : w.reward.kind === 'fireRate' ? 'CADENZA' : 'DANNO'}`, 0.45, { width: 512, color: '#6fc0ff', size: 44 });
    reward.sprite.position.y = size + 1.35;
    group.add(hp.sprite, reward.sprite);
    return { group, crates, hp };
  }

  private syncPickups(game: Game, time: number, visible: (z: number) => boolean): void {
    for (const k of game.pickups) {
      let prop = this.pickups.get(k.id);
      if (!k.taken && visible(k.z)) {
        if (!prop) {
          prop = this.pack.createPickup(k.weapon);
          prop.object.position.set(wx(k.x), 0, wz(k.z));
          this.pickups.set(k.id, prop);
          this.scene.add(prop.object);
        }
        prop.animate?.(time + k.id);
      } else if (prop) {
        this.scene.remove(prop.object);
        prop.dispose();
        this.pickups.delete(k.id);
      }
    }
  }

  private syncHazards(game: Game, time: number): void {
    const alive = new Set<number>();
    for (const h of game.hazards) {
      alive.add(h.id);
      let view = this.hazards.get(h.id);
      if (!view) {
        view = { prop: this.pack.createHazard(h.kind) };
        if (isLobbed(h.kind)) view.marker = landingMarker(h.kind);
        this.scene.add(view.prop.object);
        if (view.marker) this.scene.add(view.marker);
        this.hazards.set(h.id, view);
      }
      const o = view.prop.object;
      o.position.set(wx(h.x), h.height + (h.kind === 'boulder' ? 0.55 : h.kind === 'crow' ? 0.4 : 0.25), wz(h.z));
      if (isLobbed(h.kind)) {
        o.rotation.set(h.t * 9, h.t * 5, 0);
        view.marker!.position.set(wx(h.toX), 0.02, wz(h.toZ));
        (view.marker!.material as THREE.MeshBasicMaterial).opacity = 0.25 + h.t * 0.6;
        view.marker!.scale.setScalar(0.6 + h.t * 0.4);
      } else if (h.kind === 'boulder') {
        o.rotation.x = h.z * 1.2; // rotola verso la squadra
      }
      view.prop.animate?.(time + h.phase);
    }
    for (const [id, view] of this.hazards) {
      if (alive.has(id)) continue;
      this.scene.remove(view.prop.object);
      view.prop.dispose();
      if (view.marker) {
        this.scene.remove(view.marker);
        disposeTree(view.marker);
      }
      this.hazards.delete(id);
    }
  }

  private syncBullets(game: Game): void {
    let n = 0;
    for (const b of game.bullets) {
      if (n >= MAX_BULLETS) break;
      const [sx, sy, sz] = BULLET_SIZE[b.weapon];
      m4.compose(v3.set(wx(b.x), 0.75, wz(b.z)), q.identity(), s3.set(sx, sy, sz));
      this.bullets.setMatrixAt(n, m4);
      this.bullets.setColorAt(n, tint.set(BULLET_COLOR[b.weapon]));
      n++;
    }
    this.bullets.count = n;
    this.bullets.instanceMatrix.needsUpdate = true;
    if (this.bullets.instanceColor) this.bullets.instanceColor.needsUpdate = true;
  }

  // --- Effetti: particelle a cubetti (stile Minecraft) e macchie a terra ---

  /** Esplosione di cubetti. `spread` = raggio orizzontale di partenza in metri. */
  burst(x: number, y: number, z: number, count: number, color: number, speed = 4, spread = 0.2): void {
    for (let i = 0; i < count; i++) {
      if (this.particleData.length >= MAX_PARTICLES) this.particleData.shift();
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.particleData.push({
        x: x + (Math.random() - 0.5) * spread * 2, y, z,
        vx: Math.cos(a) * s * 0.6, vy: 2 + Math.random() * speed, vz: Math.sin(a) * s * 0.6,
        life: 0.5 + Math.random() * 0.5, size: 0.08 + Math.random() * 0.12,
        color: new THREE.Color(color).multiplyScalar(0.7 + Math.random() * 0.5),
      });
    }
  }

  private updateParticles(dt: number): void {
    this.particleData = this.particleData.filter(p => (p.life -= dt) > 0);
    this.particleData.forEach((p, i) => {
      p.vy -= 18 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt;
      m4.compose(v3.set(p.x, p.y, p.z), q.identity(), s3.setScalar(p.size * Math.min(1, p.life * 3)));
      this.particles.setMatrixAt(i, m4);
      this.particles.setColorAt(i, p.color);
    });
    this.particles.count = this.particleData.length;
    this.particles.instanceMatrix.needsUpdate = true;
    if (this.particles.instanceColor) this.particles.instanceColor.needsUpdate = true;
  }

  private splat(x: number, z: number, size: number): void {
    const i = this.decalCount++ % MAX_DECALS;
    m4.compose(v3.set(x, 0.01 + (i % 10) * 0.0005, z), q.setFromAxisAngle(v3.set(0, 1, 0), Math.random() * 3), s3.set(size, 1, size));
    this.decals.setMatrixAt(i, m4);
    this.decals.count = Math.min(this.decalCount, MAX_DECALS);
    this.decals.instanceMatrix.needsUpdate = true;
  }

  /** Effetti visivi degli eventi del core (i suoni e i testi li gestisce App3D). */
  handleEvent(e: GameEvent): void {
    switch (e.kind) {
      case 'zombieKilled':
        this.burst(wx(e.x), 0.8, wz(e.z), 10 * e.bite, 0x5aa03a, 3);
        this.splat(wx(e.x), wz(e.z), e.bite > 1 ? 1.2 : 0.7);
        break;
      case 'hurt': this.burst(wx(e.x), 0.8, wz(e.z), Math.min(40, 5 * e.count), 0xa02020, 3); break;
      case 'wallHit': this.burst(wx(e.x), 0.8, wz(e.z), 2, 0xc68a4a, 2); break;
      case 'explosion':
        this.burst(wx(e.x), 0.5, wz(e.z), 30, 0xff8a2a, 6, e.radius * ROAD_HALF);
        this.splat(wx(e.x), wz(e.z), 1.4);
        break;
      case 'weaponPickup': this.burst(wx(e.x), 1, wz(e.z), 20, 0xffe060, 4); break;
      case 'bossHit': if (Math.random() < 0.3) this.burst(wx(e.x), 2, wz(e.z), 2, 0xffe0a0, 3); break;
      case 'bossKilled':
        this.burst(wx(e.x), 2, wz(e.z), 150, 0xff6a2a, 9, 1.5);
        this.splat(wx(e.x), wz(e.z), 4);
        break;
      case 'hazardLand': this.burst(wx(e.x), 0.2, wz(e.z), e.hazard === 'rock' ? 14 : 8, 0x9a9a9a, 3); break;
      case 'hazardKilled': this.burst(wx(e.x), 0.6, wz(e.z), 16, e.hazard === 'boulder' ? 0xb08060 : 0x202020, 4); break;
      default: break;
    }
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    for (const w of this.walls.values()) w.crates.forEach(c => c.dispose());
    for (const p of this.pickups.values()) p.dispose();
    for (const h of this.hazards.values()) h.prop.dispose();
    disposeTree(this.scene);
  }
}

/** Porta con due pannelli (sinistra/destra) semitrasparenti, blu = bonus, rosso = malus. */
function gateModel(left: GateOp, right: GateOp): THREE.Group {
  const group = new THREE.Group();
  const h = 2.4;
  for (const [side, op] of [[-1, left], [1, right]] as const) {
    const color = isGoodGate(op) ? 0x2f9cff : 0xff4d4d;
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_HALF - 0.15, h),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
    );
    panel.position.set(side * ROAD_HALF / 2, h / 2, 0);
    const label = textSprite(formatGate(op), 1.5);
    label.sprite.position.set(side * ROAD_HALF / 2, h / 2 + 0.1, 0.05);
    group.add(panel, label.sprite);
  }
  // Pali ai lati e in mezzo.
  for (const x of [-ROAD_HALF, 0, ROAD_HALF]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, h + 0.3, 0.2), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    post.position.set(x, (h + 0.3) / 2, 0);
    post.castShadow = true;
    group.add(post);
  }
  return group;
}

/** Cerchio rosso a terra dove cadrà un oggetto lanciato. */
function landingMarker(kind: HazardKind): THREE.Mesh {
  const r = HAZARD.radius[kind] * ROAD_HALF * 1.3;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r * 0.55, r, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.4, depthWrite: false }),
  );
  return ring;
}

/** Traguardo a scacchi bianchi e neri. */
function finishLine(length: number): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 2;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) {
    g.fillStyle = (i + j) % 2 ? '#ffffff' : '#111111';
    g.fillRect(i, j, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 1), new THREE.MeshBasicMaterial({ map: tex }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.01, wz(length));
  return mesh;
}
