// Progressi della campagna salvati nel browser (localStorage).
// Se lo storage non è disponibile (navigazione privata) il gioco funziona lo stesso, senza salvare.

const KEY = 'horde-runner:progress';

/** Solo in sviluppo: con `window.__noSave = true` le partite di prova non salvano nulla
 *  (il browser di sviluppo contiene i progressi e i record reali di chi gioca). */
export function savingDisabled(): boolean {
  return import.meta.env.DEV && (globalThis as { __noSave?: boolean }).__noSave === true;
}

export interface Progress {
  /** Indice del livello più avanzato giocabile (0 = solo il primo). */
  unlocked: number;
  /** Miglior punteggio per livello. */
  best: Record<number, number>;
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>;
      return { unlocked: p.unlocked ?? 0, best: p.best ?? {} };
    }
  } catch { /* storage non disponibile o dati corrotti */ }
  return { unlocked: 0, best: {} };
}

/** Registra una vittoria: sblocca il livello successivo e aggiorna il record. */
export function completeLevel(index: number, score: number, levelCount: number): Progress {
  const p = loadProgress();
  if (savingDisabled()) return p;
  p.unlocked = Math.max(p.unlocked, Math.min(index + 1, levelCount - 1));
  p.best[index] = Math.max(p.best[index] ?? 0, score);
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignora */ }
  return p;
}
