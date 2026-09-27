// Versione 3D (Three.js): menu dei livelli, partita, risultati. Il core e i dati sono gli stessi del 2D.
// Modelli (models/), telecamera (cameras.ts) e shader pack (shaders/) sono intercambiabili dalle Opzioni.
import * as THREE from 'three';
import { Game } from '../../core/game';
import { computeScore } from '../../core/rules';
import type { GameEvent, LevelDef } from '../../core/types';
import { AudioPlayer } from '../../platform/audio';
import { bindInput } from '../../platform/input';
import { completeLevel } from '../../platform/progress';
import { saveSettings, type Settings } from '../../platform/settings';
import { Hud } from '../../ui-dom/hud';
import { showLevelMenu, showResults, showScores } from '../../ui-dom/screens';
import { createCameraRig, type CameraRig } from './cameras';
import { createModelPack } from './models';
import { ROAD_HALF, type ModelPack } from './models/types';
import { getShaderPack } from './shaders';
import type { ShaderPipeline } from './shaders/types';
import { World3D, wx, wz } from './World3D';

const FIXED_DT = 1 / 60;
/** Altezza della barra HUD: i tocchi lì sopra non spostano la squadra. */
const HUD_HEIGHT = 60;

export async function startThree(levels: LevelDef[], root: HTMLElement, settings: Settings): Promise<void> {
  const app = new App3D(levels, root, settings);
  await app.init();
  app.levelMenu();
}

/** Singola partita in corso: mondo, telecamera, post-produzione, HUD, input. */
interface Match {
  index: number;
  game: Game;
  world: World3D;
  rig: CameraRig;
  pipeline: ShaderPipeline;
  hud: Hud;
  unbind: () => void;
  acc: number;
  ended: boolean;
  shake: number;
}

class App3D {
  private renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  private audio = new AudioPlayer();
  private pack!: ModelPack;
  private match: Match | null = null;
  private last = performance.now();
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(private levels: LevelDef[], private root: HTMLElement, private settings: Settings) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    root.appendChild(this.renderer.domElement);
    window.addEventListener('resize', () => this.resize());
    // Solo in sviluppo: accesso da console per il debug (window.__app3d.match.game).
    if (import.meta.env.DEV) (window as unknown as { __app3d: App3D }).__app3d = this;
  }

  async init(): Promise<void> {
    this.pack = createModelPack(this.settings.models);
    await Promise.all([this.pack.load(), this.audio.preload()]);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  levelMenu(): void {
    showLevelMenu(this.root, this.levels, {
      play: i => this.startLevel(i),
      scores: () => void showScores(this.root, this.levels, () => this.levelMenu()),
      // Il menu principale è il launcher: si ricarica la pagina senza parametri (tutto pulito).
      back: () => { location.href = location.pathname; },
    });
  }

  private startLevel(index: number): void {
    this.endMatch();
    const level = this.levels[index];
    const game = new Game(level, Date.now());
    const world = new World3D(this.pack, level);
    const { innerWidth: w, innerHeight: h } = window;
    const rig = createCameraRig(this.settings.camera, w, h);
    const pipeline = getShaderPack(this.settings.shader).create({
      renderer: this.renderer, scene: world.scene, camera: rig.camera, width: w, height: h, sun: world.sun, ambient: world.ambient,
    });
    const hud = new Hud(this.root, level, this.audio.muted, () => this.audio.toggleMute());
    const unbind = bindInput(this.renderer.domElement, {
      onSteer: (x, y) => { if (y > HUD_HEIGHT) game.steerTo(this.screenToLane(x, y, rig)); },
      onNudge: d => game.steerTo(game.player.targetX + d * 0.04),
      onTap: () => {},
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') this.switchCamera();
      if (e.key === 'm' || e.key === 'M') this.audio.toggleMute();
      if (e.key === 'Escape' && this.match && !this.match.ended) { this.endMatch(); this.levelMenu(); }
    };
    window.addEventListener('keydown', onKey);
    this.match = {
      index, game, world, rig, pipeline, hud, acc: 0, ended: false, shake: 0,
      unbind: () => { unbind(); window.removeEventListener('keydown', onKey); },
    };
    rig.follow(wx(0), wz(0), 1);
    hud.banner(level.name);
  }

  private endMatch(): void {
    const m = this.match;
    if (!m) return;
    m.unbind();
    m.hud.destroy();
    m.pipeline.dispose();
    m.world.dispose();
    this.match = null;
  }

  /** Cambia telecamera durante la partita (tasto C) e ricorda la scelta. */
  private switchCamera(): void {
    const m = this.match;
    if (!m) return;
    this.settings.camera = this.settings.camera === 'iso' ? 'chase' : 'iso';
    saveSettings(this.settings);
    m.pipeline.dispose();
    m.rig = createCameraRig(this.settings.camera, window.innerWidth, window.innerHeight);
    m.pipeline = getShaderPack(this.settings.shader).create({
      renderer: this.renderer, scene: m.world.scene, camera: m.rig.camera,
      width: window.innerWidth, height: window.innerHeight, sun: m.world.sun, ambient: m.world.ambient,
    });
    m.rig.follow(wx(m.game.player.x), wz(m.game.player.z), 1);
  }

  /** Dal punto toccato sullo schermo alla posizione nella strada: si "proietta" il tocco sul terreno. */
  private screenToLane(clientX: number, clientY: number, rig: CameraRig): number {
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, rig.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, hit)) return this.match?.game.player.targetX ?? 0;
    return hit.x / ROAD_HALF;
  }

  private frame(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const m = this.match;
    if (!m) {
      this.renderer.clear();
      return;
    }
    const time = now / 1000;
    if (!m.ended) {
      m.acc += dt;
      while (m.acc >= FIXED_DT) {
        m.game.step(FIXED_DT);
        m.acc -= FIXED_DT;
      }
    }
    for (const e of m.game.drainEvents()) this.handleEvent(m, e);
    m.world.update(m.game, dt, time);
    m.rig.follow(wx(m.game.player.x), wz(m.game.player.z), dt);
    if (m.shake > 0) {
      // Scossa della telecamera che si smorza rapidamente.
      m.rig.camera.position.x += (Math.random() - 0.5) * m.shake;
      m.rig.camera.position.y += (Math.random() - 0.5) * m.shake;
      m.shake = Math.max(0, m.shake - dt * 2);
    }
    m.hud.update(m.game);
    m.pipeline.render(time);
    if (!m.ended && m.game.status !== 'playing') this.finish(m);
  }

  private finish(m: Match): void {
    m.ended = true;
    const won = m.game.status === 'won';
    const { lines, total } = computeScore(m.game.stats);
    if (won) completeLevel(m.index, total, this.levels.length);
    // Un attimo per vedere l'ultima esplosione prima della schermata.
    setTimeout(() => {
      if (this.match !== m) return;
      showResults(this.root, this.levels, m.index, won, lines, total, {
        next: () => this.startLevel(m.index + 1),
        retry: () => this.startLevel(m.index),
        menu: () => { this.endMatch(); this.levelMenu(); },
        sound: s => this.audio.play(s === 'tick' ? 'woodHit' : 'gateGood'),
      });
    }, 900);
  }

  /** Suoni, testi e scosse per gli eventi del core; gli effetti visivi li fa World3D. */
  private handleEvent(m: Match, e: GameEvent): void {
    m.world.handleEvent(e);
    const a = this.audio;
    switch (e.kind) {
      case 'text': {
        const p = this.toScreen(m, wx(e.x), 1.8, wz(e.z));
        if (p) m.hud.floatText(e.text, p.x, p.y, e.tone === 'good');
        return;
      }
      case 'shot': return a.play(e.weapon === 'shotgun' ? 'shotgun' : e.weapon === 'rocket' ? 'rocketLaunch' : 'shot');
      case 'wallHit': return a.play('woodHit');
      case 'wallDestroyed': a.play('crateBreak'); a.play('boom'); m.shake = Math.max(m.shake, 0.25); return a.play('reward');
      case 'zombieKilled': return a.play('zombieDie');
      case 'hurt': m.shake = Math.max(m.shake, 0.2); return a.play('hurt');
      case 'gate': return a.play(e.good ? 'gateGood' : 'gateBad');
      case 'end': return a.play(e.won ? 'win' : 'lose');
      case 'explosion': m.shake = Math.max(m.shake, 0.15); return a.play('explosion');
      case 'weaponPickup': return a.play('pickup');
      case 'bossSpawn': m.hud.banner(`⚠ ${e.name} ⚠`, true); m.shake = 0.6; return a.play('bossRoar');
      case 'bossHit': return a.play('bossHit');
      case 'bossKilled': m.shake = 1; a.play('explosion'); return a.play('crateBreak');
      case 'throw': return a.play('whoosh');
      case 'hazardLand': if (e.hit) m.shake = Math.max(m.shake, 0.25); return a.play('thud');
      case 'hazardKilled': return a.play(e.hazard === 'boulder' ? 'crateBreak' : 'zombieDie');
    }
  }

  private toScreen(m: Match, x: number, y: number, z: number): { x: number; y: number } | null {
    const v = new THREE.Vector3(x, y, z).project(m.rig.camera);
    if (v.z > 1) return null;
    return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight };
  }

  private resize(): void {
    const { innerWidth: w, innerHeight: h } = window;
    this.renderer.setSize(w, h);
    this.match?.rig.resize(w, h);
    this.match?.pipeline.setSize(w, h);
  }
}
