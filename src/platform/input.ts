// Input di piattaforma (mouse, touch, tastiera) tradotto in comandi astratti.

export interface InputHandlers {
  /** Posizione desiderata nella lane (-1..1) a partire dalla X dello schermo. */
  onSteer(clientX: number, clientY: number): void;
  /** Spostamento relativo da tastiera (-1 sinistra, +1 destra). */
  onNudge(direction: number): void;
  onTap(): void;
}

export function bindInput(target: HTMLElement, h: InputHandlers): () => void {
  const keys = new Set<string>();

  const down = (e: PointerEvent) => {
    target.setPointerCapture(e.pointerId);
    h.onTap();
    h.onSteer(e.clientX, e.clientY);
  };
  const move = (e: PointerEvent) => {
    // Col mouse si segue sempre il cursore; col dito solo mentre è appoggiato.
    if (e.pointerType === 'mouse' || e.buttons > 0) h.onSteer(e.clientX, e.clientY);
  };
  const keyDown = (e: KeyboardEvent) => {
    keys.add(e.key);
    if (e.key === ' ' || e.key === 'Enter') h.onTap();
  };
  const keyUp = (e: KeyboardEvent) => keys.delete(e.key);

  let raf = 0;
  const pollKeys = () => {
    const dir = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
    if (dir) h.onNudge(dir);
    raf = requestAnimationFrame(pollKeys);
  };

  target.addEventListener('pointerdown', down);
  target.addEventListener('pointermove', move);
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  raf = requestAnimationFrame(pollKeys);

  return () => {
    target.removeEventListener('pointerdown', down);
    target.removeEventListener('pointermove', move);
    window.removeEventListener('keydown', keyDown);
    window.removeEventListener('keyup', keyUp);
    cancelAnimationFrame(raf);
  };
}
