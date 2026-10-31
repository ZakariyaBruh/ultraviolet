# Friction trailer v4 score and foley. Everything is synthesised; times are on the master clock (seconds).
import numpy as np, wave, json, subprocess, sys
SR = 44100; D = 45.6; N = int(SR * D)
rng = np.random.default_rng(4)
L = np.zeros(N); R = np.zeros(N)     # dry
WL = np.zeros(N); WR = np.zeros(N)   # reverb send
BPM = 100; BEAT = 60 / BPM; BAR = BEAT * 4
T_TITLE, T_WORLD, T_CTA = 9.6, 14.4, 38.4
TICKS = json.load(open('/home/user/ultraviolet/video/public/v4/run/ticks.json'))

def put(buf, sig, at, g=1.0):
    i = int(at * SR); j = min(N, i + len(sig))
    if i >= N or j <= i or i < 0: return
    buf[i:j] += sig[:j - i] * g
def st(sig, at, g=1.0, pan=0.0, wet=0.0):
    put(L, sig, at, g * (1 - max(0, pan))); put(R, sig, at, g * (1 + min(0, pan)))
    if wet: put(WL, sig, at, g * wet); put(WR, sig, at, g * wet)
def env(n, a, r):
    e = np.exp(-np.arange(n) / SR / r); na = int(a * SR)
    if na > 0: e[:na] *= np.linspace(0, 1, na)
    return e
def noise(n): return np.diff(rng.standard_normal(n + 1))
def note(m): return 440 * 2 ** ((m - 69) / 12)

def fft_band(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo: m *= 1 / (1 + (lo / np.maximum(f, 1e-3)) ** 4)
    if hi: m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))
def sweep_lp(x, f0, f1, curve=1.0):
    """a low-pass whose cutoff glides from f0 to f1 over the length of x (block-wise, overlap-add)"""
    B = 2048; out = np.zeros(len(x) + B); w = np.hanning(B)
    fr = np.fft.rfftfreq(B, 1 / SR)
    for s in range(0, len(x) - B // 2, B // 2):
        k = min(1, s / max(1, len(x))) ** curve
        fc = f0 * (f1 / f0) ** k
        seg = np.zeros(B); part = x[s:s + B]; seg[:len(part)] = part
        out[s:s + B] += np.fft.irfft(np.fft.rfft(seg * w) / (1 + (fr / fc) ** 4), B) 
    return out[:len(x)] * 0.5

# ---------------------------------------------------------------- voices
def click(g=1.0, f=3200, ln=0.012):
    n = int(ln * SR); return fft_band(noise(n), f * 0.5, f * 1.8) * env(n, 0.0002, ln / 3) * 4 * g
def knock(f=140, g=1.0, dur=0.12):
    n = int(dur * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(f * (1 + 0.6 * np.exp(-t * 40))) / SR) * env(n, 0.0004, dur / 3.5) * g
def boom(dur=2.4, f0=90, f1=28, g=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; f = f1 + (f0 - f1) * np.exp(-t * 5)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, dur / 4)
    return (s * 1.1 + fft_band(noise(n), 30, 700) * env(n, 0.001, 0.35) * 1.4) * g
def kick(g=1.0):
    n = int(0.42 * SR); t = np.arange(n) / SR; f = 46 + 130 * np.exp(-t * 34)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.17) + noise(n) * env(n, 0.0004, 0.005) * 0.2) * g
def clap(g=1.0):
    n = int(0.3 * SR); t = np.arange(n) / SR
    e = env(n, 0.0005, 0.08) * (1 + 0.8 * np.exp(-((t - 0.012) % 0.022) * 180))
    return fft_band(noise(n), 900, 7000) * e * 1.6 * g
def hat(g=1.0, op=False):
    n = int((0.2 if op else 0.045) * SR)
    return fft_band(noise(n), 6500, 0) * env(n, 0.0003, 0.08 if op else 0.011) * 2.2 * g
def pluck(f, dur=0.5, g=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for k in range(1, 9): s += np.sin(2 * np.pi * f * k * t + k) / k * np.exp(-t * (3 + k * 3.4))
    return s * g
def pad(f, dur, g=1.0, a=1.2, r=1.2):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for det in (-0.005, 0.0, 0.006):
        for k in range(1, 7): s += np.sin(2 * np.pi * f * (1 + det) * k * t + k * 1.7) / k
    return s * np.minimum(1, t / a) * np.minimum(1, (dur - t) / r) * g / 3
def bell(f, dur=1.6, g=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 5) + 0.3 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 9)) * env(n, 0.002, dur / 3.5) * g
def swell(dur, f0, f1, g=1.0, up=True):
    n = int(dur * SR); t = np.arange(n) / SR
    nz = sweep_lp(noise(n), f0, f1, 1.3) * (4 if up else 1)
    ramp = (t / dur) ** 2 if up else (1 - t / dur) ** 1.5
    return nz * ramp * g

def reverb_ir(sec=2.6):
    n = int(sec * SR); t = np.arange(n) / SR
    ir = [fft_band(noise(n), 200, 6500) * np.exp(-t * 2.4) for _ in range(2)]
    return ir[0] / np.abs(ir[0]).max(), ir[1] / np.abs(ir[1]).max()

# ---------------------------------------------------------------- 0 - 9.6  the dial with no friction, then with some
room = fft_band(noise(N), 60, 700) * 0.012
L += room; R += room[::-1]
# the drone climbs with the speed: it is the tension
n = int(5.3 * SR); t = np.arange(n) / SR
for fr, g in [(55, 0.30), (82.41, 0.16), (110, 0.12)]:
    s = np.sin(2 * np.pi * fr * t + np.sin(2 * np.pi * 0.23 * t) * 0.7) * np.minimum(1, t / 1.6) * (0.35 + 0.65 * (t / 5.3) ** 1.5)
    put(L, s, 0, g); put(R, s * 0.96, 0, g)
tone = np.sin(2 * np.pi * np.cumsum(220 * (4.2 ** (t / 5.3))) / SR) * 0.06 * (t / 5.3) ** 2.2    # a rising whine
st(tone, 0, 1.0, wet=0.4)
wind = sweep_lp(noise(n), 320, 4200, 1.0) * 5 * (np.clip(t / 5.3, 0, 1) ** 1.8) * 0.5
st(wind, 0.3, 0.9)
# scrolling: soft ticks that come faster and faster, like a wheel under a finger
tk = 0.35
while tk < 5.25:
    r = 2.0 + 15.0 * (tk / 5.2) ** 2
    st(click(0.18 + 0.30 * (tk / 5.2), 3000 + 1500 * rng.random()), tk, 1.0, pan=rng.uniform(-0.35, 0.35))
    tk += 1 / r
# the three lines
for k, at in enumerate((1.0, 2.3, 3.6)):
    st(knock(90 - k * 8, 0.55, 0.18), at, 1.0, wet=0.2); st(click(0.35, 2400), at, 1.0)
# the friction rises ahead of the dial: stone grinding up through the floor, then the hit
st(swell(1.0, 700, 6500, 0.55), 4.35, 1.0, wet=0.3)
st(boom(2.6, 100, 26, 1.0), 5.3, 1.0, wet=0.25)
st(fft_band(noise(int(0.35 * SR)), 1500, 9000) * env(int(0.35 * SR), 0.001, 0.12) * 1.1, 5.3, 1.0)
# the ratchet, slowing: every tick is a ridge. Slower means heavier.
tt = TICKS['ticks']
for i, at in enumerate(tt):
    k = i / max(1, len(tt) - 1)
    f = 210 - 90 * k ** 0.8
    g = 0.22 + 0.55 * k ** 1.2
    st(knock(f, g, 0.07 + 0.08 * k), at, 1.0, pan=0.0, wet=0.12 + 0.2 * k)
    st(click(0.30 + 0.5 * k, 2400 - 900 * k), at, 1.0)
# the stop
st(boom(2.8, 68, 22, 0.95), 9.2, 1.0, wet=0.35)
st(knock(70, 1.0, 0.4), 9.2, 1.0, wet=0.3); st(click(0.8, 1800, 0.02), 9.2, 1.0)
# pull the drone and wind out: from 5.3 they are gone, and the ratchet is alone

# ---------------------------------------------------------------- 9.6 - 14.4  the title
chord = [note(m) for m in (50, 57, 61, 64, 69)]    # D A C# E A: open, a little future
for i, f in enumerate(chord):
    st(pad(f, 6.2, 0.34 if i < 3 else 0.2, a=1.8, r=2.2), T_TITLE - 0.1 + i * 0.05, 1.0, pan=(i - 2) * 0.12, wet=0.55)
for i in range(7):                                 # the dial clicks round and settles
    k = i / 6; at = T_TITLE + 0.35 + 1.15 * (1 - (1 - k) ** 1.7)
    st(click(0.55, 3600 - 500 * i, 0.014), at, 1.0); st(knock(260 - 18 * i, 0.4, 0.05), at, 1.0, wet=0.1)
st(swell(1.75, 350, 6000, 0.30), T_TITLE + 0.1, 1.0, wet=0.45)                   # the macro camera rising and pulling back
st(boom(1.4, 70, 34, 0.45), T_TITLE + 1.85, 1.0, wet=0.4)                        # and landing above the dial
st(swell(1.0, 500, 7500, 0.32), T_TITLE + 1.9, 1.0, wet=0.4)                    # the letters opening
st(boom(1.8, 60, 30, 0.5), T_TITLE + 2.9, 1.0, wet=0.4)
st(bell(note(86), 2.0, 0.07), T_TITLE + 3.0, 1.0, pan=0.2, wet=0.7); st(bell(note(93), 2.0, 0.045), T_TITLE + 3.12, 1.0, pan=-0.2, wet=0.7)

# ---------------------------------------------------------------- 14.4 - 38.4  one session
chords = [[50, 54, 57, 61, 64], [47, 54, 57, 62, 66], [43, 50, 54, 59, 62], [45, 52, 57, 61, 64]]
roots = [38, 35, 31, 33]
bars = int((T_CTA - T_WORLD) / BAR)
for b in range(bars):
    t0 = T_WORLD + b * BAR; ch = chords[b % 4]
    for i, m in enumerate(ch):
        st(pad(note(m), BAR + 0.5, 0.18, a=0.5, r=0.7), t0, 1.0, pan=(i - 2) * 0.15, wet=0.35)
    # bass: root on 1, a push before 3
    for off, d, g in ((0, 0.9, 0.5), (BEAT * 2, 0.7, 0.4), (BEAT * 3.5, 0.3, 0.3)):
        n = int(d * SR); tb = np.arange(n) / SR; f = note(roots[b % 4] + 12)
        sub = (np.sin(2 * np.pi * f * tb) + 0.3 * np.sin(2 * np.pi * 2 * f * tb)) * env(n, 0.004, d / 2.2)
        st(sub, t0 + off, g)
    # kick on 1 and 3 from the second bar
    if b >= 1:
        for beat in (0, 2): st(kick(0.8 if beat == 0 else 0.65), t0 + beat * BEAT, 1.0)
    if b >= 2:
        for e in range(8): st(hat(0.22 if e % 2 else 0.30, op=(e == 7)), t0 + e * BEAT / 2, 1.0, pan=0.25)
    if b >= 3:
        for beat in (1, 3): st(clap(0.55), t0 + beat * BEAT, 1.0, wet=0.2)
    # the arpeggio: eighths, then sixteenths in the last four bars
    step = BEAT / 2 if b < 6 else BEAT / 4
    if b >= 2:
        k = 0; tt_ = 0.0
        while tt_ < BAR - 1e-6:
            m = ch[[0, 2, 4, 3, 2, 1, 3, 4][k % 8]] + 12
            st(pluck(note(m), 0.55, 0.16 if b < 6 else 0.19), t0 + tt_, 1.0, pan=0.35 if k % 2 else -0.35, wet=0.45)
            tt_ += step; k += 1
    # a lift into every bar-line that carries a new screen
for at in (T_WORLD + 4.8, T_WORLD + 9.6, T_WORLD + 14.4, T_WORLD + 18.0, T_WORLD + 21.6):
    st(swell(0.75, 400, 9000, 0.4), at - 0.75, 1.0, wet=0.3)
    st(swell(0.5, 2500, 500, 0.35, up=False), at - 0.02, 1.0, wet=0.3)             # whoosh as the camera slides
    st(click(0.5, 3400, 0.014), at + 0.0, 1.0); st(knock(240, 0.35, 0.05), at + 0.0, 1.0)  # the corner dial's detent
st(boom(2.2, 96, 30, 0.9), T_WORLD, 1.0, wet=0.3)

# the app, heard: cursor clicks and keys, on the clips' own beats
W = T_WORLD
def tap(at, g=0.5, f=2600): st(click(g, f, 0.01), at, 1.0, pan=0.1); st(knock(520, g * 0.35, 0.03), at, 1.0)
for k in range(4): tap(W + 0.26 + k * 0.145, 0.32, 3300)                         # typing "jazz"
tap(W + 4.1, 0.7); st(bell(note(76), 1.2, 0.06), W + 4.12, 1.0, pan=0.2, wet=0.5)   # a station is picked
tap(W + 4.8 + 0.24, 0.55)                                                          # the slider is grabbed
for k in range(8): st(click(0.14, 2100 + 160 * k, 0.008), W + 4.8 + 0.5 + k * 0.28, 1.0, pan=0.0)   # its detents
tap(W + 4.8 + 3.0, 0.5)                                                            # released
tap(W + 4.8 + 4.0, 0.9)                                                            # LOCK IN
st(boom(1.6, 80, 26, 0.9), W + 8.8, 1.0, wet=0.2)
st(swell(0.8, 300, 9000, 0.55), W + 8.8, 1.0, wet=0.3)                              # the speed warp opens
# the drift: the room goes quiet and out of focus, a counter ticks, then the toast
for k in range(8): st(click(0.2, 1500, 0.01), W + 9.6 + 0.9 + k * 0.17, 1.0)
st(knock(55, 0.7, 0.5), W + 9.6 + 0.75, 1.0, wet=0.4)
st(bell(note(81), 0.9, 0.09), W + 9.6 + 2.35, 1.0, pan=0.1, wet=0.5); st(bell(note(76), 1.2, 0.08), W + 9.6 + 2.5, 1.0, pan=-0.1, wet=0.5)
# finishing pays out
fin = 30.40
for k, m in enumerate((76, 80, 83, 88)): st(bell(note(m), 1.8, 0.11), fin + k * 0.09, 1.0, pan=(k - 1.5) * 0.25, wet=0.6)
st(fft_band(noise(int(0.9 * SR)), 5000, 0) * env(int(0.9 * SR), 0.002, 0.3) * 0.9, fin, 1.0, wet=0.3)
# credits, then play
for k in range(3): st(bell(note(88 + 4 * k), 0.5, 0.05), W + 18.0 + 0.6 + k * 0.1, 1.0, pan=0.3, wet=0.4)
tap(W + 18.0 + 3.1, 0.6)
# five looks, five detents
for k, at in enumerate((0.0, 0.4, 0.8, 1.2, 2.0)): st(click(0.6, 3200, 0.014), W + 21.6 + at, 1.0); st(knock(300 - 20 * k, 0.45, 0.05), W + 21.6 + at, 1.0); st(bell(note(74 + 3 * k), 0.5, 0.05), W + 21.6 + at, 1.0, wet=0.4)

# ---------------------------------------------------------------- 38.4 - 45.6  what it lacks, then the name
st(boom(2.6, 80, 26, 0.85), T_CTA, 1.0, wet=0.3)
cc = [note(m) for m in (50, 57, 61, 64, 69, 74)]
for i, f in enumerate(cc): st(pad(f, 7.4, 0.3 if i < 4 else 0.16, a=0.9, r=3.2), T_CTA, 1.0, pan=(i - 2.5) * 0.12, wet=0.6)
for k, at in enumerate((0.3, 0.95, 1.6)):
    st(knock(95 - 8 * k, 0.5, 0.16), T_CTA + at, 1.0, wet=0.2); st(click(0.35, 2400), T_CTA + at, 1.0)
for k, m in enumerate((81, 85, 88, 93, 85, 88)): st(pluck(note(m), 0.7, 0.14), T_CTA + 0.3 + k * 0.6, 1.0, pan=0.3 * (1 if k % 2 else -1), wet=0.55)
st(swell(1.0, 500, 8500, 0.4), T_CTA + 2.6, 1.0, wet=0.4)
st(boom(1.8, 70, 30, 0.6), T_CTA + 3.6, 1.0, wet=0.4)
st(bell(note(93), 2.4, 0.1), T_CTA + 4.7, 1.0, wet=0.6)
st(click(0.6, 3600, 0.014), T_CTA + 6.3, 1.0); st(knock(250, 0.5, 0.06), T_CTA + 6.3, 1.0, wet=0.3)
st(bell(note(98), 2.6, 0.085), T_CTA + 6.35, 1.0, pan=0.1, wet=0.7)

# ---------------------------------------------------------------- mix
irL, irR = reverb_ir(2.4)
def conv(x, ir):
    n = len(x) + len(ir); m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[:len(x)]
rl = conv(WL, irL) * 0.04; rr = conv(WR, irR) * 0.04
oL = L + rl; oR = R + rr
# the room goes muffled while the person is away (the veil), and opens again with the toast
a0, a1 = int((T_WORLD + 9.6 + 0.55) * SR), int((T_WORLD + 9.6 + 2.45) * SR)
fl = lambda x: sweep_lp(x[a0:a1], 420, 420)
xf = np.ones(a1 - a0); k = int(0.12 * SR); xf[:k] = np.linspace(0, 1, k); xf[-k * 2:] = np.linspace(1, 0, k * 2)
oL[a0:a1] = oL[a0:a1] * (1 - xf) + fl(oL) * xf * 1.4; oR[a0:a1] = oR[a0:a1] * (1 - xf) + fl(oR) * xf * 1.4
# automate the whole mix: quiet and tight at the start, loudest at the hit and in the middle of the session, hushed at the title, then open again
curve = [(0, -26), (1.5, -17), (3.0, -11), (5.0, -6), (5.3, 0), (8.9, -1), (9.25, -3), (9.6, -13), (11.5, -11), (13.6, -8.5), (14.3, -7), (14.45, -3), (21, -3), (29, 0), (36, -1), (38.3, -2), (38.45, -5), (42.0, -7), (44.6, -12), (45.6, -30)]
ts = np.arange(N) / SR
g = 10 ** (np.interp(ts, [c[0] for c in curve], [c[1] for c in curve]) / 20)
oL = oL * g; oR = oR * g
# a gentle fade at the very end and a hard silence before the first sound, so the film starts from nothing
fade = np.ones(N); e = int(0.45 * SR); fade[-e:] = np.linspace(1, 0, e) ** 2; fade[:int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))
oL *= fade; oR *= fade
pk = max(np.abs(oL).max(), np.abs(oR).max()); oL = np.tanh(oL / pk * 1.15) * 0.86; oR = np.tanh(oR / pk * 1.15) * 0.86
raw = '/tmp/claude-0/score4_raw.wav'
with wave.open(raw, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.stack([oL, oR], 1) * 32767).astype('<i2').tobytes())
out = '/home/user/ultraviolet/video/public/v4/score.wav'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', 'highpass=f=28,acompressor=threshold=-14dB:ratio=1.5:attack=10:release=200,loudnorm=I=-15:TP=-2.5:LRA=14,alimiter=limit=0.68:level=0', '-ar', '44100', out], check=True)
print('wrote', out)
