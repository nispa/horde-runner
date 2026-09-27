// Consultazione delle classifiche dal menu: una tabella per livello, sfogliabile con ◀ ▶.
import Phaser from 'phaser';
import type { LevelDef } from '../../core/types';
import { highscores, TABLE_SIZE } from '../../platform/highscores';
import { arcade, button, scoreTable } from './ui';

export class HighScoresScene extends Phaser.Scene {
  private index = 0;
  private page!: Phaser.GameObjects.Container;

  constructor(private levels: LevelDef[]) {
    super('highscores');
  }

  init(data: { index?: number }): void {
    this.index = data.index ?? 0;
  }

  create(): void {
    this.page = this.add.container(0, 0);
    void this.draw();
    this.scale.on('resize', this.draw, this);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') this.go(-1);
      else if (e.key === 'ArrowRight') this.go(1);
      else if (e.key === 'Escape' || e.key === 'Enter') this.scene.start('menu');
    };
    this.input.keyboard?.on('keydown', onKey);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.draw, this);
      this.input.keyboard?.off('keydown', onKey);
    });
  }

  private go(d: number): void {
    this.index = (this.index + d + this.levels.length) % this.levels.length;
    void this.draw();
  }

  private async draw(): Promise<void> {
    const table = await highscores.list(this.index);
    this.page.removeAll(true);
    const { width: w, height: h } = this.scale;
    const fs = Math.min(18, w / 26);

    this.page.add(this.add.tileSprite(0, 0, w, h, 'tiles', 0).setOrigin(0).setAlpha(0.2));
    this.page.add(arcade(this, w / 2, h * 0.08, 'HIGH SCORES', Math.min(28, w / 16), '#ff5a5a'));

    const navY = h * 0.08 + fs * 2.6;
    this.page.add(arcade(this, w / 2, navY, this.levels[this.index].name.toUpperCase(), fs * 0.6, '#ffffff'));
    const arrow = Math.min(48, w / 9);
    this.page.add(button(this, w / 2 - Math.min(230, w * 0.42), navY, '◀', () => this.go(-1), { width: arrow, height: arrow, color: 0x555a66 }));
    this.page.add(button(this, w / 2 + Math.min(230, w * 0.42), navY, '▶', () => this.go(1), { width: arrow, height: arrow, color: 0x555a66 }));

    const rowH = Math.min(fs * 1.9, (h * 0.55) / TABLE_SIZE);
    const top = navY + fs * 2.4;
    scoreTable(this, this.page, table, w / 2, top, rowH);
    this.page.add(button(this, w / 2, Math.min(h - 40, top + TABLE_SIZE * rowH + 30), 'Indietro', () => this.scene.start('menu'), { color: 0x555a66 }));
  }
}
