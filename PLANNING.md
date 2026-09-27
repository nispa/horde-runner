# PLANNING — Horde Runner

Stato del progetto, decisioni prese e lavoro da fare. Per architettura e comandi: [AGENTS.md](AGENTS.md).
Ultimo aggiornamento: 2026-09-27.

## Obiettivo

Un gioco in stile pubblicità mobile ("crowd runner" con gate, casse, armi, orde e boss), costruito
a step partendo dal modello più semplice, con **logica e dati riutilizzabili** per motori futuri.
Per ora è ad uso personale; tra qualche giorno verrà pubblicato per farlo provare agli amici.

## Roadmap a step

| Step | Contenuto | Stato |
|---|---|---|
| 1 | Prototipo Canvas 2D, core separato dalla grafica | ✅ fatto |
| 2 | Renderer Phaser con sprite e suoni Kenney (CC0) | ✅ fatto |
| 3 | PWA installabile e giocabile offline, pubblicata su GitHub Pages | ✅ fatto |
| 4 | Vista 3D in prospettiva con Three.js (stesso core) | da fare |
| 5 | Eventuale porting in Unreal Engine (già installato) — JSON riusabili come DataTable | opzionale |

## Fatto finora

- **Gameplay**: gate, casse con ricompense (soldati / cadenza / danno), gittata limitata a ciò
  che è visibile (26 m su 32), potenza di fuoco meno che lineare (`soldati^0.75`).
- **Nemici**: zombi che inseguono lateralmente la squadra, bruti (più grossi, rossi, "morso"
  multiplo e braccia lunghe), ondate raggruppate in orde.
- **Armi** raccoglibili (`data/weapons.json`): fucile, mitragliatrice, fucile a pompa, lanciarazzi
  (danni ad area, extra contro casse e boss).
- **Boss** di fine livello: la squadra si ferma, il boss avanza e morde; barra vita, avviso, ruggito.
- **Lanci dei nemici** (`core/hazards.ts`): rocce a parabola con segnale a terra (bruti dal livello 2,
  Il Grosso), zombi lanciati (Il Macellaio), massi che rotolano (Il Colosso), corvi (La Belva),
  tutto insieme (Il Re dei Morti).
- **Campagna** di 5 livelli con terreni diversi, sblocco progressivo, menu di selezione.
- **HUD**: soldati, cadenza, danno, uccisioni, arma in uso, orde e zombi rimasti, punteggio.
- **Classifica arcade** locale: punteggio calcolato dal core, conteggio a fine partita,
  inserimento 3 iniziali, top 10 per livello, scena Classifiche; font Press Start 2P.
  Archivio dietro l'interfaccia `HighscoreStore` (pronta per una versione online).
- **Audio**: effetti Kenney con varianti e limite di frequenza; muto con tasto M / pulsante 🔊.
- **Strumenti**: bot, test di bilanciamento, tracce e tuner (vedi AGENTS.md).

## Bilanciamento attuale (riferimento)

Misurato con `smartBot` su 20 partite (vedi `npx vitest run balance --silent=false`):

| Livello | Terreno | Vita zombi | Boss (HP, attacco) | Bot attento | Bot casuale |
|---|---|---|---|---|---|
| 1 Periferia | erba | ×1 | Il Grosso (3500, rocce) | 90% | 0% |
| 2 Campagna | sterrato | ×0,6 | Il Macellaio (7000, zombi lanciati) | 100% | 0% |
| 3 Zona industriale | cemento | ×0,85 | Il Colosso (7500, massi) | 95% | 0% |
| 4 Deserto | sabbia | ×0,6 | La Belva (8500, veloce, corvi) | 100% | 0% |
| 5 Passo innevato | neve | ×0,85 | Il Re dei Morti (16000, tutto) | 90% | 0% |

- Il livello 1 era stato giudicato dall'utente "più difficile ma affrontabile" (prima di armi e boss):
  resta il riferimento di difficoltà per i nuovi livelli.
- Punteggi di esempio in classifica (primo posto): 12000 / 19000 / 16000 / 23000 / 32000
  (`platform/highscores.ts`), tarati sui punteggi tipici del bot attento.

## Decisioni prese (e perché)

- **Core indipendente dal motore**, coordinate astratte, eventi verso il renderer: per poter
  passare a Three.js/Unreal riscrivendo solo la grafica.
- **Phaser 4** invece di React per il gioco: il gioco vive in un canvas; React sarebbe servito solo per i menu.
- **Classifica prima locale**, online solo alla pubblicazione (GitHub Pages è statico: servirà un
  piccolo servizio esterno, es. Supabase o Cloudflare Worker, più un controllo di plausibilità).
- **Il boss è più largo della formazione** (`BOSS_RADIUS` 0.45 > 0.35): altrimenti i colpi laterali
  lo mancavano. **Il boss lancia solo da lontano** e ciò che lancia atterra tra lui e la squadra:
  altrimenti i razzi esplodevano sugli oggetti vicino al boss e lui "si faceva male da solo".
- **Zombi più aggressivi** (inseguono da 22 m) su richiesta dell'utente: prima si potevano aggirare
  senza conseguenze.
- Le armi sono **sidegrade di forza simile**: ogni livello resta vincibile qualunque arma si preferisca.

## Pubblicazione

- Repository: https://github.com/nispa/horde-runner (pubblico)
- Gioco online: **https://nispa.github.io/horde-runner/**
- A ogni push su `master` il workflow `.github/workflows/deploy.yml` esegue test e build e pubblica
  `dist/` (GitHub Pages con sorgente "GitHub Actions", non "Deploy from a branch").

## Prossimi passi (backlog, in ordine di priorità indicativa)

1. **Tri-shot in stile "1943"** (richiesta dell'utente): arma con colpo dritto + due diagonali;
   eventuale livello di potenziamento raccogliendo più volte la stessa arma.
2. **Classifica online** condivisa: seconda implementazione di `HighscoreStore` + servizio esterno.
3. Rifinitura: testi nitidi su schermi ad alta densità (scala del canvas), musica di sottofondo,
   eventuale icona/aspetto delle armi sugli sprite dei soldati.
4. **Step 4**: renderer Three.js con vista in prospettiva.

## Note e problemi noti

- I suoni sono stati scelti senza poterli ascoltare (per nome e analisi del tono): da verificare a orecchio.
- I trofei del menu per i livelli 1–2 dell'utente possono contenere valori del vecchio sistema
  (soldati invece di punti): si aggiornano alla prossima vittoria.
- I record fatti dall'utente prima delle ultime ritarature non sono confrontabili con i nuovi punteggi.
- Test nel browser: leggere la sezione dedicata in AGENTS.md (dati reali dell'utente in localStorage).
