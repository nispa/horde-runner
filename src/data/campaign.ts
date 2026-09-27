// Sequenza dei livelli della campagna. Per aggiungerne uno: nuovo JSON in levels/ e una riga qui.
import type { LevelDef } from '../core/types';
import level1 from './levels/level1.json';
import level2 from './levels/level2.json';
import level3 from './levels/level3.json';
import level4 from './levels/level4.json';
import level5 from './levels/level5.json';

export const CAMPAIGN = [level1, level2, level3, level4, level5] as LevelDef[];
