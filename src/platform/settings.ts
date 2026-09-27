// Impostazioni scelte nel menu iniziale, salvate nel browser.
// Valgono per tutti i renderer; quelle 3D vengono ignorate dalla versione 2D.

export type RenderMode = '2d' | '3d';
export type CameraMode = 'iso' | 'chase';

export interface Settings {
  mode: RenderMode;
  /** Id dello shader pack (vedi render/three/catalog.ts). */
  shader: string;
  camera: CameraMode;
  /** Id del pacchetto modelli (vedi render/three/catalog.ts). */
  models: string;
}

const KEY = 'horde-runner:settings';

export const DEFAULT_SETTINGS: Settings = { mode: '3d', shader: 'none', camera: 'iso', models: 'mixed' };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch { /* storage non disponibile o dati corrotti */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignora */ }
}

/** Muto condiviso tra 2D e 3D (stessa chiave usata da Phaser). */
const MUTE_KEY = 'horde-runner:muted';

export function isMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function setMuted(muted: boolean): void {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignora */ }
}
