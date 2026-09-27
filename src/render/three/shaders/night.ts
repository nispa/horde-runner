// Shader pack "Notte": cielo scuro, nebbia fitta, luce lunare azzurra, torce attorno alla squadra;
// proiettili ed esplosioni (colori accesi) brillano grazie al bloom. Atmosfera horror.
import * as THREE from 'three';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { composerPipeline, VignetteGrainShader } from './effects';
import type { ShaderPack } from './types';

export const nightPack: ShaderPack = {
  id: 'night',
  create(ctx) {
    const night = new THREE.Color(0x0a0f1e);
    ctx.scene.background = night;
    ctx.scene.fog = new THREE.Fog(night, 18, 55);
    ctx.sun.color.set(0x8fb0ff);
    ctx.sun.intensity = 1.3;
    ctx.ambient.color.set(0x5060a0);
    ctx.ambient.groundColor.set(0x181820);
    ctx.ambient.intensity = 1.0;
    // Le "torce" della squadra: un cerchio di luce calda attorno ai soldati.
    ctx.squadLight.intensity = 32;
    const bloom = new UnrealBloomPass(new THREE.Vector2(ctx.width, ctx.height), 0.8, 0.5, 0.82);
    const grade = new ShaderPass(VignetteGrainShader);
    grade.uniforms.vignette.value = 1.2;
    grade.uniforms.grain.value = 0.05;
    grade.uniforms.tint.value.set(0.85, 0.95, 1.15);
    return composerPipeline(ctx, [new RenderPass(ctx.scene, ctx.camera), bloom, grade],
      time => { grade.uniforms.time.value = time % 100; },
      (w, h) => bloom.resolution.set(w, h));
  },
};
