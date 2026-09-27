// Pacchetto "misto": personaggi voxel + oggetti di scena Kenney 3D ai lati della strada.
// (Per ora usa gli alberi voxel; i modelli GLB arrivano nella fase D.)
import { VoxelPack } from './voxel';

export class MixedPack extends VoxelPack {
  override readonly id: string = 'mixed';
}
