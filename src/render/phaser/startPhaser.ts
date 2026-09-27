// Avvio con il renderer Phaser: menu dei livelli → partita.
import Phaser from 'phaser';
import type { LevelDef } from '../../core/types';
import { GameScene } from './GameScene';
import { HighScoresScene } from './HighScoresScene';
import { MenuScene } from './MenuScene';
import { ResultScene } from './ResultScene';
import { ARCADE_FONT } from './ui';

export async function startPhaser(levels: LevelDef[], parent: HTMLElement): Promise<Phaser.Game> {
  // Il font arcade deve essere pronto prima che Phaser disegni i testi.
  try { await document.fonts.load(`16px "${ARCADE_FONT}"`); } catch { /* si usa il font di sistema */ }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1b1f2a',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    scene: [new MenuScene(levels), new GameScene(levels), new ResultScene(levels), new HighScoresScene(levels)],
  });
  // Solo in sviluppo: accesso da console per il debug (window.__game).
  if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
  return game;
}
