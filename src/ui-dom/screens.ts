// Schermate HTML della versione 3D: scelta del livello, fine partita in stile cabinato, classifiche.
// Usano gli stessi progressi e le stesse classifiche della versione 2D (platform/).
import type { ScoreLine } from '../core/rules';
import type { LevelDef } from '../core/types';
import { highscores, lastInitials, qualifyingRank, rememberInitials, type ScoreEntry } from '../platform/highscores';
import { loadProgress } from '../platform/progress';
import '../launcher/launcher.css';
import './ui.css';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function screen(root: HTMLElement, html: string): HTMLElement {
  const layer = document.createElement('div');
  layer.className = 'ui-layer';
  layer.innerHTML = `<div class="ui-screen">${html}</div>`;
  root.appendChild(layer);
  return layer;
}

function on(el: HTMLElement, act: string, fn: () => void): void {
  el.querySelector(`[data-act="${act}"]`)?.addEventListener('click', fn);
}

/** Tasti Invio/Esc per l'azione principale e per tornare indietro; restituisce la funzione per staccarli. */
function keys(map: Record<string, () => void>): () => void {
  const h = (e: KeyboardEvent) => { if (map[e.key]) { e.preventDefault(); map[e.key](); } };
  window.addEventListener('keydown', h);
  return () => window.removeEventListener('keydown', h);
}

// --- Scelta del livello ---

export function showLevelMenu(
  root: HTMLElement, levels: LevelDef[],
  actions: { play: (index: number) => void; scores: () => void; back: () => void },
): void {
  const progress = loadProgress();
  const buttons = levels.map((l, i) => {
    const locked = i > progress.unlocked;
    const best = progress.best[i];
    const cls = locked ? 'locked' : best !== undefined ? 'done' : '';
    return `<button class="mc-button ${cls}" data-act="l${i}" ${locked ? 'disabled' : ''}>${locked ? '🔒 ' : ''}${l.name}${best !== undefined ? ` · ${best}` : ''}</button>`;
  }).join('');
  const el = screen(root, `
    <h1 class="ui-title">HORDE RUNNER 3D</h1>
    <div class="ui-buttons">${buttons}
      <button class="mc-button" data-act="scores">🏆 Classifiche</button>
      <button class="mc-button" data-act="back">◀ Menu principale</button>
    </div>`);
  const close = (fn: () => void) => () => { off(); el.remove(); fn(); };
  levels.forEach((_, i) => on(el, `l${i}`, close(() => actions.play(i))));
  on(el, 'scores', close(actions.scores));
  on(el, 'back', close(actions.back));
  const off = keys({ Escape: close(actions.back) });
  (el.querySelector('button:not([disabled])') as HTMLElement | null)?.focus();
}

// --- Fine partita: conteggio → iniziali → classifica ---

export interface ResultActions { next?: () => void; retry: () => void; menu: () => void; sound?: (name: 'tick' | 'record') => void }

export function showResults(
  root: HTMLElement, levels: LevelDef[], index: number, won: boolean, lines: ScoreLine[], total: number, actions: ResultActions,
): void {
  const last = index === levels.length - 1;
  const title = won ? (last ? 'CAMPAGNA COMPLETATA!' : 'VITTORIA!') : 'GAME OVER';
  const rows = lines.map((l, i) =>
    `<div class="tally-row" style="animation-delay:${0.3 + i * 0.35}s"><span>${l.label} x${l.count}</span><span class="pts">${l.points}</span></div>`).join('');
  const delay = 0.3 + lines.length * 0.35;
  const el = screen(root, `
    <h1 class="ui-title ${won ? 'win' : 'lose'}">${title}</h1>
    <div class="tally">${rows}<div class="tally-total" style="animation-delay:${delay}s">SCORE <span data-k="total">0</span></div></div>
    <div class="ui-buttons"><button class="mc-button primary" data-act="go">Continua ▶</button></div>`);
  lines.forEach((_, i) => setTimeout(() => actions.sound?.('tick'), (0.3 + i * 0.35) * 1000));
  // Punteggio che "scorre" fino al totale.
  const totalEl = el.querySelector('[data-k="total"]') as HTMLElement;
  const t0 = performance.now() + delay * 1000;
  const tick = (now: number) => {
    const k = Math.min(1, Math.max(0, (now - t0) / 700));
    totalEl.textContent = String(Math.round(total * k));
    if (k < 1 && el.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const proceed = async () => {
    off();
    el.remove();
    const table = await highscores.list(index);
    const rank = qualifyingRank(table, total);
    if (rank >= 0) showInitials(root, levels, index, won, total, rank, actions);
    else void showTable(root, levels, index, won, -1, actions);
  };
  on(el, 'go', () => void proceed());
  const off = keys({ Enter: () => void proceed(), ' ': () => void proceed() });
  (el.querySelector('button') as HTMLElement).focus();
}

function showInitials(root: HTMLElement, levels: LevelDef[], index: number, won: boolean, total: number, rank: number, actions: ResultActions): void {
  const letters = lastInitials().padEnd(3, 'A').slice(0, 3).split('');
  let slot = 0;
  const el = screen(root, `
    <h1 class="ui-title gold">NUOVO RECORD!</h1>
    <p class="ui-small">${rank + 1}° POSTO · ${total} PUNTI<br>INSERISCI LE TUE INIZIALI</p>
    <div class="initials">${[0, 1, 2].map(i => `
      <div class="initial" data-i="${i}">
        <button class="mc-button" data-up="${i}">▲</button>
        <span class="letter"></span>
        <button class="mc-button" data-down="${i}">▼</button>
      </div>`).join('')}</div>
    <div class="ui-buttons"><button class="mc-button primary" data-act="ok">OK</button></div>`);
  const slots = [...el.querySelectorAll('.initial')] as HTMLElement[];
  const draw = () => slots.forEach((s, i) => {
    s.classList.toggle('active', i === slot);
    (s.querySelector('.letter') as HTMLElement).textContent = letters[i];
  });
  const change = (i: number, d: number) => {
    slot = i;
    letters[i] = LETTERS[(LETTERS.indexOf(letters[i]) + d + LETTERS.length) % LETTERS.length];
    actions.sound?.('tick');
    draw();
  };
  slots.forEach((s, i) => {
    s.querySelector(`[data-up="${i}"]`)!.addEventListener('click', () => change(i, 1));
    s.querySelector(`[data-down="${i}"]`)!.addEventListener('click', () => change(i, -1));
    s.querySelector('.letter')!.addEventListener('click', () => { slot = i; draw(); });
  });
  const confirm = async () => {
    window.removeEventListener('keydown', onKey);
    el.remove();
    const initials = letters.join('');
    rememberInitials(initials);
    const saved = await highscores.add(index, { initials, score: total, date: new Date().toISOString() });
    actions.sound?.('record');
    void showTable(root, levels, index, won, saved, actions);
  };
  // Tastiera: lettere/numeri scrivono, frecce su/giù cambiano, sinistra/destra spostano, Invio conferma.
  const onKey = (e: KeyboardEvent) => {
    const k = e.key.toUpperCase();
    if (k.length === 1 && LETTERS.includes(k)) { letters[slot] = k; slot = Math.min(2, slot + 1); actions.sound?.('tick'); }
    else if (e.key === 'ArrowUp') return change(slot, 1);
    else if (e.key === 'ArrowDown') return change(slot, -1);
    else if (e.key === 'ArrowLeft' || e.key === 'Backspace') slot = Math.max(0, slot - 1);
    else if (e.key === 'ArrowRight') slot = Math.min(2, slot + 1);
    else if (e.key === 'Enter') return void confirm();
    else return;
    e.preventDefault();
    draw();
  };
  window.addEventListener('keydown', onKey);
  on(el, 'ok', () => void confirm());
  draw();
}

function tableHtml(entries: ScoreEntry[], highlight: number): string {
  return entries.map((e, i) => {
    const cls = i === highlight ? 'me' : i < 3 ? `r${i}` : 'rn';
    return `<div class="${cls}">${String(i + 1).padStart(2, ' ')}. ${e.initials}  ${String(e.score).padStart(7, ' ')}</div>`;
  }).join('');
}

async function showTable(root: HTMLElement, levels: LevelDef[], index: number, won: boolean, highlight: number, actions: ResultActions): Promise<void> {
  const table = await highscores.list(index);
  const next = won && actions.next && index + 1 < levels.length;
  const primary = next ? 'Prossimo livello ▶' : won ? 'Menu' : 'Riprova';
  const el = screen(root, `
    <h1 class="ui-title lose">HIGH SCORES</h1>
    <p class="ui-small">${levels[index].name.toUpperCase()}</p>
    <div class="score-table">${tableHtml(table, highlight)}</div>
    <div class="ui-buttons">
      <button class="mc-button primary" data-act="primary">${primary}</button>
      ${primary !== 'Menu' ? '<button class="mc-button" data-act="menu">Menu</button>' : ''}
    </div>`);
  const close = (fn: () => void) => () => { off(); el.remove(); fn(); };
  const go = close(next ? actions.next! : won ? actions.menu : actions.retry);
  on(el, 'primary', go);
  on(el, 'menu', close(actions.menu));
  let off = () => {};
  // Piccolo ritardo: evita di saltare la schermata premendo Invio per sbaglio.
  setTimeout(() => { if (el.isConnected) off = keys({ Enter: go, Escape: close(actions.menu) }); }, 400);
  (el.querySelector('button') as HTMLElement).focus();
}

// --- Classifiche dal menu ---

export async function showScores(root: HTMLElement, levels: LevelDef[], back: () => void, index = 0): Promise<void> {
  const table = await highscores.list(index);
  const el = screen(root, `
    <h1 class="ui-title lose">HIGH SCORES</h1>
    <div class="ui-buttons"><div class="launcher-row" style="display:flex;gap:10px">
      <button class="mc-button" data-act="prev">◀</button>
      <span class="ui-small" style="flex:3;align-self:center">${levels[index].name.toUpperCase()}</span>
      <button class="mc-button" data-act="next">▶</button>
    </div></div>
    <div class="score-table">${tableHtml(table, -1)}</div>
    <div class="ui-buttons"><button class="mc-button" data-act="back">Indietro</button></div>`);
  const go = (d: number) => () => { off(); el.remove(); void showScores(root, levels, back, (index + d + levels.length) % levels.length); };
  const close = () => { off(); el.remove(); back(); };
  on(el, 'prev', go(-1));
  on(el, 'next', go(1));
  on(el, 'back', close);
  const off = keys({ ArrowLeft: go(-1), ArrowRight: go(1), Escape: close });
}
