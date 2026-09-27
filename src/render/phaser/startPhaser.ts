// Avvio con il renderer Phaser.
import Phaser from 'phaser';
import type { LevelDef } from '../../core/types';
import { GameScene } from './GameScene';

export function startPhaser(level: LevelDef, parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1b1f2a',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    scene: new GameScene(level),
  });
}
