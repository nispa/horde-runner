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

export const ARCADE_FONT = 'Press Start 2P';

/** Testo in stile sala giochi (font pixel). */
export function arcade(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color = '#ffffff'): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: `"${ARCADE_FONT}", monospace`, fontSize: `${Math.round(size)}px`,
    color, stroke: '#000000', strokeThickness: Math.max(3, size / 4),
    resolution: window.devicePixelRatio || 1,
  }).setOrigin(0.5);
}

/** Colori dei posti in classifica, come nei vecchi cabinati. */
const RANK_COLORS = ['#ffd84a', '#d0d8e0', '#e0a060', '#6fc0ff'];

/** Disegna una tabella HIGH SCORES in un container; restituisce la riga evidenziata (se c'è). */
export function scoreTable(
  scene: Phaser.Scene, parent: Phaser.GameObjects.Container, entries: { initials: string; score: number }[],
  cx: number, top: number, rowH: number, highlight = -1,
): Phaser.GameObjects.Text | null {
  const size = Math.min(16, rowH * 0.6);
  let hl: Phaser.GameObjects.Text | null = null;
  entries.forEach((e, i) => {
    const color = i === highlight ? '#ff5a5a' : RANK_COLORS[Math.min(i, RANK_COLORS.length - 1)];
    const pos = `${String(i + 1).padStart(2, ' ')}.`;
    const row = arcade(scene, cx, top + i * rowH, `${pos} ${e.initials}  ${String(e.score).padStart(7, ' ')}`, size, color);
    parent.add(row);
    if (i === highlight) hl = row;
  });
  return hl;
}

/** Lampeggio "arcade" di un testo (per la riga del nuovo record). */
export function blink(scene: Phaser.Scene, target: Phaser.GameObjects.Text): void {
  scene.tweens.add({ targets: target, alpha: 0.15, duration: 280, yoyo: true, repeat: -1 });
}
