// Piccoli componenti di interfaccia condivisi tra le scene Phaser.
import Phaser from 'phaser';

export function label(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color = '#ffffff'): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', fontSize: `${size}px`,
    color, stroke: '#000000', strokeThickness: 5,
    resolution: window.devicePixelRatio || 1,
  }).setOrigin(0.5);
}

export interface ButtonOptions {
  width?: number;
  height?: number;
  color?: number;
  disabled?: boolean;
}

/** Pulsante rettangolare con testo, effetto pressione e callback al rilascio. */
export function button(
  scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, opts: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const { width = 260, height = 56, color = 0x2f9cff, disabled = false } = opts;
  const bg = scene.add.rectangle(0, 0, width, height, disabled ? 0x555a66 : color, disabled ? 0.6 : 0.9)
    .setStrokeStyle(3, 0x000000, 0.35);
  const txt = label(scene, 0, 0, text, 22, disabled ? '#aaaaaa' : '#ffffff');
  const box = scene.add.container(x, y, [bg, txt]).setSize(width, height);
  if (!disabled) {
    box.setInteractive({ useHandCursor: true });
    box.on('pointerdown', () => box.setScale(0.95));
    box.on('pointerout', () => box.setScale(1));
    box.on('pointerup', () => { box.setScale(1); onClick(); });
  }
  return box;
}
