// Shader pack "Retrò pixel": la scena è disegnata a bassa risoluzione (pixel grossi) con bordi
// evidenziati, poi i colori sono ridotti a una piccola palette.
import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { composerPipeline, PaletteShader } from './effects';
import type { ShaderPack } from './types';

export const retroPack: ShaderPack = {
  id: 'retro',
  create(ctx) {
    const pixels = new RenderPixelatedPass(4, ctx.scene, ctx.camera, { normalEdgeStrength: 0.4, depthEdgeStrength: 0.5 });
    return composerPipeline(ctx, [pixels, new ShaderPass(PaletteShader)]);
  },
};
