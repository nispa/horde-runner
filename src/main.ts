// Punto d'ingresso: sceglie il renderer. Il core e i dati sono gli stessi per tutti.
//   /                  → Phaser (sprite, effetti)
//   /?renderer=canvas  → Canvas 2D (prototipo)
import type { LevelDef } from './core/types';
import level1 from './data/level1.json';

const level = level1 as LevelDef;
const app = document.getElementById('app')!;
const renderer = new URLSearchParams(location.search).get('renderer');

if (renderer === 'canvas') {
  import('./render/canvas/startCanvas').then(m => m.startCanvas(level, app));
} else {
  import('./render/phaser/startPhaser').then(m => m.startPhaser(level, app));
}
