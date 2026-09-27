// Renderer Canvas 2D: legge lo stato del Game e lo disegna. È l'unico file da sostituire
// per passare a Phaser, Three.js o altro.
import type { Game } from '../../core/game';
import { formatGate, formationRadius, isGoodGate } from '../../core/rules';
import { WEAPONS } from '../../core/weapons';
import type { GameEvent, TextEvent } from '../../core/types';

const VIEW_AHEAD = 32; // metri visibili davanti al giocatore
const PLAYER_Y = 0.82; // posizione verticale del giocatore (frazione dell'altezza)
const MAX_DRAWN_SOLDIERS = 80;

const COLORS = {
  bg: '#1b1f2a',
  road: '#3a3f4b',
  roadLine: '#5a6070',
  soldier: '#4da3ff',
  zombie: '#6cc24a',
  zombieDark: '#3f7a2a',
  bullet: '#ffd84a',
  wall: '#8a8f99',
  good: '#2f9cff',
  bad: '#ff4d4d',
  text: '#ffffff',
};

interface FloatingText extends TextEvent { age: number }

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private laneHalf = 0;
  private floating: FloatingText[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Converte una coordinata X dello schermo in posizione nella lane (-1..1). */
  screenToLaneX(clientX: number): number {
    return (clientX - this.w / 2) / this.laneHalf;
  }

  reset(): void {
    this.floating = [];
  }

  render(game: Game, events: GameEvent[], dt: number): void {
    const { ctx } = this;
    for (const e of events) if (e.kind === 'text') this.floating.push({ ...e, age: 0 });

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.w, this.h);
    this.drawRoad(game);

    const pz = game.player.z;
    const visible = (z: number) => z > pz - 3 && z < pz + VIEW_AHEAD + 2;

    for (const g of game.gates) if (!g.passed && visible(g.z)) this.drawGate(pz, g.z, g.left, g.right);
    for (const wl of game.walls) if (!wl.destroyed && visible(wl.z)) this.drawWall(pz, wl);
    this.drawFinish(game);

    ctx.fillStyle = COLORS.bullet;
    for (const b of game.bullets) {
      const [x, y] = this.project(b.x, b.z - pz);
      ctx.fillRect(x - 1.5, y - 5, 3, 10);
    }

    for (const k of game.pickups) {
      if (k.taken || !visible(k.z)) continue;
      const [x, y] = this.project(k.x, k.z - pz);
      this.text(`${WEAPONS[k.weapon].icon} ${WEAPONS[k.weapon].name}`, x, y, 16);
    }
    for (const z of game.zombies) if (visible(z.z)) this.drawZombie(pz, z.x, z.z, z.hp / z.maxHp);
    const boss = game.boss;
    if (boss && !boss.dead && visible(boss.z)) {
      const [x, y] = this.project(boss.x, boss.z - pz);
      ctx.fillStyle = '#d04848';
      ctx.beginPath();
      ctx.arc(x, y, 28, 0, Math.PI * 2);
      ctx.fill();
      this.text(`${boss.name} ${Math.ceil(boss.hp)}`, x, y - 40, 16);
    }
    this.drawSquad(game);
    this.drawFloating(pz, dt);
    this.drawHud(game);
    if (game.status !== 'playing') this.drawOverlay(game);
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.laneHalf = Math.min(this.w * 0.45, 240);
  }

  private get pxPerMeter(): number {
    return (this.h * PLAYER_Y) / VIEW_AHEAD;
  }

  /** Coordinate di gioco (x lane, distanza dal giocatore) → pixel. */
  private project(x: number, dz: number): [number, number] {
    return [this.w / 2 + x * this.laneHalf, this.h * PLAYER_Y - dz * this.pxPerMeter];
  }

  private drawRoad(game: Game): void {
    const { ctx } = this;
    const left = this.w / 2 - this.laneHalf;
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(left, 0, this.laneHalf * 2, this.h);
    // Tratteggio centrale che scorre per dare il senso di movimento.
    ctx.fillStyle = COLORS.roadLine;
    const step = 4 * this.pxPerMeter;
    const offset = (game.player.z * this.pxPerMeter) % step;
    for (let y = -step + offset; y < this.h; y += step) ctx.fillRect(this.w / 2 - 2, y, 4, step / 2);
  }

  private drawGate(pz: number, z: number, left: import('../../core/types').GateOp, right: import('../../core/types').GateOp): void {
    const { ctx } = this;
    const [, y] = this.project(0, z - pz);
    const hgt = 1.2 * this.pxPerMeter;
    for (const [side, op] of [[-1, left], [1, right]] as const) {
      const x0 = side < 0 ? this.w / 2 - this.laneHalf : this.w / 2;
      ctx.fillStyle = isGoodGate(op) ? COLORS.good : COLORS.bad;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x0 + 3, y - hgt, this.laneHalf - 6, hgt);
      ctx.globalAlpha = 1;
      this.text(formatGate(op), x0 + this.laneHalf / 2, y - hgt / 2, 26);
    }
  }

  private drawWall(pz: number, w: import('../../core/types').Wall): void {
    const { ctx } = this;
    const [cx, y] = this.project(w.x, w.z - pz);
    const width = w.width * this.laneHalf;
    const hgt = 1.5 * this.pxPerMeter;
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(cx - width / 2, y - hgt, width, hgt);
    ctx.fillStyle = COLORS.good;
    ctx.fillRect(cx - width / 2, y - hgt - 6, width * (w.hp / w.maxHp), 4);
    this.text(`${Math.ceil(w.hp)}`, cx, y - hgt * 0.65, 22);
    const icon = w.reward.kind === 'soldiers' ? `+${w.reward.value} 👤` : w.reward.kind === 'fireRate' ? `+${w.reward.value} ⚡` : `+${w.reward.value} 💥`;
    this.text(icon, cx, y - hgt * 0.25, 15);
  }

  private drawFinish(game: Game): void {
    const dz = game.level.length - game.player.z;
    if (dz > VIEW_AHEAD + 2) return;
    const [, y] = this.project(0, dz);
    const size = 12;
    const left = this.w / 2 - this.laneHalf;
    for (let i = 0; i * size < this.laneHalf * 2; i++) {
      for (let r = 0; r < 2; r++) {
        this.ctx.fillStyle = (i + r) % 2 ? '#fff' : '#000';
        this.ctx.fillRect(left + i * size, y - r * size, size, size);
      }
    }
  }

  private drawZombie(pz: number, x: number, z: number, hpRatio: number): void {
    const { ctx } = this;
    const [sx, sy] = this.project(x, z - pz);
    ctx.fillStyle = hpRatio < 0.5 ? COLORS.zombieDark : COLORS.zombie;
    ctx.beginPath();
    ctx.arc(sx, sy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.fillRect(sx - 4, sy - 3, 2, 2);
    ctx.fillRect(sx + 2, sy - 3, 2, 2);
  }

  private drawSquad(game: Game): void {
    const { ctx } = this;
    const p = game.player;
    const n = Math.min(p.soldiers, MAX_DRAWN_SOLDIERS);
    const r = formationRadius(p.soldiers);
    ctx.fillStyle = COLORS.soldier;
    for (let i = 0; i < n; i++) {
      // Disposizione "a girasole": riempie un cerchio in modo uniforme.
      const ang = i * 2.39996;
      const rad = r * Math.sqrt((i + 0.5) / n);
      const [sx, sy] = this.project(p.x + Math.cos(ang) * rad, Math.sin(ang) * rad * 2.5);
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    const [lx, ly] = this.project(p.x, 0);
    this.text(`${p.soldiers}`, lx, ly + r * this.laneHalf + 22, 20);
  }

  private drawFloating(pz: number, dt: number): void {
    this.floating = this.floating.filter(f => (f.age += dt) < 1.2);
    for (const f of this.floating) {
      const [x, y] = this.project(f.x, f.z - pz);
      this.ctx.globalAlpha = 1 - f.age / 1.2;
      this.text(f.text, x, y - f.age * 60, 24, f.tone === 'good' ? COLORS.good : COLORS.bad);
      this.ctx.globalAlpha = 1;
    }
  }

  private drawHud(game: Game): void {
    const { ctx } = this;
    const p = game.player;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, this.w, 44);
    ctx.textAlign = 'left';
    this.text(`👤 ${p.soldiers}  ${WEAPONS[p.weapon].icon}  ☠ ${game.kills}  Orde ${game.hordesLeft}/${game.totalHordes}  🧟 ${game.zombiesLeft}`, 12, 22, 16, COLORS.text, 'left');
    ctx.fillStyle = '#555';
    ctx.fillRect(0, 44, this.w, 4);
    ctx.fillStyle = COLORS.good;
    ctx.fillRect(0, 44, this.w * game.progress, 4);
  }

  private drawOverlay(game: Game): void {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, this.w, this.h);
    const won = game.status === 'won';
    this.text(won ? 'VITTORIA!' : 'GAME OVER', this.w / 2, this.h / 2 - 30, 44, won ? COLORS.good : COLORS.bad);
    this.text(`Soldati: ${game.player.soldiers}  ·  Zombi eliminati: ${game.kills}`, this.w / 2, this.h / 2 + 15, 18);
    this.text('Tocca per ricominciare', this.w / 2, this.h / 2 + 55, 18);
  }

  private text(s: string, x: number, y: number, size: number, color = COLORS.text, align: CanvasTextAlign = 'center'): void {
    const { ctx } = this;
    ctx.font = `bold ${size}px system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(s, x, y);
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }
}
