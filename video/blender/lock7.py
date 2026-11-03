# Friction trailer v7, the second 3D segment: the dial locks in. Photoreal, baked from springs into real keyframes (so Cycles sees true motion).
# The dial clicks round five detents and a sixth that locks; each click raises a ring of glowing ridges around it (the friction of the opening, now a field
# that holds it in place); the camera backs away and climbs, ending straight down on a target of rings with the dial at its heart.
#   blender -b -P lock7.py -- <first> <last> <outdir> [w h samples]
import bpy, bmesh, math, sys, os, json, random
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
F0, F1 = int(argv[0]), int(argv[1]); OUT = argv[2]
W = int(argv[3]) if len(argv) > 3 else 1440; H = int(argv[4]) if len(argv) > 4 else 810; SAMPLES = int(argv[5]) if len(argv) > 5 else 8
FPS = 30; DT = 1 / FPS; NF = 120            # 4.0 s, eight beats at 120 bpm
YEL = (1.0, 0.62, 0.035, 1)
random.seed(11)

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

CLICKS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]          # the sixth is the lock
RINGS = [2.7, 4.2, 5.9, 7.7, 9.6]                # radius of the ring each of the first five clicks raises
RH = 0.24
frames = list(range(NF))

kn = knob()
# --- the dial: it turns thirty degrees on each click, as a spring that overshoots a little, and dips a hair into the floor
ang = Spring(0.0, 0.17, 0.42)
dial_ang, dial_z = [], []
for f in frames:
    t = f * DT
    n = sum(1 for c in CLICKS if t >= c - 1e-6)
    dial_ang.append(ang.step(30.0 * n, DT))
    dip = sum(0.03 * math.exp(-(t - c) / 0.07) * (1 if t >= c else 0) for c in CLICKS)
    dial_z.append(0.012 - dip + (0.02 * math.exp(-(t - CLICKS[-1]) / 0.12) if t >= CLICKS[-1] else 0))
bake(kn, 'rotation_euler', 2, [math.radians(90 - a) for a in dial_ang])
bake(kn, 'location', 2, dial_z)

# --- the glass
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0)); fl = bpy.context.object; fl.scale = (120, 120, 1)
fm = mat('floor', (0.005, 0.008, 0.018, 1), rough=0.05, spec=0.8)
fl.data.materials.append(fm)
nt = fm.node_tree; bsdf = nt.nodes['Principled BSDF']
noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 90; noise.inputs['Detail'].default_value = 6
ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (0.035, 0.035, 0.035, 1); ramp.color_ramp.elements[1].color = (0.16, 0.16, 0.16, 1)
nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], bsdf.inputs['Roughness'])
# a fine smudge of the finish, so the glass is glass and not a perfect plane

# --- the rings: seventy-two bars each, one object per ring, rising with a spring that overshoots
def ring_mesh(r, n=72):
    bm = bmesh.new()
    for i in range(n):
        a = i / n * math.tau
        L = math.tau * r / n * 0.8
        M = Matrix.Translation((r * math.cos(a), r * math.sin(a), 0)) @ Matrix.Rotation(a + math.pi / 2, 4, 'Z') @ Matrix.Diagonal((L, 0.22, 1.0, 1.0))
        res = bmesh.ops.create_cube(bm, size=1.0)
        for v in res['verts']: v.co.z += 0.5
        bmesh.ops.transform(bm, matrix=M, verts=res['verts'])
    me = bpy.data.meshes.new('ring'); bm.to_mesh(me); bm.free(); return me
ring_mat = mat('ridge', (0.1, 0.28, 0.6, 1), rough=0.35, emit=(0.3, 0.62, 1.0, 1), emit_k=0.75, spec=0.5)
rings = []
for k, r in enumerate(RINGS):
    ob = bpy.data.objects.new('ring%d' % k, ring_mesh(r)); sc.collection.objects.link(ob)
    ob.data.materials.append(ring_mat)
    bv = ob.modifiers.new('bevel', 'BEVEL'); bv.width = 0.012; bv.segments = 1
    sp_ = Spring(0.0, 0.34, 0.5); vals = []
    for f in frames:
        t = f * DT
        x = sp_.step(1.0 if t >= CLICKS[k] else 0.0, DT)
        vals.append(max(0.0004, x * RH))
    bake(ob, 'scale', 2, vals); ob.scale = (1, 1, 0.0004)
    rings.append(ob)

# --- light: the same cold key and warm edge as the opening, a little more of it because the camera goes far, and a pulse on the lock
def area(name, loc, rot, size, energy, color, shape='RECTANGLE', sy=None):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.color = color; l.shape = shape; l.size = size
    if sy: l.size_y = sy
    o = bpy.data.objects.new(name, l); sc.collection.objects.link(o); o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]; return o
area('ice', (0, -6, 7), (50, 0, 0), 24, 2600, (0.5, 0.82, 1.0), sy=1.2).visible_glossy = False
warm = area('warm', (3.0, -5.5, 3.2), (62, 0, 18), 4, 520, (1.0, 0.92, 0.75), sy=2)
area('rim', (-5, 3, 3.5), (70, 0, 140), 4, 380, (0.55, 0.8, 1.0), shape='SQUARE').visible_glossy = False
top = area('top', (1.5, -1.5, 6.5), (0, 0, 0), 4, 420, (1.0, 0.92, 0.8), shape='SQUARE')
puck_col = bpy.data.collections.new('puck'); sc.collection.children.link(puck_col)
for o in [kn] + list(kn.children_recursive):
    for c in list(o.users_collection): c.objects.unlink(o)
    puck_col.objects.link(o)
for l in (warm, top): l.light_linking.receiver_collection = puck_col
flash = area('flash', (0, 0, 16), (0, 0, 0), 30, 0, (0.7, 0.88, 1.0), shape='SQUARE')
bake(flash.data, 'energy', 0, [14000 * math.exp(-((f * DT - CLICKS[-1]) / 0.12) ** 2) if f * DT >= CLICKS[-1] - 0.02 else 0.0 for f in frames])

# --- the camera: it starts on the knurled edge, and every click it backs off and climbs a stage; after the lock it goes up and over to look straight down
cam_d = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam_d.sensor_width = 36; cam_d.dof.use_dof = True
tgt = bpy.data.objects.new('tgt', None); sc.collection.objects.link(tgt); cam_d.dof.focus_object = tgt
tc = cam.constraints.new('TRACK_TO'); tc.target = tgt; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
STAGES = [  # time, camera position, look-at, lens, f-stop
    (0.0, (1.9, -2.3, 0.55), (0.35, 0.0, 0.5), 85, 2.0),
    (0.5, (2.6, -3.4, 0.9), (0.2, 0.0, 0.45), 70, 2.4),
    (1.0, (4.0, -5.4, 1.7), (0.0, 0.0, 0.4), 60, 3.2),
    (1.5, (5.2, -8.0, 3.2), (0.0, 0.0, 0.3), 50, 4.0),
    (2.0, (4.8, -11.5, 5.8), (0.0, 0.0, 0.0), 42, 5.0),
    (2.5, (2.5, -15.5, 10.0), (0.0, 0.0, 0.0), 36, 5.6),
    (3.0, (0.0, -1.0, 18.0), (0.0, 0.0, 0.0), 32, 8.0),
]
def stage_at(t):
    cur = STAGES[0]
    for s in STAGES:
        if t >= s[0] - 1e-6: cur = s
    return cur
sp = [Spring(STAGES[0][1][i], 0.6 if i < 2 else 0.7, 0.9) for i in range(3)]
sl = [Spring(STAGES[0][2][i], 0.45, 0.9) for i in range(3)]
slens = Spring(85.0, 0.5, 0.9); sfst = Spring(2.0, 0.5, 0.9)
cx, cy, cz, tx, ty, tz, lens, fst = [], [], [], [], [], [], [], []
for f in frames:
    t = f * DT; s = stage_at(t)
    # the last climb is slower: it takes the whole second after the lock
    k = 1.0 if t < 3.0 else 1.0
    cx.append(sp[0].step(s[1][0], DT)); cy.append(sp[1].step(s[1][1], DT)); cz.append(sp[2].step(s[1][2], DT))
    tx.append(sl[0].step(s[2][0], DT)); ty.append(sl[1].step(s[2][1], DT)); tz.append(sl[2].step(s[2][2], DT))
    lens.append(slens.step(s[3], DT)); fst.append(max(1.2, sfst.step(s[4], DT)))
bake(cam, 'location', 0, cx); bake(cam, 'location', 1, cy); bake(cam, 'location', 2, cz)
bake(tgt, 'location', 0, tx); bake(tgt, 'location', 1, ty); bake(tgt, 'location', 2, tz)
bake(cam.data, 'lens', 0, lens); bake(cam.data, 'dof.aperture_fstop', 0, fst)

# --- render
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
sc.render.filepath = os.path.join(OUT, 'l_')
json.dump({'fps': FPS, 'nf': NF, 'clicks': CLICKS, 'rings': RINGS, 'ang_end': dial_ang[-1]}, open(os.path.join(OUT, 'lock.json'), 'w'))
bpy.ops.render.render(animation=True)
print('LOCK done', F0, F1)
