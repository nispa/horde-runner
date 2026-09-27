// Punto d'ingresso: sceglie il renderer. Il core e i dati sono gli stessi per tutti.
//   /                  → Phaser (menu, sprite, effetti, suoni)
//   /?renderer=canvas  → Canvas 2D (prototipo, solo livello 1)
import { CAMPAIGN } from './data/campaign';

const app = document.getElementById('app')!;
const renderer = new URLSearchParams(location.search).get('renderer');

if (renderer === 'canvas') {
  import('./render/canvas/startCanvas').then(m => m.startCanvas(CAMPAIGN[0], app));
} else {
  import('./render/phaser/startPhaser').then(m => m.startPhaser(CAMPAIGN, app));
}
