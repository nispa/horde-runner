# Genera src/data/levels/level*.json. Uso (dalla radice del progetto): python tools/levels/make_levels.py
# È la fonte di verità dei livelli: modificare qui, poi rigenerare e rilanciare i test di bilanciamento.
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from levels import *
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'data', 'levels') + os.sep

# Livello 1 - Periferia
dump(D+'level1.json', 'Livello 1 - Periferia', 'grass', 335, 7, (5, 3, 1), [{"type": "gate", "z": 14, "left": {"op": "+", "value": 6}, "right": {"op": "x", "value": 2}}, {"type": "wall", "z": 30, "x": -0.5, "width": 0.9, "hp": 30, "crashCost": 4, "reward": {"kind": "soldiers", "value": 10}}, {"type": "wave", "z": 46, "count": 10, "hp": 3, "speed": 2, "spread": 0.8}, {"type": "gate", "z": 66, "left": {"op": "x", "value": 2}, "right": {"op": "-", "value": 6}}, {"type": "wall", "z": 82, "x": 0.5, "width": 0.9, "hp": 70, "crashCost": 6, "reward": {"kind": "fireRate", "value": 2}}, {"type": "wave", "z": 95, "count": 18, "hp": 5, "speed": 2.2, "spread": 0.9}, {"type": "gate", "z": 118, "left": {"op": "-", "value": 10}, "right": {"op": "+", "value": 12}}, {"type": "wall", "z": 132, "x": -0.5, "width": 0.9, "hp": 120, "crashCost": 8, "reward": {"kind": "damage", "value": 1}}, {"type": "wave", "z": 145, "count": 22, "hp": 6, "speed": 2.4, "spread": 0.9}, {"type": "wave", "z": 152, "count": 3, "hp": 40, "speed": 1.8, "spread": 0.6, "bite": 5}, {"type": "gate", "z": 175, "left": {"op": "/", "value": 2}, "right": {"op": "+", "value": 10}}, {"type": "wall", "z": 190, "x": 0.5, "width": 0.9, "hp": 200, "crashCost": 12, "reward": {"kind": "soldiers", "value": 15}}, {"type": "wave", "z": 205, "count": 40, "hp": 12, "speed": 2.6, "spread": 0.9}, {"type": "gate", "z": 230, "left": {"op": "+", "value": 15}, "right": {"op": "-", "value": 15}}, {"type": "wave", "z": 250, "count": 30, "hp": 14, "speed": 2.6, "spread": 0.9}, {"type": "wave", "z": 256, "count": 6, "hp": 90, "speed": 2, "spread": 0.8, "bite": 6}, {"type": "wave", "z": 285, "count": 60, "hp": 12, "speed": 3, "spread": 0.9}, {"type": "wave", "z": 292, "count": 4, "hp": 120, "speed": 2.2, "spread": 0.7, "bite": 8}] + [
  weapon(104, 0.5, 'minigun'),
  boss(320, 'Il Grosso', 3500, 1.2, 3, [rock(3, 3)]),
], zombie_hp=0.85)

# Livello 2 - Campagna: bruti prima, muri più duri.
dump(D+'level2.json', 'Livello 2 - Campagna', 'dirt', 355, 7.5, (5, 3, 1), [
  gate(14, '*2', '+4'),
  wall(30, -0.5, 30, 5, 'soldiers', 12),
  wave(42, 12, 4, 2.2),
  gate(60, '-8', '*2'),
  wall(74, 0.5, 90, 8, 'fireRate', 2),
  wave(88, 20, 6, 2.4), wave(94, 2, 35, 1.8, 0.6, 5),
  gate(112, '+12', '/2'),
  wall(126, -0.5, 140, 10, 'damage', 1),
  wave(140, 28, 8, 2.6), wave(148, 3, 70, 2, 0.7, 6),
  gate(170, '*2', '-12'),
  wall(186, 0.5, 220, 14, 'soldiers', 18),
  wave(200, 40, 12, 2.8),
  gate(225, '+15', '/2'),
  wave(245, 30, 12, 2.8), wave(252, 5, 90, 2.2, 0.8, 6),
  wall(280, -0.5, 300, 20, 'fireRate', 2),
  wave(300, 60, 13, 3.2), wave(308, 4, 120, 2.4, 0.7, 7),
  weapon(120, -0.5, 'shotgun'), weapon(120, 0.5, 'minigun'),
  boss(340, 'Il Macellaio', 7000, 1.2, 4, [thrown_zombie(2.5, 20)]),
], zombie_hp=0.6)

# Livello 3 - Zona industriale: muri centrali da aggirare, gate trappola ravvicinati.
dump(D+'level3.json', 'Livello 3 - Zona industriale', 'concrete', 395, 7.5, (6, 3, 1), [
  gate(14, '+5', '*2'),
  wall(34, 0, 30, 8, 'soldiers', 15, 0.6),
  wave(46, 14, 4, 2.4),
  gate(64, '*2', '-10'),
  gate(80, '/2', '+15'),
  wall(96, -0.5, 60, 10, 'fireRate', 2),
  wave(110, 25, 8, 2.6), wave(116, 4, 70, 2, 0.7, 6),
  gate(136, '-15', '*2'),
  wall(152, 0, 200, 16, 'damage', 1, 0.6),
  wave(168, 35, 12, 2.8),
  gate(190, '+20', '/2'),
  wall(206, 0.5, 260, 18, 'soldiers', 20),
  wave(222, 50, 18, 3), wave(230, 6, 150, 2.2, 0.8, 7),
  gate(255, '+40', '/2'),
  wall(272, -0.5, 350, 22, 'fireRate', 2),
  wave(290, 55, 24, 3.1),
  wave(335, 85, 22, 3.3), wave(342, 7, 220, 2.4, 0.8, 8),
  weapon(88, -0.5, 'rocket'),
  weapon(244, -0.5, 'minigun'), weapon(244, 0.5, 'shotgun'),
  boss(380, 'Il Colosso', 7500, 1.2, 5, [boulder(3.5, 6, 80)]),
], zombie_hp=0.75)

# Livello 4 - Deserto: zombi veloci, poco tempo per reagire.
dump(D+'level4.json', 'Livello 4 - Deserto', 'sand', 415, 8, (6, 3, 1), [
  gate(14, '*2', '+5'),
  wall(34, 0.5, 30, 8, 'fireRate', 1),
  wave(48, 14, 4, 3.5),
  gate(66, '+10', '-10'),
  wall(86, -0.5, 70, 10, 'soldiers', 18),
  wave(100, 18, 5, 3.8), wave(106, 2, 50, 2.6, 0.7, 5),
  gate(124, '/2', '*2'),
  wall(140, 0.5, 110, 14, 'damage', 1),
  wave(156, 30, 8, 4),
  gate(178, '*2', '-20'),
  wall(194, -0.5, 170, 18, 'fireRate', 2),
  wave(210, 40, 11, 4), wave(216, 5, 100, 3, 0.8, 6),
  gate(240, '+25', '/2'),
  wall(256, 0.5, 240, 22, 'soldiers', 25),
  wave(274, 55, 18, 4.2),
  gate(300, '-25', '+20'),
  wave(345, 90, 24, 4.4), wave(352, 7, 240, 3, 0.8, 8),
  weapon(116, -0.5, 'rocket'), weapon(116, 0.5, 'minigun'),
  boss(400, 'La Belva', 8500, 1.8, 6, [crows(3.5, 6, 4)]),
], zombie_hp=0.6)

# Livello 5 - Passo innevato: lungo, tutto insieme.
dump(D+'level5.json', 'Livello 5 - Passo innevato', 'snow', 455, 8, (6, 3, 1), [
  gate(14, '+6', '*2'),
  wall(34, -0.5, 30, 8, 'soldiers', 14),
  wave(48, 15, 4, 3),
  gate(64, '*2', '-10'),
  wall(86, 0, 70, 12, 'fireRate', 2, 0.6),
  wave(100, 22, 6, 3.2), wave(106, 3, 60, 2.4, 0.7, 5),
  gate(122, '-15', '+15'),
  wall(138, 0.5, 120, 14, 'damage', 1),
  wave(154, 30, 9, 3.4), wave(160, 3, 90, 2.6, 0.8, 6),
  gate(182, '*2', '/2'),
  wall(198, -0.5, 300, 18, 'soldiers', 22),
  wave(214, 48, 18, 3.6),
  gate(238, '+25', '-25'),
  wall(254, 0.5, 400, 22, 'fireRate', 2),
  wave(270, 45, 15, 3.8), wave(278, 5, 130, 2.8, 0.8, 7),
  gate(302, '*2', '+30'),
  wall(318, -0.5, 300, 26, 'damage', 1),
  wave(336, 60, 26, 4),
  wave(385, 90, 22, 4.2), wave(392, 6, 200, 3, 0.8, 8),
  weapon(114, -0.5, 'minigun'), weapon(114, 0.5, 'shotgun'),
  weapon(290, -0.5, 'rocket'), weapon(290, 0.5, 'minigun'),
  boss(440, 'Il Re dei Morti', 16000, 1.3, 8, [rock(4, 4), thrown_zombie(5, 25), boulder(6, 8, 120), crows(7, 5, 5)]),
], zombie_hp=0.85)
