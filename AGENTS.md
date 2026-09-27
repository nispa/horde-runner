# AGENTS.md — Horde Runner

Guida per chi (persona o agente AI) riprende il lavoro su questo progetto.
Stato attuale, roadmap e backlog sono in [PLANNING.md](PLANNING.md); presentazione in [README.md](README.md)
e spiegazione didattica del progetto in [docs/MANUALE.md](docs/MANUALE.md) (da aggiornare quando cambiano
meccaniche, tecnologie o risorse).

## Il progetto

Gioco "crowd runner" in stile pubblicità mobile: una squadra corre lungo una strada,
sceglie **gate** (+, −, ×, ÷), abbatte **casse** per ottenere bonus, raccoglie **armi**,
affronta **orde di zombi**, **bruti** che lanciano rocce e un **boss** a fine livello.
Campagna di 5 livelli, classifica arcade locale, installabile come PWA.

- Lingua del progetto: **italiano** (testi di gioco, commenti nel codice, messaggi di commit).
- Stack: **Vite 8 + TypeScript + Phaser 4**, test con **Vitest**, PWA con `vite-plugin-pwa`.

## Comandi

```bash
npm run dev       # server di sviluppo (http://localhost:5173, anche in LAN con --host)
npm run build     # typecheck + build di produzione in dist/ (con service worker PWA)
npm run preview   # serve dist/ (http://localhost:4173)
npm test          # tutti i test (core, classifica, bilanciamento)
npx tsc --noEmit  # solo typecheck
```

Prima di considerare finita una modifica: `npx tsc --noEmit`, `npm test`, `npm run build`.

## Architettura (la regola più importante)

Il gioco è diviso in strati; **la logica non conosce la grafica**. È pensato per poter
cambiare motore (Three.js, Unity, Unreal) riscrivendo solo il renderer.

```
src/
  core/        Logica pura, nessuna dipendenza da DOM/Phaser. Traducibile in C#/C++.
    types.ts     Tipi di dati (definizioni dei livelli) e stato runtime; union GameEvent.
    rules.ts     Costanti e funzioni pure: gate, punteggio (computeScore), gittata, boss...
    game.ts      Classe Game: simulazione a passo fisso (step(dt)), emette eventi.
    hazards.ts   Fisica degli oggetti lanciati dai nemici (parabola, rotolamento, volo).
    weapons.ts   Tabella armi (valori in data/weapons.json).
  data/        Dati di gioco in JSON: livelli, armi. campaign.ts elenca i livelli in ordine.
  platform/    Browser: input (mouse/touch/tastiera), progressi e classifiche (localStorage).
  render/
    phaser/    Renderer principale: scene Menu, Game, Result (fine partita), HighScores.
    canvas/    Renderer prototipo Canvas 2D (/?renderer=canvas), tenuto allineato al minimo.
  main.ts      Sceglie il renderer.
tests/         Test del core + bot e strumenti di bilanciamento (vedi sotto).
tools/levels/  Generatore dei livelli (Python): fonte di verità dei JSON dei livelli.
public/        Asset: Kenney (sprite, suoni), font Press Start 2P, icone PWA.
```

Regole:
- **Coordinate astratte** nel core: `x` = posizione nella strada da −1 (sinistra) a +1 (destra),
  `z` = metri percorsi. I pixel esistono solo nel renderer.
- Il core comunica col renderer tramite **eventi** (`GameEvent`, letti con `drainEvents()`):
  il renderer li trasforma in testi, suoni, particelle. Nuove meccaniche → nuovi eventi.
- **Determinismo**: il core usa un RNG con seed (`createRng`). Non usare `Math.random()` nel core
  (nel renderer va bene, è solo estetica). Consumare numeri casuali cambia tutte le partite dei
  test: se si aggiunge un `rng()` dove prima non c'era, i risultati del bilanciamento si spostano.
- Tutto ciò che è "contenuto" (livelli, armi, nemici che lanciano, boss) va nei **dati**, non nel codice.
- Il renderer Canvas deve almeno compilare e disegnare le nuove entità in modo semplice.

## Livelli e bilanciamento

- I file `src/data/levels/level*.json` sono **generati** da `tools/levels/make_levels.py`
  (helper in `tools/levels/levels.py`). Modificare il generatore e rigenerare:
  `python tools/levels/make_levels.py` — modifiche fatte a mano nei JSON vengono sovrascritte.
- Il bilanciamento si verifica con **bot** (`tests/bots.ts`): `smartBot` (schiva, sceglie i gate
  migliori, prende armi, rompe le casse che riesce a rompere), `randomBot`, `gatesOnlyBot`.
- `tests/balance.test.ts` (fa parte di `npm test`): per ogni livello il bot attento deve vincere
  ≥ 80% delle 20 partite, quello casuale ≤ 20%. Statistiche: `npx vitest run balance --silent=false`.
- Strumenti di analisi (non sono test, partono solo con la variabile d'ambiente):
  | Comando | A cosa serve |
  |---|---|
  | `TRACE=2 npx vitest run trace --silent=false` | soldati e potenza del bot a ogni entità del livello 2 |
  | `TUNE=1 npx vitest run tune --silent=false` | vittorie al variare della vita degli zombi |
  | `BOSS_TUNE=1 npx vitest run boss-tune --silent=false` | vita massima del boss per ~85% di vittorie |
  | `WEAPONS_EVAL=1 npx vitest run weapons-eval --silent=false` | resa di ogni arma e delle preferenze |
- Lezioni imparate (vedi PLANNING.md per i dettagli):
  - Una cassa subito dopo un gate lascia ~2 s di fuoco: se è troppo robusta non si rompe e la
    partita crolla "a valanga". Le prime casse devono essere rompibili con la potenza iniziale.
  - I moltiplicatori (×2) nella seconda metà creano valanghe di soldati: usarli con cautela.
  - Il bot è più preciso di un umano: se un livello è "90% col bot", per una persona è impegnativo.

## Asset e licenze

- Sprite, tile e suoni: pacchetti **Kenney.nl** (CC0) — licenze in `public/assets/**/License*.txt`.
- Font: **Press Start 2P** (SIL OFL) — `public/fonts/OFL.txt`.
- Suoni in OGG con fallback MP3 (Safari/iOS). Nuovi suoni: aggiungerli in `render/phaser/Sfx.ts`
  e in entrambi i formati (ffmpeg è disponibile sulla macchina di sviluppo).
- Nuovi formati di file in `public/` vanno aggiunti a `globPatterns` in `vite.config.ts`,
  altrimenti non vengono salvati per l'uso offline.

## Test nel browser (attenzione!)

- In sviluppo sono esposti `window.__game` (Phaser.Game) e `window.__scene` (GameScene, con
  `__scene.sim` = istanza di `Game`). Utili per portare la partita in un punto preciso:
  `for (...) sim.step(1/60)`. Avviare un livello: `__game.scene.getScene('menu').scene.start('game', { index: 2 })`.
- **Il browser di sviluppo è lo stesso con cui l'utente gioca**: in `localStorage` ci sono i suoi
  progressi e record reali (`horde-runner:progress`, `horde-runner:scores:<livello>`,
  `horde-runner:initials`, `horde-runner:muted`). Prima di una prova salvarne una copia;
  chiudere ogni partita forzata con una **sconfitta** (`sim.player.soldiers = 0`), mai con una
  vittoria (salverebbe record finti); alla fine verificare che i dati siano identici.
- Con la scheda in background il browser rallenta/ferma i fotogrammi: animazioni e timer di
  Phaser avanzano solo quando la scheda è visibile, e clic/tasti simulati vengono accodati.

## Convenzioni

- Codice e commenti in italiano, nello stile dei file esistenti (commenti brevi sul "perché").
- Messaggi di commit in italiano: titolo sintetico + elenco puntato delle modifiche.
- Il ramo principale è `master` (remote `origin` = github.com/nispa/horde-runner). Ogni push su master
  pubblica il gioco su https://nispa.github.io/horde-runner/ tramite GitHub Actions.
