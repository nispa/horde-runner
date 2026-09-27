// Catalogo di shader pack e pacchetti modelli: solo nomi e descrizioni, senza importare Three.js,
// così il menu iniziale resta leggero. Le implementazioni sono registrate in shaders/ e models/.

export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
}

/** "Shader pack" alla Minecraft: effetti di post-produzione applicati all'immagine finale. */
export const SHADER_PACKS: CatalogEntry[] = [
  { id: 'none', name: 'Nessuno', description: 'Immagine pulita, la più leggera.' },
  { id: 'toon', name: 'Cartoon', description: 'Colori a fasce e contorni neri.' },
  { id: 'retro', name: 'Retrò pixel', description: 'Pixel grossi e palette ridotta, da console anni 90.' },
  { id: 'cinema', name: 'Cinematico', description: 'Bagliori, vignettatura e grana della pellicola.' },
  { id: 'night', name: 'Notte', description: 'Buio, nebbia e luci calde: atmosfera horror.' },
];

/** Pacchetti modelli: come vengono costruiti personaggi e oggetti in 3D. */
export const MODEL_PACKS: CatalogEntry[] = [
  { id: 'mixed', name: 'Voxel + scenario', description: 'Personaggi a blocchi e oggetti Kenney 3D ai lati della strada.' },
  { id: 'voxel', name: 'Solo voxel', description: 'Tutto a blocchi, stile Minecraft. Il più leggero.' },
];

export const CAMERAS: CatalogEntry[] = [
  { id: 'iso', name: 'Isometrica', description: 'Vista dall\'alto di sbieco, come un diorama.' },
  { id: 'chase', name: 'Da dietro', description: 'Telecamera alle spalle della squadra, stile pubblicità.' },
];
