// Shader pack "Nessuno": disegno diretto, senza post-produzione. Il più leggero.
import type { ShaderContext, ShaderPack, ShaderPipeline } from './types';

export const nonePack: ShaderPack = {
  id: 'none',
  create({ renderer, scene, camera }: ShaderContext): ShaderPipeline {
    return {
      render: () => renderer.render(scene, camera),
      setSize: () => {},
      dispose: () => {},
    };
  },
};
