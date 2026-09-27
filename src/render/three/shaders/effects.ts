// Shader di post-produzione scritti per il gioco (GLSL) e un aiuto per montare le catene di effetti.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import type { ShaderContext, ShaderPipeline } from './types';

/** Colori "a fasce" (posterizzazione) e contorni neri dove il colore cambia bruscamente (Sobel). */
export const ToonShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
    levels: { value: 6.0 },
    edge: { value: 0.25 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float levels;
    uniform float edge;
    varying vec2 vUv;
    float lum(vec2 uv) { return dot(texture2D(tDiffuse, uv).rgb, vec3(0.299, 0.587, 0.114)); }
    void main() {
      vec2 px = 1.0 / resolution;
      // Filtro di Sobel sulla luminosità: forte variazione = bordo.
      float gx = -lum(vUv + px * vec2(-1, -1)) - 2.0 * lum(vUv + px * vec2(-1, 0)) - lum(vUv + px * vec2(-1, 1))
                 + lum(vUv + px * vec2(1, -1)) + 2.0 * lum(vUv + px * vec2(1, 0)) + lum(vUv + px * vec2(1, 1));
      float gy = -lum(vUv + px * vec2(-1, -1)) - 2.0 * lum(vUv + px * vec2(0, -1)) - lum(vUv + px * vec2(1, -1))
                 + lum(vUv + px * vec2(-1, 1)) + 2.0 * lum(vUv + px * vec2(0, 1)) + lum(vUv + px * vec2(1, 1));
      float g = sqrt(gx * gx + gy * gy);
      // I colori nella catena di effetti sono lineari: le fasce si calcolano nello spazio percepito
      // dall'occhio (gamma), altrimenti gli scuri diventano neri e i colori si "bruciano".
      vec3 c = pow(texture2D(tDiffuse, vUv).rgb, vec3(1.0 / 2.2));
      c = pow(floor(c * levels + 0.5) / levels, vec3(2.2));
      float outline = smoothstep(edge, edge + 0.15, g);
      gl_FragColor = vec4(mix(c, vec3(0.05), outline), 1.0);
    }`,
};

/** Palette ridotta (pochi livelli per canale), come le vecchie console. */
export const PaletteShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    levels: { value: 6.0 },
  },
  vertexShader: ToonShader.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float levels;
    varying vec2 vUv;
    void main() {
      vec3 c = pow(texture2D(tDiffuse, vUv).rgb, vec3(1.0 / 2.2));
      gl_FragColor = vec4(pow(floor(c * levels + 0.5) / levels, vec3(2.2)), 1.0);
    }`,
};

/** Vignettatura (bordi scuri), grana della pellicola e leggera tinta di colore. */
export const VignetteGrainShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0 },
    vignette: { value: 0.9 },
    grain: { value: 0.06 },
    tint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: ToonShader.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float vignette;
    uniform float grain;
    uniform vec3 tint;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb * tint;
      float d = distance(vUv, vec2(0.5));
      c *= smoothstep(0.85, 0.85 - vignette * 0.55, d);
      c += (rand(vUv * 1000.0 + time) - 0.5) * grain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

/**
 * Monta una catena di post-produzione: il primo passo disegna la scena, gli altri la trasformano,
 * l'ultimo (OutputPass) converte i colori per lo schermo. `onRender` aggiorna gli uniform animati.
 */
export function composerPipeline(
  ctx: ShaderContext, passes: Pass[], onRender?: (time: number) => void, onResize?: (w: number, h: number) => void,
): ShaderPipeline {
  const composer = new EffectComposer(ctx.renderer);
  composer.setPixelRatio(ctx.renderer.getPixelRatio());
  composer.setSize(ctx.width, ctx.height);
  for (const p of passes) composer.addPass(p);
  composer.addPass(new OutputPass());
  onResize?.(ctx.width, ctx.height);
  return {
    render(time) {
      onRender?.(time);
      composer.render();
    },
    setSize(w, h) {
      composer.setSize(w, h);
      onResize?.(w, h);
    },
    dispose() {
      composer.dispose();
    },
  };
}
