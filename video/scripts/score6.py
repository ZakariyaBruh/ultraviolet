#!/usr/bin/env python3
"""Friction trailer v6.1: score and sound design.

The picture is a broadcast station, retro against futuristic, so the sound is too: analogue-style synths (detuned saw pads, a pulse-wave pluck
through a dotted-eighth delay, a mono saw bass), an 808-style kit with a gated snare, station-ident tones, static between channels and a
picture tube switching off at the end. No orchestra: the first cut used a General MIDI string section, choir and timpani and they did not belong
to this picture. The hook's sounds are read from the Blender bake (public/v6/hook/hook.json): the dial's detent clicks come from its angle,
the glass hiss from its speed, the ridge thuds from the frames it crosses them. The dials in the title and the end card use the same law as
the Remotion scenes draw (ang = A(1-e^-t/tau)). Everything sits on one 120 bpm grid (beat 0.5 s) so cuts and hits land on beats.

  python3 score6.py          -> public/v6/score.wav (+ stems in /tmp/claude-0/audio/build/stems)
"""
import numpy as np, json, subprocess, os, sys
from pedalboard import Pedalboard, Reverb, Compressor, Limiter, LowpassFilter, HighpassFilter, Gain, PeakFilter, LowShelfFilter, HighShelfFilter, LadderFilter, Convolution, Distortion, Delay
from pedalboard.io import AudioFile

SR = 48000
ROOT = '/home/user/ultraviolet/video'
AUD = '/tmp/claude-0/audio'; BUILD = AUD + '/build'; STEMS = BUILD + '/stems'
os.makedirs(STEMS, exist_ok=True)
LEN = 41.0
N = int(LEN * SR)
rng = np.random.default_rng(66)
BEAT = 0.5; BAR = 2.0

# ---------------------------------------------------------------- the edit's clock (seconds on the master timeline)
CUE = dict(
    hook_end=6.2, stop=6.05, hit_title=7.0, wordmark=8.4, tagline=9.6, dive0=11.2, grow0=11.4, through=12.95, app=13.0,
    slide_up0=13.96, slide_up1=14.36, slide_dn1=14.78, lock=15.5, toast=17.5, card=21.0, dismiss=23.0,
    themes=24.0, arcade=27.0, logo=29.0, typing0=29.15, typing1=32.4, endcard=35.0, ring=35.0, square=35.45, word=35.55, dial=35.55,
    url=36.25, underline=36.5, line=36.95, ph=37.35, crt=38.7, end=39.6,
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
        vel = 0.05 + 0.5 / (1 + rate / 350)
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


# ================================================================ analogue-style voices
def stereo_fade(x, a=0.003, b=0.01):
    n = len(x); na = int(a * SR); nb = int(b * SR)
    x = x.copy()
    if na: x[:na] *= np.linspace(0, 1, na)[:, None]
    if nb: x[-nb:] *= np.linspace(1, 0, nb)[:, None]
    return x
def supersaw(notes, n, det_l=(-0.009, -0.003), det_r=(0.003, 0.009)):
    L = np.zeros(n); R = np.zeros(n)
    for m in notes:
        f = hz(m)
        for d in det_l: L += saw(np.full(n, f * (1 + d)))
        for d in det_r: R += saw(np.full(n, f * (1 + d)))
    k = 1.0 / (len(notes) * max(len(det_l), len(det_r)))
    return L * k, R * k
def stab(notes, dur=1.5, vel=1.0, bright=1.0):
    """a detuned-saw chord that opens and shuts like a polysynth stab"""
    n = int(dur * SR); t = np.arange(n) / SR
    L, R = supersaw(notes, n, (-0.011, -0.004), (0.004, 0.011))
    cut = (800 + 6500 * bright * np.exp(-t / 0.28))[::120]
    L = auto_filter(L, LadderFilter.Mode.LPF24, cut, 0.2, chunk=120); R = auto_filter(R, LadderFilter.Mode.LPF24, cut, 0.2, chunk=120)
    env = np.minimum(1, t / 0.004) * np.exp(-t / 0.6)
    return stereo_fade(np.stack([L * env, R * env], 1) * vel * 2.2, 0.002, 0.2)
def pad_bar(notes, dur, open_=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    L, R = supersaw(notes, n)
    cut = (520 + 1500 * open_ * np.sin(np.pi * np.clip(t / dur, 0, 1)))[::240]
    L = auto_filter(L, LadderFilter.Mode.LPF24, cut, 0.14); R = auto_filter(R, LadderFilter.Mode.LPF24, cut, 0.14)
    env = np.minimum(1, t / 0.6) * np.clip((dur - t) / 0.7, 0, 1)
    return np.stack([L * env, R * env], 1) * 2.4
def pluck(m, dur=0.7, vel=1.0):
    """a pulse and a saw through a filter that snaps shut: the sound of an old polysynth patch called Pluck"""
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    ph = (np.cumsum(np.full(n, f)) / SR) % 1.0
    width = 0.5 - 0.18 * np.sin(2 * np.pi * 0.8 * t)
    y = 0.55 * np.where(ph < width, 1.0, -1.0) + 0.45 * saw(np.full(n, f * 1.005))
    cut = (340 + 4600 * np.exp(-t / 0.11))[::120]
    y = auto_filter(y, LadderFilter.Mode.LPF24, cut, 0.28, chunk=120)
    env = np.minimum(1, t / 0.002) * np.exp(-t / 0.3) * np.clip((dur - t) / 0.05, 0, 1)
    return y * env * vel * 1.5
def bass_note(m, dur=0.23, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    y = 0.6 * saw(np.full(n, f)) + 0.55 * np.sin(2 * np.pi * f * t) + 0.18 * np.where(((np.cumsum(np.full(n, f)) / SR) % 1) < 0.5, 1.0, -1.0)
    cut = (150 + 1800 * np.exp(-t / 0.075))[::120]
    y = auto_filter(y, LadderFilter.Mode.LPF24, cut, 0.3, 1.8, chunk=120)
    env = np.minimum(1, t / 0.003) * np.exp(-t / 0.17) * np.clip((dur - t) / 0.025, 0, 1)
    return np.tanh(y * env * 1.6) * vel * 0.8
def kick(vel=1.0):
    n = int(0.65 * SR); t = np.arange(n) / SR
    f = 46 + 95 * np.exp(-t / 0.026)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.17)
    click = hp(noise(n), 2200) * np.exp(-t / 0.003) * 0.14
    return stereo_fade(np.tanh((body + click) * 1.5)[:, None] * np.ones((1, 2)) * vel, 0.0005, 0.03)[:, 0]
def snare(vel=1.0):
    """tone, noise, and the gated reverb that made the eighties: a tail that holds flat and is cut off hard"""
    n = int(0.5 * SR); t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * np.cumsum(185 + 70 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.05) * 0.7
    nz = hp(lp(noise(n), 7000), 900) * np.exp(-t / 0.085)
    gate = hp(lp(noise(n), 4800), 500) * np.clip((0.16 - t) / 0.012, 0, 1) * 0.42 * np.minimum(1, t / 0.004)
    return fade((tone + nz + gate) * vel * 1.3, 0.0005, 0.01)
def clap(vel=1.0):
    n = int(0.45 * SR); t = np.arange(n) / SR
    y = np.zeros(n)
    for o in (0.0, 0.011, 0.022):
        s = int(o * SR); m = n - s
        y[s:] += noise(m) * np.exp(-np.arange(m) / SR / 0.005) * 0.7
    y += noise(n) * np.exp(-t / 0.085) * 0.45 * (t > 0.02)
    y = auto_filter(y, LadderFilter.Mode.BPF12, np.full(n // 240 + 1, 1500.0), 0.25)
    return fade(y * vel * 2.2, 0.0005, 0.02)
HAT_F = [205.3, 304.4, 369.6, 522.7, 540.0, 814.8]
def hat(vel=1.0, open_=False):
    n = int((0.32 if open_ else 0.09) * SR); t = np.arange(n) / SR
    y = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in HAT_F) / 6
    y = hp(y, 7200, 2) * np.exp(-t / (0.11 if open_ else 0.02))
    return fade(y * vel * 1.4, 0.0003, 0.012)
def tom(f0, vel=1.0):
    n = int(0.5 * SR); t = np.arange(n) / SR
    f = f0 * (1 + 0.9 * np.exp(-t / 0.03))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.17) + hp(noise(n), 1500) * np.exp(-t / 0.01) * 0.15
    return fade(np.tanh(y * 1.4) * vel, 0.0005, 0.02)
def crash(tail=2.0):
    n = int(tail * SR); t = np.arange(n) / SR
    y = hp(noise(n), 3600, 2) * np.exp(-t / 0.6) + hp(noise(n), 9000) * np.exp(-t / 0.3) * 0.5
    return fade(y * 0.8, 0.0005, 0.3)
def rev_crash(dur):
    c = crash(dur * 1.3)[int(dur * 0.0 * SR):int(dur * SR)]
    return c[::-1] * np.linspace(0.2, 1.0, len(c)) ** 1.5
def static(dur, level=1.0):
    """between stations: hiss that flickers on and off at mains rate"""
    n = int(dur * SR); t = np.arange(n) / SR
    y = hp(lp(noise(n), 9000), 250)
    gate = np.repeat(rng.random(n // 320 + 1) > 0.3, 320)[:n]
    y = y * gate * np.exp(-t / (dur * 0.6)) * np.minimum(1, t / 0.003)
    return fade(y * level, 0.001, 0.02)
def crt_off():
    n = int(0.9 * SR); t = np.arange(n) / SR
    f = 3200 * np.exp(-t / 0.045) + 48
    y = lp(saw(f), 2600) * np.exp(-t / 0.11) * 0.8
    th = np.sin(2 * np.pi * np.cumsum(46 + 70 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.24)
    pf = lp(noise(n), 700) * np.exp(-t / 0.03) * 0.6
    return fade(np.tanh((y + th * 1.1 + pf) * 1.2), 0.0005, 0.25)
def ident(f, dur=0.4, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / 0.2)
    ph = np.cumsum(f * vib) / SR
    y = np.sin(2 * np.pi * ph) + 0.22 * np.sin(4 * np.pi * ph) + 0.08 * np.sin(6 * np.pi * ph)
    return fade(y * np.minimum(1, t / 0.006) * np.exp(-t / (dur * 0.5)) * vel * 0.45, 0.001, 0.05)
def zap(dur=0.16, f0=5200, f1=240, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; u = t / dur
    f = f0 * (f1 / f0) ** u
    return fade(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (dur * 0.6)) * vel, 0.0005, 0.01)

# ================================================================ MUSIC
bed = zbuf(); pad = zbuf(); plk = zbuf(); sub = zbuf(); bas = zbuf(); kick_b = zbuf(); snr = zbuf(); hats = zbuf(); toms = zbuf(); fx = zbuf(); hits = zbuf()
# the hook's bed: a D that opens like a filter on a drone, no instruments yet
n = int(6.1 * SR); tt = np.arange(n) / SR
dr = (saw(np.full(n, hz(38) * 0.998)) + saw(np.full(n, hz(38) * 1.002)) + saw(np.full(n, hz(26))) + 0.35 * np.sin(2 * np.pi * hz(26) * tt)) / 3.4
dr = auto_filter(dr, LadderFilter.Mode.LPF24, (80 * (1700 / 80) ** (tt / 6.1) ** 1.4)[::240], 0.3)
dr *= np.minimum(1, tt / 1.5) * np.clip((6.05 - tt) / 0.05, 0, 1)
put(bed, np.stack([dr, dr], 1) * 1.6, 0.0)
second = (saw(np.full(n, hz(50) * 0.997)) + saw(np.full(n, hz(50) * 1.003)) + saw(np.full(n, hz(57)))) / 3
second = auto_filter(second, LadderFilter.Mode.LPF24, (200 * (2600 / 200) ** (tt / 6.1) ** 1.8)[::240], 0.2) * np.clip((tt - 1.5) / 3.0, 0, 1) * np.clip((6.05 - tt) / 0.05, 0, 1)
put(bed, np.stack([second, second], 1) * 0.9, 0.0)

for b, name in enumerate(PROG):
    t = bar_t(b); c = CH[name]
    put(pad, pad_bar(c['str'], BAR + 0.75, 1.3 if b in (2, 6, 13) else 1.0), t - 0.05)
    # a pluck motif: a dyad on the downbeat and two answering notes, through the delay
    if (b <= 2) or (3 <= b <= 6) or (11 <= b <= 15):
        a, bb = c['dy']; v = 0.9 if b < 3 else 0.7
        put(plk, pluck(a, 0.9, v), t, 1.0, -0.25); put(plk, pluck(bb, 0.9, v * 0.8), t, 1.0, 0.25)
        put(plk, pluck(c['mo'][0], 0.6, v), t + 1.0, 1.0, 0.3); put(plk, pluck(c['mo'][1], 0.9, v * 0.85), t + 1.5, 1.0, -0.3)
    # the sub: one long note a bar
    r = c['root'] - 12
    nn = int((BAR + 0.1) * SR); tn = np.arange(nn) / SR
    s = np.sin(2 * np.pi * hz(r) * tn) + 0.22 * np.sin(2 * np.pi * hz(r) * 2 * tn)
    s = np.tanh(s * 1.3) * np.minimum(1, tn / 0.03) * np.clip((BAR + 0.1 - tn) / 0.35, 0, 1)
    put(sub, s, t, 0.7)
    # the bass: eighth notes with the octave jumping, from 17 s
    if 5 <= b <= 13:
        vels = [1.0, 0.55, 0.7, 0.55, 1.0, 0.55, 0.7, 0.9]
        for j in range(8):
            put(bas, bass_note(c['root'] + (12 if j in (3, 7) else 0), 0.23, vels[j]), t + j * 0.25, 1.0)
# stabs and impacts on the four big hits
STAB_DM = [50, 57, 62, 65, 69, 74]; STAB_D = [50, 57, 62, 66, 69, 74]
put(hits, stab(STAB_DM, 1.8, 1.0, 1.0), CUE['hit_title'])
put(hits, stab(STAB_DM, 1.4, 0.75, 0.8), CUE['app'])
put(hits, stab([50, 57, 62, 65, 69, 74, 77, 81], 2.0, 1.1, 1.2), CUE['card'])
put(hits, stab(STAB_D, 2.6, 1.05, 1.1), CUE['endcard'])
put(sub, impact(0.95, 3.6, 31.0) * 0.55, CUE['hit_title'])
put(sub, impact(0.7, 2.6, 31.0) * 0.8, CUE['app'])
put(sub, impact(1.0, 3.6, 29.0) * 0.9, CUE['card'])
put(sub, impact(0.9, 4.0, 29.0) * 0.85, CUE['endcard'])
put(sub, impact(0.8, 2.0, 33.0), CUE['stop'] - 0.03)

# the kit: groove sections as before
def groove(t0, t1, kicks=True, backbeat=True, hat_on=True):
    t = t0
    while t < t1 - 1e-6:
        for off in range(4):
            tn = t + off * BEAT
            if tn >= t1 - 1e-6: break
            if kicks and off in (0, 2): put(kick_b, kick(1.0 if off == 0 else 0.85), tn, 1.0)
            if kicks and off == 3: put(kick_b, kick(0.6), tn + BEAT * 0.5, 1.0)
            if backbeat and off in (1, 3):
                put(snr, snare(0.85), tn, 0.8, 0.05); put(snr, clap(0.5), tn, 0.5, 0.1)
            if hat_on:
                put(hats, hat(0.5 if off % 2 == 0 else 0.4), tn, 0.7, -0.25)
                put(hats, hat(0.85, off in (1, 3)), tn + BEAT * 0.5, 0.7, 0.25)
        t += BAR
groove(15.0, 17.0, True, False, False)
groove(17.0, 19.0, True, False, True)
groove(19.0, 20.0, True, True, True)
groove(21.0, 29.0, True, True, True)
groove(29.0, 31.0, True, False, False)
# the fill into the celebration: a snare roll that climbs, three toms falling, and a crash that arrives backwards
for i, t in enumerate(np.arange(20.0, 20.88, 0.125)): put(snr, snare(0.25 + 0.7 * i / 7), t, 0.8, 0.05)
for t0, f0 in [(20.25, 210), (20.5, 165), (20.75, 125), (20.875, 100)]: put(toms, tom(f0, 0.9), t0, 1.0, -0.2 + (f0 - 100) / 600)
put(fx, np.stack([rev_crash(1.0)] * 2, 1) * 0.7, 20.0)
put(hits, np.stack([crash(2.2)] * 2, 1) * 0.55, CUE['card'])
put(hits, np.stack([crash(2.8)] * 2, 1) * 0.5, CUE['endcard'])
put(toms, tom(120, 1.0), 34.5); put(toms, tom(90, 1.0), 34.75)
# the dive through the doughnut: a stream of data blips that speeds up, hats that rise, a snare roll, a kick on each beat
tb = 11.4; k = 0
pent = [62, 65, 69, 72, 74, 77, 81, 84]
while tb < 12.95:
    u = (tb - 11.4) / 1.55
    f = hz(pent[int(rng.integers(0, len(pent)))] + 12)
    put(hits, blip(f, 0.1 + 0.18 * u, 0.014) * (np.sign(np.sin(2 * np.pi * f * np.arange(int(0.014 * SR)) / SR)) if False else 1.0), tb, 1.0, rng.uniform(-0.8, 0.8))
    tb += 0.13 - 0.105 * u ** 0.8
for t in np.arange(11.0, 12.0, 0.25): put(hats, hat(0.2 + 0.5 * (t - 11.0)), t, 0.7, 0.0)
for i, t in enumerate(np.arange(12.0, 12.97, 0.125)): put(snr, snare(0.2 + 0.75 * i / 7.5), t, 0.8, 0.0)
for t in np.arange(12.0, 13.0, 0.5): put(kick_b, kick(0.8), t)

# risers
put(fx, np.stack([riser(3.4, 160, 8000, 2.4) * 0.35] * 2, 1), 2.55)
put(fx, np.stack([tone_riser(3.5, 26, 62, 0.35)] * 2, 1), 2.55)
put(fx, np.stack([riser(1.6, 400, 10000, 2.0)] * 2, 1) * 0.75, CUE['dive0'])
put(fx, np.stack([tone_riser(1.6, 38, 74, 0.5)] * 2, 1), CUE['dive0'])
put(fx, whoosh(1.4, 300, 3800, -0.9, 0.9) * 0.9, CUE['dive0'] + 0.45)
put(fx, whoosh(0.5, 600, 5200, 0.9, -0.9) * 0.55, CUE['through'] - 0.1)
put(fx, np.stack([riser(2.0, 300, 9500, 2.2)] * 2, 1) * 0.8, CUE['card'] - 2.0)
put(fx, np.stack([tone_riser(2.0, 45, 81, 0.45)] * 2, 1), CUE['card'] - 2.0)
put(fx, whoosh(0.6, 500, 6000, -0.8, 0.8) * 0.45, CUE['logo'] - 0.15)
put(fx, np.stack([riser(1.4, 300, 9000, 2.2)] * 2, 1) * 0.7, CUE['endcard'] - 1.4)
put(fx, whoosh(0.7, 400, 5000, 0.8, -0.8) * 0.5, CUE['endcard'] - 0.5)

# the station: the sign-on at the wordmark, static between channels, a tube going dark
for i in range(7):
    put(hits, ident(hz(74 + [0, 3, 5, 7, 10, 12, 15][i]), 0.1, 0.18), 7.35 + i * 0.16, 1.0, -0.5 + i / 7)
put(hits, ident(880, 0.14, 0.7), CUE['wordmark'], 1.0, -0.1); put(hits, ident(1174.7, 0.9, 0.8), CUE['wordmark'] + 0.15, 1.0, 0.1)
put(hits, ident(880, 0.14, 0.6), CUE['ph'], 1.0, -0.1); put(hits, ident(1174.7, 1.2, 0.7), CUE['ph'] + 0.15, 1.0, 0.1)
put(fx, np.stack([static(0.28, 0.45)] * 2, 1), CUE['arcade'] - 0.02)
put(fx, np.stack([static(0.34, 0.5)] * 2, 1), CUE['logo'] - 0.02)
put(fx, np.stack([crt_off()] * 2, 1) * 0.9, CUE['crt'])
# the mark: the ring draws itself, the square lands
nr = int(0.8 * SR); ur = np.linspace(0, 1, nr)
ringsw = np.sin(2 * np.pi * np.cumsum(300 * (2400 / 300) ** (ur ** 1.4)) / SR) * (ur ** 1.4) * 0.12
put(hits, np.stack([ringsw, ringsw], 1), CUE['ring'])
put(hits, thunk(1.2), CUE['square'], 0.9); put(hits, zap(0.12, 3000, 400, 0.4), CUE['square'], 0.8)
# the dial lands in the O of the end card: its clicks follow the law the picture draws
A2, T2 = 1080.0, 0.5
for k in range(1, 36):
    r = 30 * k / A2
    if r >= 0.995: break
    t = CUE['dial'] - T2 * np.log(1 - r)
    rate = A2 / T2 * (1 - r)
    put(foley, detent(0.06 + 0.5 / (1 + rate / 350), 2000 + 700 * rng.random()), t, 1.0, 0.0)
for i, t in enumerate(np.linspace(CUE['word'], CUE['word'] + 0.4, 8)): put(foley, blip(1400 + 90 * i, 0.12, 0.02), t, 1.0, -0.4 + 0.11 * i)
for t in np.linspace(CUE['underline'], CUE['underline'] + 0.7, 14): put(foley, blip(1900, 0.06, 0.012), t, 1.0, 0.0)

# app foley: slider ratchet, lock-in latch, themes as notes on the beat, tab presses, typed ident, the card
slider_ticks = list(np.linspace(CUE['slide_up0'], CUE['slide_up1'], 8)) + list(np.linspace(CUE['slide_up1'], CUE['slide_dn1'], 8))
for t in slider_ticks: put(foley, detent(0.5, 1800), t, 0.8, -0.1)
put(foley, ui_sample('mouseclick1', 1.2), CUE['slide_up0'] - 0.12, 0.8)
put(foley, ui_sample('mouserelease1', 1.0), CUE['slide_dn1'] + 0.15, 0.7)
put(foley, ui_sample('click3', 1.4, 0.8), CUE['lock'], 1.0)
put(foley, thunk(1.2), CUE['lock'] + 0.03, 0.9)
put(fx, whoosh(0.5, 300, 2400, -0.4, 0.5) * 0.4, CUE['lock'] + 0.02)
# the toast: a soft falling pair, inside the chord (F major)
for t0, f, g in [(CUE['toast'], 349.2, 0.5), (CUE['toast'] + 0.12, 293.7, 0.5)]: put(hits, ident(f, 0.5, g * 0.6), t0, 1.0, 0.0)
put(foley, ui_sample('click2', 1.0), CUE['toast'] - 1.2, 0.5)
# the rocket lifts off in the card at 21.45 and the confetti goes off at 21.95 (frames 305 and 320 of the take)
put(fx, np.stack([riser(0.55, 140, 2600, 1.4, 0.3)] * 2, 1) * 0.55, 21.42)
put(hits, clap(1.4), 21.95, 1.0, 0.0)
spk = hp(noise(int(1.8 * SR)), 4500, 2) * np.exp(-np.arange(int(1.8 * SR)) / SR / 0.5)
put(hits, np.stack([spk, np.roll(spk, 211)], 1) * 0.45, 21.97)
for j in range(10):
    put(hits, zap(0.07, 4200 + 400 * j, 2600, 0.12), 21.98 + j * 0.04, 1.0, rng.uniform(-0.8, 0.8))
put(foley, ui_sample('click5', 1.1), CUE['dismiss'] - 0.05, 0.8)
theme_notes = [62, 65, 69, 72, 74]
for i, m in enumerate(theme_notes):
    t = CUE['themes'] + i * BEAT
    put(plk, pluck(m + 12, 0.5, 0.9), t, 1.0, -0.4 + 0.2 * i)
    put(foley, ui_sample('switch%d' % (5 + 3 * i), 0.9), t, 0.7)
put(foley, ui_sample('click1', 1.3), CUE['arcade'], 1.0)
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
gap[int(6.1 * SR):int((CUE['hit_title'] - 0.001) * SR)] = 0
gap_m = gap[:, None]

g_pad = curve([(0, -60), (6.9, -60), (7.05, -12), (11, -10), (13, -13), (20.9, -11), (21, -8), (23, -12), (29, -12), (34.9, -9), (35, -7), (38.5, -9), (40, -40)])
g_plk = curve([(0, -60), (6.9, -60), (7.05, -7), (12.9, -7), (13, -9), (20.9, -9), (21, -60), (23.9, -60), (24, -8), (28.9, -8), (29, -9), (34.9, -9), (35, -7), (38.5, -8), (40, -40)])
g_sub = curve([(0, -60), (6.0, -60), (7.0, -16), (13, -19), (21, -14), (29, -22), (34.9, -19), (35, -14), (38, -19), (40, -40)])
g_bas = curve([(0, -60), (16.9, -60), (17.0, -12), (21, -8), (29, -14), (30.9, -60)])
g_bed = curve([(0, -3), (6.2, -3), (6.3, -60)])
g_fx = curve([(0, -4), (41, -4)])
sums = {}
def stem(name, x):
    sums[name] = x
    with AudioFile(f'{STEMS}/{name}.wav', 'w', SR, 2) as f: f.write(x.T.astype(np.float32))

m_bed = bus(bed * g_bed[:, None], [HighpassFilter(40), LowpassFilter(7000)])
m_pad = bus(pad * g_pad[:, None] * gap_m, [HighpassFilter(150), LowpassFilter(7500), PeakFilter(2200, -2.0, 0.8)]) * duck(0.5)
m_plk = bus(plk * g_plk[:, None] * gap_m, [HighpassFilter(180), Delay(0.375, 0.34, 0.3), LowpassFilter(8500)]) * duck(0.25)
m_sub = bus(sub * g_sub[:, None] * gap_m, [LowpassFilter(220), Compressor(-18, 3, 5, 80)]) * duck(0.45)
m_bas = bus(bas * g_bas[:, None] * gap_m, [HighpassFilter(45), LowpassFilter(3200), Compressor(-16, 3, 5, 80)]) * duck(0.55)
m_kick = bus(kick_b, [HighpassFilter(28), Compressor(-14, 3, 2, 60)])
m_snr = bus(snr, [HighpassFilter(140)])
m_hat = bus(hats, [HighpassFilter(300), HighShelfFilter(8000, 1.5, 0.7)])
m_tom = bus(toms, [HighpassFilter(70)])
m_fx = bus(fx * g_fx[:, None], [HighpassFilter(60), Compressor(-20, 2, 10, 120)])
m_hit = bus(hits, [HighpassFilter(24), Compressor(-16, 3, 1, 150)])
m_fol = bus(foley, [HighpassFilter(80), Compressor(-22, 2.5, 3, 80)])

dry = (m_bed * 1.0 + m_pad * 0.9 + m_plk * 0.8 + m_sub * 0.9 + m_bas * 0.7 + m_kick * 0.62 + m_snr * 0.75 + m_hat * 0.35 + m_tom * 0.7 + m_fx * 0.8 + m_hit * 0.8 + m_fol * 1.0)
wet_in = (m_bed * 0.2 + m_pad * 0.5 + m_plk * 0.7 + m_snr * 0.5 + m_tom * 0.4 + m_fx * 0.5 + m_hit * 0.6 + m_hat * 0.1)
room_in = m_fol * 0.4 + m_kick * 0.08 + m_snr * 0.2
wet = convolve(wet_in, HALL)
wet = bus(wet, [HighpassFilter(180), LowpassFilter(7500)])
rm = convolve(room_in, ROOM)
mix = dry + wet * 1.6 + rm * 0.6
for nm, x in [('bed', m_bed), ('pad', m_pad), ('pluck', m_plk), ('sub', m_sub), ('bass', m_bas), ('kick', m_kick), ('snare', m_snr), ('hats', m_hat), ('toms', m_tom), ('fx', m_fx), ('hits', m_hit), ('foley', m_fol), ('wet', wet)]:
    stem(nm, x)
rel = curve([(0, 0), (6.1, 0), (7.0, -1), (12.9, -1), (13.0, -4), (15.0, -5), (17, -3), (20.9, -2), (21.0, 2), (28.9, 1), (29.0, -3), (34.9, -3), (35.0, 2), (38, 1), (41, 1)])
mix = mix * rel[:, None]
# a little tape: soft saturation before the glue, then the master
mix = np.tanh(mix * 0.85) / 0.85
master = Pedalboard([HighpassFilter(30), PeakFilter(260, -2.5, 0.9), HighShelfFilter(9000, 1.0, 0.7), Compressor(-9, 1.6, 40, 300), Limiter(-1.2, 120)])
out = master(mix.T.astype(np.float32), SR).T
fadeout = np.clip((CUE['end'] - 0.3 - np.arange(N) / SR) / 1.1, 0, 1)[:, None] ** 1.5
out = out * fadeout
tmp = f'{BUILD}/score_raw.wav'
with AudioFile(tmp, 'w', SR, 2) as f: f.write(out.T.astype(np.float32))
m = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', tmp, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
integ = float([l for l in m.splitlines() if l.strip().startswith('I:')][-1].split()[1])
target = -14.5
out2 = out * db(target - integ)
pk = np.abs(out2).max()
if pk > db(-1.8): out2 = out2 * (db(-1.8) / pk)          # the plugin limiter does not hard-cap; a plain trim keeps the peak under -1.8 dBFS
dest = ROOT + '/public/v6/score.wav'
with AudioFile(dest, 'w', SR, 2, 24) as f: f.write(out2.T.astype(np.float32))
json.dump(dict(cue=CUE, prog=PROG, len=LEN, integrated_before=integ, gain_db=target - integ), open(ROOT + '/public/v6/cues.json', 'w'), indent=1)
print('integrated', integ, '-> gain', round(target - integ, 2), 'dB; peak', round(float(np.abs(out2).max()), 3), '->', dest)
