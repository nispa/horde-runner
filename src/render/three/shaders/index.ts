// Registro degli shader pack (vedi types.ts per l'interfaccia e ../catalog.ts per nomi e descrizioni).
import { cinemaPack } from './cinema';
import { nightPack } from './night';
import { nonePack } from './none';
import { retroPack } from './retro';
import { toonPack } from './toon';
import type { ShaderPack } from './types';

const PACKS: Record<string, ShaderPack> = {
  none: nonePack,
  toon: toonPack,
  retro: retroPack,
  cinema: cinemaPack,
  night: nightPack,
};

export function getShaderPack(id: string): ShaderPack {
  return PACKS[id] ?? nonePack;
}
