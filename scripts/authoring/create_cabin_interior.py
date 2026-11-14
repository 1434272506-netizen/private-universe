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


def add_bm_box(bm, layer, x, y, z, w, h, d, color_hex, yaw=0.0, rx=0.0, rz=0.0):
    """Append an axis-aligned or rotated box centered at Three.js (x, y, z)."""
    lin = hex_lin(color_hex) if isinstance(color_hex, str) else color_hex
    mat_t = Matrix.Translation(P(x, y, z))
    mat_r = Euler((rx, -rz, yaw), "XYZ").to_matrix().to_4x4()
    mat_s = Matrix.Diagonal((w, d, h, 1.0))
    res = bmesh.ops.create_cube(bm, size=1.0, matrix=mat_t @ mat_r @ mat_s)
    verts = set(res["verts"])
    for f in bm.faces:
        if all(v in verts for v in f.verts):
            for l in f.loops:
                l[layer] = (*lin, 1.0)


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
    add_bm_box(furniture_bm, furniture_color, x, 0.370, 0.0, 0.319, 0.012, 3.10, plank_tints[idx % 4])

# Interior back wall horizontal tongue-and-groove cladding (back wall has zero windows!)
wall_shades = ("#744d31", "#6b452c", "#7d5437")
for row in range(10):
    y = 0.48 + row * 0.20
    add_bm_box(furniture_bm, furniture_color, 0.0, y, -1.555, 3.918, 0.194, 0.024, wall_shades[row % 3])
# Dado waist rail along back wall
add_bm_box(furniture_bm, furniture_color, 0.0, 1.04, -1.535, 3.918, 0.045, 0.032, "#573722")
# Back gable triangle planking inside roof pitch (slope = 0.62 -> height below exterior shell)
for i in range(-11, 12):
    x = i * 0.168
    h = max(0.05, 1.18 - abs(x) * 0.62)
    add_bm_box(furniture_bm, furniture_color, x, 2.38 + h * 0.5, -1.555, 0.162, h, 0.024, wall_shades[abs(i) % 3])

# Interior door-frame timber backing (only behind center door |x| < 0.52, leaving windows clear!)
add_bm_box(furniture_bm, furniture_color, 0.0, 1.25, 1.66, 0.98, 1.78, 0.028, "#6a452b")
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
add_bm_box(furniture_bm, furniture_color, *H(0.0, 0.485, 0.06), 0.98, 0.22, 0.72, "#766f65", yaw=hyaw)
add_bm_box(furniture_bm, furniture_color, *H(0.0, 0.612, 0.09), 1.04, 0.045, 0.76, "#8d8578", yaw=hyaw)

# Firebox charcoal back & cheeks + left/right stone piers (opening y = 0.635 .. 1.24)
add_bm_box(furniture_bm, furniture_color, *H(0.0, 0.96, -0.17), 0.56, 0.68, 0.14, "#24201c", yaw=hyaw)
add_bm_box(furniture_bm, furniture_color, *H(0.0, 0.96, -0.25), 0.86, 0.72, 0.10, "#6d655c", yaw=hyaw)
for side in (-1.0, 1.0):
    add_bm_box(furniture_bm, furniture_color, *H(side * 0.335, 0.96, 0.02), 0.21, 0.68, 0.44, "#7c746a", yaw=hyaw)
# Sculptural staggered ashlar stone veneer blocks on front jambs & lintel
stone_pal = ("#8e8577", "#746c62", "#9a9082", "#675f55")
for row in range(4):
    sy = 0.71 + row * 0.165
    for side in (-1.0, 1.0):
        add_bm_box(furniture_bm, furniture_color, *H(side * 0.335, sy, 0.245), 0.195, 0.14, 0.06, stone_pal[(row + int(side + 1)) % 4], yaw=hyaw)
# Heavy arch stone lintel & warm walnut mantel shelf (y = 1.42)
add_bm_box(furniture_bm, furniture_color, *H(0.0, 1.32, 0.02), 0.92, 0.17, 0.48, "#7f766a", yaw=hyaw)
add_bm_box(furniture_bm, furniture_color, *H(0.0, 1.435, 0.06), 1.08, 0.075, 0.54, "#583a24", yaw=hyaw)
# Tapered chimney breast ascending into exterior chimney stack (x=-1.55, y=2.28, z=-0.90)
add_bm_box(furniture_bm, furniture_color, *H(0.0, 1.72, -0.02), 0.80, 0.52, 0.44, "#756d63", yaw=hyaw)
add_bm_box(furniture_bm, furniture_color, -1.53, 2.24, -0.94, 0.70, 0.62, 0.48, "#6f675d", yaw=hyaw * 0.4)

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
add_bm_box(glow_bm, glow_color, *H(0.0, 0.692, 0.10), 0.38, 0.035, 0.25, "#e45414", yaw=hyaw)
for i in range(7):
    add_bm_cyl(glow_bm, glow_color, *H((i-3)*0.046, 0.725, 0.19+(i%2)*0.018),
               0.026, 0.019, 0.018, 6, "#ff8a27")
for fx_u, fy, fz_d, fr, fh, col in (
    (-0.12, 0.93, 0.12, 0.052, 0.27, "#ff7420"),
    (-0.065, 1.00, 0.08, 0.058, 0.36, "#ffb23d"),
    (0.005, 1.015, 0.10, 0.062, 0.39, "#ffc663"),
    (0.075, 0.96, 0.14, 0.047, 0.29, "#ff8a29"),
    (0.13, 0.92, 0.07, 0.038, 0.24, "#ef5818"),
):
    add_bm_cyl(glow_bm, glow_color, *H(fx_u, fy, fz_d), fr, 0.004, fh, 7, col)
    add_bm_cyl(glow_bm, glow_color, *H(fx_u, fy-0.04, fz_d+0.026), fr*0.46, 0.003, fh*0.58, 6, "#ffe0a0")

# Mantel decor: potted mini fern, twin brass candlesticks + glowing flames, festive wreath above mantel
import_kenney("furniture/plantSmall1.glb", 1.55, H(-0.32, 1.472, 0.16), yaw=hyaw, palette_overrides={"wood": "#a87049", "plant": "#3f6a3f"})
for cu in (0.26, 0.36):
    add_bm_cyl(furniture_bm, furniture_color, *H(cu, 1.515, 0.18), 0.022, 0.016, 0.085, 6, "#b29058")
    add_bm_cyl(glow_bm, glow_color, *H(cu, 1.59, 0.18), 0.016, 0.014, 0.07, 6, "#f7ebd4")
    add_bm_cyl(glow_bm, glow_color, *H(cu, 1.645, 0.18), 0.013, 0.003, 0.045, 5, "#ffd06b")
# Evergreen wreath mounted flat onto the upper chimney breast (clearly framed in left-front window!)
import_kenney("holiday/wreath.glb", 0.56, H(0.0, 1.66, 0.23), yaw=hyaw, pivot_z="min", tint_mul=(0.45, 0.55, 0.38))


# ---------------------------------------------------------------------------
# 3. Furnish Living, Reading & Study Zones with Kenney CC0 GLBs
# ---------------------------------------------------------------------------

# Woven round area rug on floorboards in center room
import_kenney(
    "furniture/rugRound.glb",
    1.95,
    (-0.14, 0.377, -0.02),
    yaw=0.0,
    palette_overrides={"carpet": "#cbb292", "carpetDarker": "#945743"},
)

# Coffee table resting over the rug + teacup + small stack of books
import_kenney(
    "furniture/tableCoffee.glb",
    1.55,
    (-0.18, 0.377, -0.04),
    yaw=0.22,
    palette_overrides={"wood": "#9e683e"},
)
import_kenney("food/cup-tea.glb", 0.52, (-0.30, 0.734, 0.02), yaw=0.4, tint_mul=(0.96, 0.93, 0.88))
import_kenney(
    "furniture/books.glb",
    1.55,
    (-0.02, 0.734, -0.08),
    yaw=-0.35,
    palette_overrides={"carpetDarker": "#7f3f36", "carpetWhite": "#efe5d5", "plant": "#3c6347", "metal": "#b4915b"},
)

# Low caramel sofa along the right side wall: the front-right window sees
# its narrow arm/profile, leaving the centre rug, tea table and study in view.
sofa_x, sofa_z = 1.42, -0.02
sofa_yaw = -math.pi / 2
import_kenney(
    "furniture/loungeSofa.glb",
    1.40,
    (sofa_x, 0.377, sofa_z),
    yaw=sofa_yaw,
    palette_overrides={"carpet": "#8b543b", "wood": "#513423"},
)
# Cozy accent pillows + seated plush bear perched neatly above sofa seat cushions (y=0.69)
import_kenney(
    "furniture/pillow.glb",
    1.55,
    (sofa_x + 0.05, 0.66, sofa_z - 0.37),
    yaw=sofa_yaw + 0.25,
    palette_overrides={"carpet": "#cfb89b"},
)
import_kenney(
    "furniture/bear.glb",
    0.85,
    (sofa_x - 0.14, 0.66, sofa_z + 0.38),
    yaw=sofa_yaw - 0.25,
    palette_overrides={"fur": "#a6764c", "wood": "#e3ccb0", "metalDark": "#241d19"},
)

# Relaxed reading armchair on left living area, clear of door entry walkway
chair_x, chair_z = -1.06, 0.60
chair_yaw = face_toward(chair_x, chair_z, -0.35, -0.35)
import_kenney(
    "furniture/loungeChairRelax.glb",
    1.65,
    (chair_x, 0.377, chair_z),
    yaw=chair_yaw,
    palette_overrides={"carpet": "#9a5442", "wood": "#70482b", "metal": "#5e4c36"},
)

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
    palette_overrides={"carpetDarker": "#59684e", "carpetWhite": "#f0e6d6", "plant": "#9b5a42", "metal": "#b2905a"},
)
import_kenney("food/mug.glb", 0.44, (0.50, 1.037, -1.02), yaw=-0.6, tint_mul=(0.95, 0.90, 0.85))

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
    (0.76, 0.10, {"carpetDarker": "#8a4638", "carpetWhite": "#ede3d3", "plant": "#49684f", "metal": "#b08e58"}),
    (1.17, -0.14, {"carpetDarker": "#4d615c", "carpetWhite": "#efe5d5", "plant": "#9e6b43", "metal": "#7a523c"}),
    (1.58, 0.08, {"carpetDarker": "#7b533b", "carpetWhite": "#ebe0cf", "plant": "#5b7049", "metal": "#a68552"}),
):
    import_kenney("furniture/books.glb", 1.72, (bx - 0.14, shelf_y, bz + 0.03), yaw=rot_k, palette_overrides=pal)
import_kenney(
    "furniture/plantSmall1.glb",
    1.55,
    (bx + 0.14, 1.58, bz + 0.04),
    yaw=0.4,
    palette_overrides={"wood": "#9e6b46", "plant": "#457042"},
)

# Potted botanical fern tucked into front-right window corner
import_kenney(
    "furniture/pottedPlant.glb",
    1.15,
    (1.78, 0.377, 0.90),
    yaw=-0.4,
    palette_overrides={"wood": "#8f613d", "woodDark": "#3b2619", "plant": "#335434"},
)

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
            lamp_gi = 0.55 * math.exp(-d_floor * 2.0) + 0.75 * math.exp(-d_table * 2.3)

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
assert total_tris <= 6000, f"Interior triangle budget exceeded: {total_tris} ({counts})"

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
    "layout": {"sofa": [sofa_x, 0.377, sofa_z], "sofaYaw": sofa_yaw, "plant": [1.78, 0.377, 0.90], "plantScale": 1.15},
    "units": "metres, Three.js Y-up",
    "bytes": OUT.stat().st_size,
    "groups": ["cabin-interior-furniture", "cabin-interior-glow"],
    "authoringScript": "scripts/authoring/create_cabin_interior.py",
    "license": "CC0-1.0 (Kenney Furniture/Food/Holiday/Survival kits + original architecture)",
}
OUT.with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print("CABIN_INTERIOR_READY", json.dumps(manifest))
