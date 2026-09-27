// Pacchetto modelli "Voxel": tutto a blocchi, in stile Minecraft, costruito dal codice (nessun file da scaricare).
// Le folle usano InstancedMesh: una mesh per parte del corpo, con tutte le istanze in un solo draw call.
import * as THREE from 'three';
import type { HazardKind, LevelTheme, WeaponId } from '../../../core/types';
import { loadTileSheet, tileTexture } from '../textures';
import { ROAD_HALF, type Crowd, type CrowdKind, type ModelPack, type Prop } from './types';

// --- Anatomia di un personaggio a blocchi (metri; origine ai piedi, sguardo verso −Z) ---

type PartName = 'legL' | 'legR' | 'body' | 'head' | 'eyes' | 'armL' | 'armR' | 'gun' | 'helmet';

interface PartDef {
  size: [number, number, number];
  /** Punto di rotazione (anca, spalla...) e posizione del blocco rispetto ad esso. */
  pivot: [number, number, number];
  offset: [number, number, number];
  /** Rotazione attorno all'asse X in funzione della fase di camminata. */
  swing: (walk: number) => number;
}

interface Palette { legs: number; body: number; skin: number; arms: number; eyes: number; gun?: number; helmet?: number }

const PALETTES: Record<CrowdKind | 'boss', Palette> = {
  soldier: { legs: 0x3b4a2a, body: 0x5a7a3a, skin: 0xe0b08a, arms: 0x5a7a3a, eyes: 0x1a1a1a, gun: 0x222222, helmet: 0x4a6a2a },
  zombie: { legs: 0x34406a, body: 0x3f8a8a, skin: 0x6cae4a, arms: 0x6cae4a, eyes: 0x300000 },
  brute: { legs: 0x4a2a2a, body: 0x8a2a2a, skin: 0x7a9a4a, arms: 0x7a9a4a, eyes: 0xff2020 },
  boss: { legs: 0x2a1a2a, body: 0x6a1a3a, skin: 0x8aa04a, arms: 0x8aa04a, eyes: 0xffd000 },
};

/** Parti del corpo: i soldati tengono il fucile, gli zombi allungano le braccia in avanti. */
function anatomy(armed: boolean): Record<PartName, PartDef | null> {
  const leg = (side: number): PartDef => ({
    size: [0.13, 0.42, 0.15], pivot: [side * 0.075, 0.42, 0], offset: [0, -0.21, 0],
    swing: w => Math.sin(w + (side > 0 ? Math.PI : 0)) * 0.7,
  });
  const arm = (side: number): PartDef => ({
    size: [0.11, 0.36, 0.13], pivot: [side * 0.215, 0.76, 0], offset: [0, -0.16, 0],
    // In avanti (rotazione negativa attorno a X porta il braccio verso −Z), con un leggero dondolio.
    swing: armed ? w => -1.35 + Math.sin(w) * 0.05 : w => -1.5 + Math.sin(w * 0.5 + side) * 0.15,
  });
  return {
    legL: leg(-1),
    legR: leg(1),
    body: { size: [0.32, 0.36, 0.18], pivot: [0, 0.6, 0], offset: [0, 0, 0], swing: () => 0 },
    head: { size: [0.27, 0.27, 0.27], pivot: [0, 0.92, 0], offset: [0, 0, 0], swing: () => 0 },
    eyes: { size: [0.19, 0.05, 0.02], pivot: [0, 0.95, 0], offset: [0, 0, -0.14], swing: () => 0 },
    armL: arm(-1),
    armR: arm(1),
    gun: armed ? { size: [0.07, 0.08, 0.46], pivot: [0.215, 0.76, 0], offset: [0, -0.02, -0.34], swing: () => 0 } : null,
    // Elmetto: dall'alto (vista isometrica) distingue la squadra dagli zombi.
    helmet: armed ? { size: [0.33, 0.12, 0.33], pivot: [0, 1.08, 0], offset: [0, 0, 0], swing: () => 0 } : null,
  };
}

function partColor(p: Palette, part: PartName): number {
  switch (part) {
    case 'legL': case 'legR': return p.legs;
    case 'body': return p.body;
    case 'head': return p.skin;
    case 'eyes': return p.eyes;
    case 'armL': case 'armR': return p.arms;
    case 'gun': return p.gun ?? 0x222222;
    case 'helmet': return p.helmet ?? p.body;
  }
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);

// Matrici di lavoro riusate per non allocare a ogni fotogramma.
const mBase = new THREE.Matrix4();
const mPart = new THREE.Matrix4();
const mTmp = new THREE.Matrix4();
const mLocal = new THREE.Matrix4();
const vPos = new THREE.Vector3();
const qRot = new THREE.Quaternion();
const vScale = new THREE.Vector3();
const eul = new THREE.Euler();
const color = new THREE.Color();
const WHITE = new THREE.Color(1, 1, 1);

/** Matrice locale di una parte: pivot → rotazione di camminata → posizione del blocco → dimensioni. */
function partMatrix(def: PartDef, walk: number, out: THREE.Matrix4): THREE.Matrix4 {
  out.makeTranslation(def.pivot[0], def.pivot[1], def.pivot[2]);
  out.multiply(mTmp.makeRotationX(def.swing(walk)));
  out.multiply(mTmp.makeTranslation(def.offset[0], def.offset[1], def.offset[2]));
  return out.multiply(mTmp.makeScale(def.size[0], def.size[1], def.size[2]));
}

class VoxelCrowd implements Crowd {
  readonly object = new THREE.Group();
  private parts: { def: PartDef; mesh: THREE.InstancedMesh; color: THREE.Color }[] = [];

  constructor(kind: CrowdKind, max: number) {
    const palette = PALETTES[kind];
    const body = anatomy(kind === 'soldier');
    for (const [name, def] of Object.entries(body) as [PartName, PartDef | null][]) {
      if (!def) continue;
      const mesh = new THREE.InstancedMesh(unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff }), max);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.frustumCulled = false; // le istanze si muovono: il riquadro della mesh non è affidabile
      mesh.count = 0;
      this.object.add(mesh);
      this.parts.push({ def, mesh, color: new THREE.Color(partColor(palette, name)) });
    }
  }

  set(i: number, x: number, z: number, facing: number, scale: number, walk: number, tint = WHITE): void {
    mBase.compose(vPos.set(x, 0, z), qRot.setFromEuler(eul.set(0, facing, 0)), vScale.set(scale, scale, scale));
    for (const p of this.parts) {
      p.mesh.setMatrixAt(i, mPart.multiplyMatrices(mBase, partMatrix(p.def, walk, mLocal)));
      p.mesh.setColorAt(i, color.copy(p.color).multiply(tint));
    }
  }

  setCount(n: number): void {
    for (const p of this.parts) p.mesh.count = n;
  }

  commit(): void {
    for (const p of this.parts) {
      p.mesh.instanceMatrix.needsUpdate = true;
      if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const p of this.parts) (p.mesh.material as THREE.Material).dispose();
  }
}

/** Personaggio singolo (non istanziato), per boss e zombi lanciati. */
function characterGroup(palette: Palette, armed: boolean, horns = false): { group: THREE.Group; animate: (walk: number) => void } {
  const group = new THREE.Group();
  const meshes: { def: PartDef; mesh: THREE.Mesh }[] = [];
  for (const [name, def] of Object.entries(anatomy(armed)) as [PartName, PartDef | null][]) {
    if (!def) continue;
    const mesh = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: partColor(palette, name) }));
    mesh.matrixAutoUpdate = false;
    mesh.castShadow = true;
    group.add(mesh);
    meshes.push({ def, mesh });
  }
  if (horns) {
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: 0xe8e0c0 }));
      horn.scale.set(0.06, 0.16, 0.06);
      horn.position.set(side * 0.11, 1.12, 0);
      horn.rotation.z = -side * 0.35;
      group.add(horn);
    }
  }
  const animate = (walk: number) => {
    for (const m of meshes) m.mesh.matrix.copy(partMatrix(m.def, walk, new THREE.Matrix4()));
  };
  animate(0);
  return { group, animate };
}

const WEAPON_COLORS: Record<WeaponId, number> = { rifle: 0x9aa4b2, minigun: 0x3fd0ff, shotgun: 0xff9a3c, rocket: 0xff5a5a };

/** Frame del tilesheet Kenney per ogni tema (gli stessi del 2D) e per la cassa. */
export const THEME_FRAME: Record<LevelTheme, number> = { grass: 0, dirt: 4, concrete: 6, snow: 11, sand: 14 };
const CRATE_FRAME = 128;

export class VoxelPack implements ModelPack {
  readonly id: string = 'voxel';

  async load(): Promise<void> {
    await loadTileSheet();
  }

  createCrowd(kind: CrowdKind, max: number): Crowd {
    return new VoxelCrowd(kind, max);
  }

  createBoss(): Prop {
    const { group, animate } = characterGroup(PALETTES.boss, false, true);
    return { object: group, animate: (_t, walk = 0) => animate(walk), dispose: () => disposeTree(group) };
  }

  createHazard(kind: HazardKind): Prop {
    if (kind === 'zombie') {
      const { group } = characterGroup(PALETTES.zombie, false);
      return { object: group, dispose: () => disposeTree(group) };
    }
    if (kind === 'crow') return crow();
    // Roccia e masso: un blocco di pietra (il masso è più grosso e marrone).
    const boulder = kind === 'boulder';
    const mesh = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ map: tileTexture(THEME_FRAME.concrete), color: boulder ? 0xb08060 : 0xaaaaaa }));
    mesh.scale.setScalar(boulder ? 1.1 : 0.5);
    mesh.castShadow = true;
    return { object: mesh, dispose: () => (mesh.material as THREE.Material).dispose() };
  }

  createPickup(weapon: WeaponId): Prop {
    const c = WEAPON_COLORS[weapon];
    const group = new THREE.Group();
    const cube = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.5 }));
    cube.scale.setScalar(0.6);
    cube.position.y = 1;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.9, 24), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    group.add(cube, ring);
    return {
      object: group,
      animate: t => { cube.rotation.y = t * 2; cube.position.y = 1 + Math.sin(t * 4) * 0.15; ring.scale.setScalar(1 + Math.sin(t * 6) * 0.1); },
      dispose: () => disposeTree(group),
    };
  }

  createCrate(size: number): Prop {
    const mesh = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ map: tileTexture(CRATE_FRAME) }));
    mesh.scale.setScalar(size);
    mesh.position.y = size / 2;
    mesh.castShadow = mesh.receiveShadow = true;
    return { object: mesh, dispose: () => (mesh.material as THREE.Material).dispose() };
  }

  /** Terreno a blocchi ai lati della strada, con qualche rilievo e alberi voxel. */
  createScenery(theme: LevelTheme, length: number): THREE.Object3D {
    const group = new THREE.Group();
    const width = 26; // metri di terreno per lato (la vista isometrica inquadra molto ai lati)
    const zFrom = -30;
    const zTo = length + 80;
    const blocks: [number, number, number][] = [];
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let z = zFrom; z < zTo; z++) {
      for (let i = 0; i < width; i++) {
        for (const side of [-1, 1]) {
          const x = side * (ROAD_HALF + 0.5 + i);
          // Più ci si allontana dalla strada, più il terreno sale (colline a gradini).
          const h = i > 3 && rnd() < 0.08 + i * 0.03 ? 1 : 0;
          blocks.push([x, h - 0.5, -z]);
        }
      }
    }
    const ground = new THREE.InstancedMesh(unitBox, new THREE.MeshLambertMaterial({ map: tileTexture(THEME_FRAME[theme]) }), blocks.length);
    blocks.forEach(([x, y, z], i) => ground.setMatrixAt(i, mBase.makeTranslation(x, y, z)));
    ground.receiveShadow = true;
    group.add(ground);
    if (this.voxelTrees) group.add(voxelTrees(theme, zFrom, zTo, rnd));
    return group;
  }

  /** Il pacchetto "misto" sostituisce gli alberi voxel con oggetti di scena Kenney 3D. */
  protected voxelTrees = true;
}

function voxelTrees(theme: LevelTheme, zFrom: number, zTo: number, rnd: () => number): THREE.Object3D {
  const trunks: THREE.Matrix4[] = [];
  const leaves: THREE.Matrix4[] = [];
  for (let z = zFrom; z < zTo; z += 3) {
    for (const side of [-1, 1]) {
      if (rnd() > 0.35) continue;
      const x = side * (ROAD_HALF + 3 + Math.floor(rnd() * 20));
      const h = 2 + Math.floor(rnd() * 2);
      for (let y = 0; y < h; y++) trunks.push(new THREE.Matrix4().makeTranslation(x, y + 0.5, -z));
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy < 2; dy++) {
        if (dy === 1 && Math.abs(dx) + Math.abs(dz) === 2) continue; // chioma arrotondata
        leaves.push(new THREE.Matrix4().makeTranslation(x + dx, h + dy + 0.5, -z + dz));
      }
    }
  }
  const leafColor = theme === 'snow' ? 0xe8f0f0 : theme === 'sand' ? 0x9aa040 : 0x3a8a3a;
  const group = new THREE.Group();
  const trunk = new THREE.InstancedMesh(unitBox, new THREE.MeshLambertMaterial({ color: 0x6a4a2a }), trunks.length);
  trunks.forEach((m, i) => trunk.setMatrixAt(i, m));
  const leaf = new THREE.InstancedMesh(unitBox, new THREE.MeshLambertMaterial({ color: leafColor }), leaves.length);
  leaves.forEach((m, i) => leaf.setMatrixAt(i, m));
  trunk.castShadow = leaf.castShadow = true;
  group.add(trunk, leaf);
  return group;
}

function crow(): Prop {
  const black = new THREE.MeshLambertMaterial({ color: 0x151515 });
  const group = new THREE.Group();
  const body = new THREE.Mesh(unitBox, black);
  body.scale.set(0.16, 0.14, 0.4);
  const beak = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: 0xf0a020 }));
  beak.scale.set(0.06, 0.05, 0.12);
  beak.position.z = 0.25; // guarda verso la squadra (+Z)
  const wings = [-1, 1].map(side => {
    const pivot = new THREE.Group();
    const wing = new THREE.Mesh(unitBox, black);
    wing.scale.set(0.45, 0.03, 0.25);
    wing.position.x = side * 0.25;
    pivot.add(wing);
    group.add(pivot);
    return { pivot, side };
  });
  group.add(body, beak);
  return {
    object: group,
    animate: t => wings.forEach(w => { w.pivot.rotation.z = w.side * Math.sin(t * 18) * 0.7; }),
    dispose: () => disposeTree(group),
  };
}

/** Libera la memoria GPU di un oggetto e dei suoi figli (le texture dei tile sono condivise e restano). */
export function disposeTree(obj: THREE.Object3D): void {
  obj.traverse(o => {
    const m = (o as THREE.Mesh).material;
    for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
      // Le texture dei testi (sprite) sono uniche per oggetto: vanno liberate con il materiale.
      if ((mat as THREE.SpriteMaterial).isSpriteMaterial) (mat as THREE.SpriteMaterial).map?.dispose();
      mat.dispose();
    }
    // La geometria degli sprite è condivisa da Three.js e quella dei blocchi da tutto il pacchetto.
    const geo = (o as THREE.Mesh).geometry;
    if (geo && geo !== unitBox && !(o as THREE.Sprite).isSprite) geo.dispose();
  });
}
