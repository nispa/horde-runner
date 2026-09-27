// Effetti sonori: varianti casuali, limite di frequenza per suono e muto persistente.
// Asset: pacchetti audio Kenney (CC0), in OGG con fallback MP3 per Safari/iOS.
import Phaser from 'phaser';
import { SOUNDS, type SoundDef, type SoundName } from '../../data/sounds';

export type { SoundName };

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
