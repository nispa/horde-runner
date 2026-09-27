// Renderer Phaser: legge lo stato del core e lo sincronizza con sprite, testi ed effetti.
// La logica di gioco resta tutta in core/: qui si decide solo "come appare".
import Phaser from 'phaser';
import { Game } from '../../core/game';
import { formatGate, formationRadius, isGoodGate } from '../../core/rules';
import type { GameEvent, GateOp, LevelDef, Wall } from '../../core/types';
import { bindInput } from '../../platform/input';
import { Sfx } from './Sfx';

const FIXED_DT = 1 / 60;
const VIEW_AHEAD = 32; // metri visibili davanti al giocatore
const PLAYER_Y = 0.82; // posizione verticale del giocatore (frazione dell'altezza)
const MAX_DRAWN_SOLDIERS = 80;
const MAX_BULLETS = 200;
const MAX_DECALS = 60;
const CHARACTER_SCALE = 0.75;
const HUD_HEIGHT = 44;

// Frame del tilesheet Kenney (griglia 27 colonne x 64px).
const FRAME = { grass: 0, crate: 128, splat: 319 };

const COLOR = {
  good: 0x2f9cff,
  bad: 0xff4d4d,
  road: 0x484848,
  bullet: 0xffd84a,
  blood: 0x8a1c1c,
  wood: 0xc68a4a,
};

const DEPTH = { ground: 0, decal: 1, gate: 2, wall: 3, bullet: 4, zombie: 5, squad: 6, fx: 7, hud: 10, overlay: 20 };

interface WallView { box: Phaser.GameObjects.Container; hp: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Rectangle; barWidth: number }
interface Decal { img: Phaser.GameObjects.Image; x: number; z: number }

export class GameScene extends Phaser.Scene {
  private sim!: Game;
  private acc = 0;
  private w = 0;
  private h = 0;
  private laneHalf = 0;
  private endShown = false;

  private grass!: Phaser.GameObjects.TileSprite;
  private road!: Phaser.GameObjects.TileSprite;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private blood!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hud!: Phaser.GameObjects.Text;
  private progress!: Phaser.GameObjects.Rectangle;
  private squadLabel!: Phaser.GameObjects.Text;
  private muteButton!: Phaser.GameObjects.Text;
  private sfx!: Sfx;

  private soldiers: Phaser.GameObjects.Image[] = [];
  private bullets: Phaser.GameObjects.Image[] = [];
  private gates = new Map<number, Phaser.GameObjects.Container>();
  private walls = new Map<number, WallView>();
  private zombies = new Map<number, Phaser.GameObjects.Image>();
  private decals: Decal[] = [];

  constructor(private level: LevelDef) {
    super('game');
  }

  preload(): void {
    this.load.spritesheet('tiles', 'assets/kenney/tiles.png', { frameWidth: 64, frameHeight: 64 });
    this.load.image('soldier', 'assets/kenney/soldier.png');
    this.load.image('zombie', 'assets/kenney/zombie.png');
    Sfx.preload(this);
  }

  create(): void {
    this.sim = new Game(this.level, Date.now());
    // Solo in sviluppo: accesso da console per il debug (window.__scene.sim).
    if (import.meta.env.DEV) (window as unknown as { __scene: GameScene }).__scene = this;
    this.acc = 0;
    this.endShown = false;
    this.gates.clear();
    this.walls.clear();
    this.zombies.clear();
    this.decals = [];

    this.makeTextures();
    this.grass = this.add.tileSprite(0, 0, 1, 1, 'tiles', FRAME.grass).setOrigin(0).setDepth(DEPTH.ground);
    this.road = this.add.tileSprite(0, 0, 1, 1, 'road').setOrigin(0.5, 0).setDepth(DEPTH.ground);

    this.soldiers = Array.from({ length: MAX_DRAWN_SOLDIERS }, () =>
      this.add.image(0, 0, 'soldier').setScale(CHARACTER_SCALE).setAngle(-90).setDepth(DEPTH.squad).setVisible(false));
    this.bullets = Array.from({ length: MAX_BULLETS }, () =>
      this.add.image(0, 0, 'bullet').setDepth(DEPTH.bullet).setVisible(false));
    this.squadLabel = this.label(0, 0, '', 22).setDepth(DEPTH.squad);

    this.sparks = this.add.particles(0, 0, 'spark', {
      speed: { min: 80, max: 260 }, lifespan: 550, scale: { start: 1.2, end: 0 },
      tint: [COLOR.wood, 0xffe0a0, 0xffffff], emitting: false,
    }).setDepth(DEPTH.fx);
    this.blood = this.add.particles(0, 0, 'spark', {
      speed: { min: 30, max: 120 }, lifespan: 350, scale: { start: 0.8, end: 0 },
      tint: [COLOR.blood, 0x5a9e3a], emitting: false,
    }).setDepth(DEPTH.fx);

    this.hud = this.label(12, 22, '', 16).setOrigin(0, 0.5).setDepth(DEPTH.hud);
    this.add.rectangle(0, 0, 1, HUD_HEIGHT, 0x000000, 0.5).setOrigin(0).setDepth(DEPTH.hud - 1).setName('hudBg');
    this.progress = this.add.rectangle(0, HUD_HEIGHT, 0, 4, COLOR.good).setOrigin(0).setDepth(DEPTH.hud);

    this.sfx = new Sfx(this);
    this.muteButton = this.label(0, HUD_HEIGHT / 2, '', 22).setDepth(DEPTH.hud).setInteractive({ useHandCursor: true });
    const toggleMute = () => { this.sfx.toggleMute(); this.updateMuteButton(); };
    this.muteButton.on('pointerdown', toggleMute);
    this.input.keyboard?.on('keydown-M', toggleMute);
    this.updateMuteButton();

    this.layout();
    this.scale.on('resize', this.layout, this);

    const unbind = bindInput(this.game.canvas, {
      // I tocchi sulla barra in alto (pulsante muto) non spostano la squadra.
      onSteer: (clientX, clientY) => { if (clientY > HUD_HEIGHT + 4) this.sim.steerTo(this.screenToLaneX(clientX)); },
      onNudge: dir => this.sim.steerTo(this.sim.player.targetX + dir * 0.04),
      onTap: () => { if (this.sim.status !== 'playing') this.scene.restart(); },
    });
    this.events.once('shutdown', () => {
      unbind();
      this.scale.off('resize', this.layout, this);
      this.input.keyboard?.off('keydown-M', toggleMute);
    });
  }

  update(_time: number, deltaMs: number): void {
    this.acc += Math.min(0.1, deltaMs / 1000);
    while (this.acc >= FIXED_DT) {
      this.sim.step(FIXED_DT);
      this.acc -= FIXED_DT;
    }
    this.syncWorld();
    for (const e of this.sim.drainEvents()) this.handleEvent(e);
    this.syncHud();
    if (this.sim.status !== 'playing' && !this.endShown) this.showEnd();
  }

  // --- Layout e proiezione ---

  private layout(): void {
    this.w = this.scale.width;
    this.h = this.scale.height;
    this.laneHalf = Math.min(this.w * 0.45, 240);
    this.grass.setSize(this.w, this.h);
    this.road.setPosition(this.w / 2, 0).setSize(this.laneHalf * 2, this.h);
    // Una sola "piastrella" di asfalto in larghezza: bordi e linea centrale non si ripetono.
    this.road.setTileScale((this.laneHalf * 2) / 256, 1);
    (this.children.getByName('hudBg') as Phaser.GameObjects.Rectangle).setSize(this.w, HUD_HEIGHT);
    this.muteButton.setX(this.w - 26);
    // Gli oggetti dipendono dalla larghezza della lane: si ricreano alla prossima sincronizzazione.
    for (const g of this.gates.values()) g.destroy();
    for (const wv of this.walls.values()) wv.box.destroy();
    this.gates.clear();
    this.walls.clear();
  }

  private get ppm(): number {
    return (this.h * PLAYER_Y) / VIEW_AHEAD;
  }

  private sx(x: number): number {
    return this.w / 2 + x * this.laneHalf;
  }

  private sy(dz: number): number {
    return this.h * PLAYER_Y - dz * this.ppm;
  }

  private screenToLaneX(clientX: number): number {
    const rect = this.game.canvas.getBoundingClientRect();
    return (clientX - rect.left - this.w / 2) / this.laneHalf;
  }

  private visible(dz: number): boolean {
    return dz > -3 && dz < VIEW_AHEAD + 3;
  }

  // --- Sincronizzazione stato → oggetti grafici ---

  private syncWorld(): void {
    const s = this.sim;
    const pz = s.player.z;
    const scroll = pz * this.ppm;
    this.grass.tilePositionY = -scroll;
    this.road.tilePositionY = -scroll;

    this.syncGates(pz);
    this.syncWalls(pz);
    this.syncZombies(pz);
    this.syncBullets(pz);
    this.syncSquad();
    this.syncDecals(pz);
  }

  private syncGates(pz: number): void {
    for (const g of this.sim.gates) {
      let view = this.gates.get(g.id);
      if (!g.passed && this.visible(g.z - pz)) {
        if (!view) this.gates.set(g.id, view = this.makeGate(g.left, g.right));
        view.setY(this.sy(g.z - pz));
      } else if (view) {
        view.destroy();
        this.gates.delete(g.id);
      }
    }
  }

  private syncWalls(pz: number): void {
    for (const w of this.sim.walls) {
      let view = this.walls.get(w.id);
      if (!w.destroyed && this.visible(w.z - pz)) {
        if (!view) this.walls.set(w.id, view = this.makeWall(w));
        view.box.setY(this.sy(w.z - pz));
        view.hp.setText(`${Math.ceil(w.hp)}`);
        view.bar.width = view.barWidth * (w.hp / w.maxHp);
      } else if (view) {
        if (w.hp <= 0) this.explodeWall(view.box.x, view.box.y, view.barWidth);
        view.box.destroy();
        this.walls.delete(w.id);
      }
    }
  }

  private syncZombies(pz: number): void {
    const alive = new Set<number>();
    const t = this.time.now / 1000;
    for (const z of this.sim.zombies) {
      alive.add(z.id);
      let img = this.zombies.get(z.id);
      if (!img) {
        // I "bruti" (bite > 1) sono più grossi e tendenti al rosso.
        img = this.add.image(0, 0, 'zombie').setScale(CHARACTER_SCALE * (1 + (z.bite - 1) * 0.3)).setDepth(DEPTH.zombie);
        this.zombies.set(z.id, img);
      }
      const dz = z.z - pz;
      img.setVisible(this.visible(dz));
      img.setPosition(this.sx(z.x), this.sy(dz));
      // Andatura barcollante e tinta più scura quando sono feriti.
      img.setAngle(90 + Math.sin(t * 6 + z.id) * 12);
      const wounded = z.hp < z.maxHp * 0.5;
      img.setTint(z.bite > 1 ? (wounded ? 0xaa6666 : 0xff9090) : (wounded ? 0x9a9a9a : 0xffffff));
    }
    for (const [id, img] of this.zombies) {
      if (alive.has(id)) continue;
      // Gli effetti di morte/contatto arrivano come eventi dal core (handleEvent).
      img.destroy();
      this.zombies.delete(id);
    }
  }

  private syncBullets(pz: number): void {
    const list = this.sim.bullets;
    for (let i = 0; i < this.bullets.length; i++) {
      const img = this.bullets[i];
      const b = list[i];
      if (!b) { img.setVisible(false); continue; }
      img.setVisible(true).setPosition(this.sx(b.x), this.sy(b.z - pz));
    }
  }

  private syncSquad(): void {
    const p = this.sim.player;
    const n = Math.min(p.soldiers, MAX_DRAWN_SOLDIERS);
    const r = formationRadius(p.soldiers);
    const t = this.time.now / 1000;
    for (let i = 0; i < this.soldiers.length; i++) {
      const img = this.soldiers[i];
      if (i >= n) { img.setVisible(false); continue; }
      // Disposizione "a girasole" più un leggero ondeggiare di corsa.
      const ang = i * 2.39996;
      const rad = r * Math.sqrt((i + 0.5) / n);
      const x = this.sx(p.x + Math.cos(ang) * rad);
      const y = this.sy(Math.sin(ang) * rad * 2.5) + Math.sin(t * 14 + i) * 1.5;
      img.setVisible(true).setPosition(x, y);
    }
    this.squadLabel
      .setText(`${p.soldiers}`)
      .setPosition(this.sx(p.x), this.sy(0) + r * this.laneHalf + 26);
  }

  private syncDecals(pz: number): void {
    this.decals = this.decals.filter(d => {
      const dz = d.z - pz;
      if (dz < -6) { d.img.destroy(); return false; }
      d.img.setPosition(this.sx(d.x), this.sy(dz));
      return true;
    });
  }

  private syncHud(): void {
    const s = this.sim;
    const p = s.player;
    this.hud.setText(`👤 ${p.soldiers}   ⚡ ${p.fireRate}/s   💥 ${p.damage}   ☠ ${s.kills}`);
    this.progress.width = this.w * s.progress;
  }

  // --- Creazione oggetti ---

  private makeGate(left: GateOp, right: GateOp): Phaser.GameObjects.Container {
    const box = this.add.container(0, 0).setDepth(DEPTH.gate);
    const hgt = 1.3 * this.ppm;
    for (const [side, op] of [[-1, left], [1, right]] as const) {
      const cx = this.sx(side * 0.5);
      const color = isGoodGate(op) ? COLOR.good : COLOR.bad;
      const panel = this.add.rectangle(cx, -hgt / 2, this.laneHalf - 8, hgt, color, 0.5).setStrokeStyle(3, color, 1);
      box.add([panel, this.label(cx, -hgt / 2, formatGate(op), 30)]);
    }
    return box;
  }

  private makeWall(w: Wall): WallView {
    const box = this.add.container(0, 0).setDepth(DEPTH.wall);
    const width = w.width * this.laneHalf;
    const size = Math.min(1.6 * this.ppm, width);
    const count = Math.max(1, Math.round(width / size));
    const crate = width / count;
    const cx = this.sx(w.x);
    for (let i = 0; i < count; i++) {
      box.add(this.add.image(cx - width / 2 + crate * (i + 0.5), -crate / 2, 'tiles', FRAME.crate).setDisplaySize(crate, crate));
    }
    const hp = this.label(cx, -crate / 2 - 4, '', 24);
    const icon = w.reward.kind === 'soldiers' ? '👤' : w.reward.kind === 'fireRate' ? '⚡' : '💥';
    const reward = this.label(cx, -crate - 22, `+${w.reward.value} ${icon}`, 16);
    box.add(this.add.rectangle(cx - width / 2, -crate - 6, width, 5, 0x000000, 0.6).setOrigin(0, 0.5));
    const bar = this.add.rectangle(cx - width / 2, -crate - 6, width, 5, COLOR.good).setOrigin(0, 0.5);
    box.add([bar, hp, reward]);
    return { box, hp, bar, barWidth: width };
  }

  private addSplat(x: number, z: number, size: number): void {
    const img = this.add.image(0, 0, 'tiles', FRAME.splat)
      .setScale(0.45 * size).setAngle(Math.random() * 360).setAlpha(0.7).setDepth(DEPTH.decal);
    this.decals.push({ img, x, z });
    if (this.decals.length > MAX_DECALS) this.decals.shift()!.img.destroy();
  }

  private explodeWall(cx: number, y: number, width: number): void {
    for (let i = 0; i < 4; i++) this.sparks.explode(12, cx + (i / 3 - 0.5) * width, y - 20);
    this.cameras.main.shake(150, 0.006);
  }

  /** Traduce gli eventi del core in testi, suoni ed effetti. */
  private handleEvent(e: GameEvent): void {
    const pz = this.sim.player.z;
    switch (e.kind) {
      case 'text': return this.floatText(e.text, this.sx(e.x), this.sy(e.z - pz) - 20, e.tone === 'good');
      case 'shot': return this.sfx.play('shot');
      case 'wallHit':
        this.sparks.explode(2, this.sx(e.x), this.sy(e.z - pz) - 10);
        return this.sfx.play('woodHit');
      case 'wallDestroyed':
        this.sfx.play('crateBreak');
        this.sfx.play('boom');
        return this.sfx.play('reward');
      case 'zombieKilled':
        this.addSplat(e.x, e.z, e.bite > 1 ? 1.6 : 1);
        this.blood.explode(8 * e.bite, this.sx(e.x), this.sy(e.z - pz));
        return this.sfx.play('zombieDie');
      case 'hurt':
        this.blood.explode(Math.min(40, 6 * e.count), this.sx(e.x), this.sy(e.z - pz));
        this.cameras.main.shake(120, 0.005);
        return this.sfx.play('hurt');
      case 'gate': return this.sfx.play(e.good ? 'gateGood' : 'gateBad');
      case 'end': return this.sfx.play(e.won ? 'win' : 'lose');
    }
  }

  private floatText(s: string, x: number, y: number, good: boolean): void {
    const text = this.label(x, y, s, 28, good ? '#6fc0ff' : '#ff6b6b').setDepth(DEPTH.fx);
    this.tweens.add({ targets: text, y: y - 70, alpha: 0, scale: 1.3, duration: 900, onComplete: () => text.destroy() });
  }

  private updateMuteButton(): void {
    this.muteButton.setText(this.sfx.muted ? '🔇' : '🔊');
  }

  private showEnd(): void {
    this.endShown = true;
    const won = this.sim.status === 'won';
    const { w, h } = this;
    const layer = this.add.container(0, 0).setDepth(DEPTH.overlay).setAlpha(0);
    layer.add([
      this.add.rectangle(0, 0, w, h, 0x000000, 0.65).setOrigin(0),
      this.label(w / 2, h / 2 - 40, won ? 'VITTORIA!' : 'GAME OVER', 48, won ? '#6fc0ff' : '#ff6b6b'),
      this.label(w / 2, h / 2 + 10, `Soldati: ${this.sim.player.soldiers}  ·  Zombi eliminati: ${this.sim.kills}`, 18),
      this.label(w / 2, h / 2 + 55, 'Tocca per ricominciare', 18),
    ]);
    this.tweens.add({ targets: layer, alpha: 1, duration: 400 });
  }

  // --- Utility ---

  private label(x: number, y: number, text: string, size: number, color = '#ffffff'): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', fontSize: `${size}px`,
      color, stroke: '#000000', strokeThickness: 5,
      resolution: window.devicePixelRatio || 1,
    }).setOrigin(0.5);
  }

  /** Texture generate al volo per ciò che il pacchetto Kenney non ha (asfalto, proiettili, scintille). */
  private makeTextures(): void {
    if (this.textures.exists('road')) return;
    const g = this.add.graphics();
    g.fillStyle(COLOR.road).fillRect(0, 0, 256, 128);
    g.fillStyle(0xdddddd).fillRect(0, 0, 5, 128).fillRect(251, 0, 5, 128);
    g.fillStyle(0xdddddd).fillRect(126, 0, 4, 56);
    g.generateTexture('road', 256, 128);
    g.clear().fillStyle(COLOR.bullet).fillRoundedRect(0, 0, 4, 12, 2);
    g.generateTexture('bullet', 4, 12);
    g.clear().fillStyle(0xffffff).fillCircle(4, 4, 4);
    g.generateTexture('spark', 8, 8);
    g.destroy();
  }
}
