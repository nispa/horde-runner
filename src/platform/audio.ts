// Lettore di effetti sonori con WebAudio, senza dipendere da un motore di gioco (usato dal 3D).
// Stesse regole della versione Phaser: varianti casuali, intonazione variabile, limite di frequenza.
import { SOUNDS, type SoundDef, type SoundName } from '../data/sounds';
import { isMuted, setMuted } from './settings';

export class AudioPlayer {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private lastPlayed = new Map<SoundName, number>();
  private ext = new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
  muted = isMuted();

  constructor(private baseUrl = 'assets/sfx/') {
    // I browser attivano l'audio solo dopo un gesto dell'utente.
    const unlock = () => { void this.context().resume(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  private context(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  /** Scarica e decodifica tutti i suoni (in parallelo). Gli errori non bloccano il gioco. */
  async preload(): Promise<void> {
    const files = new Set(Object.values(SOUNDS).flatMap(s => s.files));
    await Promise.all([...files].map(async f => {
      try {
        const res = await fetch(`${this.baseUrl}${f}.${this.ext}`);
        this.buffers.set(f, await this.context().decodeAudioData(await res.arrayBuffer()));
      } catch { /* suono mancante: si gioca senza */ }
    }));
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    setMuted(this.muted);
    return this.muted;
  }

  play(name: SoundName): void {
    if (this.muted || !this.ctx) return;
    const def: SoundDef = SOUNDS[name];
    const now = performance.now();
    if (def.throttle && now - (this.lastPlayed.get(name) ?? -Infinity) < def.throttle) return;
    this.lastPlayed.set(name, now);
    const buffer = this.buffers.get(def.files[Math.floor(Math.random() * def.files.length)]);
    if (!buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    if (def.detune) src.detune.value = (Math.random() * 2 - 1) * def.detune;
    const gain = this.ctx.createGain();
    gain.gain.value = def.volume;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
  }
}
