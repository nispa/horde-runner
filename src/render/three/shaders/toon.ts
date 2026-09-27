// Shader pack "Cartoon": colori a fasce e contorni neri.
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { composerPipeline, ToonShader } from './effects';
import type { ShaderPack } from './types';

export const toonPack: ShaderPack = {
  id: 'toon',
  create(ctx) {
    const toon = new ShaderPass(ToonShader);
    const pr = ctx.renderer.getPixelRatio();
    return composerPipeline(ctx, [new RenderPass(ctx.scene, ctx.camera), toon], undefined,
      (w, h) => toon.uniforms.resolution.value.set(w * pr, h * pr));
  },
};
