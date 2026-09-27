// HUD in HTML sopra la scena 3D: statistiche, arma, orde, punteggio, barra del boss, testi volanti.
import type { Game } from '../core/game';
import type { LevelDef, WeaponId } from '../core/types';
import { WEAPONS } from '../core/weapons';
import './ui.css';

const WEAPON_COLOR: Record<WeaponId, string> = { rifle: '#9aa4b2', minigun: '#3fd0ff', shotgun: '#ff9a3c', rocket: '#ff5a5a' };

export class Hud {
  readonly el = document.createElement('div');
  private stats: HTMLElement;
  private score: HTMLElement;
  private weapon: HTMLElement;
  private hordes: HTMLElement;
  private progress: HTMLElement;
  private boss: HTMLElement;
  private bossName: HTMLElement;
  private bossFill: HTMLElement;
  private shownWeapon: WeaponId | null = null;
  private last = '';

  constructor(root: HTMLElement, private level: LevelDef, muted: boolean, onMute: () => boolean) {
    this.el.className = 'ui-layer';
    this.el.innerHTML = `
      <div class="hud-bar">
        <div class="hud-row"><span data-k="stats"></span><span><span class="hud-score" data-k="score"></span><button class="hud-mute" data-k="mute"></button></span></div>
        <div class="hud-row"><span class="hud-weapon" data-k="weapon"></span><span data-k="hordes"></span></div>
        <div class="hud-progress" data-k="progress"></div>
      </div>
      <div class="hud-boss" data-k="boss" hidden><span data-k="bossName"></span><div class="hud-boss-bar"><div class="hud-boss-fill" data-k="bossFill"></div></div></div>`;
    root.appendChild(this.el);
    const q = (k: string) => this.el.querySelector(`[data-k="${k}"]`) as HTMLElement;
    this.stats = q('stats');
    this.score = q('score');
    this.weapon = q('weapon');
    this.hordes = q('hordes');
    this.progress = q('progress');
    this.boss = q('boss');
    this.bossName = q('bossName');
    this.bossFill = q('bossFill');
    const mute = q('mute');
    mute.textContent = muted ? '🔇' : '🔊';
    mute.addEventListener('pointerdown', e => { e.stopPropagation(); mute.textContent = onMute() ? '🔇' : '🔊'; });
  }

  update(game: Game): void {
    const p = game.player;
    const b = game.boss;
    const bossAlive = !!b && b.active && !b.dead;
    const hordes = game.hordesLeft;
    const bossAhead = game.boss === null && this.level.entities.some(e => e.type === 'boss');
    const hordeText = hordes ? `Orde ${hordes}/${game.totalHordes} · ${game.zombiesLeft}` : bossAlive ? 'BOSS!' : bossAhead ? 'Arriva il boss' : 'Via libera';
    // Aggiorna il DOM solo se qualcosa è cambiato (evita lavoro inutile a ogni fotogramma).
    const key = `${p.soldiers}|${p.fireRate}|${p.damage}|${game.kills}|${game.score}|${hordeText}|${bossAlive ? Math.ceil(b!.hp) : ''}`;
    this.progress.style.width = `${game.progress * 100}%`;
    if (p.weapon !== this.shownWeapon) {
      const w = WEAPONS[p.weapon];
      this.weapon.textContent = `${w.icon} ${w.name}`;
      this.weapon.style.color = WEAPON_COLOR[p.weapon];
      if (this.shownWeapon) {
        this.weapon.classList.add('pop');
        setTimeout(() => this.weapon.classList.remove('pop'), 250);
      }
      this.shownWeapon = p.weapon;
    }
    if (key === this.last) return;
    this.last = key;
    this.stats.textContent = `👤 ${p.soldiers}  ⚡ ${p.fireRate}/s  💥 ${p.damage}  ☠ ${game.kills}`;
    this.score.textContent = String(game.score).padStart(6, '0');
    this.hordes.textContent = hordeText;
    this.boss.hidden = !bossAlive;
    if (bossAlive) {
      this.bossName.textContent = `${b!.name}  ${Math.ceil(b!.hp)}/${b!.maxHp}`;
      this.bossFill.style.width = `${(b!.hp / b!.maxHp) * 100}%`;
    }
  }

  /** Testo che vola via da un punto dello schermo (px). */
  floatText(text: string, x: number, y: number, good: boolean): void {
    const t = document.createElement('div');
    t.className = `float-text ${good ? 'good' : 'bad'}`;
    t.textContent = text;
    t.style.left = `${x}px`;
    t.style.top = `${y}px`;
    this.el.appendChild(t);
    setTimeout(() => t.remove(), 900);
  }

  /** Scritta al centro dello schermo che sfuma (nome del livello, avviso del boss). */
  banner(text: string, warning = false): void {
    const t = document.createElement('div');
    t.className = `hud-banner${warning ? ' warning' : ''}`;
    t.textContent = text;
    this.el.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }

  destroy(): void {
    this.el.remove();
  }
}
