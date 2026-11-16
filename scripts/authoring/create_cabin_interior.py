"""Blender 4.5 headless cabin interior builder using verified CC0 Kenney 3D assets.
Canonical copy: scripts/authoring/create_cabin_interior.py.
Blender Z-up (x, -z, y) exports to Three.js Y-up (x, y, z).

Generates a single compact GLB (`public/models/cabin-interior.glb`) with strictly
2 merged draw-call meshes (`cabin-interior-furniture` and `cabin-interior-glow`),
under 6,000 triangles total, tailored to align inside `secret-haven-cabin` without
overlapping exterior walls, window openings, door swing, or chimney stonework.
"""

import bpy
import bmesh
import json
import math
from pathlib import Path
from mathutils import Euler, Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
KENNEY_ROOT = ROOT / "work" / "references" / "kenney" / "3d"
OUT = ROOT / "public" / "models" / "cabin-interior.glb"


def P(x, y, z):
    """Map Three.js room coordinates (x, y, z) to Blender (x, -z, y)."""
    return Vector((x, -z, y))


def srgb_chan(c):
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def hex_lin(code):
    code = code.lstrip("#")
    r = srgb_chan(int(code[0:2], 16) / 255.0)
    g = srgb_chan(int(code[2:4], 16) / 255.0)
    b = srgb_chan(int(code[4:6], 16) / 255.0)
    return (r, g, b)


def blend_lin(a, b, t):
    return (
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
    )


def scale_lin(c, factor):
    return (
        max(0.0, min(1.0, c[0] * factor)),
        max(0.0, min(1.0, c[1] * factor)),
        max(0.0, min(1.0, c[2] * factor)),
    )


def face_toward(from_x, from_z, target_x, target_z):
    """Return Blender Z-yaw so an asset facing Three.js +Z turns toward target."""
    return math.atan2(target_x - from_x, target_z - from_z)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


reset_scene()
scene = bpy.context.scene
collection = bpy.data.collections.new("CabinInterior")
scene.collection.children.link(collection)

furniture_bm = bmesh.new()
furniture_color = furniture_bm.loops.layers.float_color.new("Color")

glow_bm = bmesh.new()
glow_color = glow_bm.loops.layers.float_color.new("Color")


hidden_surface_triangles=0
asset_layout=[]

def add_bm_box(bm, layer, x, y, z, w, h, d, color_hex, yaw=0.0, rx=0.0, rz=0.0, surface=None):
    """Append an axis-aligned or rotated box centered at Three.js (x, y, z)."""
    lin = hex_lin(color_hex) if isinstance(color_hex, str) else color_hex
    mat_t = Matrix.Translation(P(x, y, z))
    mat_r = Euler((rx, -rz, yaw), "XYZ").to_matrix().to_4x4()
    mat_s = Matrix.Diagonal((w, d, h, 1.0))
    res = bmesh.ops.create_cube(bm, size=1.0, matrix=mat_t @ mat_r @ mat_s)
    verts = set(res["verts"])
    global hidden_surface_triangles
    for f in list(bm.faces):
        if all(v in verts for v in f.verts):
            f.normal_update()
            keep=surface is None or (surface=='top' and f.normal.z>.5) or (surface=='bottom' and f.normal.z<-.5) or (surface=='front' and f.normal.y<-.5) or (surface=='back' and f.normal.y>.5) or (surface=='hearth' and f.normal.z>-.5 and f.normal.y<.5)
            if not keep:
                hidden_surface_triangles+=len(f.verts)-2;bm.faces.remove(f);continue
            for l in f.loops:
                l[layer] = (*lin, 1.0)
    for v in verts:
        if not v.link_faces:bm.verts.remove(v)


def add_bm_cyl(bm, layer, x, y, z, r1, r2, depth, segments, color_hex, rot_euler=(0.0, 0.0, 0.0)):
    """Append a tapered cylinder centered at Three.js (x, y, z)."""
    lin = hex_lin(color_hex) if isinstance(color_hex, str) else color_hex
    mat = Matrix.Translation(P(x, y, z)) @ Euler(rot_euler, "XYZ").to_matrix().to_4x4()
    res = bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segments,
        radius1=r1,
        radius2=r2,
        depth=depth,
        matrix=mat,
    )
    verts = set(res["verts"])
    for f in bm.faces:
        if all(v in verts for v in f.verts):
            for l in f.loops:
                l[layer] = (*lin, 1.0)


# Default cohesive cabin material remapping for Kenney furniture solid materials.
BASE_PALETTE = {
    "wood": hex_lin("#9f6c43"),
    "woodDark": hex_lin("#5c3a23"),
    "carpet": hex_lin("#c79f78"),
    "carpetDarker": hex_lin("#8a4b3c"),
    "carpetWhite": hex_lin("#ece1d1"),
    "metal": hex_lin("#6c593f"),
    "metalDark": hex_lin("#353028"),
    "plant": hex_lin("#3e663d"),
    "fur": hex_lin("#9c6d47"),
    "lamp": hex_lin("#ffe6b8"),
}


def sample_image_rgba(tex_node, u, v, cache):
    img = tex_node.image
    if img is None:
        return (0.8, 0.72, 0.62)
    if img.name not in cache:
        w, h = img.size[0], img.size[1]
        cache[img.name] = (w, h, list(img.pixels))
    w, h, pix = cache[img.name]
    if w <= 0 or h <= 0 or not pix:
        return (0.8, 0.72, 0.62)
    px = max(0, min(w - 1, int((u % 1.0) * w)))
    py = max(0, min(h - 1, int((v % 1.0) * h)))
    idx = (py * w + px) * 4
    # Convert GLTF colormap pixels gently into linear space with cozy cabin warmth.
    return (
        srgb_chan(pix[idx]),
        srgb_chan(pix[idx + 1]),
        srgb_chan(pix[idx + 2]),
    )


def material_tex_node(mat):
    if not mat or not mat.use_nodes:
        return None
    for n in mat.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image is not None:
            return n
    return None


def material_linear_color(mat, palette):
    if not mat:
        return hex_lin("#a87d56")
    base = mat.name.split(".")[0]
    if base in palette:
        v = palette[base]
        return hex_lin(v) if isinstance(v, str) else v
    if base in BASE_PALETTE:
        return BASE_PALETTE[base]
    if mat.use_nodes:
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            c = bsdf.inputs["Base Color"].default_value
            return (c[0], c[1], c[2])
    return hex_lin("#a87d56")


def import_kenney(
    rel_path,
    scale,
    three_pos,
    yaw=0.0,
    palette_overrides=None,
    pivot_z="min",
    tint_mul=None,
    simplify_ratio=None,
    drop_bottom=False,
):
    """Import a verified CC0 Kenney GLB, normalize origin/scale, and merge into room batches."""
    filepath = KENNEY_ROOT / rel_path
    assert filepath.exists(), f"Missing CC0 asset: {filepath}"
    palette = dict(palette_overrides or {})

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(filepath))
    bpy.context.view_layer.update()
    imported = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in imported if o.type == "MESH"]
    source_triangles=sum(len(poly.vertices)-2 for obj in meshes for poly in obj.data.polygons)
    if simplify_ratio is not None:
        for obj in meshes:
            bpy.context.view_layer.objects.active=obj
            modifier=obj.modifiers.new('Small accent silhouette budget','DECIMATE');modifier.ratio=simplify_ratio
            modifier.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=modifier.name)

    # Gather world-space vertices to compute exact normalized local bounds in Blender space.
    all_pts = []
    for o in meshes:
        mw = o.matrix_world
        for v in o.data.vertices:
            all_pts.append(mw @ v.co)
    xs = [q.x for q in all_pts]
    ys = [q.y for q in all_pts]
    zs = [q.z for q in all_pts]
    mid_x = 0.5 * (min(xs) + max(xs))
    mid_y = 0.5 * (min(ys) + max(ys))
    ref_z = min(zs) if pivot_z == "min" else 0.5 * (min(zs) + max(zs))

    rot_m = Matrix.Rotation(yaw, 4, "Z")
    dst_v = P(*three_pos)
    tex_cache = {}
    imported_triangles=0

    for o in meshes:
        me = o.data
        uv_layer = me.uv_layers.active
        mw = o.matrix_world
        mats = list(me.materials)

        # Build transformed vertex coordinates inside target batch.
        def place_pt(co):
            wco = mw @ co
            centered = Vector((wco.x - mid_x, wco.y - mid_y, wco.z - ref_z)) * scale
            return dst_v + (rot_m @ centered)

        vmap_f = {}
        vmap_g = {}
        for poly in me.polygons:
            if drop_bottom and (mw.to_3x3().inverted().transposed()@poly.normal).z<(-.9 if drop_bottom=='flat' else -.01):
                continue
            mat = mats[poly.material_index] if poly.material_index < len(mats) else None
            m_name = mat.name.split(".")[0] if mat else ""
            is_lamp = m_name == "lamp"
            target_bm = glow_bm if is_lamp else furniture_bm
            target_layer = glow_color if is_lamp else furniture_color
            vmap = vmap_g if is_lamp else vmap_f

            tex_node = material_tex_node(mat)
            solid_lin = material_linear_color(mat, palette)

            bm_verts = []
            for vi in poly.vertices:
                if vi not in vmap:
                    vmap[vi] = target_bm.verts.new(place_pt(me.vertices[vi].co))
                bm_verts.append(vmap[vi])
            try:
                bf = target_bm.faces.new(bm_verts)
            except ValueError:
                continue
            imported_triangles+=len(poly.vertices)-2

            for loop, bloop in zip(poly.loop_indices, bf.loops):
                if tex_node is not None and uv_layer is not None:
                    u, v = uv_layer.data[loop].uv
                    col = sample_image_rgba(tex_node, u, v, tex_cache)
                else:
                    col = solid_lin
                if tint_mul is not None:
                    col = (
                        min(1.0, col[0] * tint_mul[0]),
                        min(1.0, col[1] * tint_mul[1]),
                        min(1.0, col[2] * tint_mul[2]),
                    )
                bloop[target_layer] = (*col, 1.0)

    asset_layout.append({"asset":rel_path,"position":list(three_pos),"scale":scale,"yaw":yaw,"sourceTriangles":source_triangles,"triangles":imported_triangles})
    for o in imported:
        bpy.data.objects.remove(o, do_unlink=True)


# ---------------------------------------------------------------------------
# 1. Cabin Interior Architecture Shell (Strict Clearance Inside Log Walls)
# Exterior inner deck floor is y=0.37; front/back log inner faces |z|=1.565;
# side log inner faces |x|=1.975. Keep windows & doorway openings completely clear!
# ---------------------------------------------------------------------------

# Warm oak floorboards (12 planks spanning Z, y_top = 0.376 -> flush 6mm over deck)
plank_tints = ("#865a39", "#7b5031", "#916341", "#815535")
for idx in range(12):
    x = -1.7875 + idx * 0.325
    add_bm_box(furniture_bm, furniture_color, x, 0.370, 0.0, 0.319, 0.012, 3.10, plank_tints[idx % 4],surface='top')

# Interior back wall horizontal tongue-and-groove cladding (back wall has zero windows!)
wall_shades = ("#744d31", "#6b452c", "#7d5437")
for row in range(10):
    y = 0.48 + row * 0.20
    add_bm_box(furniture_bm, furniture_color, 0.0, y, -1.555, 3.918, 0.194, 0.024, wall_shades[row % 3],surface='front')
# Dado waist rail along back wall
add_bm_box(furniture_bm, furniture_color, 0.0, 1.04, -1.535, 3.918, 0.045, 0.032, "#573722")
# Back gable triangle planking inside roof pitch (slope = 0.62 -> height below exterior shell)
for i in range(-11, 12):
    x = i * 0.168
    h = max(0.05, 1.18 - abs(x) * 0.62)
    add_bm_box(furniture_bm, furniture_color, x, 2.38 + h * 0.5, -1.555, 0.162, h, 0.024, wall_shades[abs(i) % 3],surface='front')

# Interior door-frame timber backing (only behind center door |x| < 0.52, leaving windows clear!)
add_bm_box(furniture_bm, furniture_color, 0.0, 1.25, 1.66, 0.98, 1.78, 0.028, "#6a452b",surface='back')
for post_x in (-0.54, 0.54):
    add_bm_box(furniture_bm, furniture_color, post_x, 1.26, 1.62, 0.065, 1.82, 0.055, "#4f321e")
add_bm_box(furniture_bm, furniture_color, 0.0, 2.18, 1.62, 1.16, 0.07, 0.055, "#4f321e")

# Exposed roof underside sheathing + ridge beam + 3 overhead timber tie trusses
slope = 0.62
roof_angle = math.atan(slope)
for side in (-1.0, 1.0):
    # Planked underside safely below exterior roof deck (keeps |x| <= 1.90, no log poke-through)
    add_bm_box(
        furniture_bm,
        furniture_color,
        side * 0.94,
        3.62 - slope * 0.94,
        0.0,
        1.88 / math.cos(roof_angle),
        0.032,
        3.10,
        "#5d3d27",
        rz=-side * roof_angle,
        surface='bottom',
    )
# Central ridge beam
add_bm_box(furniture_bm, furniture_color, 0.0, 3.53, 0.0, 0.10, 0.12, 3.08, "#462c1b")
# Tie beams & sloped rafters at z = -0.82, 0.05, +0.92 (y = 2.48 -> safely above 2.12 window tops)
for rz_pos in (-0.82, 0.05, 0.92):
    add_bm_box(furniture_bm, furniture_color, 0.0, 2.48, rz_pos, 3.84, 0.09, 0.09, "#4b301d")
    add_bm_box(furniture_bm, furniture_color, 0.0, 3.02, rz_pos, 0.075, 1.04, 0.075, "#4b301d")

# Framing base molding strips around perimeter below sills
for z in (-1.535,):
    add_bm_box(furniture_bm, furniture_color, 0.0, 0.415, z, 3.90, 0.078, 0.035, "#4a2f1d")
for side in (-1.0, 1.0):
    for sx, sw, sz in ((side * 1.940, 0.035, -1.04, ), (side * 1.940, 0.035, 1.14)):
        add_bm_box(furniture_bm, furniture_color, sx, 0.415, sz, sw, 0.078, 0.98, "#4a2f1d")


# ---------------------------------------------------------------------------
# 2. Corner Stone Hearth & Wood-Burning Fireplace (Aligned under Chimney Stack)
# Exterior chimney base starts at (x=-1.55, y=2.28, z=-0.90). Angled +27.5 deg
# toward room center so both front AND side windows look right into the fire!
# ---------------------------------------------------------------------------

hx, hz, hyaw = -1.35, -1.00, 0.44
c_h, s_h = math.cos(hyaw), math.sin(hyaw)


def H(u, y, d):
    return (hx + u * c_h + d * s_h, y, hz - u * s_h + d * c_h)


# Raised ashlar hearth plinth (y = 0.376 .. 0.62)
add_bm_box(furniture_bm, furniture_color, *H(0.0, 0.485, 0.06), 0.98, 0.22, 0.72, "#766f65", yaw=hyaw,surface='hearth')
add_bm_box(furniture_bm, furniture_color, *H(0.0, 0.612, 0.09), 1.04, 0.045, 0.76, "#8d8578", yaw=hyaw,surface='hearth')

# Firebox charcoal back & cheeks + left/right stone piers (opening y = 0.635 .. 1.24)
add_bm_box(furniture_bm, furniture_color, *H(0.0, 0.96, -0.17), 0.56, 0.68, 0.14, "#24201c", yaw=hyaw,surface='hearth')
add_bm_box(furniture_bm, furniture_color, *H(0.0, 0.96, -0.25), 0.86, 0.72, 0.10, "#6d655c", yaw=hyaw,surface='hearth')
for side in (-1.0, 1.0):
    add_bm_box(furniture_bm, furniture_color, *H(side * 0.335, 0.96, 0.02), 0.21, 0.68, 0.44, "#7c746a", yaw=hyaw,surface='hearth')
# Sculptural staggered ashlar stone veneer blocks on front jambs & lintel
stone_pal = ("#8e8577", "#746c62", "#9a9082", "#675f55")
for row in range(4):
    sy = 0.71 + row * 0.165
    for side in (-1.0, 1.0):
        add_bm_box(furniture_bm, furniture_color, *H(side * 0.335, sy, 0.245), 0.195, 0.14, 0.06, stone_pal[(row + int(side + 1)) % 4], yaw=hyaw,surface='hearth')
# Heavy arch stone lintel & warm walnut mantel shelf (y = 1.42)
add_bm_box(furniture_bm, furniture_color, *H(0.0, 1.32, 0.02), 0.92, 0.17, 0.48, "#7f766a", yaw=hyaw,surface='hearth')
add_bm_box(furniture_bm, furniture_color, *H(0.0, 1.435, 0.06), 1.08, 0.075, 0.54, "#583a24", yaw=hyaw)
# Tapered chimney breast ascending into exterior chimney stack (x=-1.55, y=2.28, z=-0.90)
add_bm_box(furniture_bm, furniture_color, *H(0.0, 1.72, -0.02), 0.80, 0.52, 0.44, "#756d63", yaw=hyaw,surface='hearth')
add_bm_box(furniture_bm, furniture_color, -1.53, 2.24, -0.94, 0.70, 0.62, 0.48, "#6f675d", yaw=hyaw * 0.4,surface='hearth')

# Split firewood stack inside hearth (Kenney survival/resource-wood.glb CC0)
import_kenney("survival/resource-wood.glb", 2.05, H(0.0, 0.64, 0.04), yaw=hyaw + 0.12, tint_mul=(0.82, 0.74, 0.68))
# Staggered charred split logs, ember bed and layered flame tongues. All fit
# inside the masonry opening; they share the existing furniture/glow batches.
for row in range(2):
    for log in range(3-row):
        add_bm_box(furniture_bm, furniture_color,
                   *H((log-(2-row)*0.5)*0.115, 0.735+row*0.072, 0.07),
                   0.14, 0.066, 0.31, ("#4c2b18", "#66341b", "#342018")[log],
                   yaw=hyaw+(-0.18 if row else 0.16))
add_bm_box(glow_bm, glow_color, *H(0.0, 0.692, 0.10), 0.38, 0.035, 0.25, "#d84212", yaw=hyaw)
for i in range(7):
    add_bm_cyl(glow_bm, glow_color, *H((i-3)*0.046, 0.725, 0.19+(i%2)*0.018),
               0.026, 0.019, 0.018, 6, "#ff7420")
# No baked flame cones. Runtime layers rise from this ember bed, inside the opening.

# Mantel decor: potted mini fern, twin brass candlesticks + glowing flames, festive wreath above mantel
import_kenney("furniture/plantSmall1.glb", 1.55, H(-0.32, 1.472, 0.16), yaw=hyaw, palette_overrides={"wood": "#a87049", "plant": "#3f6a3f"})
for cu in (0.26, 0.36):
    add_bm_cyl(furniture_bm, furniture_color, *H(cu, 1.515, 0.18), 0.022, 0.016, 0.085, 6, "#b29058")
    add_bm_cyl(glow_bm, glow_color, *H(cu, 1.59, 0.18), 0.016, 0.014, 0.07, 6, "#f7ebd4")
    add_bm_cyl(glow_bm, glow_color, *H(cu, 1.645, 0.18), 0.013, 0.003, 0.045, 5, "#ffd06b")
# Evergreen wreath mounted flat onto the upper chimney breast (clearly framed in left-front window!)
import_kenney("holiday/wreath.glb", 0.45, H(0.0, 2.02, 0.23), yaw=hyaw, pivot_z="min", tint_mul=(0.45, 0.52, 0.46), simplify_ratio=.25)

# A miniature gilt portrait: two warm silhouettes in the couple's green/purple,
# with fine curled corner filigree. All colours stay in the furniture batch.
add_bm_box(furniture_bm,furniture_color,*H(0,1.735,.218),.43,.34,.025,'#493326',yaw=hyaw)
for u in (-.211,.211):add_bm_box(furniture_bm,furniture_color,*H(u,1.735,.243),.015,.34,.018,'#c8a568',yaw=hyaw)
for y in (1.572,1.898):add_bm_box(furniture_bm,furniture_color,*H(0,y,.243),.43,.015,.018,'#e1c88f',yaw=hyaw)

def portrait_polygon(points,color,depth=.235):
    verts=[furniture_bm.verts.new(P(*H(u,y-.055,depth))) for u,y in points]
    face=furniture_bm.faces.new(verts)
    for loop in face.loops:loop[furniture_color]=(*hex_lin(color),1)

portrait_polygon([(-.192,1.65),(.192,1.65),(.192,1.932),(-.192,1.932)],'#f4e7d0')
for side,color in ((-1,'#416649'),(1,'#785f85')):
    cx=side*.071
    portrait_polygon([(cx+math.cos(i*math.tau/16)*.035,1.831+math.sin(i*math.tau/16)*.039) for i in range(16)],color,.237)
    portrait_polygon([(cx-.066,1.685),(cx+.065,1.685),(cx+.054,1.743),(cx+.024,1.778),(cx-.020,1.778),(cx-.052,1.749)],color,.237)
heart=[]
for i in range(20):
    t=-i*math.tau/20
    heart.append((.0011*16*math.sin(t)**3,1.755+.0011*(13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t))))
portrait_polygon(heart,'#e4a6b6',.240)
for side in (-1,1):
    for top in (-1,1):
        for i in range(6):
            t=i/6;a=t*math.pi*1.5;r=.014*(1-t*.7)
            u=side*(.176+math.cos(a)*r);y=1.79+top*(.123+math.sin(a)*r)
            nt=(i+1)/6;na=nt*math.pi*1.5;nr=.014*(1-nt*.7)
            nu=side*(.176+math.cos(na)*nr);ny=1.79+top*(.123+math.sin(na)*nr)
            length=math.hypot(nu-u,ny-y);ox=-(ny-y)/length*.0013;oy=(nu-u)/length*.0013
            portrait_polygon([(u-ox,y-oy),(nu-ox,ny-oy),(nu+ox,ny+oy),(u+ox,y+oy)],'#e1c88f',.239)


# ---------------------------------------------------------------------------
# 3. Furnish Living, Reading & Study Zones with Kenney CC0 GLBs
# ---------------------------------------------------------------------------

# Woven round area rug on floorboards in center room
import_kenney(
    "furniture/rugRound.glb",
    1.95,
    (-0.14, 0.377, -0.02),
    yaw=0.0,
    palette_overrides={"carpet": "#4a6852", "carpetDarker": "#785f85"},
    drop_bottom=True,
)

# Coffee table resting over the rug + teacup + small stack of books
import_kenney(
    "furniture/tableCoffee.glb",
    1.55,
    (-0.18, 0.377, -0.04),
    yaw=0.22,
    palette_overrides={"wood": "#9e683e"},
)
import_kenney("food/cup-saucer.glb",.29,(-.30,.734,.045),tint_mul=(1,.98,.95),drop_bottom=True)
import_kenney("food/cup-tea.glb",.34,(-.30,.745,.045),yaw=.4,tint_mul=(.98,.96,.93),drop_bottom='flat')
import_kenney("food/cup-saucer.glb",.35,(-.07,.734,.10),tint_mul=(1,.98,.95),drop_bottom=True)
for x,z,yaw in ((-.10,.08,.15),(-.041,.08,-.35),(-.07,.12,.8)):
    import_kenney("food/cookie.glb",.25,(x,.748,z),yaw=yaw,tint_mul=(1,.96,.85),drop_bottom=True)
# A small, genuinely open purple hardcover leaves room for the tea and cookies.
add_bm_box(furniture_bm,furniture_color,-.07,.742,-.14,.19,.013,.12,'#785f85',yaw=.12)
for side in (-1,1):
    points=[(-.07,.756,-.197),(-.07+side*.087,.750,-.197),(-.07+side*.087,.750,-.083),(-.07,.756,-.083)]
    if side==1:points.reverse()
    face=furniture_bm.faces.new([furniture_bm.verts.new(P(*v)) for v in points])
    for loop in face.loops:loop[furniture_color]=(*hex_lin('#fff0de'),1)
    for row in range(3):add_bm_box(furniture_bm,furniture_color,-.07+side*.049,.757,-.177+row*.035,.055,.001,.002,'#c2a375')

# Low forest-green sofa along the right side wall: the front-right window sees
# its narrow arm/profile, leaving the centre rug, tea table and study in view.
sofa_x, sofa_z = 1.42, -0.02
sofa_yaw = -math.pi / 2
import_kenney(
    "furniture/loungeSofa.glb",
    1.40,
    (sofa_x, 0.377, sofa_z),
    yaw=sofa_yaw,
    palette_overrides={"carpet": "#3d5a45", "wood": "#422e20"},
)
# Lavender cushion and a sleeping pink piglet sharing the sofa.
pig_pos = (sofa_x - 0.14, 0.745, sofa_z + 0.38)
pig_yaw = face_toward(pig_pos[0], pig_pos[2], 1.36, 1.89)

def pig_point(x, y, z):
    return (pig_pos[0] + math.cos(pig_yaw)*x + math.sin(pig_yaw)*z,
            pig_pos[1] + y,
            pig_pos[2] - math.sin(pig_yaw)*x + math.cos(pig_yaw)*z)

# Sculpt at 20x12, then simplify ONLY the plush surfaces to the room's fixed
# budget. Facial stitches and recessed nostril bowls are protected separately.
pig_parts=[]
pig_metrics=[]
pig_details_start=sum(len(f.verts)-2 for f in furniture_bm.faces)

def smoothstep(a,b,value):
    t=max(0.0,min(1.0,(value-a)/(b-a)))
    return t*t*(3-2*t)

def plush_form(center,scale,color,sculpt=None,paint=None,detail_weight=1,name=None):
    form=bmesh.new();layer=form.loops.layers.float_color.new('Color')
    result=bmesh.ops.create_uvsphere(form,u_segments=20,v_segments=12,radius=1)
    colours={};local_points=[]
    for vertex in result['verts']:
        q=Vector((vertex.co.x,vertex.co.z,-vertex.co.y))
        point=Vector((center[0]+q.x*scale[0],center[1]+q.y*scale[1],center[2]+q.z*scale[2]))
        if sculpt is not None: point=Vector(sculpt(q,point))
        local_points.append(tuple(point))
        colours[vertex]=paint(q,point) if paint else hex_lin(color)
        vertex.co=P(*pig_point(*point))
    for face in {f for v in result['verts'] for f in v.link_faces}:
        face.smooth=True
        for loop in face.loops: loop[layer]=(*colours[loop.vert],1)
    mesh=bpy.data.meshes.new('plush-curved-surface');form.to_mesh(mesh);form.free()
    mesh['plush_role']=name or 'detail'
    pig_parts.append((mesh,detail_weight))
    if name:pig_metrics.append({"name":name,"min":[min(p[k] for p in local_points) for k in range(3)],"max":[max(p[k] for p in local_points) for k in range(3)]})

def pear(q,p):
    fullness=1.03-.17*q.y
    return (p.x*fullness,p.y,p.z*fullness-.012*q.y)

def belly_paint(q,p):
    radius=(p.x/.082)**2+((p.y-.143)/.090)**2
    patch=(1-smoothstep(.55,1.12,radius))*smoothstep(.02,.07,p.z)
    base=blend_lin(hex_lin('#f8b8c8'),hex_lin('#fff0f3'),patch)
    collar=smoothstep(.192,.196,p.y)*(1-smoothstep(.201,.205,p.y))
    return blend_lin(base,hex_lin('#785f85'),collar)

def cheek_paint(q,p):
    radius=((abs(p.x)-.068)/.028)**2+((p.y-.275)/.023)**2
    blush=math.exp(-radius*1.2)*smoothstep(.025,.065,p.z)*.82
    return blend_lin(hex_lin('#f8b8c8'),hex_lin('#ff9ebb'),blush)

# Compressed cushion spans y=.659–.749: the lifted piglet remains supported.
plush_form((0,-.041,.014),(.135,.045,.125),'#a892b8',detail_weight=.5)
plush_form((.018,.176,-.102),(.125,.153,.046),'#a892b8',detail_weight=.7,name='soft-lavender-back-cushion')
plush_form((0,.140,-.012),(.117,.135,.099),'#f8b8c8',sculpt=pear,paint=belly_paint,detail_weight=3.2,name='pear-body')
plush_form((0,.275,.014),(.119,.102,.092),'#f8b8c8',paint=cheek_paint,detail_weight=4.6,name='head')

def snout_dents(q,p):
    if q.z>0:
        dent=sum(math.exp(-2*(((p.x-side*.012)/.007)**2+((p.y-.264)/.007)**2)) for side in (-1,1))
        p.z-=.0018*dent*smoothstep(0,.6,q.z)
        p.z+=.0015*q.y
    return p

plush_form((0,.264,.113),(.039,.024,.011),'#ffd8e2',sculpt=snout_dents,detail_weight=2.0,name='button-snout')
for side in (-1,1):
    # Small rounded pig ears emerge at the head's 45-degree shoulders. They
    # fold forward locally; their entire width stays inside the head silhouette.
    def folded_ear(q,p,side=side):
        t=(q.y+1)*.5
        start=Vector((side*.065,.333,.012));bend=Vector((side*.082,.414,.025));tip=Vector((side*.095,.354,.047))
        centre=(1-t)**2*start+2*(1-t)*t*bend+t*t*tip
        tangent=(2*(1-t)*(bend-start)+2*t*(tip-bend)).normalized()
        width=(Vector((1,0,0))-tangent*tangent.x).normalized()
        normal=width.cross(tangent).normalized()
        inset=.0013*(1-q.x*q.x)*(1-q.y*q.y) if q.z<0 else 0
        return centre+width*(q.x*.014*(.75+.25*t))+normal*(q.z*.0055+inset)
    def inner_ear(q,p):
        inner=smoothstep(-.1,.65,-q.z)*(1-smoothstep(.65,1,abs(q.x)))
        return blend_lin(hex_lin('#f8b8c8'),hex_lin('#fca5b5'),inner)
    plush_form((0,0,0),(1,1,1),'#f8b8c8',sculpt=folded_ear,paint=inner_ear,detail_weight=.9,name=f'compact-ear-{side}')
    plush_form((side*.068,.035,.085),(.044,.031,.052),'#ffd8e2',detail_weight=.7)
    plush_form((side*.028,.160,.093),(.026,.028,.030),'#fff0f3',detail_weight=1.0,name=f'hug-paw-{side}')
    # Thin curved silk loops replace the old inflated, peanut-shaped lobes.
    grid=[]
    for row in range(7):
        u=row/6;ring=[]
        for column in range(5):
            v=column/2-1
            x=side*(.003+u*.018);y=.197+v*.006*math.sin(math.pi*u*.85)+.002*math.sin(math.pi*u)
            z=.112+.003*math.sin(math.pi*u)+.0015*v*v
            ring.append(furniture_bm.verts.new(P(*pig_point(x,y,z))))
        grid.append(ring)
    for row in range(6):
        for column in range(4):
            vertices=[grid[row][column],grid[row+1][column],grid[row+1][column+1],grid[row][column+1]]
            if side<0:vertices.reverse()
            face=furniture_bm.faces.new(vertices);face.smooth=True
            for loop in face.loops:loop[furniture_color]=(*hex_lin('#785f85' if column%2 else '#a892b8'),1)
    tail=[(side*.003,.194,.113),(side*.009,.195,.113),(side*.013,.178,.110),(side*.007,.181,.111)]
    if side>0:tail.reverse()
    face=furniture_bm.faces.new([furniture_bm.verts.new(P(*pig_point(*v))) for v in tail])
    for loop in face.loops:loop[furniture_color]=(*hex_lin('#785f85'),1)
plush_form((0,.197,.117),(.0038,.004,.003),'#a892b8',detail_weight=.25)

def facial_tube(points,radius,color):
    rings=[]
    for x,y,z in points:
        rings.append([furniture_bm.verts.new(P(*pig_point(x,y+radius*math.cos(k*math.pi/2),z+radius*math.sin(k*math.pi/2)))) for k in range(4)])
    for a,b in zip(rings,rings[1:]):
        for k in range(4):
            face=furniture_bm.faces.new((a[k],a[(k+1)%4],b[(k+1)%4],b[k]));face.smooth=True
            for loop in face.loops: loop[furniture_color]=(*hex_lin(color),1)

for side in (-1,1):
    points=[]
    for i in range(13):
        t=i/12;x=side*.049+(t-.5)*.035;y=.299+.007*math.sin(math.pi*t)
        z=.014+.092*math.sqrt(max(0,1-(x/.119)**2-((y-.275)/.102)**2))+.0025
        points.append((x,y,z))
    facial_tube(points,.0018,'#3e2830')
    # Two concentric oval rings drop into a recessed, plum-pink bowl.
    rings=[]
    for radius,depth in ((1,.1240),(.64,.1232)):
        rings.append([furniture_bm.verts.new(P(*pig_point(side*.012+math.cos(k*math.tau/12)*.0042*radius,.264+math.sin(k*math.tau/12)*.0045*radius,depth))) for k in range(12)])
    centre=furniture_bm.verts.new(P(*pig_point(side*.012,.264,.1228)))
    for k in range(12):
        faces=[furniture_bm.faces.new((rings[0][k],rings[0][(k+1)%12],rings[1][(k+1)%12],rings[1][k])),furniture_bm.faces.new((rings[1][k],rings[1][(k+1)%12],centre))]
        for face in faces:
            face.smooth=True
            for loop in face.loops: loop[furniture_color]=(*hex_lin('#d47a90'),1)
pig_detail_triangles=sum(len(f.verts)-2 for f in furniture_bm.faces)-pig_details_start

# The purple/green portrait now supplies the mantel's couple colour accents.

# Relaxed reading armchair on left living area, clear of door entry walkway
chair_x, chair_z = -1.06, 0.60
chair_yaw = face_toward(chair_x, chair_z, -0.35, -0.35)
import_kenney(
    "furniture/loungeChairRelax.glb",
    1.65,
    (chair_x, 0.377, chair_z),
    yaw=chair_yaw,
    palette_overrides={"carpet": "#6b5475", "wood": "#513423", "metal": "#5e4c36"},
)
import_kenney("furniture/pillowLong.glb",.80,(chair_x+.035,.67,chair_z-.035),yaw=chair_yaw,palette_overrides={"carpet":"#4a6852"})

# Tall warm floor lamp right beside reading chair (visible in upper left-front window!)
import_kenney(
    "furniture/lampRoundFloor.glb",
    1.85,
    (-1.60, 0.377, 0.96),
    yaw=0.0,
    palette_overrides={"metal": "#4a3c2c", "lamp": "#ffdfaa"},
)

# Writing desk along back wall with glowing warm table lamp, mug & books
import_kenney(
    "furniture/desk.glb",
    1.72,
    (0.18, 0.377, -1.14),
    yaw=0.0,
    palette_overrides={"wood": "#8f5c37", "metal": "#443a30"},
)
import_kenney(
    "furniture/lampRoundTable.glb",
    1.78,
    (-0.20, 1.037, -1.15),
    yaw=0.0,
    palette_overrides={"metal": "#6e583b", "lamp": "#ffe2b0"},
)
import_kenney(
    "furniture/books.glb",
    1.70,
    (0.24, 1.037, -1.12),
    yaw=0.18,
    palette_overrides={"carpetDarker": "#5e4373", "carpetWhite": "#f2ece4", "plant": "#416649", "metal": "#b2905a"},
)
import_kenney("food/mug.glb", 0.44, (0.50, 1.037, -1.28), yaw=-0.6, tint_mul=(0.95, 0.90, 0.85))

# Open foil-edged journal and a little feather quill sit below the warm lamp.
add_bm_box(furniture_bm,furniture_color,.50,1.045,-.96,.23,.014,.15,'#5e4373')
add_bm_box(furniture_bm,furniture_color,.50,1.054,-.96,.226,.006,.145,'#c4a36a')
for side in (-1,1):
    points=[(.50,1.064,-1.026),(.50+side*.106,1.059,-1.026),(.50+side*.106,1.059,-.894),(.50,1.064,-.894)]
    if side==1:points.reverse()
    verts=[furniture_bm.verts.new(P(*v)) for v in points];face=furniture_bm.faces.new(verts)
    for loop in face.loops:loop[furniture_color]=(*hex_lin('#fff0d9'),1)
    for row in range(4):add_bm_box(furniture_bm,furniture_color,.50+side*.057,1.065,-1.005+row*.028,.070,.001,.002,'#aa8c59')
quill_base=P(.636,1.039,-1.075);quill_tip=P(.630,1.188,-1.002);quill_direction=quill_tip-quill_base
quill_matrix=Matrix.Translation((quill_base+quill_tip)*.5)@quill_direction.to_track_quat('Z','Y').to_matrix().to_4x4()
quill=bmesh.ops.create_cone(furniture_bm,cap_ends=True,cap_tris=False,segments=6,radius1=.002,radius2=.0015,depth=quill_direction.length,matrix=quill_matrix)
for face in {f for v in quill['verts'] for f in v.link_faces}:
    for loop in face.loops:loop[furniture_color]=(*hex_lin('#c4a36a'),1)
feather=[(.634,1.092,-1.049),(.607,1.119,-1.035),(.608,1.155,-1.015),(.630,1.188,-1.002),(.653,1.151,-1.014),(.646,1.117,-1.033)]
for outline in (feather,list(reversed(feather))):
    face=furniture_bm.faces.new([furniture_bm.verts.new(P(*v)) for v in outline])
    for loop in face.loops:loop[furniture_color]=(*hex_lin('#e8dccb'),1)

# Open bookcase in back-right corner (right window background silhouette), filled with books & small plant
bx, bz = 1.44, -1.24
import_kenney(
    "furniture/bookcaseOpen.glb",
    1.86,
    (bx, 0.377, bz),
    yaw=0.0,
    palette_overrides={"wood": "#7c4f2e"},
)
for shelf_y, rot_k, pal in (
    (0.76, 0.10, {"carpetDarker": "#5e4373", "carpetWhite": "#f2ece4", "plant": "#416649", "metal": "#b08e58"}),
    (1.58, 0.08, {"carpetDarker": "#5e4373", "carpetWhite": "#f2ece4", "plant": "#416649", "metal": "#a68552"}),
):
    import_kenney("furniture/books.glb", 1.42 if shelf_y>1.5 else 1.72, (bx - 0.14, shelf_y, bz + 0.03), yaw=rot_k, palette_overrides=pal)
import_kenney(
    "furniture/plantSmall2.glb",
    1.30,
    (bx + 0.19, 1.58, bz + 0.04),
    yaw=0.4,
    palette_overrides={"wood": "#9e6b46", "plant": "#457042"},
)
import_kenney("furniture/plantSmall3.glb",1.25,(bx+.19,.76,bz+.04),yaw=-.3,palette_overrides={"wood":"#8a5a36","plant":"#416649"})
import_kenney("furniture/radio.glb",1.30,(bx,1.17,bz+.035),palette_overrides={"wood":"#865a39","metal":"#c8a568","metalMedium":"#55493c"},simplify_ratio=.8)
for x in (-.32,.68):
    import_kenney("furniture/lampWall.glb",1.1,(x,1.84,-1.458),palette_overrides={"metal":"#bd9558","lamp":"#ffe0a2"})

# Potted botanical fern tucked into front-right window corner
import_kenney(
    "furniture/pottedPlant.glb",
    1.15,
    (1.78, 0.377, 0.90),
    yaw=-0.4,
    palette_overrides={"wood": "#8f613d", "woodDark": "#3b2619", "plant": "#335434"},
)
for scale,pos in ((.90,(-.72,.377,1.08)),(.72,(.91,.377,-1.24))):
    import_kenney("furniture/pottedPlant.glb",scale,pos,yaw=.3,palette_overrides={"wood":"#8f613d","woodDark":"#3b2619","plant":"#335434"})

# Central overhead timber-and-parchment hanging pendant chandelier
px, pz = -0.05, -0.08
add_bm_cyl(furniture_bm, furniture_color, px, 2.98, pz, 0.012, 0.012, 1.15, 6, "#3a3127")
add_bm_cyl(furniture_bm, furniture_color, px, 2.40, pz, 0.24, 0.24, 0.028, 12, "#593b25")
add_bm_cyl(glow_bm, glow_color, px, 2.29, pz, 0.19, 0.23, 0.20, 12, "#ffebc2")


# ---------------------------------------------------------------------------
# 4. Vertex-Color Baked Soft Bounce GI & Export Strictly 2 Compact Draw Calls
# ---------------------------------------------------------------------------

def bake_room_ao_and_hearth_gi(bm, layer):
    hearth_center = Vector((-1.42, 0.84, -0.96))
    for face in bm.faces:
        for loop in face.loops:
            # Blender world coords -> Three.js (tx, ty, tz)
            co = loop.vert.co
            tx, ty, tz = co.x, co.z, -co.y
            pos_3 = Vector((tx, ty, tz))
            d_hearth = (pos_3 - hearth_center).length
            warmth_gi = 1.20 * math.exp(-d_hearth * 1.22)
            d_floor = (pos_3 - Vector((-1.60, 1.35, 0.96))).length
            d_table = (pos_3 - Vector((-0.20, 1.36, -1.15))).length
            wall_gi=sum(.24*math.exp(-(pos_3-Vector((x,1.9,-1.40))).length*1.65) for x in (-.32,.68))
            lamp_gi = 0.55 * math.exp(-d_floor * 2.0) + 0.75 * math.exp(-d_table * 2.3)+wall_gi

            floor_factor = 0.78 + 0.22 * min(1.0, max(0.0, (ty - 0.37) / 0.55))
            corner_prox = max(abs(tx) / 2.02, abs(tz) / 1.62)
            corner_ao = 0.64 + 0.36 * (1.0 - min(1.0, corner_prox) ** 4)
            ceiling_ao = 0.76 if ty > 3.15 else 1.0

            base = loop[layer]
            mul_r = (floor_factor * corner_ao * ceiling_ao) * (1.0 + warmth_gi * 0.92 + lamp_gi * 0.55)
            mul_g = (floor_factor * corner_ao * ceiling_ao) * (1.0 + warmth_gi * 0.25 + lamp_gi * 0.28)
            mul_b = (floor_factor * corner_ao * ceiling_ao) * (1.0 - warmth_gi * 0.22 - lamp_gi * 0.12)
            loop[layer] = (
                max(0.0, min(1.0, base[0] * mul_r)),
                max(0.0, min(1.0, base[1] * mul_g)),
                max(0.0, min(1.0, base[2] * mul_b)),
                1.0,
            )


# Keep all architecture/CC0 furnishings intact. Spend the remaining room budget
# on the sculpt, protecting the separate eyelid tubes and recessed nose bowls.
def merge_flat_surfaces(bm,layer):
    """Remove coplanar subdivisions without merging colour seams or curved edges."""
    before=sum(len(f.verts)-2 for f in bm.faces)
    colour_ids={}
    for face in bm.faces:
        colours=[tuple(round(c,5) for c in loop[layer]) for loop in face.loops]
        key=colours[0] if all(c==colours[0] for c in colours) else ('painted',len(colour_ids))
        if key not in colour_ids:colour_ids[key]=len(colour_ids)
        face.material_index=colour_ids[key]
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
    bm.normal_update()
    # Open painted sheets (pages, portrait and floor skins) are protected.
    bmesh.ops.dissolve_limit(bm,angle_limit=.0001,use_dissolve_boundaries=True,verts=[v for v in bm.verts if not v.is_boundary],edges=[e for e in bm.edges if e.is_manifold],delimit={'MATERIAL','NORMAL'})
    for face in bm.faces:face.material_index=0
    return before-sum(len(f.verts)-2 for f in bm.faces)

planar_savings=merge_flat_surfaces(furniture_bm,furniture_color)+merge_flat_surfaces(glow_bm,glow_color)
surface_tree=BVHTree.FromBMesh(furniture_bm)
page_hit=surface_tree.ray_cast(P(-.115,1.1,-.14),P(0,-1,0))[0]
floor_hit=surface_tree.ray_cast(P(.90,1,.75),P(0,-1,0))[0]
portrait_hit=surface_tree.ray_cast(P(*H(0,1.83,.70)),P(-s_h,0,-c_h))[3]
assert page_hit is not None and .751<page_hit.z<.757, 'Open book pages lost during optimization'
assert floor_hit is not None and abs(floor_hit.z-.376)<.00001, 'Visible floor skin lost during optimization'
assert portrait_hit is not None and abs(portrait_hit-.465)<.001, 'Portrait picture lost during optimization'
surface_checks={'openPagesY':page_hit.z,'floorY':floor_hit.z,'portraitDepth':portrait_hit}
pig_source_triangles=sum(len(p.vertices)-2 for mesh,_ in pig_parts for p in mesh.polygons)
base_triangles=sum(len(f.verts)-2 for bm in (furniture_bm,glow_bm) for f in bm.faces)
pig_budget=5940-base_triangles
print('ROOM_BUDGET',json.dumps({'base':base_triangles,'hiddenSaved':hidden_surface_triangles,'coplanarSaved':planar_savings,'pigBudget':pig_budget}))
assert pig_budget>1000, f'Insufficient smooth piglet budget: {pig_budget}'
pig_surface_triangles=0
optimized_pig_parts=[]
total_detail_weight=sum(weight for _,weight in pig_parts)
for mesh,weight in pig_parts:
    role=mesh.get('plush_role','detail')
    pig_obj=bpy.data.objects.new('sleepy-piglet-sculpt',mesh);collection.objects.link(pig_obj)
    source_triangles=sum(len(p.vertices)-2 for p in mesh.polygons)
    modifier=pig_obj.modifiers.new('Curvature-preserving plush budget','DECIMATE')
    modifier.ratio=min(1.0,int(pig_budget*weight/total_detail_weight)/source_triangles)
    modifier.use_collapse_triangulate=True
    bpy.context.view_layer.objects.active=pig_obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in pig_obj.data.polygons: polygon.use_smooth=True
    part_triangles=sum(len(p.vertices)-2 for p in pig_obj.data.polygons)
    pig_surface_triangles+=part_triangles
    entry={'name':role,'triangles':part_triangles}
    if role.startswith('compact-ear'):
        local=[]
        for vertex in pig_obj.data.vertices:
            dx=vertex.co.x-pig_pos[0];dz=-vertex.co.y-pig_pos[2]
            local.append((dx*math.cos(pig_yaw)-dz*math.sin(pig_yaw),vertex.co.z-pig_pos[1],dx*math.sin(pig_yaw)+dz*math.cos(pig_yaw)))
        entry['embeddedVertices']=sum((x/.119)**2+((y-.275)/.102)**2+((z-.014)/.092)**2<.95 for x,y,z in local)
        assert entry['embeddedVertices']>=1,'Pig ear must remain embedded in the head after optimization'
    optimized_pig_parts.append(entry)
    furniture_bm.from_mesh(pig_obj.data)
    bpy.data.objects.remove(pig_obj,do_unlink=True)
bake_room_ao_and_hearth_gi(furniture_bm, furniture_color)

bmesh.ops.triangulate(furniture_bm, faces=furniture_bm.faces[:])
bmesh.ops.triangulate(glow_bm, faces=glow_bm.faces[:])

# Enforce physical cabin-local bounds before export, independently of the runtime.
room_vertices = [(v.co.x, v.co.z, -v.co.y) for bm in (furniture_bm, glow_bm) for v in bm.verts]
bounds_min = [min(v[axis] for v in room_vertices) for axis in range(3)]
bounds_max = [max(v[axis] for v in room_vertices) for axis in range(3)]
assert bounds_min[0] >= -1.96 and bounds_max[0] <= 1.96, f"Interior wall clearance failed: {bounds_min} / {bounds_max}"

# Build Blender Mesh Objects with Vertex Color shader link so glTF exports COLOR_0 cleanly.
mat_furn = bpy.data.materials.new("Cabin_Interior_Furniture")
mat_furn.use_nodes = True
pf = mat_furn.node_tree.nodes.get("Principled BSDF")
pf.inputs["Roughness"].default_value = 0.78
pf.inputs["Metallic"].default_value = 0.04
vcf = mat_furn.node_tree.nodes.new("ShaderNodeVertexColor")
vcf.layer_name = "Color"
mat_furn.node_tree.links.new(vcf.outputs["Color"], pf.inputs["Base Color"])

mat_glow = bpy.data.materials.new("Cabin_Interior_Glow")
mat_glow.use_nodes = True
pg = mat_glow.node_tree.nodes.get("Principled BSDF")
pg.inputs["Roughness"].default_value = 0.45
pg.inputs["Emission Strength"].default_value = 1.0
vcg = mat_glow.node_tree.nodes.new("ShaderNodeVertexColor")
vcg.layer_name = "Color"
mat_glow.node_tree.links.new(vcg.outputs["Color"], pg.inputs["Base Color"])
mat_glow.node_tree.links.new(vcg.outputs["Color"], pg.inputs["Emission Color"])

mesh_furn = bpy.data.meshes.new("cabin-interior-furniture")
furniture_bm.to_mesh(mesh_furn)
furniture_bm.free()
obj_furn = bpy.data.objects.new("cabin-interior-furniture", mesh_furn)
obj_furn.data.materials.append(mat_furn)
collection.objects.link(obj_furn)

mesh_glow = bpy.data.meshes.new("cabin-interior-glow")
glow_bm.to_mesh(mesh_glow)
glow_bm.free()
obj_glow = bpy.data.objects.new("cabin-interior-glow", mesh_glow)
obj_glow.data.materials.append(mat_glow)
collection.objects.link(obj_glow)

counts = {
    "cabin-interior-furniture": len(mesh_furn.polygons),
    "cabin-interior-glow": len(mesh_glow.polygons),
}
total_tris = sum(counts.values())
assert 5400 <= total_tris <= 5950 and total_tris < 6000, f"Interior triangle budget exceeded: {total_tris} ({counts})"

OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
obj_furn.select_set(True)
obj_glow.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(OUT),
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_animations=False,
    export_extras=True,
    export_lights=False,
)

manifest = {
    "blender": bpy.app.version_string,
    "triangles": counts,
    "totalTriangles": total_tris,
    "drawCallMeshes": 2,
    "bounds": {"min": bounds_min, "max": bounds_max},
    "layout": {"sofa": [sofa_x, 0.377, sofa_z], "sofaYaw": sofa_yaw, "plant": [1.78, 0.377, 0.90], "plantScale": 1.15, "piglet": list(pig_pos), "pigletYaw": pig_yaw},
    "theme": "forest-green-and-lavender / sleepy-pink-piglet",
    "keepsakes": {"portrait": list(H(0,1.735,.243)), "openJournal": [.50,1.064,-.96], "quill": [.634,1.12,-1.02]},
    "assets":asset_layout,
    "optimization":{"hiddenSurfaceTrianglesRemoved":hidden_surface_triangles,"coplanarTrianglesRemoved":planar_savings,"pigSurfaceBudget":pig_budget},
    "surfaceChecks":surface_checks,
    "piglet": {"design":"compact-crown-button-nose-fine-ribbon-v2", "authoredSegments": [20,12], "sourceSurfaceTriangles": pig_source_triangles, "surfaceTriangles": pig_surface_triangles, "protectedDetailTriangles": pig_detail_triangles, "metrics":pig_metrics,"optimizedParts":optimized_pig_parts, "features": ["pear-body", "gradient-belly", "rounded-forward-drooping-ears", "compact-crown-pig-ears", "button-snout", "shallow-peach-nostrils", "curved-smiling-eyelids", "peach-blush", "hugging-hands", "lavender-bow", "fine-silk-bow"]},
    "hearth": {"staticFlames": 0, "emberColors": ["#d84212", "#ff7420"], "runtimeAnchor": list(H(0,.78,.12)), "yaw": hyaw},
    "units": "metres, Three.js Y-up",
    "bytes": OUT.stat().st_size,
    "groups": ["cabin-interior-furniture", "cabin-interior-glow"],
    "authoringScript": "scripts/authoring/create_cabin_interior.py",
    "license": "CC0-1.0 (Kenney Furniture/Food/Holiday/Survival kits + original architecture)",
}
OUT.with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print("CABIN_INTERIOR_READY", json.dumps(manifest))
