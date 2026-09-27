# Generatore dei JSON dei livelli (formato compatto: una entità per riga).
import json, sys
def gate(z, l, r): return {"type":"gate","z":z,"left":op(l),"right":op(r)}
def op(s): return {"op": s[0] if s[0] != '*' else 'x', "value": int(s[1:])}
def wall(z, x, hp, crash, kind, val, width=0.9): return {"type":"wall","z":z,"x":x,"width":width,"hp":hp,"crashCost":crash,"reward":{"kind":kind,"value":val}}
def wave(z, count, hp, speed, spread=0.9, bite=None, throws=None):
    w = {"type":"wave","z":z,"count":count,"hp":hp,"speed":speed,"spread":spread}
    if bite: w["bite"] = bite
    # Per default i bruti lanciano rocce (danno pari al loro morso, ogni 4 secondi).
    if throws is None and bite: throws = rock(4, bite)
    if throws: w["throws"] = throws
    return w
def rock(every, damage): return {"kind":"rock","every":every,"damage":damage}
def thrown_zombie(every, hp): return {"kind":"zombie","every":every,"hp":hp}
def boulder(every, damage, hp): return {"kind":"boulder","every":every,"damage":damage,"hp":hp}
def crows(every, count, hp, damage=1): return {"kind":"crow","every":every,"count":count,"hp":hp,"damage":damage}
def dump(path, name, theme, length, speed, start, ents, zombie_hp=1.0):
    # zombie_hp: moltiplicatore della vita degli zombi (taratura dopo l'inseguimento più aggressivo).
    ents = [dict(e, hp=max(1, round(e['hp'] * zombie_hp))) if e['type'] == 'wave' else e for e in ents]
    ents = sorted(ents, key=lambda e: e["z"])
    fmt = lambda e: json.dumps(e, ensure_ascii=False).replace('{"', '{ "').replace('}', ' }').replace('  }', ' }')
    out = '{\n' + f'  "name": {json.dumps(name, ensure_ascii=False)},\n  "theme": "{theme}",\n  "length": {length},\n  "playerSpeed": {speed},\n'
    out += f'  "start": {{ "soldiers": {start[0]}, "fireRate": {start[1]}, "damage": {start[2]} }},\n  "entities": [\n'
    out += ',\n'.join('    ' + fmt(e) for e in ents) + '\n  ]\n}\n'
    open(path, 'w', encoding='utf-8').write(out)
def weapon(z, x, w): return {"type":"weapon","z":z,"x":x,"weapon":w}
def boss(z, name, hp, speed, bite, attacks=None):
    b = {"type":"boss","z":z,"name":name,"hp":hp,"speed":speed,"bite":bite}
    if attacks: b["attacks"] = attacks
    return b
