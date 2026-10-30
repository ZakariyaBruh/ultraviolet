#!/usr/bin/env python3
"""Friction trailer v6: score and sound design.

Real instruments (General MIDI soundfont, rendered by tsfr.c) for strings, cello, piano; everything else is synthesised
here (sub, pulse, drums, risers, impacts, foley). The hook's sounds are not invented, they are read from the Blender
bake (public/v6/hook/hook.json): the dial's detent clicks come from its angle, the glass hiss from its speed, the
ridge thuds from the frames it crosses them. The title's dial uses the same law as the Remotion title (ang = A(1-e^-t/tau)).
Everything sits on one 120 bpm grid (beat 0.5 s) so cuts and hits land on beats.

  python3 score6.py          -> public/v6/score.wav (+ stems in /tmp/claude-0/audio/build/stems)
"""
import numpy as np, json, subprocess, os, sys
from pedalboard import Pedalboard, Reverb, Compressor, Limiter, LowpassFilter, HighpassFilter, Gain, PeakFilter, LowShelfFilter, HighShelfFilter, LadderFilter, Convolution, Distortion
from pedalboard.io import AudioFile

SR = 48000
ROOT = '/home/user/ultraviolet/video'
AUD = '/tmp/claude-0/audio'; BUILD = AUD + '/build'; STEMS = BUILD + '/stems'
os.makedirs(STEMS, exist_ok=True)
LEN = 41.5
N = int(LEN * SR)
rng = np.random.default_rng(66)
BEAT = 0.5; BAR = 2.0

# ---------------------------------------------------------------- the edit's clock (seconds on the master timeline)
CUE = dict(
    hook_end=6.2, stop=6.05, hit_title=7.0, wordmark=8.4, tagline=9.6, dive0=11.2, through=12.6, app=13.0,
    slide_up0=13.96, slide_up1=14.36, slide_dn1=14.78, lock=15.5, toast=17.5, card=21.0, dismiss=23.0,
    themes=24.0, arcade=27.0, logo=29.0, typing0=29.15, typing1=32.4, endcard=35.0, end=38.0,
)
# chords, one per bar from 7.0
PROG = ['Dm', 'Bb', 'C', 'Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'D', 'D']
CH = {
    'Dm': dict(root=38, str=[57, 62, 65, 69], dy=(62, 69), mo=(77, 76), tone=[50, 57, 62, 65]),
    'Bb': dict(root=34, str=[53, 58, 62, 65], dy=(58, 65), mo=(74, 72), tone=[46, 53, 58, 62]),
    'F':  dict(root=41, str=[57, 60, 65, 69], dy=(60, 65), mo=(69, 67), tone=[41, 48, 53, 57]),
    'C':  dict(root=36, str=[55, 60, 64, 67], dy=(60, 67), mo=(76, 74), tone=[48, 55, 60, 64]),
    'D':  dict(root=38, str=[57, 62, 66, 69], dy=(62, 69), mo=(78, 76), tone=[50, 57, 62, 66]),
}
def bar_t(i): return 7.0 + BAR * i
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

# ---------------------------------------------------------------- helpers
def zbuf(): return np.zeros((N, 2))
def pan_gains(p): a = (p + 1) * np.pi / 4; return np.cos(a), np.sin(a)
def put(buf, x, t, gain=1.0, pan=0.0):
    """mix a mono (n,) or stereo (n,2) signal into buf at time t"""
    i = int(round(t * SR))
    if i >= N or i + len(x) <= 0: return
    if x.ndim == 1:
        l, r = pan_gains(pan); x = np.stack([x * l, x * r], 1)
    a = max(0, -i); b = min(len(x), N - i)
    buf[i + a:i + b] += x[a:b] * gain
def db(x): return 10 ** (x / 20)
def curve(points, n=N):
    """piecewise-linear gain in dB over the whole timeline, returned as linear gain per sample"""
    ts = np.array([p[0] for p in points]); ds = np.array([p[1] for p in points])
    return db(np.interp(np.arange(n) / SR, ts, ds))
def auto_filter(x, mode, cutoffs, res=0.2, drive=1.0, chunk=240):
    lf = LadderFilter(mode=mode, cutoff_hz=float(cutoffs[0]), resonance=res, drive=drive)
    out = np.empty_like(x, dtype=np.float32); x = x.astype(np.float32)
    for i in range(0, len(x), chunk):
        lf.cutoff_hz = float(np.clip(cutoffs[min(i // chunk, len(cutoffs) - 1)], 20, 20000))
        out[i:i + chunk] = lf.process(x[i:i + chunk].reshape(1, -1), SR, reset=False)[0]
    return out.astype(np.float64)
def noise(n): return rng.standard_normal(n)
def lp(x, f, order=1):
    y = x.astype(np.float32).reshape(1, -1)
    for _ in range(order): y = LowpassFilter(f).process(y, SR)
    return y[0].astype(np.float64)
def hp(x, f, order=1):
    y = x.astype(np.float32).reshape(1, -1)
    for _ in range(order): y = HighpassFilter(f).process(y, SR)
    return y[0].astype(np.float64)
def fade(x, a=0.004, b=0.004):
    x = x.copy(); na = int(a * SR); nb = int(b * SR)
    if na: x[:na] *= np.linspace(0, 1, na)
    if nb: x[-nb:] *= np.linspace(1, 0, nb)
    return x
def saw(f):
    ph = np.cumsum(f / SR) % 1.0
    return 2 * ph - 1
def stereo_from(x, width=0.0):
    return np.stack([x, x], 1)

# ---------------------------------------------------------------- instruments (soundfont)
def tsf(preset, events, name, secs=LEN):
    path = f'{BUILD}/{name}.txt'
    open(path, 'w').write('\n'.join(f'{s:.4f} {d:.4f} {k} {v:.3f}' for s, d, k, v in events))
    subprocess.run([f'{BUILD}/tsfr', f'{AUD}/GeneralUser-GS.sf2', str(preset), path, str(secs), f'{BUILD}/{name}.f32'], check=True)
    a = np.fromfile(f'{BUILD}/{name}.f32', dtype=np.float32).reshape(-1, 2).astype(np.float64)
    out = zbuf(); out[:min(N, len(a))] = a[:N]
    return out

# ---------------------------------------------------------------- synth voices
def kick(vel=1.0, f0=48, drop=120):
    n = int(0.55 * SR); t = np.arange(n) / SR
    f = f0 + drop * np.exp(-t / 0.032)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.17)
    click = hp(noise(n), 2500) * np.exp(-t / 0.0035) * 0.22
    return fade((body + click) * vel, 0.0005, 0.02)
def clap(vel=1.0):
    n = int(0.45 * SR); t = np.arange(n) / SR
    y = np.zeros(n)
    for o in (0.0, 0.011, 0.022):
        s = int(o * SR); m = n - s
        y[s:] += noise(m) * np.exp(-np.arange(m) / SR / 0.005) * 0.7
    y += noise(n) * np.exp(-t / 0.085) * 0.45 * (t > 0.02)
    y = auto_filter(y, LadderFilter.Mode.BPF12, np.full(n // 240 + 1, 1500.0), 0.25)
    return fade(y * vel * 2.2, 0.0005, 0.02)
def hat(vel=1.0, open_=False):
    n = int((0.22 if open_ else 0.07) * SR); t = np.arange(n) / SR
    y = hp(noise(n), 7500, 2) * np.exp(-t / (0.08 if open_ else 0.018))
    return fade(y * vel, 0.0003, 0.01)
def impact(vel=1.0, tail=3.4, sub=30.0):
    n = int(tail * SR); t = np.arange(n) / SR
    f = sub + 70 * np.exp(-t / 0.22)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 1.1)
    boom = lp(noise(n), 160, 2) * np.exp(-t / 0.4) * 2.2
    crack = hp(noise(n), 2200) * np.exp(-t / 0.022) * 0.55
    mid = lp(hp(noise(n), 90), 700) * np.exp(-t / 0.16) * 0.9
    return fade((s * 0.95 + boom + crack + mid) * vel, 0.0005, 0.3)
def riser(dur, f0=250, f1=9000, curve_p=2.2, res=0.55):
    n = int(dur * SR); u = np.linspace(0, 1, n)
    cut = f0 * (f1 / f0) ** u[::240]
    y = auto_filter(noise(n), LadderFilter.Mode.BPF12, cut, res)
    return y * (u ** curve_p)
def tone_riser(dur, m0, m1, level=1.0):
    """a saw gliding up (pitch in MIDI), filtered open as it climbs: the tonal half of a build"""
    n = int(dur * SR); u = np.linspace(0, 1, n)
    f = hz(m0) * (hz(m1) / hz(m0)) ** (u ** 1.6)
    y = (saw(f) + saw(f * 1.006) + saw(f * 0.994)) / 3
    y = auto_filter(y, LadderFilter.Mode.LPF24, 300 * (9000 / 300) ** u[::240], 0.25)
    return y * (u ** 1.8) * level
def whoosh(dur, lo, hi, p0=-0.8, p1=0.8, bell=0.55):
    n = int(dur * SR); u = np.linspace(0, 1, n)
    cen = lo * (hi / lo) ** (np.sin(np.pi * np.clip(u / bell, 0, 1) * 0.5) ** 1.0 * (u < bell) + (1 - (u - bell) / (1 - bell)) ** 1.5 * (u >= bell)) if False else lo * (hi / lo) ** (1 - np.abs(2 * (u ** 0.8) - 1))
    y = auto_filter(noise(n), LadderFilter.Mode.BPF12, cen[::240], 0.35)
    env = np.sin(np.pi * u ** 0.85) ** 2
    y = y * env
    pan = p0 + (p1 - p0) * u
    l, r = pan_gains(1)  # placeholder to keep import use obvious
    a = (pan + 1) * np.pi / 4
    return np.stack([y * np.cos(a), y * np.sin(a)], 1)
def detent(vel=1.0, f=2600):
    n = int(0.03 * SR); t = np.arange(n) / SR
    y = noise(n) * np.exp(-t / 0.0011) * 0.55 + np.sin(2 * np.pi * f * t) * np.exp(-t / 0.0022) * 0.7 + np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.007) * 0.5
    return fade(y * vel, 0.0002, 0.004)
def thunk(vel=1.0):
    n = int(0.16 * SR); t = np.arange(n) / SR
    f = 62 + 95 * np.exp(-t / 0.018)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.045) + lp(hp(noise(n), 700), 3200) * np.exp(-t / 0.007) * 0.55
    return fade(y * vel, 0.0003, 0.01)
def blip(f=1760, vel=1.0, dur=0.035):
    n = int(dur * SR); t = np.arange(n) / SR
    return fade(np.sin(2 * np.pi * f * t) * np.exp(-t / 0.012) * vel, 0.0005, 0.004)
def ui_sample(name, gain=1.0, pitch=1.0, cutoff=9000):
    with AudioFile(f'{AUD}/ui/{name}.wav').resampled_to(SR) as f: a = f.read(f.frames)
    m = a.mean(0)
    if pitch != 1.0:
        idx = np.arange(0, len(m) - 1, pitch); m = np.interp(idx, np.arange(len(m)), m)
    return lp(m, cutoff) * gain

# ---------------------------------------------------------------- reverbs: generated impulse responses, no presets
def make_ir(path, sec, pre, rt_lo, rt_mid, rt_hi, er=True):
    n = int(sec * SR); t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for c in range(2):
        nz = rng.standard_normal(n)
        lo = lp(nz, 350, 2) * np.exp(-6.91 * t / rt_lo)
        mid = lp(hp(nz, 350, 1), 3200, 1) * np.exp(-6.91 * t / rt_mid)
        hi = hp(nz, 3200, 1) * np.exp(-6.91 * t / rt_hi)
        ir[c] = lo * 1.1 + mid * 0.8 + hi * 0.35
        k = int(pre * SR); ir[c] = np.concatenate([np.zeros(k), ir[c][:n - k]])
        if er:
            for d, g in [(0.011, .7), (0.019, .5), (0.031, -.45), (0.047, .4), (0.063, -.3), (0.079, .25)]:
                j = int((pre + d * (1 + 0.07 * c)) * SR); ir[c][j] += g * 0.8
    ir /= np.sqrt((ir ** 2).sum() / 2) / 3.0
    with AudioFile(path, 'w', SR, 2) as f: f.write(ir.astype(np.float32))
HALL = BUILD + '/hall.wav'; ROOM = BUILD + '/room.wav'
make_ir(HALL, 4.2, 0.03, 3.6, 2.6, 1.2)
make_ir(ROOM, 1.0, 0.004, 0.7, 0.5, 0.25)
def convolve(x, path, mix=1.0):
    y = Pedalboard([Convolution(path, mix=mix)])(x.T.astype(np.float32), SR).T
    return y.astype(np.float64)

# ================================================================ THE HOOK (0 - 6.2): the sounds of the bake
hk = json.load(open(ROOT + '/public/v6/hook/hook.json'))
sp = np.array(hk['speed']); ang = np.array(hk['ang']); ticks = hk['ticks']; fps = hk['fps']
tf = np.arange(len(sp)) / fps
foley = zbuf()      # diegetic sounds: dial, ridges, ui
# glass hiss follows the dial's speed
n_h = int(6.1 * SR)
tt = np.arange(n_h) / SR
spd = np.interp(tt, tf, sp)
cut = (160 + 62 * spd)[::240]
hiss = auto_filter(noise(n_h), LadderFilter.Mode.BPF12, cut, 0.3)
hiss *= (0.05 + 0.95 * (spd / 36.0) ** 1.5)
hiss *= np.minimum(1, tt / 0.4) * np.clip((6.05 - tt) / 0.5, 0, 1)
put(foley, hiss * 0.55, 0.0, 1.0, 0.25)
# detent clicks from the baked angle (30 degree detents): a whirr when fast, distinct ticks when it slows
k0 = int(ang[0] // 30)
for i in range(len(ang) - 1):
    a0, a1 = ang[i], ang[i + 1]
    k = int(np.floor(a0 / 30)) + 1
    while k * 30 <= a1:
        u = (k * 30 - a0) / max(1e-9, a1 - a0); t = (i + u) / fps
        rate = (a1 - a0) * fps
        vel = 0.10 + 0.55 / (1 + rate / 500)
        put(foley, detent(vel, 2300 + 600 * rng.random()), t, 1.0, 0.2)
        k += 1
# the ridges the dial bites into
for i, t in enumerate(ticks):
    v = 0.35 + 0.65 * min(1, i / 20)
    put(foley, thunk(v), t, 1.0, -0.15)
# the grind as it brakes: friction noise that falls in pitch as the speed drops
dec = np.clip(-np.gradient(sp, 1 / fps), 0, None)
n_g = int(2.4 * SR); tg = 3.7 + np.arange(n_g) / SR
d_i = np.interp(tg, tf, dec / max(1, dec.max()))
s_i = np.interp(tg, tf, sp)
grind = auto_filter(noise(n_g), LadderFilter.Mode.BPF24, (200 + 55 * s_i)[::240], 0.6)
grind = grind * (d_i ** 0.8) * np.clip((6.05 - tg) / 0.15, 0, 1)
put(foley, grind * 0.9, 3.7, 1.0, 0.0)
put(foley, thunk(1.6), CUE['stop'] - 0.02, 1.0, 0.0)
put(foley, detent(1.0, 1800), CUE['stop'] + 0.04, 1.0, 0.1)

# ================================================================ TITLE dial: ang(t) = A (1 - e^(-t/tau)), the same law the Remotion title draws
A_T, TAU = 1440.0, 0.55
for k in range(1, 48):
    r = 30 * k / A_T
    if r >= 0.995: break
    t = CUE['hit_title'] - TAU * np.log(1 - r)
    rate = A_T / TAU * (1 - r)
    put(foley, detent(0.10 + 0.6 / (1 + rate / 450), 2000 + 700 * rng.random()), t, 1.0, 0.0)
put(foley, thunk(0.9), CUE['hit_title'] + 2.45, 0.8, 0.0)                    # the last detent latches

# ================================================================ MUSIC
str_ev, cello_ev, piano_ev, tim_ev, choir_ev = [], [], [], [], []
for b, name in enumerate(PROG):
    t = bar_t(b); c = CH[name]
    vel = 0.55 if b < 3 else 0.5
    for m in c['str']: str_ev.append((t - 0.05, BAR + 0.55, m, vel))
    if b >= 1: cello_ev.append((t, BAR + 0.1, c['root'] + 12, 0.6))
    if b >= 3 and b != 14 and b != 15: cello_ev.append((t, BAR + 0.1, c['root'], 0.5))
    pian = (b <= 2) or (3 <= b <= 6) or (11 <= b <= 15)
    if pian:
        a, bb = c['dy']; pv = 0.55 if b < 3 else 0.42
        piano_ev.append((t, 1.8, a, pv)); piano_ev.append((t, 1.8, bb, pv * 0.85))
        piano_ev.append((t + 1.0, 0.7, c['mo'][0], pv * 0.9)); piano_ev.append((t + 1.5, 1.4, c['mo'][1], pv * 0.8))
# a low piano line under the final hit, a held choir under the end card
for m in (38, 50): piano_ev.append((CUE['endcard'], 3.5, m, 0.8))
for m in (62, 66, 69): choir_ev.append((CUE['endcard'] - 0.05, 3.2, m, 0.45))
# timpani: the title hit, the app arrival, the celebration, the end card
for t0, k, v in [(CUE['hit_title'], 38, 1.0), (CUE['hit_title'], 26, 0.9), (CUE['app'], 38, 0.95), (CUE['card'], 38, 1.0), (CUE['card'], 45, 0.8),
                 (CUE['endcard'], 38, 1.0), (CUE['endcard'], 26, 0.9)]:
    tim_ev.append((t0, 1.4, k, v))
hook_cello = [(0.0, 6.0, 38, 0.55), (2.0, 4.0, 45, 0.4)]
cello_ev += hook_cello
hook_str = [(1.0, 5.2, m, 0.4) for m in (50, 57, 62)]
str_ev += hook_str

S_str = tsf(49, str_ev, 'strings')
S_cel = tsf(42, cello_ev, 'cello')
S_pia = tsf(0, piano_ev, 'piano')
S_tim = tsf(47, tim_ev, 'timp')
S_cho = tsf(52, choir_ev, 'choir')

# synth pad: three detuned saws per chord note, low-passed, opening on the builds
pad = zbuf()
for b, name in enumerate(PROG):
    t = bar_t(b); c = CH[name]
    n = int((BAR + 0.6) * SR); tt = np.arange(n) / SR
    y = np.zeros(n)
    for m in c['tone']:
        f = hz(m)
        y += saw(np.full(n, f * 0.997)) + saw(np.full(n, f * 1.003)) + saw(np.full(n, f))
    y /= 12
    cutv = 500 + 900 * np.sin(np.pi * np.clip(tt / (BAR + 0.6), 0, 1)) + (800 if name in ('D',) else 0)
    y = auto_filter(y, LadderFilter.Mode.LPF24, cutv[::240], 0.12)
    env = np.minimum(1, tt / 0.5) * np.clip((BAR + 0.6 - tt) / 0.6, 0, 1)
    put(pad, np.stack([y * env, np.roll(y, 37) * env], 1), t - 0.05, 1.0)
# the hook's pad: a D drone that opens as the dial speeds up
n = int(6.1 * SR); tt = np.arange(n) / SR
dr = (saw(np.full(n, hz(38) * 0.998)) + saw(np.full(n, hz(38) * 1.002)) + saw(np.full(n, hz(26)))) / 3
dr = auto_filter(dr, LadderFilter.Mode.LPF24, (90 * (1500 / 90) ** (tt / 6.1) ** 1.4)[::240], 0.3)
dr *= np.minimum(1, tt / 1.5) * np.clip((6.05 - tt) / 0.05, 0, 1)
put(pad, np.stack([dr, dr], 1) * 1.4, 0.0, 1.0)

# sub and pulse bass
sub = zbuf(); pulse = zbuf()
for b, name in enumerate(PROG):
    t = bar_t(b); c = CH[name]; r = c['root'] - 12
    n = int((BAR + 0.1) * SR); tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * hz(r) * tt) + 0.25 * np.sin(2 * np.pi * hz(r) * 2 * tt)
    s = np.tanh(s * 1.4) * np.minimum(1, tt / 0.03) * np.clip((BAR + 0.1 - tt) / 0.35, 0, 1)
    put(sub, s, t, 0.7)
    if 4 <= b <= 13 and b != 2:
        for j in range(4):
            for h in (0, 1):
                tn = t + j * BEAT + h * BEAT * 0.5
                m = int(0.22 * SR); u = np.arange(m) / SR
                y = saw(np.full(m, hz(c['root']))) * 0.7 + np.sin(2 * np.pi * hz(c['root']) * u) * 0.5
                cut_p = 240 + 1900 * np.exp(-u / 0.05)
                y = auto_filter(y, LadderFilter.Mode.LPF24, cut_p[::120], 0.35, 1.5, chunk=120)
                y *= np.exp(-u / 0.11) * (1.0 if h == 0 else 0.62)
                put(pulse, y, tn, 1.0)
put(sub, impact(0.9, 3.6, 29.0) * 0.8, CUE['hit_title'])
put(sub, impact(0.75, 2.8, 31.0) * 0.8, CUE['app'])
put(sub, impact(1.0, 3.6, 29.0) * 0.9, CUE['card'])
put(sub, impact(0.9, 4.0, 29.0) * 0.85, CUE['endcard'])
put(sub, impact(0.8, 2.0, 33.0), CUE['stop'] - 0.03)

# drums
kick_b = zbuf(); drum = zbuf()
def groove(t0, t1, kicks=True, claps=True, hats=True):
    t = t0
    while t < t1 - 1e-6:
        bar_i = int(round((t - 7.0) / BAR))
        for j, off in enumerate([0, 1, 2, 3]):
            tn = t + off * BEAT
            if tn >= t1 - 1e-6: break
            if kicks and off in (0, 2): put(kick_b, kick(1.0 if off == 0 else 0.85), tn, 1.0)
            if kicks and off == 3: put(kick_b, kick(0.6), tn + BEAT * 0.5, 1.0)
            if claps and off in (1, 3): put(drum, clap(0.8), tn, 0.8, 0.1)
            if hats:
                put(drum, hat(0.5 if off % 2 == 0 else 0.35), tn, 0.7, -0.25)
                put(drum, hat(0.9, False), tn + BEAT * 0.5, 0.7, 0.25)
        t += BAR
groove(15.0, 17.0, kicks=True, claps=False, hats=False)
groove(17.0, 19.0, kicks=True, claps=False, hats=True)
groove(19.0, 21.0 - 0.001, kicks=True, claps=True, hats=True)
groove(21.0, 29.0, kicks=True, claps=True, hats=True)
groove(29.0, 31.0, kicks=True, claps=False, hats=False)
for t in np.arange(11.0, 13.0, 0.25):                           # the dive: a snare-roll style crescendo of hats and a kick on each beat
    put(drum, hat(0.2 + 0.7 * (t - 11.0) / 2.0), t, 0.7, 0.0)
for t in np.arange(12.0, 13.0, 0.5): put(kick_b, kick(0.8), t)
# a single kick in the hook for the stop, none on 6.2 - 7.0 (silence)

# risers and hits (effects)
fx = zbuf()
put(fx, np.stack([riser(3.4, 160, 8000, 2.4) * 0.35] * 2, 1), 2.55)                       # hook: opens until the stop
put(fx, np.stack([tone_riser(3.5, 26, 62, 0.35)] * 2, 1), 2.55)
put(fx, np.stack([riser(1.55, 400, 10000, 2.0)] * 2, 1) * 0.75, CUE['dive0'])             # the dive
put(fx, np.stack([tone_riser(1.55, 38, 74, 0.5)] * 2, 1), CUE['dive0'])
put(fx, whoosh(1.2, 300, 3800, -0.9, 0.9) * 0.9, CUE['dive0'] + 0.45)
put(fx, whoosh(0.55, 600, 5200, 0.9, -0.9) * 0.5, CUE['through'] + 0.1)
put(fx, np.stack([riser(2.0, 300, 9500, 2.2)] * 2, 1) * 0.8, CUE['card'] - 2.0)           # into the celebration
put(fx, np.stack([tone_riser(2.0, 45, 81, 0.45)] * 2, 1), CUE['card'] - 2.0)
put(fx, whoosh(0.6, 500, 6000, -0.8, 0.8) * 0.45, CUE['logo'] - 0.15)
put(fx, whoosh(0.7, 400, 5000, 0.8, -0.8) * 0.5, CUE['endcard'] - 0.5)
hits = zbuf()
put(hits, impact(1.0, 3.8), CUE['hit_title']); put(hits, impact(0.8, 3.0), CUE['app']); put(hits, impact(1.1, 4.0), CUE['card'])
put(hits, impact(1.0, 4.2), CUE['endcard'])
# the celebration: a pop, a rush of bright noise, a rising chord
put(hits, clap(1.4) * 1.0, CUE['card'] + 0.02)
sparkle = hp(noise(int(1.6 * SR)), 5000, 2) * np.exp(-np.arange(int(1.6 * SR)) / SR / 0.45)
put(hits, np.stack([sparkle, np.roll(sparkle, 173)], 1) * 0.45, CUE['card'] + 0.05)
# the rocket in the card lifts off at 21.45 and the confetti goes off at 21.95 (read from the capture: frames 305 and 320)
put(fx, np.stack([riser(0.55, 140, 2600, 1.4, 0.3)] * 2, 1) * 0.55, 21.42)
put(hits, clap(1.5), 21.95, 1.0, 0.0)
spk = hp(noise(int(1.8 * SR)), 4500, 2) * np.exp(-np.arange(int(1.8 * SR)) / SR / 0.5)
put(hits, np.stack([spk, np.roll(spk, 211)], 1) * 0.5, 21.97)
for j in range(14):
    f = hz(86 + [0, 2, 4, 7, 9][j % 5] + 12 * (j % 3 == 0)); nn = int(0.25 * SR); u = np.arange(nn) / SR
    put(hits, np.sin(2 * np.pi * f * u) * np.exp(-u / 0.05) * 0.06, 21.98 + j * 0.035 + rng.random() * 0.02, 1.0, rng.uniform(-0.8, 0.8))
# ticks of the 'you drifted' toast: a falling two-note sigh, quiet
for t0, f, g in [(CUE['toast'], 330, 0.5), (CUE['toast'] + 0.11, 247, 0.5)]:
    nn = int(0.7 * SR); u = np.arange(nn) / SR
    put(hits, np.sin(2 * np.pi * f * u) * np.exp(-u / 0.22) * g * 0.35, t0, 1.0, 0.0)
# app foley: slider ratchet, lock-in latch, themes as notes on the beat, tab presses, typed ident
slider_ticks = list(np.linspace(CUE['slide_up0'], CUE['slide_up1'], 8)) + list(np.linspace(CUE['slide_up1'], CUE['slide_dn1'], 8))
for i, t in enumerate(slider_ticks): put(foley, detent(0.5, 1800), t, 0.8, -0.1)
put(foley, ui_sample('mouseclick1', 1.2), CUE['slide_up0'] - 0.12, 0.8)
put(foley, ui_sample('mouserelease1', 1.0), CUE['slide_dn1'] + 0.15, 0.7)
put(foley, ui_sample('click3', 1.4, 0.8), CUE['lock'], 1.0)
put(foley, thunk(1.2), CUE['lock'] + 0.03, 0.9)
put(fx, whoosh(0.5, 300, 2400, -0.4, 0.5) * 0.4, CUE['lock'] + 0.02)
theme_notes = [62, 65, 69, 72, 74]
for i, m in enumerate(theme_notes):
    t = CUE['themes'] + i * BEAT
    nn = int(0.6 * SR); u = np.arange(nn) / SR
    y = (np.sin(2 * np.pi * hz(m) * u) + 0.3 * np.sin(2 * np.pi * hz(m) * 2 * u)) * np.exp(-u / 0.16) * np.minimum(1, u / 0.003)
    put(hits, y * 0.3, t, 1.0, -0.4 + 0.2 * i)
    put(foley, ui_sample('switch%d' % (5 + 3 * i), 0.9), t, 0.7)
put(foley, ui_sample('click1', 1.3), CUE['arcade'], 1.0)
put(foley, ui_sample('click5', 1.1), CUE['dismiss'] - 0.05, 0.8)
put(foley, ui_sample('click2', 1.0), CUE['toast'] - 1.2, 0.5)
put(foley, ui_sample('click4', 1.3), CUE['logo'], 1.0)
for i, t in enumerate(np.linspace(CUE['typing0'], CUE['typing1'], 54)):
    put(foley, blip(1500 + 600 * rng.random(), 0.12 + 0.1 * rng.random()), t, 1.0, 0.15)
put(foley, ui_sample('rollover2', 0.9), CUE['arcade'] - 0.2, 0.5)

# ================================================================ MIX
def bus(x, chain): return Pedalboard(chain)(x.T.astype(np.float32), SR).T.astype(np.float64)
kick_env = np.abs(kick_b[:, 0] + kick_b[:, 1])
sc = np.convolve(kick_env, np.ones(1024) / 1024, 'same'); sc = np.minimum(1, sc / (sc.max() + 1e-9) * 1.8)
sc = np.convolve(sc, np.ones(4800) / 4800, 'same')
duck = lambda depth: 1 - depth * np.minimum(1, sc * 1.4)[:, None]
gap = np.ones(N)
for h in (CUE['hit_title'], CUE['app'], CUE['card'], CUE['endcard']):
    a = int((h - 0.2) * SR); b = int((h - 0.002) * SR)
    gap[a:b] = np.linspace(1, 0, b - a) ** 2
gap[int(6.1 * SR):int((CUE['hit_title'] - 0.001) * SR)] = 0             # silence after the hook, before the title
gap_m = gap[:, None]

g_str = curve([(0, -60), (1.0, -16), (5.9, -9), (6.1, -60), (7.0, -60), (7.05, -10), (11, -8), (13, -11), (17, -9), (20.9, -5), (21, -3), (23, -7), (29, -8), (34.9, -6), (35.0, -3), (38, -4), (40, -30)])
g_cel = curve([(0, -60), (0.3, -14), (5.9, -7), (6.1, -60), (7.0, -60), (7.05, -10), (13, -8), (21, -3), (29, -6), (35, -3), (38.5, -6), (40.5, -40)])
g_pia = curve([(0, -60), (6.9, -60), (7.05, -3), (12.9, -3), (13, -2), (21, -1), (23, -60), (28.9, -60), (29, -4), (34.9, -3), (35, -2), (40, -12), (41, -60)])
g_pad = curve([(0, -60), (0.2, -16), (5.9, -8), (6.1, -60), (7.0, -60), (7.05, -17), (11, -13), (13, -17), (20.9, -12), (21, -9), (29, -15), (35, -10), (38, -11), (40.5, -40)])
g_sub = curve([(0, -60), (6.0, -60), (7.0, -11), (13, -14), (21, -9), (29, -17), (34.9, -14), (35, -9), (38, -14), (40.5, -40)])
g_pul = curve([(0, -60), (16.9, -60), (17.0, -14), (21, -10), (29, -13), (30.9, -60)])
g_fx = curve([(0, -4), (41, -4)])
sums = {}
def stem(name, x):
    sums[name] = x
    with AudioFile(f'{STEMS}/{name}.wav', 'w', SR, 2) as f: f.write(x.T.astype(np.float32))

m_str = bus(S_str * g_str[:, None] * gap_m, [HighpassFilter(190), PeakFilter(3200, 2.0, 0.8), LowpassFilter(9000)]) * duck(0.28)
m_cel = bus(S_cel * g_cel[:, None] * gap_m, [HighpassFilter(110), LowpassFilter(5000)]) * duck(0.2)
m_pia = bus(S_pia * g_pia[:, None] * gap_m, [HighpassFilter(90), Compressor(-22, 2.5, 8, 120), HighShelfFilter(5000, 1.5, 0.6)])
m_pad = bus(pad * g_pad[:, None] * gap_m, [HighpassFilter(140), LowpassFilter(6500)]) * duck(0.5)
m_sub = bus(sub * g_sub[:, None] * gap_m, [LowpassFilter(220), Compressor(-18, 3, 5, 80)]) * duck(0.45)
m_pul = bus(pulse * g_pul[:, None] * gap_m, [HighpassFilter(55), Distortion(5), LowpassFilter(3600)]) * duck(0.6)
m_kick = bus(kick_b, [HighpassFilter(28), Compressor(-14, 3, 2, 60)])
m_drum = bus(drum, [HighpassFilter(160), HighShelfFilter(7000, 2.0, 0.7)])
m_tim = bus(S_tim * 1.3, [HighpassFilter(40)])
m_cho = bus(S_cho, [HighpassFilter(150), LowpassFilter(5000)])
m_fx = bus(fx * g_fx[:, None], [HighpassFilter(60), Compressor(-20, 2, 10, 120)])
m_hit = bus(hits, [HighpassFilter(24), Compressor(-16, 3, 1, 150)])
m_fol = bus(foley, [HighpassFilter(80), Compressor(-22, 2.5, 3, 80)])

dry = (m_str * 0.9 + m_cel * 0.9 + m_pia * 1.0 + m_pad * 1.0 + m_sub * 0.9 + m_pul * 0.45 + m_kick * 0.75 + m_drum * 0.45 + m_tim * 0.5 + m_cho * 0.5 + m_fx * 0.8 + m_hit * 0.8 + m_fol * 1.0)
wet_in = (m_str * 0.55 + m_cel * 0.4 + m_pia * 0.7 + m_pad * 0.4 + m_tim * 0.55 + m_cho * 0.9 + m_fx * 0.5 + m_hit * 0.55 + m_drum * 0.18)
room_in = m_fol * 0.4 + m_kick * 0.1 + m_drum * 0.25
wet = convolve(wet_in, HALL)
wet = bus(wet, [HighpassFilter(180), LowpassFilter(7500)])
rm = convolve(room_in, ROOM)
# the hook stops dead: the reverb is allowed to ring into the silence, but nothing new enters after 6.1 until the hit
mix = dry + wet * 1.7 + rm * 0.6
for nm, x in [('strings', m_str), ('cello', m_cel), ('piano', m_pia), ('pad', m_pad), ('sub', m_sub), ('pulse', m_pul), ('kick', m_kick), ('drums', m_drum), ('timp', m_tim), ('choir', m_cho), ('fx', m_fx), ('hits', m_hit), ('foley', m_fol), ('wet', wet)]:
    stem(nm, x)
rel = curve([(0, 0), (6.1, 0), (7.0, -1), (12.9, -1), (13.0, -4), (15.0, -5), (17, -3), (20.9, -2), (21.0, 2), (28.9, 1), (29.0, -3), (34.9, -3), (35.0, 2), (38, 1), (41, 1)])
mix = mix * rel[:, None]
master = Pedalboard([HighpassFilter(30), PeakFilter(260, -2.5, 0.9), HighShelfFilter(9000, 1.0, 0.7), Compressor(-9, 1.6, 40, 300), Limiter(-1.2, 120)])
out = master(mix.T.astype(np.float32), SR).T
# tail fade and measure
fadeout = np.clip((39.3 - np.arange(N) / SR) / 1.2, 0, 1)[:, None] ** 1.5
out = out * fadeout
tmp = f'{BUILD}/score_raw.wav'
with AudioFile(tmp, 'w', SR, 2) as f: f.write(out.T.astype(np.float32))
m = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', tmp, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
lines = [l for l in m.splitlines() if 'I:' in l or 'LRA:' in l or 'Peak:' in l]
integ = float([l for l in m.splitlines() if l.strip().startswith('I:')][-1].split()[1])
target = -14.5
g = db(target - integ)
out2 = out * g
pk = np.abs(out2).max()
if pk > db(-1.8): out2 = out2 * (db(-1.8) / pk)          # the plugin limiter does not hard-cap; a plain trim keeps the peak under -1.8 dBFS
dest = ROOT + '/public/v6/score.wav'
with AudioFile(dest, 'w', SR, 2, 24) as f: f.write(out2.T.astype(np.float32))
json.dump(dict(cue=CUE, prog=PROG, len=LEN, integrated_before=integ, gain_db=target - integ), open(ROOT + '/public/v6/cues.json', 'w'), indent=1)
print('integrated', integ, '-> gain', round(target - integ, 2), 'dB; peak', round(float(np.abs(out2).max()), 3), '->', dest)
