// Texture per il 3D: ritagli del tilesheet Kenney (pixel nitidi, stile Minecraft) e testi su canvas.
import * as THREE from 'three';

const TILE = 64;
const SHEET_COLUMNS = 27;
let sheet: HTMLImageElement | null = null;

/** Carica una volta il tilesheet Kenney (lo stesso usato dal 2D). */
export async function loadTileSheet(url = 'assets/kenney/tiles.png'): Promise<void> {
  if (sheet) return;
  const img = new Image();
  img.src = url;
  await img.decode();
  sheet = img;
}

const tileCache = new Map<number, THREE.Texture>();

/** Texture di un singolo tile (numero di frame nella griglia 27×20), ripetibile e senza sfocatura. */
export function tileTexture(frame: number): THREE.Texture {
  const cached = tileCache.get(frame);
  if (cached) return cached;
  if (!sheet) throw new Error('Tilesheet non caricato: chiamare loadTileSheet() prima');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE;
  canvas.getContext('2d')!.drawImage(sheet, (frame % SHEET_COLUMNS) * TILE, Math.floor(frame / SHEET_COLUMNS) * TILE, TILE, TILE, 0, 0, TILE, TILE);
  const tex = pixelated(new THREE.CanvasTexture(canvas));
  tileCache.set(frame, tex);
  return tex;
}

export function pixelated<T extends THREE.Texture>(tex: T): T {
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Asfalto con bordi bianchi e linea tratteggiata: una "piastrella" che si ripete lungo la strada. */
export function roadTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#484848';
  g.fillRect(0, 0, 128, 64);
  // Un po' di "grana" a pixel per non avere una superficie piatta.
  for (let i = 0; i < 180; i++) {
    g.fillStyle = Math.random() < 0.5 ? '#424242' : '#4f4f4f';
    g.fillRect(Math.floor(Math.random() * 64) * 2, Math.floor(Math.random() * 32) * 2, 2, 2);
  }
  g.fillStyle = '#dddddd';
  g.fillRect(0, 0, 3, 64);
  g.fillRect(125, 0, 3, 64);
  g.fillRect(63, 0, 2, 32);
  return pixelated(new THREE.CanvasTexture(c));
}

export interface TextTexture {
  texture: THREE.CanvasTexture;
  /** Ridisegna il testo (solo se è cambiato). */
  set(text: string): void;
  aspect: number;
}

/** Testo in font arcade su canvas, per gate, vita delle casse, etichette. */
export function textTexture(text: string, opts: { width?: number; height?: number; color?: string; bg?: string; size?: number } = {}): TextTexture {
  const { width = 256, height = 128, color = '#ffffff', bg = 'transparent', size = 56 } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  let current = '';
  const set = (t: string) => {
    if (t === current) return;
    current = t;
    g.clearRect(0, 0, width, height);
    if (bg !== 'transparent') {
      g.fillStyle = bg;
      g.fillRect(0, 0, width, height);
    }
    g.font = `${size}px "Press Start 2P", monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = size / 5;
    g.strokeStyle = '#000000';
    g.strokeText(t, width / 2, height / 2 + size * 0.06);
    g.fillStyle = color;
    g.fillText(t, width / 2, height / 2 + size * 0.06);
    texture.needsUpdate = true;
  };
  set(text);
  return { texture, set, aspect: width / height };
}

/** Sprite (sempre rivolto alla telecamera) con testo; `height` in metri. */
export function textSprite(text: string, height: number, opts: Parameters<typeof textTexture>[1] = {}): { sprite: THREE.Sprite; set: (t: string) => void } {
  const tt = textTexture(text, opts);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tt.texture, depthWrite: false, transparent: true }));
  sprite.scale.set(height * tt.aspect, height, 1);
  return { sprite, set: tt.set };
}
