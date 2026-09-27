// Test del core senza grafica: dimostrano che la logica è indipendente dal renderer.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { applyGate, FIRE_RANGE } from '../src/core/rules';
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
