# Friction trailer v6, the hook. One animation, baked from a spring/physics simulation into real keyframes (FCurveKeyframePoints), so Cycles
# motion blur sees true motion: the dial slides AND spins on the glass, speeds up, the floor rises into ridges, the ridges bite and it grinds to a stop.
#   blender -b -P hook6.py -- <first> <last> <outdir> [w h samples]
import bpy, bmesh, math, sys, os, json, random

argv = sys.argv[sys.argv.index('--') + 1:]
F0, F1 = int(argv[0]), int(argv[1]); OUT = argv[2]
W = int(argv[3]) if len(argv) > 3 else 1440; H = int(argv[4]) if len(argv) > 4 else 810; SAMPLES = int(argv[5]) if len(argv) > 5 else 10
FPS = 30; DT = 1 / FPS; NF = 186            # 6.2 s
YEL = (1.0, 0.62, 0.035, 1)
SPACING = 0.9
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.fps = FPS; sc.frame_start = F0; sc.frame_end = F1

def mat(name, base, rough=0.3, metal=0.0, coat=0.0, emit=None, emit_k=0.0, spec=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = base; b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat; b.inputs['Specular IOR Level'].default_value = spec
    if emit: b.inputs['Emission Color'].default_value = emit; b.inputs['Emission Strength'].default_value = emit_k
    return m

_bags = {}
def _bag(idb):
    """Blender 4.4+ keeps animation in actions with layers, strips and slots; this returns the channel bag of an object (or its data) to put F-curves in"""
    key = idb.as_pointer()
    if key in _bags: return _bags[key]
    ad = idb.animation_data_create()
    act = bpy.data.actions.new(idb.name + 'Action')
    slot = act.slots.new(id_type=idb.id_type, name=idb.name)
    layer = act.layers.new('L'); strip = layer.strips.new(type='KEYFRAME')
    ad.action = act; ad.action_slot = slot
    cb = strip.channelbag(slot, ensure=True)
    _bags[key] = cb; return cb

def bake(obj, path, idx, values):
    """one keyframe per frame, straight lines between them: the curve itself is the simulation (bpy.types.FCurveKeyframePoints)"""
    cb = _bag(obj)
    fc = cb.fcurves.find(path, index=idx) or cb.fcurves.new(path, index=idx)
    fc.keyframe_points.add(len(values))
    co = []
    for i, v in enumerate(values): co += [i + 1, v]
    fc.keyframe_points.foreach_set('co', co)
    for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    fc.update()

def sm(u): u = max(0.0, min(1.0, u)); return u * u * (3 - 2 * u)

class Spring:
    """a retargetable spring (Apple's 'response' and damping ratio): position and velocity carry over when the target moves"""
    def __init__(self, x, response=0.5, zeta=0.9): self.x = x; self.v = 0.0; self.w = 2 * math.pi / response; self.z = zeta
    def step(self, target, dt):
        n = max(1, int(dt / 0.002)); h = dt / n
        for _ in range(n):
            a = self.w * self.w * (target - self.x) - 2 * self.z * self.w * self.v
            self.v += a * h; self.x += self.v * h
        return self.x

# ---------------------------------------------------------------- the simulation of the dial (0.005 s steps), sampled on the frames
V0, V1 = 9.0, 36.0; T_ACC = 3.85; T_FRONT = 2.45; FRONT_V = 85.0; D = 2.35; PBRAKE = 2.2
def speed(t):
    if t < T_ACC: return V0 + (V1 - V0) * sm(t / T_ACC) ** 1.15
    td = min(t - T_ACC, D); return V1 * (1 - td / D) ** PBRAKE
STEP = 0.005
xs, ws, angs = [], [], []
x = 0.0; ang = 0.0; t = 0.0
spin_peak = 5.2 * 360                     # degrees per second at full speed: five turns a second
def omega(t, v):
    if t < T_ACC: return 540 + (spin_peak - 540) * sm(t / T_ACC)
    return spin_peak * (1 - min(1, (t - T_ACC) / D)) ** 1.6      # grinds down with the ridges
steps = int((NF + 5) * DT / STEP)
sim = []
for i in range(steps + 1):
    t = i * STEP; v = speed(t); w = omega(t, v)
    sim.append((t, x, ang, v, w)); x += v * STEP; ang += w * STEP
def at(t, k):
    i = min(len(sim) - 1, int(t / STEP)); return sim[i][k]
T_STOP = T_ACC + D
# at rest it snaps to the nearest detent (thirty degrees) with a small overshoot, like a real knob finding its click
final_free = at(T_STOP, 2); detent = round(final_free / 30.0) * 30.0
frames = list(range(NF))
dial_x = [at(f * DT, 1) for f in frames]
def spin_at(t):
    free = at(min(t, T_STOP), 2)
    if t <= T_STOP: return free
    k = (t - T_STOP) / 0.45
    # spring settle toward the detent
    z = 0.38; w = 14.0; tt = t - T_STOP
    e = 1 - math.exp(-z * w * tt) * (math.cos(w * math.sqrt(1 - z * z) * tt) + z / math.sqrt(1 - z * z) * math.sin(w * math.sqrt(1 - z * z) * tt))
    return free + (detent - free) * e
dial_ang = [spin_at(f * DT) for f in frames]
x_stop = at(T_STOP, 1)

# ---------------------------------------------------------------- the dial
def knob():
    R, TEETH, Hh = 1.0, 96, 0.72
    bm = bmesh.new(); top, bot = [], []; n = TEETH * 2
    for i in range(n):
        a = i / n * math.tau; r = R if i % 2 == 0 else R * 0.972
        bot.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, 0))); top.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, Hh)))
    for i in range(n): j = (i + 1) % n; bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bm.faces.new(top); bm.faces.new(bot[::-1])
    me = bpy.data.meshes.new('knob'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('knob', me); sc.collection.objects.link(ob)
    bv = ob.modifiers.new('bevel', 'BEVEL'); bv.width = 0.018; bv.segments = 2; bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(50)
    ob.data.materials.append(mat('yellow', YEL, rough=0.2, coat=1.0, spec=0.6))
    for p in ob.data.polygons: p.use_smooth = True
    bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=0.63, depth=0.04, location=(0, 0, Hh)); ins = bpy.context.object
    bv = ins.modifiers.new('bevel', 'BEVEL'); bv.width = 0.012; bv.segments = 2
    ins.data.materials.append(mat('rubber', (0.008, 0.010, 0.016, 1), rough=0.42, spec=0.3)); bpy.ops.object.shade_smooth()
    for r in (0.30, 0.46):
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.008, major_segments=96, minor_segments=8, location=(0, 0, Hh + 0.02))
        tt = bpy.context.object; tt.data.materials.append(mat('groove', (0, 0, 0, 1), rough=0.8)); tt.parent = ob
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.36, 0, Hh + 0.028)); ind = bpy.context.object; ind.scale = (0.46, 0.075, 0.03)
    ind.data.materials.append(mat('ind', YEL, rough=0.3, emit=YEL, emit_k=3.0))
    # a bright notch on the knurled side, so the turning reads from the side too
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.985, 0, Hh * 0.62)); nt = bpy.context.object; nt.scale = (0.04, 0.05, 0.22)
    nt.data.materials.append(mat('notch', (1, 0.8, 0.2, 1), rough=0.3, emit=(1, 0.78, 0.2, 1), emit_k=2.2))
    for o in (ins, ind, nt): o.parent = ob
    return ob
kn = knob()
bake(kn, 'rotation_euler', 2, [math.radians(90 - a) for a in dial_ang])
bake(kn, 'location', 0, dial_x)

# ---------------------------------------------------------------- the glass, the lamps, the ridges
bpy.ops.mesh.primitive_plane_add(size=1, location=(80, 0, 0)); fl = bpy.context.object; fl.scale = (600, 60, 1)
fl.data.materials.append(mat('floor', (0.005, 0.008, 0.018, 1), rough=0.05, spec=0.8))
for i in range(34):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(i * 6.5 - 20, 10, 4.6)); s = bpy.context.object; s.scale = (2.8, 0.12, 0.12)
    s.data.materials.append(mat('strip', (0.5, 0.8, 1, 1), rough=1, emit=(0.5, 0.82, 1.0, 1), emit_k=5 if i % 2 == 0 else 2.2)); s.visible_camera = False

bpy.ops.mesh.primitive_cube_add(size=1); rid = bpy.context.object
rid.modifiers.new('bevel', 'BEVEL').width = 0.014
rid.data.materials.append(mat('ridge', (0.035, 0.05, 0.1, 1), rough=0.1, metal=0.85, spec=1.0)); ridge_mesh = rid.data; bpy.data.objects.remove(rid)
xf = at(T_FRONT, 1)
RH = 0.125
ridge_h = []                      # (x, emergence time) kept for the dial's hops
NR = 150
for i in range(NR):
    xi = 6 + i * SPACING
    te = T_FRONT + (xi - xf) / FRONT_V if xi > xf else 1e9
    o = bpy.data.objects.new('r%d' % i, ridge_mesh); sc.collection.objects.link(o); o.modifiers.new('bevel', 'BEVEL').width = 0.014
    o.scale = (0.15, 9.0, 0.012); o.location = (xi, 0, 0.002)
    vals_s, vals_z = [], []
    for f in frames:
        tt = f * DT; h = 0.012 + (RH - 0.012) * (sm((tt - te) / 0.30) if te < 1e8 else 0.0)
        vals_s.append(h); vals_z.append(h / 2 - 0.004)
    if te < 1e8:
        bake(o, 'scale', 2, vals_s); bake(o, 'location', 2, vals_z)
    ridge_h.append((xi, te))

def lift_at(t, x):
    lift = 0.0
    for xi, te in ridge_h:
        if abs(x - xi) < 1.3 and te < 1e8:
            h = (0.012 + (RH - 0.012) * sm((t - te) / 0.30)) - 0.004
            lift = max(lift, h * (1 - sm((abs(x - xi) - 0.86) / 0.26)))
    return lift
v_at = lambda t: at(t, 3)
dial_z = []
for f in frames:
    t = f * DT; v = v_at(t); l = lift_at(t, dial_x[f])
    ph = ((dial_x[f] - 6) / SPACING) % 1.0
    jit = 0.0
    if l > 0.05:
        if v > 13: jit = 0.014 * (random.random() - 0.5) * min(1, v / 20)       # too fast to see each ridge: a buzz
        else: jit = 0.034 * (math.sin(ph * math.pi) ** 2) * min(1, (13 - v) / 8 + 0.3)     # slow enough to feel each one
    dial_z.append(0.012 + l + max(0, jit))
bake(kn, 'location', 2, dial_z)
# pitch and roll shiver on the ridges
bake(kn, 'rotation_euler', 0, [math.radians(1.4 * (random.random() - 0.5) * (1 if dial_z[f] > 0.07 else 0) * min(1, v_at(f * DT) / 14)) for f in frames])
bake(kn, 'rotation_euler', 1, [math.radians(1.1 * (random.random() - 0.5) * (1 if dial_z[f] > 0.07 else 0) * min(1, v_at(f * DT) / 14)) for f in frames])

# ---------------------------------------------------------------- lights ride along with the dial
rig = bpy.data.objects.new('rig', None); sc.collection.objects.link(rig); bake(rig, 'location', 0, dial_x)
def area(name, loc, rot, size, energy, color, shape='RECTANGLE', sy=None):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.color = color; l.shape = shape; l.size = size
    if sy: l.size_y = sy
    o = bpy.data.objects.new(name, l); sc.collection.objects.link(o); o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]; o.parent = rig; return o
area('ice', (0, -5, 5.5), (58, 0, 0), 22, 2100, (0.5, 0.82, 1.0), sy=0.9)
area('back', (30, 14, 1.2), (90, 0, 55), 18, 1800, (0.45, 0.7, 1.0), sy=0.4)
area('warm', (2.0, -6.5, 3.0), (64, 0, 0), 4, 420, (1.0, 0.92, 0.75), sy=2)
area('rim', (-5, -1.5, 3.2), (70, 0, -80), 3, 300, (0.55, 0.8, 1.0), shape='SQUARE')
area('kick', (1.5, 1.5, 4.2), (-50, 0, 25), 3, 260, (1.0, 0.9, 0.7), shape='SQUARE')   # a little light for the top, so the indicator reads

# ---------------------------------------------------------------- the camera: it chases the dial on springs, so speed is felt in the frame
cam_d = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam_d.sensor_width = 36; cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 2.8
tgt = bpy.data.objects.new('tgt', None); sc.collection.objects.link(tgt); cam_d.dof.focus_object = tgt
tc = cam.constraints.new('TRACK_TO'); tc.target = tgt; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
sx = Spring(dial_x[0] + 5.0, 0.55, 0.85); sy_ = Spring(-6.0, 0.7, 0.9); sz = Spring(1.9, 0.7, 0.9); sl = Spring(34.0, 0.6, 0.8)
tx = Spring(dial_x[0] + 0.5, 0.35, 0.9); tz = Spring(0.45, 0.6, 0.9)
cx, cy, cz, cl, ttx, ttz = [], [], [], [], [], []
T_IMP = T_ACC + 0.05
for f in frames:
    t = f * DT; x = dial_x[f]
    lead = 5.0 - 3.0 * sm((t - 0.2) / 3.3)                      # it starts ahead of the dial and lets the dial overtake as it accelerates
    if t > T_IMP: lead = 1.6 - 0.8 * sm((t - T_IMP) / 2.0)
    cx.append(sx.step(x + lead, DT))
    cy.append(sy_.step(-6.4 + 1.2 * sm((t - T_IMP) / 1.2) + 1.0 * sm((t - T_IMP - 1.2) / 1.6), DT))
    cz.append(sz.step(1.7 + 0.5 * sm((t - T_IMP) / 2.4) + 0.7 * sm((t - T_IMP - 1.8) / 1.8), DT))
    punch = math.exp(-((t - (T_IMP + 0.03)) / 0.09) ** 2)
    cl.append(sl.step(34.0 + 20.0 * sm((t - T_IMP) / 2.2) + 9.0 * punch, DT))
    ttx.append(tx.step(x + 0.5, DT)); ttz.append(tz.step(0.45, DT))
bake(cam, 'location', 0, cx); bake(cam, 'location', 1, cy); bake(cam, 'location', 2, cz)
bake(tgt, 'location', 0, ttx); bake(tgt, 'location', 2, ttz)
bake(cam.data, 'lens', 0, cl)

# ---------------------------------------------------------------- render
sc.render.engine = 'CYCLES'; cy_ = sc.cycles
cy_.device = 'CPU'; cy_.samples = SAMPLES; cy_.use_denoising = True; cy_.denoiser = 'OPENIMAGEDENOISE'
cy_.use_adaptive_sampling = True; cy_.adaptive_threshold = 0.03
cy_.max_bounces = 6; cy_.diffuse_bounces = 2; cy_.glossy_bounces = 4; cy_.transmission_bounces = 2; cy_.volume_bounces = 0; cy_.sample_clamp_indirect = 8
sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.resolution_percentage = 100
sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = 0.55; cy_.motion_blur_position = 'CENTER'
sc.view_settings.view_transform = 'Khronos PBR Neutral'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '8'
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True
sc.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.004, 0.006, 0.013, 1)
os.makedirs(OUT, exist_ok=True)
sc.render.filepath = os.path.join(OUT, 'h_')
json.dump({'fps': FPS, 'nf': NF, 'T_ACC': T_ACC, 'T_STOP': T_STOP, 'x_stop': x_stop, 'detent': detent,
           'ticks': [round(te + (xi - xf) * 0, 4) for xi, te in ridge_h[:0]]}, open(os.path.join(OUT, 'hook.json'), 'w'))
# ridge crossings for the sound (the moments the dial's centre passes a risen ridge while braking)
ticks = []; last = None
for f in frames:
    t = f * DT
    if t < T_ACC - 0.3: continue
    idx = math.floor((dial_x[f] - 6) / SPACING)
    if last is not None and idx > last: ticks.append(round(t, 4))
    last = idx
json.dump({'fps': FPS, 'nf': NF, 'T_ACC': T_ACC, 'T_STOP': T_STOP, 'x_stop': x_stop, 'detent': detent, 'ticks': ticks, 'ang_end': dial_ang[-1], 'speed': [round(v_at(f * DT), 2) for f in frames], 'ang': [round(a, 2) for a in dial_ang]}, open(os.path.join(OUT, 'hook.json'), 'w'))
bpy.ops.render.render(animation=True)
print('HOOK done', F0, F1)
