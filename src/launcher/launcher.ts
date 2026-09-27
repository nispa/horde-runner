// Menu iniziale in HTML/CSS, indipendente dai motori grafici: sceglie 2D (Phaser) o 3D (Three.js)
// e gestisce le opzioni (shader pack, telecamera, pacchetto modelli, audio).
import { CAMERAS, MODEL_PACKS, SHADER_PACKS, type CatalogEntry } from '../render/three/catalog';
import { isMuted, loadSettings, saveSettings, setMuted, type RenderMode, type Settings } from '../platform/settings';
import './launcher.css';

const SPLASHES = [
  'Ora in 3D!', 'Zombi inclusi!', 'Anche in 2D!', '100% blocchi!', 'Scegli il gate giusto!',
  'Occhio alle rocce!', 'Shader pluggabili!', 'Come nel 1943!', 'Niente creeper!',
];

export function showLauncher(root: HTMLElement, onPlay: (mode: RenderMode, settings: Settings) => void): void {
  const settings = loadSettings();
  const el = document.createElement('div');
  el.className = 'launcher';
  root.appendChild(el);

  const play = (mode: RenderMode) => {
    settings.mode = mode;
    saveSettings(settings);
    el.remove();
    onPlay(mode, settings);
  };

  const title = () => {
    const splash = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
    el.innerHTML = `
      <h1 class="launcher-title">HORDE RUNNER<span class="launcher-splash">${splash}</span></h1>
      <div class="launcher-buttons">
        <button class="mc-button primary" data-act="3d">Gioca in 3D</button>
        <button class="mc-button primary" data-act="2d">Gioca in 2D</button>
        <button class="mc-button" data-act="options">Opzioni...</button>
      </div>
      <p class="launcher-hint">Ultima modalità: ${settings.mode.toUpperCase()}</p>
      <div class="launcher-footer"><span>Horde Runner</span><span>Kenney.nl (CC0) · Press Start 2P (OFL)</span></div>`;
    on('3d', () => play('3d'));
    on('2d', () => play('2d'));
    on('options', options);
    focusFirst();
  };

  /** Opzioni come in Minecraft: ogni pulsante scorre i valori possibili. */
  const options = () => {
    const cycle = (list: CatalogEntry[], current: string) => list[(list.findIndex(e => e.id === current) + 1) % list.length].id;
    const name = (list: CatalogEntry[], id: string) => list.find(e => e.id === id)?.name ?? id;
    const desc = (list: CatalogEntry[], id: string) => list.find(e => e.id === id)?.description ?? '';

    const draw = (hint = '') => {
      el.innerHTML = `
        <p class="launcher-subtitle">Opzioni</p>
        <div class="launcher-buttons">
          <button class="mc-button" data-act="shader">Shader: ${name(SHADER_PACKS, settings.shader)}</button>
          <button class="mc-button" data-act="camera">Telecamera: ${name(CAMERAS, settings.camera)}</button>
          <button class="mc-button" data-act="models">Modelli: ${name(MODEL_PACKS, settings.models)}</button>
          <button class="mc-button" data-act="audio">Audio: ${isMuted() ? 'OFF' : 'ON'}</button>
          <button class="mc-button primary" data-act="done">Fatto</button>
        </div>
        <p class="launcher-hint">${hint || 'Shader, telecamera e modelli valgono per la versione 3D.'}</p>`;
      on('shader', () => { settings.shader = cycle(SHADER_PACKS, settings.shader); saveSettings(settings); draw(desc(SHADER_PACKS, settings.shader)); focus('shader'); });
      on('camera', () => { settings.camera = cycle(CAMERAS, settings.camera) as Settings['camera']; saveSettings(settings); draw(desc(CAMERAS, settings.camera)); focus('camera'); });
      on('models', () => { settings.models = cycle(MODEL_PACKS, settings.models); saveSettings(settings); draw(desc(MODEL_PACKS, settings.models)); focus('models'); });
      on('audio', () => { setMuted(!isMuted()); draw(); focus('audio'); });
      on('done', title);
    };
    draw();
    focusFirst();
  };

  const on = (act: string, fn: () => void) => el.querySelector(`[data-act="${act}"]`)?.addEventListener('click', fn);
  const focus = (act: string) => (el.querySelector(`[data-act="${act}"]`) as HTMLElement | null)?.focus();
  const focusFirst = () => (el.querySelector('button') as HTMLElement | null)?.focus();

  // Navigazione da tastiera: frecce su/giù tra i pulsanti, Invio per premere (nativo dei <button>).
  el.addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const buttons = [...el.querySelectorAll('button')];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    e.preventDefault();
  });

  title();
}
