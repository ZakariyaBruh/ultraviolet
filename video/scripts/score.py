import numpy as np, wave
SR=44100; D=45.0; N=int(SR*D)
rng=np.random.default_rng(11)
L=np.zeros(N); R=np.zeros(N)
beatbus=np.zeros(N)   # things that duck to the kick (pads, bass)
def put(buf,sig,at,gain=1.0):
    i=int(at*SR); j=min(N,i+len(sig))
    if i>=N or j<=i: return
    buf[i:j]+=sig[:j-i]*gain
def stereo(sig,at,gain=1.0,pan=0.0):
    put(L,sig,at,gain*(1-max(0,pan))); put(R,sig,at,gain*(1+min(0,pan)))
def duck(sig,at,gain=1.0,pan=0.0):
    tmp=np.zeros(N); put(tmp,sig,at,gain); beatbus_l=tmp*(1-max(0,pan)); beatbus_r=tmp*(1+min(0,pan))
    return beatbus_l,beatbus_r
BL=np.zeros(N); BR=np.zeros(N)
def bus(sig,at,gain=1.0,pan=0.0):
    put(BL,sig,at,gain*(1-max(0,pan))); put(BR,sig,at,gain*(1+min(0,pan)))
def env(n,a,r):
    e=np.exp(-np.arange(n)/SR/r)
    na=int(a*SR)
    if na>0: e[:na]*=np.linspace(0,1,na)
    return e
def kick(g=1.0):
    n=int(0.4*SR); t=np.arange(n)/SR; f=42+120*np.exp(-t*30)
    s=np.sin(2*np.pi*np.cumsum(f)/SR)*env(n,0.001,0.16)
    s+=rng.standard_normal(n)*env(n,0.0005,0.006)*0.25
    return s*g
def boom(dur=2.8,f0=100,f1=26,g=1.0):
    n=int(dur*SR); t=np.arange(n)/SR; f=f1+(f0-f1)*np.exp(-t*4)
    s=np.sin(2*np.pi*np.cumsum(f)/SR)*env(n,0.002,0.7)
    nz=np.diff(rng.standard_normal(n+1))*env(n,0.001,0.5)*0.35
    return (s*1.1+nz)*g
def clap(g=1.0):
    n=int(0.28*SR); t=np.arange(n)/SR
    nz=np.diff(rng.standard_normal(n+1))
    e=env(n,0.0005,0.07)*(1+0.8*np.exp(-((t-0.012)%0.02)*200)) 
    return nz*e*0.5*g+np.sin(2*np.pi*190*t)*env(n,0.001,0.05)*0.25*g
def hat(g=1.0,open_=False):
    n=int((0.22 if open_ else 0.05)*SR)
    return np.diff(rng.standard_normal(n+1))*env(n,0.0003,0.09 if open_ else 0.012)*0.28*g
def pluck(f,dur,bright=1.0,g=1.0,harm=14):
    n=int(dur*SR); t=np.arange(n)/SR; s=np.zeros(n)
    for k in range(1,harm+1):
        s+=np.sin(2*np.pi*f*k*t+k)*(1.0/k)*np.exp(-t*(2+k*3.2/bright))
    return s*g
def pad(f,dur,g=1.0):
    n=int(dur*SR); t=np.arange(n)/SR; s=np.zeros(n)
    for det in (-0.006,0.0,0.007):
        for k in range(1,9):
            s+=np.sin(2*np.pi*f*(1+det)*k*t+k*1.7)*(1.0/k)
    a=np.minimum(1,t/0.8); r=np.minimum(1,(dur-t)/0.9)
    return s*a*r*g/3
def riser(dur,g=1.0,f0=200,f1=5000):
    n=int(dur*SR); t=np.arange(n)/SR
    ramp=(t/dur)**2.0
    nz=np.diff(rng.standard_normal(n+1))*ramp*0.5
    f=f0*(f1/f0)**(t/dur)
    tone=np.sin(2*np.pi*np.cumsum(f)/SR)*ramp*0.25
    return (nz+tone)*g
def note(m): return 440*2**((m-69)/12)

# ---------- 0-4: power on, boot, test card
put(L,boom(1.6,70,28,0.9),0.28); put(R,boom(1.6,70,28,0.9),0.28)
n=int(1.4*SR); t=np.arange(n)/SR; whine=np.sin(2*np.pi*np.cumsum(2200+9000*np.exp(-t*3))/SR)*env(n,0.002,0.35)*0.10
stereo(whine,0.30,1.0)
for k in range(32):        # boot terminal keys
    at=0.62+k*0.07+ (k//6)*0.0
    if at<2.5:
        n=int(0.03*SR); tick=np.diff(rng.standard_normal(n+1))*env(n,0.0003,0.006)*0.35
        stereo(tick,at,0.8,pan=rng.uniform(-0.3,0.3))
for at in (0.62,0.81,1.0,1.19,1.38,1.57,1.76):
    stereo(pluck(note(81),0.25,1.0,0.05,6),at,1.0,0.0)
n=int(1.2*SR); t=np.arange(n)/SR; tone=np.sin(2*np.pi*1000*t)*0.09*np.minimum(1,(1.2-t)/0.05)
stereo(tone,2.85,1.0)
n=int(0.5*SR); stereo(np.diff(rng.standard_normal(n+1))*env(n,0.001,0.3)*0.5,2.33,1.0)
# drone under everything until 10
for fr,g in [(55,0.30),(82.41,0.14),(110,0.10)]:
    n=int(9.8*SR); t=np.arange(n)/SR
    s=np.sin(2*np.pi*fr*t+np.sin(2*np.pi*0.2*t)*0.5)*np.minimum(1,t/2.0)
    put(L,s,0.0,g*0.8); put(R,s*0.97,0.0,g*0.8)

# ---------- 4-10: the feed
t0=4.0
put(L,riser(5.75,0.9),t0); put(R,riser(5.75,0.9),t0)
tt=t0; step=0.5
while tt<9.7:
    stereo(pluck(note(33),0.35,0.6,0.55,10),tt,1.0)
    frac=(tt-t0)/5.7; step=0.5*(1-frac)+0.075*frac
    tt+=step
tt=t0+0.25; 
while tt<9.7:
    frac=(tt-t0)/5.7; stereo(hat(0.5+0.9*frac),tt,1.0,pan=0.3*np.sin(tt*9)); tt+=0.25*(1-frac)+0.06*frac
# silence gate 9.72-10.0 applied later

# ---------- 10-45 the drive
def chord_for(t):
    bar=int((t-10)//2); return [[57,60,64],[53,57,60],[60,64,67],[55,59,62]][bar%4]
bassroot=[33,29,36,31]
t=10.0
put(L,boom(3.2,110,24,1.15),10.0); put(R,boom(3.2,110,24,1.15),10.0)
# crash
n=int(2.6*SR); crash=np.diff(rng.standard_normal(n+1))*env(n,0.001,0.9)*0.5; stereo(crash,10.0,1.0)
beat=0.5
b=10.0; i=0
while b<41.0-1e-6:
    lowE = 0.7 if (30<=b<34) else 1.0
    if b<41: stereo(kick(0.95*lowE),b,1.0)
    stereo(hat(0.9),b+beat/2,1.0,pan=0.25)
    if i%2==1: stereo(clap(0.9),b,1.0)
    if i%4==3: stereo(hat(0.8,True),b+beat/2,1.0,pan=-0.25)
    # bass: 8ths on the root, ducked
    bar=int((b-10)//2); root=bassroot[bar%4]
    bus(pluck(note(root),0.42,0.8,0.55,10),b,1.0)
    bus(pluck(note(root+(12 if i%4==2 else 0)),0.3,0.8,0.4,8),b+beat/2,1.0)
    i+=1; b+=beat
# pads per 2 bars
tpad=10.0
while tpad<41.0:
    for m in chord_for(tpad):
        bus(pad(note(m),4.2,0.20),tpad,1.0,pan=0.3*(-1)**m)
    tpad+=4.0
# arpeggio from 16 to 41 (16ths)
step16=beat/4; ta=16.0; k=0
while ta<41.0:
    ch=chord_for(ta); order=[0,1,2,1,2,1,2,1] if (ta<24 or ta>=34) else [0,2,1,2,0,2,1,2]
    m=ch[order[k%8]]+12
    gain=0.30 if ta<30 else 0.34
    stereo(pluck(note(m),0.22,1.6,gain,12),ta,1.0,pan=0.45*np.sin(ta*2.1))
    ta+=step16; k+=1
# builds into cuts
for c,d,g in [(16,2.0,0.9),(24,2.0,0.8),(34,2.0,0.7),(41,0,0)]:
    if d: put(L,riser(d,g),c-d); put(R,riser(d,g),c-d)
# snare rolls at the ends of 14-16 and 28-30 and 36-38
def roll(t_end,dur):
    tt=t_end-dur; sp=0.25
    while tt<t_end-0.02:
        stereo(clap(0.5+0.6*(tt-(t_end-dur))/dur),tt,1.0); sp=max(0.06,sp*0.86); tt+=sp
roll(16.0,2.0); roll(24.0,2.0); roll(30.0,1.2); roll(38.0,2.0)
# hits on the cuts
for c,g in [(16,0.95),(20,0.8),(24,0.9),(30,0.8),(34,0.8),(38,0.9)]:
    put(L,boom(1.8,95,30,g),c); put(R,boom(1.8,95,30,g),c)
put(L,boom(1.2,60,24,0.9),22.2); put(R,boom(1.2,60,24,0.9),22.2)   # the drift
for c in (38.6,39.2,39.8,40.4):
    stereo(clap(1.0),c,1.0); stereo(kick(1.1),c,1.0)
# ---------- 41-45: sign off
for m,g in [(45,0.5),(52,0.4),(57,0.4),(60,0.35),(64,0.3),(71,0.2)]:
    bus(pad(note(m),4.2,g),41.0,1.0,pan=0.3*(-1)**m)
put(L,boom(4.0,80,22,1.1),41.0); put(R,boom(4.0,80,22,1.1),41.0)
stereo(pluck(note(93),2.0,0.5,0.25,8),41.1,1.0)
stereo(pluck(note(100),1.6,0.5,0.18,6),41.6,1.0,pan=0.3)
n=int(1.0*SR); t=np.arange(n)/SR
off=np.sin(2*np.pi*np.cumsum(9000*np.exp(-t*5))/SR)*env(n,0.002,0.25)*0.12
stereo(off,44.1,1.0)
stereo(boom(0.8,60,25,0.7),44.5,1.0)

# sidechain the bus to the kick from 10s
t=np.arange(N)/SR
sc=np.ones(N)
m=(t>=10)&(t<41)
ph=(t-10)%beat
sc[m]=1-0.7*np.exp(-ph[m]/0.11)
L+=BL*sc; R+=BR*sc
# bus under 10s: nothing; the gate: silence 9.72-10.0 for everything except the drone fade
gate=np.ones(N); g0,g1=int(9.72*SR),int(10.0*SR); gate[g0:g1]=0.0
L*=gate; R*=gate
fade=np.clip((D-t)/0.2,0,1); L*=fade; R*=fade
m=max(np.abs(L).max(),np.abs(R).max()); L/=m*1.05; R/=m*1.05
pcm=(np.stack([L,R],1)*32767).astype(np.int16)
with wave.open('/tmp/claude-0/raw2.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok')
