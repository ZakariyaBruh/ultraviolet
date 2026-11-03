# Frame and sound checks for a rendered trailer. Usage: qa.py movie.mp4 [fps]
import subprocess, sys, re, json
mv = sys.argv[1]; fps = float(sys.argv[2]) if len(sys.argv) > 2 else 24
def stats(vf):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', mv, '-an', '-vf', vf + ',metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-'], capture_output=True, text=True).stdout
    return [float(m) for m in re.findall(r'YAVG=([0-9.]+)', out)]
luma = stats('scale=480:-1,signalstats')
diff = stats('scale=480:-1,tblend=all_mode=difference,signalstats')
n = min(len(luma), len(diff))
print(f'frames {n}  duration {n / fps:.2f}s')
print('\nblack frames (YAVG<1.5), as ranges:')
rng = []; s = None
for i in range(n):
    if luma[i] < 1.5 and s is None: s = i
    if luma[i] >= 1.5 and s is not None: rng.append((s, i - 1)); s = None
if s is not None: rng.append((s, n - 1))
print('  ', [(f'{a / fps:.2f}', f'{b / fps:.2f}') for a, b in rng] or 'none')
print('\nsudden luma jumps (|d|>18 between neighbours) = flashes or hard cuts:')
for i in range(1, n):
    if abs(luma[i] - luma[i - 1]) > 18: print(f'   {i / fps:6.2f}s  {luma[i - 1]:.1f} -> {luma[i]:.1f}')
print('\nfrozen stretches (frame difference < 0.02 for >= 12 frames):')
run = 0
for i in range(1, n + 1):
    if i < n and diff[i] < 0.02: run += 1
    else:
        if run >= 12: print(f'   {(i - run) / fps:6.2f}s - {i / fps:6.2f}s  ({run / fps:.1f}s)')
        run = 0
print('\nbusiest frames (largest frame-to-frame change):')
for i in sorted(range(1, n), key=lambda k: -diff[k])[:8]: print(f'   {i / fps:6.2f}s  diff {diff[i]:.1f}')
# sound
a = subprocess.run(['ffmpeg', '-v', 'info', '-i', mv, '-vn', '-af', 'loudnorm=print_format=json,astats=metadata=1:reset=0', '-f', 'null', '-'], capture_output=True, text=True).stderr
m = re.search(r'\{[^{}]*"input_i"[^{}]*\}', a, re.S)
if m:
    j = json.loads(m.group(0)); print('\nloudness: integrated', j['input_i'], 'LUFS, true peak', j['input_tp'], 'dBTP, range', j['input_lra'], 'LU')
sd = subprocess.run(['ffmpeg', '-v', 'info', '-i', mv, '-vn', '-af', 'silencedetect=n=-48dB:d=0.25', '-f', 'null', '-'], capture_output=True, text=True).stderr
print('quiet stretches (<-48 dB):', re.findall(r'silence_start: ([0-9.]+)|silence_end: ([0-9.]+)', sd)[:12])
