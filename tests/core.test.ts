// Test del core senza grafica: dimostrano che la logica è indipendente dal renderer.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { applyGate, computeScore, FIRE_RANGE } from '../src/core/rules';
import type { LevelDef } from '../src/core/types';

const base: Omit<LevelDef, 'entities'> = {
  name: 'test', length: 100, playerSpeed: 10,
  start: { soldiers: 10, fireRate: 1, damage: 1 },
};

function run(game: Game, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) game.step(1 / 60);
}

describe('rules', () => {
  it('applica le operazioni dei gate', () => {
    expect(applyGate(10, { op: '+', value: 5 })).toBe(15);
    expect(applyGate(10, { op: 'x', value: 3 })).toBe(30);
    expect(applyGate(3, { op: '-', value: 5 })).toBe(0);
    expect(applyGate(7, { op: '/', value: 2 })).toBe(3);
  });
});

describe('Game', () => {
  it('sceglie il gate in base al lato della lane', () => {
    const level: LevelDef = { ...base, entities: [
      { type: 'gate', z: 5, left: { op: '+', value: 5 }, right: { op: 'x', value: 3 } },
    ] };
    const left = new Game(level);
    left.steerTo(-0.8);
    run(left, 1);
    expect(left.player.soldiers).toBe(15);

    const right = new Game(level);
    right.steerTo(0.8);
    run(right, 1);
    expect(right.player.soldiers).toBe(30);
  });

  it('abbattere un muro dà la ricompensa', () => {
    const level: LevelDef = { ...base, playerSpeed: 1, start: { soldiers: 10, fireRate: 5, damage: 1 }, entities: [
      { type: 'wall', z: 10, x: 0, width: 1, hp: 20, crashCost: 5, reward: { kind: 'soldiers', value: 7 } },
    ] };
    const g = new Game(level);
    run(g, 3);
    expect(g.walls[0].destroyed).toBe(true);
    expect(g.player.soldiers).toBe(17);
  });

  it('schiantarsi contro un muro costa soldati', () => {
    const level: LevelDef = { ...base, start: { soldiers: 10, fireRate: 0.01, damage: 0 }, entities: [
      { type: 'wall', z: 5, x: 0, width: 1, hp: 999, crashCost: 4, reward: { kind: 'soldiers', value: 1 } },
    ] };
    const g = new Game(level);
    run(g, 1);
    expect(g.player.soldiers).toBe(6);
  });

  it("un'orda troppo forte fa perdere la partita", () => {
    const level: LevelDef = { ...base, start: { soldiers: 2, fireRate: 1, damage: 0 }, entities: [
      { type: 'wave', z: 20, count: 30, hp: 100, speed: 3, spread: 0.1 },
    ] };
    const g = new Game(level);
    run(g, 5);
    expect(g.status).toBe('lost');
  });

  it('i muri oltre la portata di tiro non si danneggiano', () => {
    const level: LevelDef = { ...base, playerSpeed: 0, start: { soldiers: 50, fireRate: 10, damage: 5 }, entities: [
      { type: 'wall', z: FIRE_RANGE + 2, x: 0, width: 1, hp: 10, crashCost: 1, reward: { kind: 'soldiers', value: 1 } },
    ] };
    const g = new Game(level);
    run(g, 3);
    expect(g.walls[0].hp).toBe(10);
  });

  it('i bruti uccidono più soldati', () => {
    const level: LevelDef = { ...base, start: { soldiers: 20, fireRate: 1, damage: 0 }, entities: [
      { type: 'wave', z: 10, count: 1, hp: 100, speed: 1, spread: 0, bite: 6 },
    ] };
    const g = new Game(level);
    run(g, 3);
    expect(g.player.soldiers).toBe(14);
  });
});

describe('armi', () => {
  it("si raccoglie l'arma solo passandoci sopra", () => {
    const level: LevelDef = { ...base, entities: [{ type: 'weapon', z: 5, x: 0.5, weapon: 'shotgun' }] };
    const on = new Game(level);
    on.steerTo(0.5);
    run(on, 1);
    expect(on.player.weapon).toBe('shotgun');

    const off = new Game(level);
    off.steerTo(-0.6);
    run(off, 1);
    expect(off.player.weapon).toBe('rifle');
  });

  it('il fucile a pompa non arriva ai muri lontani', () => {
    const level: LevelDef = { ...base, playerSpeed: 0, start: { soldiers: 30, fireRate: 5, damage: 3, weapon: 'shotgun' }, entities: [
      { type: 'wall', z: 20, x: 0, width: 1, hp: 50, crashCost: 1, reward: { kind: 'soldiers', value: 1 } },
    ] };
    const g = new Game(level);
    run(g, 3);
    expect(g.walls[0].hp).toBe(50);
  });

  it('il razzo colpisce più zombi con una sola esplosione', () => {
    const level: LevelDef = { ...base, playerSpeed: 0, start: { soldiers: 1, fireRate: 1, damage: 50, weapon: 'rocket' }, entities: [
      { type: 'wave', z: 10, count: 6, hp: 5, speed: 0, spread: 0.05 },
    ] };
    const g = new Game(level);
    let explosions = 0;
    for (let t = 0; t < 1.5; t += 1 / 60) {
      g.step(1 / 60);
      explosions += g.drainEvents().filter(e => e.kind === 'explosion').length;
    }
    expect(explosions).toBe(1);
    expect(g.kills).toBeGreaterThan(1);
  });
});

describe('boss', () => {
  const bossLevel = (hp: number): LevelDef => ({ ...base, length: 60, start: { soldiers: 20, fireRate: 5, damage: 1 }, entities: [
    { type: 'boss', z: 40, name: 'Test', hp, speed: 1, bite: 4 },
  ] });

  it('la squadra si ferma finché il boss è vivo', () => {
    const g = new Game(bossLevel(1e9));
    run(g, 6);
    expect(g.bossFight).toBe(true);
    const z = g.player.z;
    run(g, 1);
    expect(g.player.z).toBe(z);
  });

  it('un boss troppo forte divora la squadra', () => {
    const g = new Game(bossLevel(1e9));
    run(g, 30);
    expect(g.status).toBe('lost');
  });

  it('abbattuto il boss si arriva al traguardo', () => {
    const g = new Game(bossLevel(200));
    run(g, 20);
    expect(g.boss?.dead).toBe(true);
    expect(g.status).toBe('won');
  });
});

describe('HUD', () => {
  it('conta orde e zombi rimasti', () => {
    const level: LevelDef = { ...base, playerSpeed: 0, start: { soldiers: 10, fireRate: 20, damage: 50 }, entities: [
      { type: 'wave', z: 10, count: 3, hp: 1, speed: 0, spread: 0 },
      { type: 'wave', z: 14, count: 1, hp: 1, speed: 0, spread: 0, bite: 5 },
      { type: 'wave', z: 80, count: 4, hp: 1, speed: 0, spread: 0 },
    ] };
    const g = new Game(level);
    expect(g.totalHordes).toBe(2);
    expect(g.hordesLeft).toBe(2);
    expect(g.zombiesLeft).toBe(8);
    run(g, 3);
    expect(g.hordesLeft).toBe(1);
    expect(g.zombiesLeft).toBe(4);
  });
});

describe('punteggio', () => {
  it('somma zombi, bruti, casse, boss e sopravvissuti', () => {
    const r = computeScore({ zombies: 10, brutes: 2, crates: 1, bossKilled: true, bossSeconds: 4, survivors: 30 });
    expect(r.total).toBe(10 * 10 + 2 * 50 + 25 + 2000 + (3000 - 4 * 150) + 30 * 100);
  });

  it('una partita vinta assegna i sopravvissuti, una persa no', () => {
    const won = new Game({ ...base, length: 10, entities: [] });
    run(won, 2);
    expect(won.status).toBe('won');
    expect(won.score).toBe(10 * 100);

    const lost = new Game({ ...base, start: { soldiers: 1, fireRate: 1, damage: 0 }, entities: [
      { type: 'wave', z: 10, count: 5, hp: 100, speed: 3, spread: 0 },
    ] });
    run(lost, 5);
    expect(lost.status).toBe('lost');
    expect(lost.score).toBe(0);
  });
});
