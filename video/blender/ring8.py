# Friction trailer v9: the ring of tablets, in Blender. Six Apple-style tablets (thin even bezel, big corners, flat aluminium rim, a front camera, side buttons,
# a camera block on the back, and no logo anywhere) turn on a ring; each has an app screen on it. The camera starts as close as the app's last frame (the screen fills
# the frame), pulls back to see the ring, and comes back to the front tablet. Transparent film: the Remotion scene puts the contour field behind it.
#   blender -b -P ring8.py -- <first> <last> <outdir> [w h samples]
import bpy, bmesh, math, sys, os, json
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
F0, F1 = int(argv[0]), int(argv[1]); OUT = argv[2]
W = int(argv[3]) if len(argv) > 3 else 1600; H = int(argv[4]) if len(argv) > 4 else 900; SAMPLES = int(argv[5]) if len(argv) > 5 else 16
FPS = 30; DT = 1 / FPS; NF = 120                     # 4.0 s
SHOTS = '/home/user/ultraviolet/video/public/'
SCREENS = ['shots/new-focus.png', 'shots/radio.png', 'shots/tv.png', 'shots/new-learn.png', 'shots/new-arcade.png', 'shots/new-focus.png']
N = 6; R = 4.3                                       # the ring's radius; the tablets are 3.4 wide, so neighbours clear one another
SW, SH = 3.2, 1.8                                    # the screen (16:9, the app's own shape)
BZ = 0.085                                           # an even, thin bezel
TH = 0.075                                           # the thickness
RO = 0.22                                            # corner radius of the body
RI = 0.075                                           # corner radius of the screen

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.fps = FPS; sc.frame_start = F0; sc.frame_end = F1

_bags = {}
def _bag(idb):
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
    cb = _bag(obj)
    fc = cb.fcurves.find(path, index=idx) or cb.fcurves.new(path, index=idx)
    fc.keyframe_points.add(len(values))
    co = []
    for i, v in enumerate(values): co += [i + 1, v]
    fc.keyframe_points.foreach_set('co', co)
    for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    fc.update()

class Spring:
    def __init__(self, x, response=0.5, zeta=0.9): self.x = x; self.v = 0.0; self.w = 2 * math.pi / response; self.z = zeta
    def step(self, target, dt):
        n = max(1, int(dt / 0.002)); h = dt / n
        for _ in range(n):
            a = self.w * self.w * (target - self.x) - 2 * self.z * self.w * self.v
            self.v += a * h; self.x += self.v * h
        return self.x

def mat(name, base, rough=0.3, metal=0.0, coat=0.0, spec=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = base; b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat; b.inputs['Specular IOR Level'].default_value = spec
    return m

def rrect(w, h, r, n=10):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n); pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

def prism(name, pts, z0, z1, material):
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, z0)) for x, y in pts]; hi = [bm.verts.new((x, y, z1)) for x, y in pts]
    n = len(pts)
    for i in range(n): j = (i + 1) % n; bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bm.faces.new(hi); bm.faces.new(lo[::-1])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    ob.data.materials.append(material)
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def screen_plane(name, pts, z, material):
    bm = bmesh.new(); uv = bm.loops.layers.uv.new('uv')
    vs = [bm.verts.new((x, y, z)) for x, y in pts]
    f = bm.faces.new(vs)
    for l in f.loops: l[uv].uv = (l.vert.co.x / SW + 0.5, l.vert.co.y / SH + 0.5)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob); ob.data.materials.append(material); return ob

ALU = mat('alu', (0.17, 0.18, 0.215, 1), rough=0.3, metal=1.0, spec=0.6)
GLASS = mat('glass', (0.004, 0.005, 0.009, 1), rough=0.035, coat=1.0, spec=0.7)
BLACK = mat('black', (0.01, 0.011, 0.015, 1), rough=0.5)
CAMG = mat('lens', (0.0, 0.0, 0.004, 1), rough=0.02, coat=1.0)

def screen_mat(path):
    m = bpy.data.materials.new('scr'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(SHOTS + path); t.interpolation = 'Cubic'
    t.image.colorspace_settings.name = 'sRGB'
    b.inputs['Base Color'].default_value = (0, 0, 0, 1); b.inputs['Roughness'].default_value = 0.05; b.inputs['Specular IOR Level'].default_value = 0.2
    nt.links.new(t.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = 1.6
    return m

def tablet(i, path):
    parts = []
    body = prism('body%d' % i, rrect(SW + BZ * 2, SH + BZ * 2, RO), -TH, 0, ALU)
    bv = body.modifiers.new('bevel', 'BEVEL'); bv.width = 0.011; bv.segments = 3; bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(40)
    parts.append(body)
    glass = prism('glass%d' % i, rrect(SW + BZ * 2 - 0.026, SH + BZ * 2 - 0.026, RO - 0.013), 0, 0.004, GLASS)
    bv = glass.modifiers.new('bevel', 'BEVEL'); bv.width = 0.002; bv.segments = 2
    parts.append(glass)
    scr = screen_plane('screen%d' % i, rrect(SW, SH, RI), 0.0046, screen_mat(path)); parts.append(scr)
    # the front camera, in the middle of the top bezel, and a sensor beside it
    for dx, r in ((0, 0.016), (0.075, 0.007)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r, depth=0.002, location=(dx, SH / 2 + BZ / 2, 0.0049)); c = bpy.context.object
        c.data.materials.append(CAMG if dx == 0 else BLACK); parts.append(c)
    # buttons on the top edge and the right edge
    for (x, y, z, sx, sy) in ((1.05, SH / 2 + BZ + 0.002, -TH / 2, 0.26, 0.012), (SW / 2 + BZ + 0.002, 0.5, -TH / 2, 0.012, 0.2), (SW / 2 + BZ + 0.002, 0.15, -TH / 2, 0.012, 0.2)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z)); b = bpy.context.object; b.scale = (sx, sy, 0.022)
        b.data.materials.append(ALU); parts.append(b)
    # the back: a camera block in the top corner, two lenses, and nothing else
    bump = prism('bump%d' % i, rrect(0.52, 0.52, 0.12), -TH - 0.012, -TH, ALU); bump.location = (-SW / 2 - BZ + 0.42, SH / 2 + BZ - 0.42, 0); parts.append(bump)
    bv = bump.modifiers.new('bevel', 'BEVEL'); bv.width = 0.006; bv.segments = 2
    for dy in (0.12, -0.12):
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.075, depth=0.016, location=(-SW / 2 - BZ + 0.42, SH / 2 + BZ - 0.42 + dy, -TH - 0.02)); c = bpy.context.object
        c.data.materials.append(CAMG); parts.append(c)
    root = bpy.data.objects.new('tablet%d' % i, None); sc.collection.objects.link(root)
    for p in parts:
        for c in list(p.users_collection): c.objects.unlink(p)
        sc.collection.objects.link(p); p.parent = root
    return root

ring = bpy.data.objects.new('ring', None); sc.collection.objects.link(ring)
for i in range(N):
    t = tablet(i, SCREENS[i])
    a = math.radians(i * 360 / N)
    t.parent = ring
    t.location = (R * math.sin(a), -R * math.cos(a), 0)
    t.rotation_euler = (math.radians(90), 0, a)       # the screen faces outward, away from the middle

# --- the motion, the same as the css version: one full turn (whip in, settle out), a camera that backs off and comes in again
def ease_in_out(u): u = max(0.0, min(1.0, u)); return 4 * u * u * u if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2
frames = list(range(NF))
th = [-360.0 * ease_in_out((f * DT - 0.25) / (3.1 - 0.25)) for f in frames]
bake(ring, 'rotation_euler', 2, [math.radians(v) for v in th])

sp_out = Spring(0.0, 0.8, 0.9)
out = []
for f in frames:
    t = f * DT
    out.append(sp_out.step(0.0 if (t < 0.15 or t >= 3.05) else 1.0, DT))
cam_d = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam_d.sensor_width = 36; cam_d.dof.use_dof = True
tgt = bpy.data.objects.new('tgt', None); sc.collection.objects.link(tgt); cam_d.dof.focus_object = tgt
tc = cam.constraints.new('TRACK_TO'); tc.target = tgt; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
LENS0 = 50.0; D0 = SW * LENS0 / 36 / 1.1            # the screen 1.1 times the frame's width at the start
cx, cy, cz, tx, ty, tz, lens, fst = [], [], [], [], [], [], [], []
for o in out:
    o = max(0.0, o)
    cx.append(0.0)
    cy.append(-R - (D0 + (11.0 - D0) * o))
    cz.append(0.1 + 2.6 * o)
    tx.append(0.0); ty.append(-R * (1 - o) - 0.0); tz.append(0.0)
    lens.append(LENS0 - 12 * o); fst.append(2.8 + 4.0 * o)
bake(cam, 'location', 0, cx); bake(cam, 'location', 1, cy); bake(cam, 'location', 2, cz)
bake(tgt, 'location', 0, tx); bake(tgt, 'location', 1, ty); bake(tgt, 'location', 2, tz)
bake(cam.data, 'lens', 0, lens); bake(cam.data, 'dof.aperture_fstop', 0, fst)

# --- light: big soft boxes for the aluminium to reflect (cold key from above, warm kicker, blue rim from behind)
def area(name, loc, rot, size, energy, color, sy=None):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.color = color; l.shape = 'RECTANGLE'; l.size = size
    l.size_y = sy or size
    o = bpy.data.objects.new(name, l); sc.collection.objects.link(o); o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]; return o
area('ice', (0, -9, 9), (50, 0, 0), 22, 6000, (0.62, 0.84, 1.0), sy=7)
area('warm', (9, -10, 3), (80, 0, 40), 8, 2400, (1.0, 0.9, 0.72), sy=14)
area('rim', (-9, 6, 6), (60, 0, 135), 10, 3600, (0.55, 0.78, 1.0), sy=8)
area('belly', (0, 0, 16), (0, 0, 0), 14, 2200, (0.8, 0.9, 1.0))

# the soft shadow under the ring
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, -2.4)); fl = bpy.context.object; fl.scale = (90, 90, 1); fl.is_shadow_catcher = True

# --- render
sc.render.engine = 'CYCLES'; cy_ = sc.cycles
cy_.device = 'CPU'; cy_.samples = SAMPLES; cy_.use_denoising = True; cy_.denoiser = 'OPENIMAGEDENOISE'
cy_.use_adaptive_sampling = True; cy_.adaptive_threshold = 0.03
cy_.max_bounces = 6; cy_.diffuse_bounces = 2; cy_.glossy_bounces = 4; cy_.transmission_bounces = 2; cy_.volume_bounces = 0; cy_.sample_clamp_indirect = 8
sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.resolution_percentage = 100
sc.render.film_transparent = True
sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = 0.3; cy_.motion_blur_position = 'CENTER'
sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'; sc.render.image_settings.color_depth = '8'
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True
bg = sc.world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.01, 0.018, 0.04, 1); bg.inputs['Strength'].default_value = 1.0
os.makedirs(OUT, exist_ok=True)
sc.render.filepath = os.path.join(OUT, 'r_')
json.dump({'fps': FPS, 'nf': NF}, open(os.path.join(OUT, 'ring.json'), 'w'))
bpy.ops.render.render(animation=True)
print('RING done', F0, F1)
