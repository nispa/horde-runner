// Registro dei pacchetti modelli. Per aggiungerne uno: implementare ModelPack, registrarlo qui
// e aggiungere nome e descrizione in ../catalog.ts (così compare nel menu Opzioni).
import { MixedPack } from './mixed';
import type { ModelPack } from './types';
import { VoxelPack } from './voxel';

const PACKS: Record<string, () => ModelPack> = {
  voxel: () => new VoxelPack(),
  mixed: () => new MixedPack(),
};

export function createModelPack(id: string): ModelPack {
  return (PACKS[id] ?? PACKS.voxel)();
}
