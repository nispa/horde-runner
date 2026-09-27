// Punto d'ingresso: menu iniziale (stile Minecraft) → versione 2D (Phaser) o 3D (Three.js).
// Il core e i dati sono gli stessi per tutte le versioni.
//   /                  → menu iniziale
//   /?mode=2d | 3d     → salta il menu (utile in sviluppo)
//   /?renderer=canvas  → prototipo Canvas 2D (solo livello 1)
import { CAMPAIGN } from './data/campaign';
import { showLauncher } from './launcher/launcher';
import { loadSettings, type RenderMode } from './platform/settings';

const app = document.getElementById('app')!;
const params = new URLSearchParams(location.search);

function start(mode: RenderMode): void {
  if (mode === '3d') import('./render/three/startThree').then(m => m.startThree(CAMPAIGN, app, loadSettings()));
  else import('./render/phaser/startPhaser').then(m => m.startPhaser(CAMPAIGN, app));
}

if (params.get('renderer') === 'canvas') {
  import('./render/canvas/startCanvas').then(m => m.startCanvas(CAMPAIGN[0], app));
} else if (params.get('mode') === '2d' || params.get('mode') === '3d') {
  start(params.get('mode') as RenderMode);
} else {
  showLauncher(app, mode => start(mode));
}
