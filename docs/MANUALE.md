# Manuale didattico — Come è stato fatto Horde Runner

Questo manuale racconta come è stato costruito **Horde Runner**, dall'idea al gioco pubblicato
online, spiegando le scelte tecniche, le tecnologie e le risorse usate. È pensato per chi vuole
capire come si fa un piccolo videogioco per il web, o riprendere il progetto per ampliarlo.

▶ Il gioco: **https://nispa.github.io/horde-runner/** · Codice: https://github.com/nispa/horde-runner

---

## Indice

1. [L'idea: un gioco "da pubblicità"](#1-lidea-un-gioco-da-pubblicità)
2. [Sviluppare a step](#2-sviluppare-a-step)
3. [Le tecnologie e perché](#3-le-tecnologie-e-perché)
4. [L'architettura: separare la logica dalla grafica](#4-larchitettura-separare-la-logica-dalla-grafica)
5. [Il cuore del gioco: la simulazione](#5-il-cuore-del-gioco-la-simulazione)
6. [I dati: livelli e armi in JSON](#6-i-dati-livelli-e-armi-in-json)
7. [La grafica con Phaser](#7-la-grafica-con-phaser)
8. [Le meccaniche di gioco](#8-le-meccaniche-di-gioco)
9. [Bilanciare un gioco con i bot](#9-bilanciare-un-gioco-con-i-bot)
10. [Punteggio e classifica arcade](#10-punteggio-e-classifica-arcade)
11. [Suoni ed effetti](#11-suoni-ed-effetti)
12. [PWA: un sito che diventa un'app](#12-pwa-un-sito-che-diventa-unapp)
13. [Pubblicazione con GitHub Actions e Pages](#13-pubblicazione-con-github-actions-e-pages)
14. [Risorse e licenze](#14-risorse-e-licenze)
15. [Come è stato sviluppato: il ruolo dell'intelligenza artificiale](#15-come-è-stato-sviluppato-il-ruolo-dellintelligenza-artificiale)
16. [Idee ed esercizi per continuare](#16-idee-ed-esercizi-per-continuare)

---

## 1. L'idea: un gioco "da pubblicità"

Chi usa lo smartphone li ha visti mille volte negli annunci: una strada, un omino o un gruppo di
omini che corre, **porte colorate** con scritto `+10` o `×2`, e un'orda di nemici che arriva.
Il genere si chiama *crowd runner* (o *gate runner*). Il fascino sta in poche regole semplici:

- **scelte rapide**: a sinistra `+6` o a destra `×2`? Dipende da quanti soldati hai;
- **crescita visibile**: la folla aumenta o diminuisce sotto i tuoi occhi;
- **tensione finale**: l'orda o il boss mettono alla prova quello che hai accumulato.

Horde Runner prende questa formula e la rende un vero gioco: armi da raccogliere, casse da
abbattere, nemici che lanciano oggetti, boss, cinque livelli e una classifica da sala giochi,
con un richiamo a classici come *1943* di Capcom.

## 2. Sviluppare a step

Invece di partire subito con grafica complessa, il gioco è stato costruito **per passi**,
verificando a ogni passo che fosse divertente e funzionante:

| Step | Cosa | Perché |
|---|---|---|
| 1 | Prototipo con forme geometriche (Canvas 2D) | Capire se il gioco "funziona" prima di investire nella grafica |
| 2 | Grafica e suoni veri con Phaser | Rendere il gioco piacevole senza toccare la logica |
| 3 | PWA installabile e pubblicazione | Giocarlo sul telefono e farlo provare agli amici |
| 4 | *(futuro)* 3D con Three.js | Vista in prospettiva come negli annunci |
| 5 | *(opzionale)* Unreal Engine | Versione "da store" con grafica avanzata |

La cronologia reale del progetto (dai commit git):

1. prototipo, grafica Phaser, suoni e PWA;
2. campagna di 5 livelli con menu e progressi salvati;
3. armi raccoglibili, boss di fine livello, HUD con orde e zombi rimasti;
4. classifica arcade con iniziali;
5. nemici che lanciano oggetti e zombi più aggressivi;
6. pubblicazione automatica su GitHub Pages.

> **Lezione**: un prototipo "brutto" che si può giocare vale più di una grafica bellissima
> senza gioco. Le forme colorate dello step 1 esistono ancora: aprendo il gioco con
> `?renderer=canvas` si vede la versione originale.

## 3. Le tecnologie e perché

| Tecnologia | Versione | A cosa serve |
|---|---|---|
| **TypeScript** | 7 | JavaScript con i tipi: gli errori si vedono mentre si scrive, non mentre si gioca |
| **Vite** | 8 | Server di sviluppo istantaneo (ricarica mentre modifichi) e build ottimizzata |
| **Phaser** | 4 | Motore di gioco 2D per il web: sprite, animazioni, particelle, suoni, input |
| **Vitest** | 5 | Test automatici della logica di gioco, senza aprire il browser |
| **vite-plugin-pwa** (Workbox) | 1.3 | Trasforma il sito in un'app installabile e giocabile offline |
| **GitHub Actions + Pages** | — | Test, build e pubblicazione automatica a ogni modifica |
| **Python** | 3 | Script che genera i file dei livelli |
| **ffmpeg**, **sharp** | — | Conversione dei suoni (OGG → MP3) e ritaglio delle immagini |

Alcune scelte e le alternative scartate:

- **Phaser invece di React**: React è ottimo per le interfacce, ma un gioco vive dentro un
  `<canvas>` ridisegnato 60 volte al secondo; Phaser è fatto apposta per questo.
- **Phaser invece di Three.js** (per ora): il 2D visto dall'alto è più semplice da realizzare e
  da bilanciare; il 3D è previsto come step successivo, riusando tutta la logica.
- **Web invece di Unreal/Unity**: nessuna installazione, si gioca da un link, si aggiorna al
  volo. Unreal non esporta più per il browser, quindi resta un'opzione per il futuro.

## 4. L'architettura: separare la logica dalla grafica

È la decisione più importante del progetto. Il codice è diviso in **strati**:

```
┌──────────────────────────────────────────────┐
│  DATI (JSON)          livelli, armi, boss    │  riusabili da qualsiasi motore
├──────────────────────────────────────────────┤
│  CORE (TypeScript)    regole e simulazione   │  nessuna grafica: traducibile in C#/C++
├──────────────────────────────────────────────┤
│  RENDERER             Phaser (o Canvas, o…)  │  l'unica parte che dipende dal motore
│  PLATFORM             input, salvataggi      │  specifica del browser
└──────────────────────────────────────────────┘
```

Nel codice:

```
src/core/       logica pura (types, rules, game, hazards, weapons)
src/data/       livelli e armi in JSON
src/render/     phaser/ (grafica principale) e canvas/ (prototipo)
src/platform/   input, progressi, classifiche
```

Tre idee rendono possibile questa separazione:

1. **Coordinate astratte.** Il core non conosce i pixel. Un oggetto ha una posizione `x` nella
   strada (da −1 = bordo sinistro a +1 = bordo destro) e una distanza `z` in metri. È il
   renderer a convertirle in pixel:
   ```ts
   private sx(x: number): number { return this.w / 2 + x * this.laneHalf; }
   private sy(dz: number): number { return this.h * PLAYER_Y - dz * this.ppm; }
   ```
2. **Eventi.** Quando succede qualcosa (uno zombi muore, si raccoglie un'arma, arriva il boss)
   il core non disegna nulla e non suona nulla: **pubblica un evento**. Il renderer li legge e
   decide come mostrarli (particelle, suono, testo che vola via).
   ```ts
   export type GameEvent =
     | { kind: 'zombieKilled'; x: number; z: number; bite: number }
     | { kind: 'weaponPickup'; x: number; z: number; weapon: WeaponId }
     | { kind: 'bossSpawn'; name: string }
     // ...
   ```
3. **Comandi.** Nel verso opposto, l'input non tocca lo stato: manda un comando astratto
   (`steerTo(x)`: "voglio andare in questa posizione della strada"). Mouse, dito o tastiera
   sono dettagli della piattaforma.

Il vantaggio si è visto subito: allo step 2 la grafica è stata **completamente sostituita**
(da forme geometriche a sprite animati) senza cambiare una riga della logica, e i due
renderer convivono ancora oggi.

## 5. Il cuore del gioco: la simulazione

La classe `Game` (in `src/core/game.ts`) contiene tutto lo stato: la squadra, gli zombi, i
proiettili, le casse, il boss. Il metodo principale è `step(dt)`, che fa avanzare il mondo di
`dt` secondi:

```ts
step(dt: number): void {
  this.movePlayer(dt);
  this.spawn();          // fa comparire le ondate che si avvicinano
  this.moveZombies(dt);
  this.moveBoss(dt);
  this.updateThrows(dt); // i nemici lanciano oggetti
  this.moveHazards(dt);
  this.shoot(dt);
  this.moveBullets(dt);  // e controlla i colpi
  this.checkGates();
  // ... contatti, vittoria, sconfitta
}
```

### Il passo fisso

Il browser disegna a velocità variabile (60, 120, 144 fotogrammi al secondo, o meno se il
telefono è lento). Se la simulazione avanzasse "un pezzo per fotogramma", il gioco andrebbe
più veloce sugli schermi veloci. Per questo si usa un **passo fisso** di 1/60 di secondo,
accumulando il tempo trascorso:

```ts
this.acc += deltaSecondi;
while (this.acc >= FIXED_DT) {   // FIXED_DT = 1/60
  this.sim.step(FIXED_DT);
  this.acc -= FIXED_DT;
}
```

### Numeri casuali "ripetibili"

Gli zombi compaiono in posizioni casuali, ma il core usa un **generatore con seme**
(*seeded RNG*, qui l'algoritmo *mulberry32*): con lo stesso seme, la partita si ripete
identica. Sembra un dettaglio, ma è ciò che rende possibili i test automatici e il
bilanciamento con i bot (capitolo 9).

### Collisioni senza "salti"

Un proiettile veloce in un fotogramma percorre mezzo metro: potrebbe "saltare" oltre uno
zombi senza toccarlo. Per evitarlo si controlla il **segmento** percorso nel fotogramma,
non solo il punto di arrivo (`z` precedente → `z` attuale).

## 6. I dati: livelli e armi in JSON

Tutto ciò che è "contenuto" sta nei dati, non nel codice. Un livello è una lista di entità:

```json
{ "type": "gate", "z": 14, "left": { "op": "+", "value": 6 }, "right": { "op": "x", "value": 2 } },
{ "type": "wall", "z": 30, "x": -0.5, "width": 0.9, "hp": 30, "crashCost": 4,
  "reward": { "kind": "soldiers", "value": 10 } },
{ "type": "wave", "z": 88, "count": 20, "hp": 6, "speed": 2.4, "spread": 0.9 },
{ "type": "weapon", "z": 120, "x": -0.5, "weapon": "shotgun" },
{ "type": "boss", "z": 340, "name": "Il Macellaio", "hp": 7000, "speed": 1.2, "bite": 4,
  "attacks": [{ "kind": "zombie", "every": 2.5, "hp": 20 }] }
```

Le armi hanno la loro tabella (`src/data/weapons.json`) con cadenza, danno, gittata, numero di
pallini, raggio d'esplosione. Cambiare il bilanciamento di un'arma non richiede di toccare il codice.

Scrivere a mano centinaia di righe di JSON è scomodo, quindi i livelli sono **generati** da
uno script Python (`tools/levels/make_levels.py`) con funzioni brevi:

```python
gate(60, '-8', '*2'),
wall(74, 0.5, 90, 8, 'fireRate', 2),
wave(88, 20, 6, 2.4), wave(94, 2, 35, 1.8, 0.6, 5),   # 20 zombi + 2 bruti
weapon(120, -0.5, 'shotgun'), weapon(120, 0.5, 'minigun'),
boss(340, 'Il Macellaio', 7000, 1.2, 4, [thrown_zombie(2.5, 20)]),
```

> **Collegamento con Unreal/Unity**: questi JSON si possono importare così come sono
> (in Unreal diventano *DataTable*). Il lavoro di level design non va perso cambiando motore.

## 7. La grafica con Phaser

Phaser organizza il gioco in **scene**. Horde Runner ne ha quattro:

| Scena | Contenuto |
|---|---|
| `MenuScene` | carica tutte le risorse, mostra i livelli (bloccati/sbloccati) |
| `GameScene` | la partita: legge lo stato del core e lo disegna |
| `ResultScene` | fine partita in stile sala giochi, sopra la partita |
| `HighScoresScene` | le classifiche dei livelli |

Tecniche usate in `GameScene`:

- **Sincronizzazione.** A ogni fotogramma il renderer confronta gli oggetti del core con quelli
  disegnati (per `id`): crea gli sprite dei nuovi, sposta quelli esistenti, distrugge quelli spariti.
- **Pool di oggetti.** Soldati e proiettili sono tanti e cambiano continuamente: invece di
  crearli e distruggerli, si tiene una riserva fissa di sprite e si mostrano/nascondono.
- **Scorrimento del terreno.** Erba e asfalto sono `TileSprite`: una piastrella ripetuta
  di cui si sposta solo l'"offset" (`tilePositionY`) mentre la squadra avanza.
- **Texture generate.** Ciò che manca nei pacchetti grafici (asfalto, proiettili, razzi,
  corvi) viene disegnato al volo con `Graphics` e trasformato in texture.
- **Formazione "a girasole".** I soldati sono disposti con l'angolo aureo (≈137,5°) per
  riempire un cerchio in modo uniforme qualunque sia il loro numero.
- **Particelle** per esplosioni, schegge e sangue; **tween** per testi che volano e lampeggi.
- **Profondità** (`depth`) per decidere cosa sta sopra a cosa: terreno, macchie, casse,
  proiettili, zombi, squadra, effetti, HUD, schermate.

## 8. Le meccaniche di gioco

### Gate e casse
I gate applicano un'operazione al numero di soldati (`+`, `−`, `×`, `÷`) in base al lato in
cui passi. Le casse hanno punti vita: se le abbatti prima di arrivarci ottieni un bonus,
se ci sbatti contro perdi soldati.

### Gittata "onesta"
Si può colpire solo ciò che è entro **26 m**, mentre lo schermo ne mostra **32**: casse e
nemici compaiono prima di poter essere colpiti. Nelle prime versioni una folla numerosa
distruggeva le casse prima ancora che entrassero nell'inquadratura.

### Potenza di fuoco meno che proporzionale
La potenza cresce con i soldati, ma non in modo lineare: `danno × soldati^0,75`.
100 soldati sparano come circa 32, non come 100. Così una folla enorme resta forte ma non invincibile.

### Armi
| Arma | Caratteristica |
|---|---|
| Fucile | equilibrato |
| ⚡ Mitragliatrice | cadenza ×2,5, colpi più leggeri |
| 💥 Fucile a pompa | 5 pallini a ventaglio, danno alto, corto raggio |
| 🚀 Lanciarazzi | lento, esplode ad area, danno extra a casse e boss |

### Nemici che inseguono
Gli zombi si spostano lateralmente verso la squadra quando sono vicini: aggirarli richiede
di muoversi presto. I **bruti** sono più grossi, resistenti, "mordono" più soldati e hanno
le braccia lunghe.

### Oggetti lanciati
Descritti nei dati (`throws` per un'ondata, `attacks` per un boss), con fisica in `core/hazards.ts`:

- **roccia e zombi lanciato**: traiettoria a parabola. La posizione si interpola tra partenza
  e arrivo, e l'altezza segue `h = 4·H·t·(1−t)` (zero alla partenza e all'arrivo, massima a metà).
  Un **cerchio rosso** a terra mostra dove cadranno: si schivano spostandosi.
- **masso**: rotola lungo la corsia in cui eri al momento del lancio; si può distruggere.
- **corvi**: volano verso la squadra a zig-zag (una sinusoide); si abbattono sparando.

### Boss
Quando il boss si avvicina la squadra **si ferma** e lo affronta. Il boss avanza, lancia i suoi
attacchi da lontano e, quando arriva a contatto, morde a intervalli regolari. Un boss
abbattuto in fretta vale un bonus.

## 9. Bilanciare un gioco con i bot

Come si fa a sapere se un livello è troppo facile o impossibile? Giocarlo cento volte è lento
e soggettivo. La soluzione adottata: **bot** che giocano da soli, migliaia di partite in pochi
secondi, grazie alla simulazione separata dalla grafica.

- `smartBot`: schiva i lanci, sceglie il gate migliore, prende le armi, rompe le casse
  che riesce a rompere in tempo;
- `randomBot`: sceglie i gate a caso;
- `gatesOnlyBot`: sceglie bene i gate ma ignora il resto.

Il test `tests/balance.test.ts` fa giocare 20 partite per bot e per livello, e **fallisce** se
il bot attento vince meno dell'80% delle volte o quello casuale più del 20%.
Così ogni modifica che rompe l'equilibrio viene scoperta subito.

Strumenti di analisi più fini:

- **trace**: segue una partita entità per entità (soldati e potenza di fuoco dopo ogni gate,
  cassa, ondata) per capire *dove* un livello crolla;
- **tuner**: prova diversi moltiplicatori di difficoltà e mostra le percentuali di vittoria;
- **boss-tune**: cerca con una *ricerca binaria* la vita del boss che dà circa l'85% di vittorie.

### Cose scoperte grazie ai bot

- **L'effetto valanga.** I livelli erano o vinti con margini enormi o persi a un quarto del percorso.
  Il motivo: una cassa troppo robusta subito dopo un gate (restano ~2 secondi di fuoco) non si
  rompe, si perde il bonus e da lì tutto crolla. Regola: le prime casse devono essere rompibili
  con la potenza iniziale.
- **Il boss "troppo stretto".** Con molti soldati, i colpi sparati ai lati della formazione
  passavano accanto al boss. Il boss è stato reso più largo della formazione più ampia.
- **Il boss che si faceva male da solo.** Gli zombi che lanciava atterravano dietro di lui e i
  razzi che li colpivano esplodevano anche sul boss. Ora ciò che lancia cade tra lui e la squadra.
- **La gittata misurata male.** Un cambiamento apparentemente innocuo (gittata calcolata dal
  punto di sparo invece che dalla squadra) aveva reso tutto più difficile: il test l'ha rivelato subito.

> **Lezione**: il bot è più preciso di una persona. Un livello "vinto al 90% dal bot" per un
> umano è impegnativo: è proprio il livello di sfida cercato.

## 10. Punteggio e classifica arcade

Il punteggio è calcolato dal core (`computeScore` in `rules.ts`): zombi 10, bruti 50, casse 25,
massi e corvi 15, boss 2000, un **bonus velocità** fino a 3000 se il boss muore in fretta,
e 100 per ogni soldato vivo al traguardo.

A fine partita la `ResultScene` ricrea il rituale dei cabinati anni '80: i punti che scorrono,
l'inserimento delle **tre iniziali** con ▲▼ e la tabella **HIGH SCORES** con la propria riga che
lampeggia. Il font è *Press Start 2P*, ispirato ai caratteri dei giochi Namco.

La classifica è salvata nel browser (`localStorage`), ma è nascosta dietro un'**interfaccia**:

```ts
export interface HighscoreStore {
  list(level: number): Promise<ScoreEntry[]>;
  add(level: number, entry: ScoreEntry): Promise<number>;
}
```

È asincrona apposta: una futura classifica online condivisa sarà solo una seconda
implementazione (che parla con un server), senza cambiare il resto del gioco.

## 11. Suoni ed effetti

- I suoni vengono dai pacchetti audio di Kenney, in **OGG** con copia **MP3** per Safari/iOS
  (conversione con `ffmpeg`). Alcuni sono stati modificati: il ruggito del boss è un suono
  "viscido" rallentato e abbassato di tono.
- **Varianti e intonazione casuale**: ogni sparo sceglie tra più campioni e varia leggermente
  il tono, così non si sente sempre lo stesso suono.
- **Limite di frequenza** (*throttle*): con 10 proiettili a raffica, suonarli tutti creerebbe un
  rumore continuo; ogni suono ha un intervallo minimo tra una riproduzione e l'altra.
- Sui telefoni l'audio si attiva solo dopo il primo tocco (regola dei browser), cosa che
  Phaser gestisce da solo. Il muto viene ricordato tra una partita e l'altra.

## 12. PWA: un sito che diventa un'app

Una **Progressive Web App** è un sito che il browser può installare come un'app:

- il **manifest** (`manifest.webmanifest`) descrive nome, icone, colori, schermo intero e
  orientamento verticale;
- il **service worker** (generato da Workbox) salva tutti i file del gioco (codice, grafica,
  suoni, font: circa 2 MB) e li serve anche senza connessione;
- le **icone** nelle varie misure sono generate da un unico SVG (`public/icon.svg`).

Requisito importante: l'installazione funziona solo su **HTTPS** (o su `localhost`).
Per questo serviva una pubblicazione vera, non bastava aprire il gioco dal PC in rete locale.

## 13. Pubblicazione con GitHub Actions e Pages

Il file `.github/workflows/deploy.yml` descrive cosa fa GitHub a ogni `git push` su `master`:

1. scarica il codice e installa le dipendenze (`npm ci`);
2. esegue **tutti i test**, compreso il bilanciamento: se qualcosa è rotto, il gioco non viene pubblicato;
3. compila (`npm run build`) nella cartella `dist/`;
4. pubblica `dist/` su **GitHub Pages**.

Due dettagli da ricordare:

- in Vite, `base: './'` rende i percorsi relativi, perché il sito vive in una sottocartella
  (`nispa.github.io/horde-runner/`);
- in *Settings → Pages* del repository la sorgente dev'essere **"GitHub Actions"**. Con
  "Deploy from a branch" GitHub pubblicherebbe i file sorgente invece del gioco compilato
  (e la pagina resterebbe vuota).

## 14. Risorse e licenze

| Risorsa | Autore | Licenza | Uso |
|---|---|---|---|
| *Top-down Shooter* | Kenney.nl | CC0 | soldati, zombi, terreni, casse, rocce, macchie |
| *Impact Sounds* | Kenney.nl | CC0 | colpi sul legno, casse, tonfi, pugni |
| *Interface Sounds* | Kenney.nl | CC0 | gate, raccolta armi, conferme |
| *Sci-fi Sounds* | Kenney.nl | CC0 | spari, razzi, esplosioni, fruscii |
| *Music Jingles* | Kenney.nl | CC0 | jingle di vittoria e sconfitta |
| *Press Start 2P* | CodeMan38 | SIL OFL 1.1 | font arcade |

**CC0** significa pubblico dominio: si può usare anche in progetti commerciali senza obbligo di
citazione (citare l'autore è comunque una buona abitudine). **OFL** permette di usare e
distribuire il font liberamente insieme al gioco. I file di licenza sono in
`public/assets/**/License*.txt` e `public/fonts/OFL.txt`.

## 15. Come è stato sviluppato: il ruolo dell'intelligenza artificiale

Il gioco è stato realizzato in una serie di sessioni con **Claude Code**, un assistente di
programmazione basato su intelligenza artificiale, guidato dalle richieste e dalle prove di
gioco dell'autore. In pratica:

- l'autore ha definito l'idea, le priorità e le scelte di gioco ("le casse devono rompersi solo
  quando entrano nell'inquadratura", "gli zombi non devono poter essere evitati senza conseguenze",
  "un'arma come in *1943*", "una classifica come nei cabinati");
- l'assistente ha proposto l'architettura, scritto il codice e i test, scelto e preparato le
  risorse grafiche e sonore, costruito gli strumenti di bilanciamento e verificato il gioco nel browser;
- ogni passo è stato **provato giocando**: molte correzioni sono nate da osservazioni dell'autore
  durante le partite.

Un metodo che ha funzionato: **misurare invece di indovinare**. Quando un numero non convinceva
(la vita di un boss, la forza di un'arma), invece di cambiarlo "a occhio" si è misurato con i bot.

## 16. Idee ed esercizi per continuare

Dal più semplice al più impegnativo:

1. **Crea un livello tuo**: aggiungi una funzione `dump(...)` in `tools/levels/make_levels.py`,
   rigenera, aggiungi il file a `src/data/campaign.ts` e verifica con `npm test` che sia bilanciato.
2. **Una nuova arma**: aggiungi una voce in `data/weapons.json` (ad esempio un "Tri-shot" con
   `pellets: 3` e `spread` ampio, in stile *1943*) e il suo colore/proiettile nel renderer.
3. **Un nuovo nemico che lancia**: un nuovo `HazardKind` in `core/types.ts`, la sua fisica in
   `core/hazards.ts`, il disegno in `GameScene`, un test in `tests/core.test.ts`.
4. **Classifica online**: una seconda implementazione di `HighscoreStore` con un piccolo servizio
   (ad esempio Supabase o un Cloudflare Worker) e un controllo di plausibilità dei punteggi.
5. **Il salto in 3D**: un nuovo renderer con Three.js che legge lo stesso `Game`. Il core e i
   dati restano identici: è la prova definitiva che l'architettura funziona.
