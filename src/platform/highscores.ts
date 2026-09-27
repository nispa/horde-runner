// Classifiche arcade (top 10 per livello).
// L'interfaccia è asincrona apposta: oggi i dati stanno nel browser, domani la stessa
// interfaccia potrà parlare con un server (classifica online) senza cambiare il gioco.

export interface ScoreEntry {
  initials: string;
  score: number;
  /** Data ISO della partita. */
  date: string;
}

export interface HighscoreStore {
  list(level: number): Promise<ScoreEntry[]>;
  /** Salva il punteggio e restituisce la posizione in classifica (0 = primo), o -1 se non entra. */
  add(level: number, entry: ScoreEntry): Promise<number>;
}

export const TABLE_SIZE = 10;
const KEY = (level: number) => `horde-runner:scores:${level}`;
const INITIALS_KEY = 'horde-runner:initials';

/** Punteggi di esempio, come nei cabinati: danno subito un obiettivo da battere. */
function defaultTable(level: number): ScoreEntry[] {
  // Il primo è impegnativo (circa una buona partita), l'ultimo si batte anche perdendo a metà.
  const names = ['ACE', 'ZED', 'BOB', 'KIM', 'MAX', 'LUX', 'RAY', 'EVA', 'TOM', 'JOY'];
  const tops = [12000, 19000, 16000, 23000, 32000];
  const top = tops[level] ?? tops[tops.length - 1];
  return names.map((initials, i) => ({ initials, score: Math.round((top * (1 - i * 0.1)) / 50) * 50, date: '1985-01-01' }));
}

export class LocalHighscoreStore implements HighscoreStore {
  async list(level: number): Promise<ScoreEntry[]> {
    try {
      const raw = localStorage.getItem(KEY(level));
      if (raw) return JSON.parse(raw) as ScoreEntry[];
    } catch { /* storage non disponibile o dati corrotti */ }
    return defaultTable(level);
  }

  async add(level: number, entry: ScoreEntry): Promise<number> {
    const table = await this.list(level);
    const rank = qualifyingRank(table, entry.score);
    if (rank < 0) return -1;
    table.splice(rank, 0, entry);
    table.length = Math.min(table.length, TABLE_SIZE);
    try { localStorage.setItem(KEY(level), JSON.stringify(table)); } catch { /* ignora */ }
    return rank;
  }
}

/** Posizione che otterrebbe un punteggio (0 = primo), o -1 se non entra in classifica. */
export function qualifyingRank(table: ScoreEntry[], score: number): number {
  if (score <= 0) return -1;
  const i = table.findIndex(e => score > e.score);
  if (i >= 0) return i;
  return table.length < TABLE_SIZE ? table.length : -1;
}

/** Ultime iniziali usate, per proporle già compilate. */
export function lastInitials(): string {
  try { return localStorage.getItem(INITIALS_KEY) ?? 'AAA'; } catch { return 'AAA'; }
}

export function rememberInitials(initials: string): void {
  try { localStorage.setItem(INITIALS_KEY, initials); } catch { /* ignora */ }
}

export const highscores: HighscoreStore = new LocalHighscoreStore();
