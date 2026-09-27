// Avvio con il renderer Canvas 2D (versione prototipo, step 1).
import { Game } from '../../core/game';
import type { LevelDef } from '../../core/types';
import { bindInput } from '../../platform/input';
import { CanvasRenderer } from './canvasRenderer';

const FIXED_DT = 1 / 60;

export function startCanvas(level: LevelDef, parent: HTMLElement): void {
  const canvas = document.createElement('canvas');
  parent.appendChild(canvas);
  const renderer = new CanvasRenderer(canvas);
  let game = new Game(level, Date.now());

  bindInput(canvas, {
    onSteer: clientX => game.steerTo(renderer.screenToLaneX(clientX)),
    onNudge: dir => game.steerTo(game.player.targetX + dir * 0.04),
    onTap: () => {
      if (game.status !== 'playing') {
        game = new Game(level, Date.now());
        renderer.reset();
      }
    },
  });

  let last = performance.now();
  let acc = 0;
  function frame(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    // Passo fisso: la simulazione è identica a qualsiasi frame rate.
    while (acc >= FIXED_DT) {
      game.step(FIXED_DT);
      acc -= FIXED_DT;
    }
    renderer.render(game, game.drainEvents(), dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
