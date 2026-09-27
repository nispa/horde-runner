// Pacchetto "misto": personaggi voxel + oggetti di scena Kenney 3D (low-poly, GLB, CC0) ai lati della strada.
// Ogni modello è disegnato con InstancedMesh: centinaia di alberi uguali costano pochi draw call.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { LevelTheme } from '../../../core/types';
import { ROAD_HALF } from './types';
import { VoxelPack } from './voxel';

interface PropDef {
  /** Percorso sotto assets/kenney3d/ senza estensione. */
  file: string;
  /** Altezza desiderata in metri (il modello viene scalato di conseguenza). */
  height: number;
  /** Probabilità relativa di comparire. */
  weight: number;
}

const n = (file: string, height: number, weight = 1): PropDef => ({ file: `nature/${file}`, height, weight });
const g = (file: string, height: number, weight = 1): PropDef => ({ file: `graveyard/${file}`, height, weight });

/** Oggetti di scena per ambiente: natura e cimitero si mescolano per un'atmosfera "zombie". */
const THEME_PROPS: Record<LevelTheme, PropDef[]> = {
  grass: [
    n('tree_oak', 5, 3), n('tree_default', 4.5, 3), n('tree_detailed', 5, 2), n('plant_bushLarge', 1.2, 2),
    n('rock_largeA', 1.2), n('stump_round', 0.6), n('flower_redA', 0.5, 2),
    g('gravestone-round', 1.1, 2), g('gravestone-cross', 1.4, 1), g('fence-damaged', 1.1), g('pumpkin', 0.6), g('lightpost-single', 3.2),
  ],
  dirt: [
    n('tree_fat_fall', 4.5, 3), n('tree_default_fall', 4.5, 3), n('log_stack', 1, 2), n('fence_simple', 1.1, 2), n('plant_bush', 1),
    g('hay-bale', 1.2, 3), g('pumpkin-carved', 0.7, 2), g('pumpkin', 0.6, 2), g('gravestone-round', 1.1),
  ],
  concrete: [
    g('stone-wall', 2, 3), g('stone-wall-damaged', 2, 3), g('iron-fence', 2, 2), g('pillar-large', 3), g('lightpost-double', 3.5, 2),
    g('debris', 0.8, 2), g('crypt-small', 3.5), g('urn-round', 1), n('rock_largeB', 1.3),
  ],
  sand: [
    n('cactus_tall', 3.5, 3), n('cactus_short', 1.8, 3), n('tree_palmTall', 6, 2), n('rock_tallA', 3, 2), n('rock_largeC', 1.5, 2),
    n('stump_old', 0.8), g('rocks', 1.2, 2), g('debris-wood', 0.6),
  ],
  snow: [
    n('tree_pineTallA', 6, 3), n('tree_pineRoundA', 4.5, 3), n('tree_pineDefaultA', 5, 3), n('rock_smallA', 0.6, 2), n('stone_largeA', 1.4, 2),
    g('pine', 5, 2), g('gravestone-cross-large', 1.8), g('lantern-candle', 0.9),
  ],
};

/** Modello pronto per l'instancing: le sue mesh con la trasformazione relativa alla radice, già scalata. */
interface PropModel { parts: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; local: THREE.Matrix4 }[] }

export class MixedPack extends VoxelPack {
  override readonly id: string = 'mixed';
  protected override voxelTrees = false;
  private models = new Map<string, PropModel>();

  constructor(private baseUrl = 'assets/kenney3d/') {
    super();
  }

  override async load(): Promise<void> {
    await super.load();
    const loader = new GLTFLoader();
    const defs = new Map(Object.values(THEME_PROPS).flat().map(d => [d.file, d]));
    await Promise.all([...defs.values()].map(async def => {
      try {
        const gltf = await loader.loadAsync(`${this.baseUrl}${def.file}.glb`);
        this.models.set(def.file, toPropModel(gltf.scene, def.height));
      } catch {
        // Un modello mancante non blocca il gioco: semplicemente non compare.
      }
    }));
  }

  override createScenery(theme: LevelTheme, length: number): THREE.Object3D {
    const group = new THREE.Group();
    group.add(super.createScenery(theme, length));
    const defs = THEME_PROPS[theme].filter(d => this.models.has(d.file));
    if (!defs.length) return group;
    const totalWeight = defs.reduce((a, d) => a + d.weight, 0);
    const placements = new Map<string, THREE.Matrix4[]>();
    let seed = 777;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const pick = () => {
      let r = rnd() * totalWeight;
      for (const d of defs) if ((r -= d.weight) <= 0) return d;
      return defs[defs.length - 1];
    };
    for (let z = -30; z < length + 80; z += 2.2) {
      for (const side of [-1, 1]) {
        if (rnd() > 0.55) continue;
        const def = pick();
        // Distanza dalla strada: gli oggetti bassi possono stare vicini, quelli alti più lontani.
        const minGap = def.height > 2.5 ? 2.5 : 0.8;
        const x = side * (ROAD_HALF + minGap + rnd() * 18);
        const s = 0.8 + rnd() * 0.4;
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(x, 0, -z - rnd() * 2),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2),
          new THREE.Vector3(s, s, s),
        );
        const list = placements.get(def.file) ?? [];
        list.push(m);
        placements.set(def.file, list);
      }
    }
    const tmp = new THREE.Matrix4();
    for (const [file, list] of placements) {
      for (const part of this.models.get(file)!.parts) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, list.length);
        list.forEach((m, i) => mesh.setMatrixAt(i, tmp.multiplyMatrices(m, part.local)));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    }
    return group;
  }
}

/** Estrae le mesh del modello con la loro trasformazione e le scala all'altezza desiderata (base a terra). */
function toPropModel(root: THREE.Object3D, height: number): PropModel {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const scale = height / Math.max(0.001, box.max.y - box.min.y);
  const fix = new THREE.Matrix4().makeScale(scale, scale, scale).multiply(new THREE.Matrix4().makeTranslation(0, -box.min.y, 0));
  const parts: PropModel['parts'] = [];
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    parts.push({ geometry: mesh.geometry, material: mesh.material, local: fix.clone().multiply(mesh.matrixWorld) });
  });
  return { parts };
}
