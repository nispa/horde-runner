// Tabella degli effetti sonori, condivisa da tutti i renderer (Phaser, Three.js).
// File in public/assets/sfx/<nome>.ogg e .mp3 (pacchetti audio Kenney, CC0).

export interface SoundDef {
  files: string[];
  volume: number;
  /** Intervallo minimo tra due riproduzioni (ms): evita la cacofonia con tanti colpi. */
  throttle?: number;
  /** Variazione casuale di intonazione (±) per non sentire sempre lo stesso campione. */
  detune?: number;
}

export const SOUNDS = {
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
