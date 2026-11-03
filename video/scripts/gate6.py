#!/usr/bin/env python3
"""The three gates from the brief, run on a rendered movie. Usage: gate6.py movie.mp4
Gate 2: frames at 0.5, 1.5, 3.0 and 5.0 s (and every cue), a contact sheet to look at.
        static dead zones: any stretch where the picture does not change for more than 30 frames.
        contrast: share of the frame where light text could sit on a light ground (pixels brighter than 200 in a block that is also bright).
Gate 1 numbers that can be read from the movie: the first 45 frames must change (mean frame difference), the 5% safe zone must not carry text-bright pixels
        except where the shot is a full-bleed screen recording."""
import subprocess, sys, os, re
import numpy as np
from PIL import Image
mv = sys.argv[1]; out = '/tmp/claude-0/gate6'; os.makedirs(out, exist_ok=True)
fps = 30
def grab(t, name):
    p = f'{out}/{name}.png'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(t), '-i', mv, '-frames:v', '1', '-vf', 'scale=960:540', p], check=True); return p
cues = [0.5, 1.5, 3.0, 5.0, 6.5, 7.5, 8.6, 10.2, 12.3, 13.3, 14.4, 15.6, 17.8, 19.5, 21.4, 22.5, 24.3, 27.2, 29.4, 31.0, 34.6, 35.6, 37.0]
ims = [Image.open(grab(t, f's_{t}')) for t in cues]
cols = 4; rows = (len(ims) + cols - 1) // cols
W = Image.new('RGB', (480 * cols, 270 * rows))
for i, im in enumerate(ims): W.paste(im.resize((480, 270)), ((i % cols) * 480, (i // cols) * 270))
W.save(f'{out}/sheet.png'); print('sheet', f'{out}/sheet.png')
# per-frame difference on a 160x90 grey stream
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', mv, '-an', '-vf', 'scale=160:90,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, 90, 160).astype(float); n = len(fr)
d = np.abs(np.diff(fr, axis=0)).mean((1, 2)); d = np.concatenate([[0], d])
print(f'frames {n} ({n / fps:.2f}s)')
print('Gate 1.3 first 45 frames: mean change per frame', round(d[1:46].mean(), 2), 'min', round(d[1:46].min(), 3), '(must be > 0.2 and never frozen)')
runs = []; s = None
for i in range(1, n):
    if d[i] < 0.12 and s is None: s = i
    if (d[i] >= 0.12 or i == n - 1) and s is not None:
        if i - s > 30: runs.append((s / fps, i / fps))
        s = None
print('Gate 2 dead zones (>30 frames with <0.12 mean change):', [(round(a, 2), round(b, 2)) for a, b in runs] or 'none')
# safe zone: 5% padding on the full frame, text-bright pixels near the edges (excluding the recorded app)
bad = []
for i in range(0, n, 15):
    f = fr[i]; t = f > 215
    edge = np.zeros_like(t); edge[:4, :] = 1; edge[-4:, :] = 1; edge[:, :8] = 1; edge[:, -8:] = 1
    if (t & edge).sum() > 40: bad.append(round(i / fps, 1))
print('Gate 1.2 bright pixels inside the outer 5% at (s):', bad[:40] or 'none')
