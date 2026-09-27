// Effetti sonori: varianti casuali, limite di frequenza per suono e muto persistente.
// Asset: pacchetti audio Kenney (CC0), in OGG con fallback MP3 per Safari/iOS.
import Phaser from 'phaser';

interface SoundDef {
  files: string[];
  volume: number;
  /** Intervallo minimo tra due riproduzioni (ms): evita la cacofonia con tanti colpi. */
  throttle?: number;
  /** Variazione casuale di intonazione (±) per non sentire sempre lo stesso campione. */
  detune?: number;
}

const SOUNDS = {
  shot: { files: ['shot1', 'shot2', 'shot3'], volume: 0.12, throttle: 90, detune: 150 },
  woodHit: { files: ['woodHit1', 'woodHit2', 'woodHit3'], volume: 0.35, throttle: 70, detune: 200 },
  crateBreak: { files: ['crateBreak'], volume: 0.8 },
  boom: { files: ['boom'], volume: 0.5 },
  zombieDie: { files: ['zombieDie1', 'zombieDie2'], volume: 0.35, throttle: 60, detune: 250 },
  hurt: { files: ['hurt'], volume: 0.6, throttle: 120, detune: 100 },
  gateGood: { files: ['gateGood'], volume: 0.6 },
  gateBad: { files: ['gateBad'], volume: 0.6 },
  reward: { files: ['reward'], volume: 0.6 },
  shotgun: { files: ['shotgun'], volume: 0.3, throttle: 120, detune: 150 },
  rocketLaunch: { files: ['rocketLaunch'], volume: 0.3, throttle: 150, detune: 200 },
  explosion: { files: ['explosion'], volume: 0.55, throttle: 80, detune: 200 },
  pickup: { files: ['pickup'], volume: 0.7 },
  bossHit: { files: ['bossHit'], volume: 0.3, throttle: 100, detune: 200 },
  bossRoar: { files: ['bossRoar'], volume: 0.9 },
  whoosh: { files: ['whoosh'], volume: 0.4, throttle: 150, detune: 300 },
  thud: { files: ['thud'], volume: 0.5, throttle: 100, detune: 200 },
  win: { files: ['win'], volume: 0.7 },
  lose: { files: ['lose'], volume: 0.7 },
} satisfies Record<string, SoundDef>;

export type SoundName = keyof typeof SOUNDS;

const MUTE_KEY = 'horde-runner:muted';

export class Sfx {
  private lastPlayed = new Map<SoundName, number>();

  static preload(scene: Phaser.Scene): void {
    const files = new Set(Object.values(SOUNDS).flatMap(s => s.files));
    for (const f of files) scene.load.audio(f, [`assets/sfx/${f}.ogg`, `assets/sfx/${f}.mp3`]);
  }

  constructor(private scene: Phaser.Scene) {
    scene.sound.mute = readMuted();
  }

  get muted(): boolean {
    return this.scene.sound.mute;
  }

  toggleMute(): boolean {
    const muted = !this.scene.sound.mute;
    this.scene.sound.mute = muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage non disponibile */ }
    return muted;
  }

  play(name: SoundName): void {
    const def: SoundDef = SOUNDS[name];
    const now = this.scene.time.now;
    if (def.throttle && now - (this.lastPlayed.get(name) ?? -Infinity) < def.throttle) return;
    this.lastPlayed.set(name, now);
    const file = def.files[Math.floor(Math.random() * def.files.length)];
    const detune = def.detune ? (Math.random() * 2 - 1) * def.detune : 0;
    this.scene.sound.play(file, { volume: def.volume, detune });
  }
}

function readMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}
