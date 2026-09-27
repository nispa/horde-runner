// Tabella delle armi: i valori stanno in data/weapons.json (modificabili senza toccare il codice).
import weapons from '../data/weapons.json';
import type { WeaponDef, WeaponId } from './types';

export const WEAPONS = weapons as Record<WeaponId, WeaponDef>;
