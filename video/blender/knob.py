# Friction trailer, 3D shots. blender -b -P knob.py -- <shot> <frame> <w> <h> <samples> <out>
#   shot: run   = the dial slides with no friction, the floor then rises into ridges and stops it
#         top   = the dial seen from above on a transparent background (the O of the wordmark)
import bpy, bmesh, math, sys, os, json

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SHOT = argv[0] if len(argv) > 0 else 'run'
FRAME = int(argv[1]) if len(argv) > 1 else 1
W = int(argv[2]) if len(argv) > 2 else 1280
H = int(argv[3]) if len(argv) > 3 else 720
SAMPLES = int(argv[4]) if len(argv) > 4 else 16
OUT = argv[5] if len(argv) > 5 else '/tmp/claude-0/bl/test.png'

FPS = 24
SPACING = 0.9
YEL = (1.0, 0.62, 0.035, 1)          # #ffd23f in linear light

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS

def mat(name, base, rough=0.3, metal=0.0, coat=0.0, emit=None, emit_k=0.0, spec=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = base
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Specular IOR Level'].default_value = spec
    if emit:
        b.inputs['Emission Color'].default_value = emit
        b.inputs['Emission Strength'].default_value = emit_k
    return m

def knob():
    R, TEETH, Hh = 1.0, 96, 0.72
    bm = bmesh.new(); top, bot = [], []; n = TEETH * 2
    for i in range(n):
        a = i / n * math.tau; r = R if i % 2 == 0 else R * 0.972
        x, y = math.cos(a) * r, math.sin(a) * r
        bot.append(bm.verts.new((x, y, 0))); top.append(bm.verts.new((x, y, Hh)))
    for i in range(n):
        j = (i + 1) % n; bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bm.faces.new(top); bm.faces.new(bot[::-1])
    me = bpy.data.meshes.new('knob'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('knob', me); sc.collection.objects.link(ob)
    bv = ob.modifiers.new('bevel', 'BEVEL'); bv.width = 0.018; bv.segments = 2; bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(50)
    ob.data.materials.append(mat('yellow', YEL, rough=0.2, coat=1.0, spec=0.6))
    for p in ob.data.polygons: p.use_smooth = True
    bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=0.63, depth=0.04, location=(0, 0, Hh))
    ins = bpy.context.object; ins.name = 'insert'
    bv = ins.modifiers.new('bevel', 'BEVEL'); bv.width = 0.012; bv.segments = 2
    ins.data.materials.append(mat('rubber', (0.008, 0.010, 0.016, 1), rough=0.42, spec=0.3))
    bpy.ops.object.shade_smooth()
    # three fine grooves in the insert, so it reads as a made thing
    for r in (0.30, 0.46):
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.008, major_segments=96, minor_segments=8, location=(0, 0, Hh + 0.02))
        t = bpy.context.object; t.data.materials.append(mat('groove', (0.0, 0.0, 0.0, 1), rough=0.8)); t.parent = ob
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.36, 0, Hh + 0.028))
    ind = bpy.context.object; ind.name = 'indicator'; ind.scale = (0.46, 0.075, 0.03)
    ind.data.materials.append(mat('ind', YEL, rough=0.3, emit=YEL, emit_k=3.0))
    for o in (ins, ind): o.parent = ob
    pivot = bpy.data.objects.new('pivot', None); sc.collection.objects.link(pivot); ob.parent = pivot
    return pivot, ob

pivot, kn = knob()

def area(name, loc, rot, size, energy, color, shape='RECTANGLE', sy=None):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.color = color; l.shape = shape; l.size = size
    if sy: l.size_y = sy
    o = bpy.data.objects.new(name, l); sc.collection.objects.link(o)
    o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]
    return o

sc.render.engine = 'CYCLES'
cy = sc.cycles
cy.device = 'CPU'; cy.samples = SAMPLES; cy.use_denoising = True; cy.denoiser = 'OPENIMAGEDENOISE'
cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.03
cy.max_bounces = 6; cy.diffuse_bounces = 2; cy.glossy_bounces = 4; cy.transmission_bounces = 2; cy.volume_bounces = 0
cy.sample_clamp_indirect = 8
sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.resolution_percentage = 100
sc.view_settings.view_transform = 'Khronos PBR Neutral'; sc.view_settings.exposure = float(os.environ.get('EXPO', '0.0'))
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '8'
sc.render.image_settings.color_mode = 'RGBA' if SHOT == 'top' else 'RGB'
sc.render.film_transparent = (SHOT == 'top')
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True
sc.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.004, 0.006, 0.013, 1)
sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
sc.render.filepath = OUT

cam_d = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
tgt = bpy.data.objects.new('tgt', None); sc.collection.objects.link(tgt)
c = cam.constraints.new('TRACK_TO'); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'

if SHOT == 'top':
    cam_d.type = 'ORTHO'; cam_d.ortho_scale = 2.6
    cam.location = (0, 0, 8); tgt.location = (0, 0, 0.7); c.up_axis = 'UP_Y'
    pivot.rotation_euler = (0, 0, math.radians(90))      # indicator points to 12 o'clock
    kn.location = (0, 0, 0)
    area('key', (-2.5, -3.5, 6), (30, -20, 0), 5, 700, (1, 0.97, 0.9), shape='SQUARE')
    area('rim', (3.5, 3.0, 4), (-35, 30, 0), 5, 500, (0.55, 0.8, 1.0), shape='SQUARE')
    bpy.ops.render.render(write_still=True); print('TOP done'); sys.exit(0)

# ---- RUN shot ------------------------------------------------------------
cam_d.lens = 38; cam_d.sensor_width = 36
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 2.6; cam_d.dof.focus_object = tgt
sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = 0.6

T1, T_END = 5.4, 9.2
V0, V1 = 7.0, 36.0
SCALE_D = 1.0
def kx(t):
    if t <= T1: return V0 * t + 0.5 * (V1 - V0) / T1 * t * t
    x1 = V0 * T1 + 0.5 * (V1 - V0) * T1
    D = T_END - T1; td = min(t - T1, D); p = 2.4
    s_ = V1 * D / (p + 1) * (1 - (1 - td / D) ** (p + 1))
    return x1 + s_ * SCALE_D
def kv(t): return (kx(t + 1e-3) - kx(max(0, t - 1e-3))) / 2e-3

# floor, strips and ridges
bpy.ops.mesh.primitive_plane_add(size=1, location=(80, 0, 0))
fl = bpy.context.object; fl.scale = (600, 60, 1)
fl.data.materials.append(mat('floor', (0.005, 0.008, 0.018, 1), rough=0.05, spec=0.8))
bpy.ops.mesh.primitive_cube_add(size=1)
rid = bpy.context.object; rid.name = 'ridge0'
bv = rid.modifiers.new('bevel', 'BEVEL'); bv.width = 0.014; bv.segments = 2
rid.data.materials.append(mat('ridge', (0.035, 0.05, 0.1, 1), rough=0.1, metal=0.85, spec=1.0))
ridge_mesh = rid.data
bpy.data.objects.remove(rid)

N = 190
FRONT_T0, FRONT_V, RISE = 4.5, 70.0, 0.32
xs = kx(FRONT_T0)
def smooth(u): u = max(0.0, min(1.0, u)); return u * u * (3 - 2 * u)
t = (FRAME - 1) / FPS
for i in range(N):
    xi = 6 + i * SPACING
    te = FRONT_T0 + (xi - xs) / FRONT_V
    h = smooth((t - te) / RISE) if xi > xs else 0.0
    o = bpy.data.objects.new('r%d' % i, ridge_mesh); sc.collection.objects.link(o)
    o.modifiers.new('bevel', 'BEVEL').width = 0.014
    H_ = 0.012 + 0.125 * h
    o.scale = (0.15, 9.0, H_); o.location = (xi, 0, H_ / 2 - 0.004)

# strip lamps (their reflections are the streaks on the floor)
for i in range(30):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(i * 7.5 - 20, 10, 4.6))
    s = bpy.context.object; s.scale = (2.8, 0.12, 0.12)
    s.data.materials.append(mat('strip', (0.5, 0.8, 1, 1), rough=1, emit=(0.5, 0.82, 1.0, 1), emit_k=5 if i % 2 == 0 else 2.2))
    s.visible_camera = False

x = kx(t); v = kv(t)
k = smooth((t - T1) / (T_END - T1))
spin_rate = 22 * (1.0 if t < T1 else max(0.0, 1 - (t - T1) / 3.4))
pivot.location = (x, 0, 0)
pivot.rotation_euler = (0, 0, math.radians(90 - spin_rate * min(t, T1) * 0.5 - (spin_rate * 0.4 * (t - T1) if t > T1 else 0)))
def ridge_h(xr):
    te = FRONT_T0 + (xr - xs) / FRONT_V
    return (0.012 + 0.125 * smooth((t - te) / RISE)) if xr > xs else 0.012
lift = 0.0
for i in range(N):
    xr = 6 + i * SPACING
    d = abs(x - xr)
    w = 1 - smooth((d - 0.86) / 0.26)
    lift = max(lift, (ridge_h(xr) - 0.004) * w)
ph = ((x - 6) / SPACING) % 1.0
sp = min(1.0, v / 12.0)
rattle = 0.02 * (math.sin(ph * math.pi) ** 2) * sp if lift > 0.05 else 0.0
kn.location = (0, 0, 0.012 + lift + rattle)
kn.rotation_euler = (math.radians(1.1 * math.sin(ph * math.tau) * sp * (1 if lift > 0.05 else 0)), math.radians(0.8 * math.cos(ph * math.tau) * sp * (1 if lift > 0.05 else 0)), 0)

# camera ahead and to the side, looking back at the dial; closer and lower as it stops
lead = 5.0 - 2.2 * k
dist = 7.2 - 2.4 * k
h = 0.85 + 0.3 * k
cam.location = (x + lead, -dist, h)
tgt.location = (x - 0.4 + 0.0 * k, 0, 0.42)
punch = math.exp(-((t - (T1 + 0.05)) / 0.12) ** 2)
cam_d.lens = 38 + 14 * k + 3.5 * punch
cam.location = (cam.location.x + 0.05 * math.sin(t * 90) * punch, cam.location.y, cam.location.z + 0.05 * math.sin(t * 70 + 1) * punch)

cam.location = (cam.location.x + 0.05 * math.sin(t * 1.7), cam.location.y + 0.04 * math.sin(t * 1.3 + 2), cam.location.z + 0.03 * math.sin(t * 2.1 + 1))
area('ice', (x, -5, 5.5), (58, 0, 0), 22, 2100, (0.5, 0.82, 1.0), sy=0.9)
area('back', (x + 30, 14, 1.2), (90, 0, 55), 18, 1800, (0.45, 0.7, 1.0), sy=0.4)
area('warm', (x + 2.0, -6.5, 3.0), (64, 0, 0), 4, 420, (1.0, 0.92, 0.75), sy=2)
area('rim', (x - 5, -1.5, 3.2), (70, 0, -80), 3, 300, (0.55, 0.8, 1.0), shape='SQUARE')

# tick times (the knob crossing a risen ridge) for the score
ticks = []
last = None
for f in range(1, int(T_END * FPS) + 30):
    tt = (f - 1) / FPS
    idx = math.floor((kx(tt) - 6) / SPACING)
    te = FRONT_T0 + ((6 + idx * SPACING) - xs) / FRONT_V
    if last is not None and idx != last and tt > T1 - 0.2 and tt > te: ticks.append(round(tt, 4))
    last = idx
json.dump({'ticks': ticks, 'T1': T1, 'T_END': T_END, 'fps': FPS}, open(os.path.join(os.path.dirname(OUT) or '.', 'ticks.json'), 'w'))

bpy.ops.render.render(write_still=True)
print('FRAME', FRAME, 't=%.2f x=%.1f v=%.1f' % (t, x, v), 'ticks', len(ticks))
