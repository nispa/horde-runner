// Registro degli shader pack (vedi types.ts per l'interfaccia e ../catalog.ts per nomi e descrizioni).
import { nonePack } from './none';
import type { ShaderPack } from './types';

const PACKS: Record<string, ShaderPack> = {
  none: nonePack,
};

export function getShaderPack(id: string): ShaderPack {
  return PACKS[id] ?? nonePack;
}
