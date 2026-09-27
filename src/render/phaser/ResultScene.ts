// Fine partita in stile cabinato: conteggio dei punti → iniziali (se si entra in classifica) → HIGH SCORES.
// Si apre sopra GameScene, che resta visibile sotto (ferma).
import Phaser from 'phaser';
import type { ScoreLine } from '../../core/rules';
import type { LevelDef } from '../../core/types';
import { highscores, lastInitials, qualifyingRank, rememberInitials, TABLE_SIZE } from '../../platform/highscores';
import { Sfx } from './Sfx';
import { arcade, blink, button, scoreTable } from './ui';

export interface ResultData {
  index: number;
  won: boolean;
  lines: ScoreLine[];
  total: number;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export class ResultScene extends Phaser.Scene {
  private data_!: ResultData;
  private page!: Phaser.GameObjects.Container;
  private sfx!: Sfx;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(private levels: LevelDef[]) {
    super('result');
  }

  init(data: ResultData): void {
    this.data_ = data;
  }

  create(): void {
    this.sfx = new Sfx(this);
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.75).setOrigin(0).setName('shade');
    this.page = this.add.container(0, 0);
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      this.setKeys(null);
    });
    this.showTally();
  }

  private onResize(): void {
    (this.children.getByName('shade') as Phaser.GameObjects.Rectangle).setSize(this.scale.width, this.scale.height);
  }

  private get w(): number { return this.scale.width; }
  private get h(): number { return this.scale.height; }
  private get fs(): number { return Math.min(18, this.w / 26); }

  private newPage(): void {
    this.page.removeAll(true);
    this.tweens.killAll();
    this.setKeys(null);
  }

  /** Un solo gestore di tastiera per pagina. */
  private setKeys(handler: ((e: KeyboardEvent) => void) | null): void {
    if (this.keyHandler) this.input.keyboard?.off('keydown', this.keyHandler);
    this.keyHandler = handler;
    if (handler) this.input.keyboard?.on('keydown', handler);
  }

  // --- Pagina 1: conteggio dei punti ---

  private showTally(): void {
    this.newPage();
    const { won, lines, total } = this.data_;
    const { w, h, fs } = this;
    const title = won ? (this.data_.index === this.levels.length - 1 ? 'CAMPAGNA COMPLETATA!' : 'VITTORIA!') : 'GAME OVER';
    this.page.add(arcade(this, w / 2, h * 0.14, title, Math.min(32, w / 16), won ? '#6fc0ff' : '#ff6b6b'));

    const top = h * 0.26;
    const rowH = fs * 2.2;
    const left = w / 2 - Math.min(260, w * 0.42);
    const right = w / 2 + Math.min(260, w * 0.42);
    let delay = 300;
    const counters: { text: Phaser.GameObjects.Text; value: number }[] = [];
    lines.forEach((l, i) => {
      const y = top + i * rowH;
      const name = arcade(this, left, y, `${l.label} x${l.count}`, fs * 0.8).setOrigin(0, 0.5).setAlpha(0);
      const pts = arcade(this, right, y, '0', fs * 0.8, '#ffd84a').setOrigin(1, 0.5).setAlpha(0);
      this.page.add([name, pts]);
      counters.push({ text: pts, value: l.points });
      this.tweens.add({ targets: [name, pts], alpha: 1, delay, duration: 150 });
      this.countUp(pts, l.points, delay, 450);
      this.time.delayedCall(delay, () => this.sfx.play('woodHit'));
      delay += 450;
    });

    const totalY = top + lines.length * rowH + rowH * 0.8;
    const totalText = arcade(this, w / 2, totalY, 'SCORE 0', fs * 1.4, '#ffffff').setAlpha(0);
    this.page.add(totalText);
    this.tweens.add({ targets: totalText, alpha: 1, delay, duration: 150 });
    this.countUp(totalText, total, delay, 700, 'SCORE ');
    this.time.delayedCall(delay + 700, () => this.sfx.play('reward'));

    const next = () => this.afterTally();
    // Dopo il conteggio si prosegue con un tocco o Invio; toccare prima salta l'animazione.
    const btn = button(this, w / 2, Math.min(h - 50, totalY + rowH * 2.6), 'Continua ▶', next).setAlpha(0);
    this.page.add(btn);
    this.tweens.add({ targets: btn, alpha: 1, delay: delay + 700, duration: 200 });
    this.setKeys(e => { if (e.key === 'Enter' || e.key === ' ') next(); });
  }

  private countUp(text: Phaser.GameObjects.Text, value: number, delay: number, duration: number, prefix = ''): void {
    const counter = { v: 0 };
    this.tweens.add({
      targets: counter, v: value, delay, duration,
      onUpdate: () => text.setText(`${prefix}${Math.round(counter.v)}`),
      onComplete: () => text.setText(`${prefix}${value}`),
    });
  }

  private async afterTally(): Promise<void> {
    const table = await highscores.list(this.data_.index);
    const rank = qualifyingRank(table, this.data_.total);
    if (rank >= 0) this.showInitials(rank);
    else this.showTable(-1);
  }

  // --- Pagina 2: inserimento delle iniziali ---

  private showInitials(rank: number): void {
    this.newPage();
    const { w, h, fs } = this;
    const letters = lastInitials().padEnd(3, 'A').slice(0, 3).split('');
    let slot = 0;

    this.page.add(arcade(this, w / 2, h * 0.14, 'NUOVO RECORD!', Math.min(28, w / 16), '#ffd84a'));
    this.page.add(arcade(this, w / 2, h * 0.14 + fs * 2.4, `${rank + 1}° POSTO - ${this.data_.total} PUNTI`, fs * 0.8));
    this.page.add(arcade(this, w / 2, h * 0.14 + fs * 4.4, 'INSERISCI LE TUE INIZIALI', fs * 0.7, '#aaaaaa'));

    const size = Math.min(56, w / 9);
    const gap = size * 1.6;
    const cy = h * 0.46;
    const views: Phaser.GameObjects.Text[] = [];
    const cursors: Phaser.GameObjects.Rectangle[] = [];
    const refresh = () => views.forEach((v, i) => {
      v.setText(letters[i]).setColor(i === slot ? '#ffd84a' : '#ffffff');
      cursors[i].setVisible(i === slot);
    });
    const change = (i: number, d: number) => {
      slot = i;
      const k = LETTERS.indexOf(letters[i]);
      letters[i] = LETTERS[(k + d + LETTERS.length) % LETTERS.length];
      this.sfx.play('woodHit');
      refresh();
    };

    for (let i = 0; i < 3; i++) {
      const x = w / 2 + (i - 1) * gap;
      const up = button(this, x, cy - size * 1.2, '▲', () => change(i, 1), { width: size, height: size * 0.7, color: 0x555a66 });
      const down = button(this, x, cy + size * 1.2, '▼', () => change(i, -1), { width: size, height: size * 0.7, color: 0x555a66 });
      const letter = arcade(this, x, cy, letters[i], size).setInteractive({ useHandCursor: true });
      letter.on('pointerdown', () => { slot = i; refresh(); });
      const cursor = this.add.rectangle(x, cy + size * 0.65, size * 0.9, 5, 0xffd84a);
      this.tweens.add({ targets: cursor, alpha: 0.2, duration: 300, yoyo: true, repeat: -1 });
      views.push(letter);
      cursors.push(cursor);
      this.page.add([up, down, letter, cursor]);
    }
    refresh();

    const confirm = async () => {
      this.setKeys(null);
      const initials = letters.join('');
      rememberInitials(initials);
      const saved = await highscores.add(this.data_.index, { initials, score: this.data_.total, date: new Date().toISOString() });
      this.sfx.play('gateGood');
      this.showTable(saved);
    };
    this.page.add(button(this, w / 2, Math.min(h - 50, cy + size * 2.6), 'OK', confirm));

    // Tastiera: lettere/numeri scrivono, frecce su/giù cambiano, sinistra/destra spostano, Invio conferma.
    this.setKeys(e => {
      const k = e.key.toUpperCase();
      if (k.length === 1 && LETTERS.includes(k)) {
        letters[slot] = k;
        slot = Math.min(2, slot + 1);
        this.sfx.play('woodHit');
      } else if (e.key === 'ArrowUp') change(slot, 1);
      else if (e.key === 'ArrowDown') change(slot, -1);
      else if (e.key === 'ArrowLeft' || e.key === 'Backspace') slot = Math.max(0, slot - 1);
      else if (e.key === 'ArrowRight') slot = Math.min(2, slot + 1);
      else if (e.key === 'Enter') { void confirm(); return; }
      refresh();
    });
  }

  // --- Pagina 3: classifica e prossime azioni ---

  private async showTable(highlight: number): Promise<void> {
    this.newPage();
    const { w, h, fs } = this;
    const { index, won } = this.data_;
    const table = await highscores.list(index);

    this.page.add(arcade(this, w / 2, h * 0.08, 'HIGH SCORES', Math.min(28, w / 16), '#ff5a5a'));
    this.page.add(arcade(this, w / 2, h * 0.08 + fs * 2, this.levels[index].name.toUpperCase(), fs * 0.6, '#aaaaaa'));
    const rowH = Math.min(fs * 1.9, (h * 0.55) / TABLE_SIZE);
    const top = h * 0.08 + fs * 4;
    const row = scoreTable(this, this.page, table, w / 2, top, rowH, highlight);
    if (row) blink(this, row);

    const next = won && index + 1 < this.levels.length ? index + 1 : null;
    const primary = next !== null
      ? { text: 'Prossimo livello ▶', go: () => this.scene.start('game', { index: next }) }
      : won ? { text: 'Menu', go: () => this.toMenu() }
      : { text: 'Riprova', go: () => this.scene.start('game', { index }) };
    const by = Math.min(h - 100, top + TABLE_SIZE * rowH + 30);
    this.page.add(button(this, w / 2, by, primary.text, primary.go));
    if (primary.text !== 'Menu') this.page.add(button(this, w / 2, by + 66, 'Menu', () => this.toMenu(), { color: 0x555a66 }));
    // Piccolo ritardo prima che Invio/Spazio funzionino: evita di saltare la schermata per sbaglio.
    this.time.delayedCall(400, () => this.setKeys(e => { if (e.key === 'Enter' || e.key === ' ') primary.go(); }));
  }

  private toMenu(): void {
    this.scene.stop('game');
    this.scene.start('menu');
  }
}
