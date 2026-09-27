// Shader pack "Cinematico": bagliori sulle parti luminose (bloom), vignettatura e grana della pellicola.
import * as THREE from 'three';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { composerPipeline, VignetteGrainShader } from './effects';
import type { ShaderPack } from './types';

export const cinemaPack: ShaderPack = {
  id: 'cinema',
  create(ctx) {
    // Luce più calda e contrastata, da "ora d'oro".
    ctx.sun.color.set(0xffe2b8);
    ctx.sun.intensity = 2.6;
    ctx.ambient.intensity = 1.1;
    const bloom = new UnrealBloomPass(new THREE.Vector2(ctx.width, ctx.height), 0.55, 0.5, 0.82);
    const grade = new ShaderPass(VignetteGrainShader);
    grade.uniforms.tint.value.set(1.05, 1.0, 0.92);
    return composerPipeline(ctx, [new RenderPass(ctx.scene, ctx.camera), bloom, grade],
      time => { grade.uniforms.time.value = time % 100; },
      (w, h) => bloom.resolution.set(w, h));
  },
};
