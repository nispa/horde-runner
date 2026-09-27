// Progressi della campagna salvati nel browser (localStorage).
// Se lo storage non è disponibile (navigazione privata) il gioco funziona lo stesso, senza salvare.

const KEY = 'horde-runner:progress';

export interface Progress {
  /** Indice del livello più avanzato giocabile (0 = solo il primo). */
  unlocked: number;
  /** Miglior numero di soldati sopravvissuti per livello. */
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
export function completeLevel(index: number, soldiers: number, levelCount: number): Progress {
  const p = loadProgress();
  p.unlocked = Math.max(p.unlocked, Math.min(index + 1, levelCount - 1));
  p.best[index] = Math.max(p.best[index] ?? 0, soldiers);
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignora */ }
  return p;
}
