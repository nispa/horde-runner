// Interfaccia degli "shader pack": come in Minecraft, cambiano l'aspetto finale dell'immagine
// (post-produzione) e l'atmosfera della scena (luci, nebbia, cielo), senza toccare il gioco.
// Per aggiungerne uno: implementare ShaderPack, registrarlo in shaders/index.ts e in ../catalog.ts.
import type * as THREE from 'three';

export interface ShaderContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  width: number;
  height: number;
  /** Luci principali della scena, che lo shader pack può regolare. */
  sun: THREE.DirectionalLight;
  ambient: THREE.HemisphereLight;
}

export interface ShaderPipeline {
  /** Disegna un fotogramma (tempo totale in secondi, per effetti animati come la grana). */
  render(time: number): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}

export interface ShaderPack {
  readonly id: string;
  /** Prepara scena e post-produzione; restituisce la pipeline che disegnerà ogni fotogramma. */
  create(ctx: ShaderContext): ShaderPipeline;
}
