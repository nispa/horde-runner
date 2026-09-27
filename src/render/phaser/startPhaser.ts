// Avvio con il renderer Phaser: menu dei livelli → partita.
import Phaser from 'phaser';
import type { LevelDef } from '../../core/types';
import { GameScene } from './GameScene';
import { MenuScene } from './MenuScene';

export function startPhaser(levels: LevelDef[], parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1b1f2a',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    scene: [new MenuScene(levels), new GameScene(levels)],
  });
}
