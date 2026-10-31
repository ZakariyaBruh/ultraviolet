#!/usr/bin/env python3
"""Turns the captures in /tmp/claude-0/demo/cap/<theme>/ into the publishable demo in demo/dist:
   shots/<theme>/<state>.webp, data.js (the click zones for every state) and index.html."""
import json, os, shutil, sys
from PIL import Image

CAP = os.environ.get('CAP', '/tmp/claude-0/demo/cap')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'dist')
Q = int(os.environ.get('Q', '74'))
THEMES = [
  ('station', 'Station', '#05070c', '#ffd23f'),
  ('paper', 'Paper', '#f2efe6', '#1f3bff'),
  ('phosphor', 'Phosphor', '#0d130e', '#9fe870'),
  ('blueprint', 'Blueprint', '#0a2557', '#7ff0ff'),
  ('sunset', 'Sunset', '#140a24', '#ff4fa3'),
]

def compact(h):
    o = {'r': [round(v, 4) for v in h['r']]}
    if h.get('label'): o['l'] = h['label']
    k = h.get('kind') or ('go' if h.get('to') else 'info')
    o['k'] = k
    if h.get('to'): o['to'] = h['to']
    if h.get('tip'): o['tip'] = h['tip']
    if h.get('route'): o['route'] = h['route']
    if h.get('dial'): o['dial'] = h['dial']
    if 'stop' in h: o['stop'] = h['stop']
    if h.get('ruler'): o['ruler'] = 1
    if h.get('stops'): o['stops'] = h['stops']
    if h.get('theme'): o['th'] = h['theme']
    if h.get('ghost'): o['ghost'] = 1
    return o

def main():
    if os.path.isdir(OUT): shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, 'shots'))
    data = {'themes': [], 's': {}}
    total = 0; n = 0
    for tid, name, ground, signal in THEMES:
        d = os.path.join(CAP, tid)
        if not os.path.isdir(d): print('skip', tid); continue
        states = {}
        for f in ('states.json', 'states-look.json'):
            p = os.path.join(d, f)
            if os.path.exists(p): states.update(json.load(open(p)))
        if not states: print('no states for', tid); continue
        data['themes'].append({'id': tid, 'name': name, 'ground': ground, 'signal': signal})
        data['s'][tid] = {}
        os.makedirs(os.path.join(OUT, 'shots', tid))
        for sid, st in states.items():
            src = os.path.join(d, sid + '.png')
            if not os.path.exists(src): print('missing image', tid, sid); continue
            dst = os.path.join(OUT, 'shots', tid, sid.replace('@', '_') + '.webp')
            im = Image.open(src).convert('RGB')
            if im.size != (1920, 1080): im = im.resize((1920, 1080), Image.LANCZOS)
            im.save(dst, 'WEBP', quality=Q, method=5)
            total += os.path.getsize(dst); n += 1
            data['s'][tid][sid] = [compact(h) for h in st['hot']]
    with open(os.path.join(OUT, 'data.js'), 'w') as f:
        f.write('window.DEMO=' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';')
    shutil.copy(os.path.join(HERE, 'index.html'), os.path.join(OUT, 'index.html'))
    print(f'{n} images, {total/1e6:.1f} MB, data.js {os.path.getsize(os.path.join(OUT,"data.js"))/1e3:.0f} KB')

main()
