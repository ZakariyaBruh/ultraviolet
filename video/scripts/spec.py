import sys, numpy as np
from PIL import Image
from pedalboard.io import AudioFile
src, dst = sys.argv[1], sys.argv[2]
with AudioFile(src) as f: a = f.read(f.frames); sr = f.samplerate
m = a.mean(0); n = 2048; hop = 512
w = np.hanning(n); frames = (len(m) - n) // hop
S = np.abs(np.stack([np.fft.rfft(m[i*hop:i*hop+n]*w) for i in range(frames)], 1))
S = 20*np.log10(S/(n/4)+1e-9)
freqs = np.fft.rfftfreq(n, 1/sr); keep = freqs < 12000; S = S[keep]
S = np.clip((S + 100) / 75, 0, 1)
# log-ish frequency axis: resample rows
H = 360; idx = (np.geomspace(1, S.shape[0]-1, H)).astype(int)
img = S[idx][::-1]
W = img.shape[1]; sc = 1800 / W
im = Image.fromarray((img * 255).astype(np.uint8)).resize((1800, H))
pal = np.array([[0,0,0],[20,10,60],[90,20,110],[200,50,80],[250,160,40],[255,250,200]], float)
x = np.asarray(im)/255*(len(pal)-1); lo = np.floor(x).astype(int).clip(0,len(pal)-2); fr = (x-lo)[...,None]
rgb = (pal[lo]*(1-fr)+pal[lo+1]*fr).astype(np.uint8)
dur = len(m)/sr
from PIL import ImageDraw
im2 = Image.fromarray(rgb); d = ImageDraw.Draw(im2)
for t in [6.2,7,13,21,29,35]:
    x0 = int(t/dur*1800); d.line([(x0,0),(x0,H)], fill=(0,255,255), width=1); d.text((x0+3,3), str(t), fill=(0,255,255))
im2.save(dst)
