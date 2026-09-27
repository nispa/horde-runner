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
- Stack: **Vite 8 + TypeScript**, **Phaser 4** (versione 2D), **Three.js** (versione 3D),
  test con **Vitest**, PWA con `vite-plugin-pwa`.

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
  platform/    Browser: input, progressi, classifiche, impostazioni, audio WebAudio (localStorage).
  launcher/    Menu iniziale HTML/CSS in stile Minecraft: scelta 2D/3D e Opzioni.
  ui-dom/      Interfaccia HTML indipendente dal motore (HUD, livelli, risultati, classifiche) — usata dal 3D.
  render/
    phaser/    Versione 2D: scene Menu, Game, Result (fine partita), HighScores.
    three/     Versione 3D: startThree (app), World3D (scena), cameras (iso/da dietro),
               models/ (pacchetti modelli pluggabili), shaders/ (shader pack pluggabili), catalog.ts.
    canvas/    Renderer prototipo Canvas 2D (/?renderer=canvas), tenuto allineato al minimo.
  main.ts      Menu iniziale → versione 2D o 3D (import dinamici: ogni motore è un pacchetto separato).
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
- Nuove entità del core vanno disegnate in **tutti** i renderer: Phaser (`GameScene`), Three.js
  (`World3D` + un metodo nel `ModelPack`), Canvas (minimo).

## Versione 3D: parti pluggabili

- **Pacchetti modelli** (`render/three/models/`): interfaccia `ModelPack` in `types.ts` (folle in
  instancing, boss, oggetti lanciati, armi, casse, scenario). Oggi: `voxel` (tutto a blocchi,
  costruito dal codice) e `mixed` (voxel + oggetti di scena Kenney 3D GLB da `public/assets/kenney3d/`).
  Nuovo pacchetto: implementare `ModelPack`, registrarlo in `models/index.ts`, aggiungerlo in `catalog.ts`.
  Nel Graveyard Kit c'è già `character-zombie.glb` (con animazioni) per un futuro pacchetto low-poly.
- **Shader pack** (`render/three/shaders/`): interfaccia `ShaderPack` in `types.ts`; ricevono renderer,
  scena, telecamera e luci (anche `squadLight`) e restituiscono una pipeline di post-produzione.
  Shader GLSL propri in `effects.ts`. Nuovo pack: file in `shaders/`, registrarlo in `shaders/index.ts`
  e in `catalog.ts`. `World3D.resetAtmosphere()` ripristina luci e cielo prima di applicare un pack.
- Mondo 3D: 1 unità = 1 metro, strada larga `2 × ROAD_HALF` (8 m); `wx(x)`/`wz(z)` convertono
  dalle coordinate del core (avanti = −Z).
- Tasti in partita: **C** telecamera, **V** shader, **M** muto, **Esc** livelli.

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
- Modelli 3D: **Kenney Nature Kit** e **Graveyard Kit** (CC0) — `public/assets/kenney3d/*/License.txt`.
- Font: **Press Start 2P** (SIL OFL) — `public/fonts/OFL.txt`.
- Suoni in OGG con fallback MP3 (Safari/iOS). Nuovi suoni: aggiungerli in `render/phaser/Sfx.ts`
  e in entrambi i formati (ffmpeg è disponibile sulla macchina di sviluppo).
- Nuovi formati di file in `public/` vanno aggiunti a `globPatterns` in `vite.config.ts`,
  altrimenti non vengono salvati per l'uso offline.

## Test nel browser (attenzione!)

- `/?mode=2d` o `/?mode=3d` salta il menu iniziale.
- In sviluppo sono esposti `window.__game` (Phaser.Game), `window.__scene` (GameScene, con
  `__scene.sim` = istanza di `Game`) e `window.__app3d` (versione 3D: `__app3d.match.game`,
  `__app3d.startLevel(i)`). Utili per portare la partita in un punto preciso:
  `for (...) sim.step(1/60)`. Avviare un livello: `__game.scene.getScene('menu').scene.start('game', { index: 2 })`.
- **Il browser di sviluppo è lo stesso con cui l'utente gioca**: in `localStorage` ci sono i suoi
  progressi e record reali. **Prima di ogni prova eseguire `window.__noSave = true`** (solo in sviluppo:
  blocca il salvataggio di progressi e classifiche). Chiavi: (`horde-runner:progress`, `horde-runner:scores:<livello>`,
  `horde-runner:initials`, `horde-runner:muted`, `horde-runner:settings`). Prima di una prova salvarne una copia;
  chiudere ogni partita forzata con una **sconfitta** (`sim.player.soldiers = 0`), mai con una
  vittoria (salverebbe record finti); alla fine verificare che i dati siano identici.
- Con la scheda in background il browser rallenta/ferma i fotogrammi: animazioni e timer di
  Phaser avanzano solo quando la scheda è visibile, e clic/tasti simulati vengono accodati.
- Su Windows fermare `npm run dev` (anche come processo in background) **non chiude il processo `node`
  di Vite**, che resta sulla porta 5173 con file vecchi mentre un nuovo server parte sulla 5174.
  Avviare con `node node_modules/vite/bin/vite.js --host --strictPort` e, se serve, chiudere il processo
  rimasto (`Get-NetTCPConnection -LocalPort 5173`).
- Per provare gli schermi dei telefoni: una pagina con `<iframe>` di 844×390 e 390×844 dà un viewport
  reale (lo zoom della pagina no); impostare `__noSave = true` anche nella finestra di ogni iframe.
- La prima volta che si apre il 3D (o dopo aver aggiunto un import di Three.js) Vite ottimizza la
  dipendenza e **ricarica la pagina**: uno script lanciato in quel momento si interrompe, va rilanciato.

## Convenzioni

- Codice e commenti in italiano, nello stile dei file esistenti (commenti brevi sul "perché").
- Messaggi di commit in italiano: titolo sintetico + elenco puntato delle modifiche.
- Il ramo principale è `master` (remote `origin` = github.com/nispa/horde-runner). Ogni push su master
  pubblica il gioco su https://nispa.github.io/horde-runner/ tramite GitHub Actions.
