// Menu iniziale: carica gli asset e mostra i livelli della campagna (bloccati/sbloccati).
import Phaser from 'phaser';
import type { LevelDef } from '../../core/types';
import { loadProgress } from '../../platform/progress';
import { Sfx } from './Sfx';
import { arcade, button, label } from './ui';

export class MenuScene extends Phaser.Scene {
  constructor(private levels: LevelDef[]) {
    super('menu');
  }

  preload(): void {
    // Asset condivisi da tutte le scene: caricati una volta sola.
    this.load.spritesheet('tiles', 'assets/kenney/tiles.png', { frameWidth: 64, frameHeight: 64 });
    this.load.image('soldier', 'assets/kenney/soldier.png');
    this.load.image('zombie', 'assets/kenney/zombie.png');
    Sfx.preload(this);
  }

  create(): void {
    this.draw();
    this.scale.on('resize', this.draw, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.draw, this));
  }

  private draw(): void {
    this.children.removeAll(true);
    const { width: w, height: h } = this.scale;
    const progress = loadProgress();

    this.add.tileSprite(0, 0, w, h, 'tiles', 0).setOrigin(0).setAlpha(0.35);
    const top = Math.max(60, h * 0.12);
    arcade(this, w / 2, top, 'HORDE RUNNER', Math.min(36, w / 13), '#6fc0ff');
    label(this, w / 2, top + 44, 'Scegli il livello', 18);

    const gap = 12;
    const bh = 56;
    const startY = top + 100;
    this.levels.forEach((level, i) => {
      const locked = i > progress.unlocked;
      const best = progress.best[i];
      const title = locked ? `🔒  ${level.name}` : level.name;
      const y = startY + i * (bh + gap);
      button(this, w / 2, y, title, () => this.scene.start('game', { index: i }), {
        width: Math.min(420, w - 32), height: bh, disabled: locked,
        color: best !== undefined ? 0x2a8a4a : 0x2f9cff,
      });
      if (best !== undefined) label(this, w / 2 + Math.min(210, w / 2 - 16) - 44, y, `🏆${best}`, 14).setOrigin(0.5);
    });

    const lastY = startY + (this.levels.length - 1) * (bh + gap);
    button(this, w / 2, lastY + bh + gap * 2, '🏆 Classifiche', () => this.scene.start('highscores', { index: 0 }), {
      width: Math.min(420, w - 32), height: bh, color: 0x8a5a1a,
    });
    label(this, w / 2, h - 24, 'Grafica e suoni: Kenney.nl (CC0) · Font: Press Start 2P (OFL)', 12, '#bbbbbb');
  }
}
