"""Author the actual Love Garden hero tree in Blender 4.5 + MTree 5.6.

Run with the adjacent portable Blender. Geometry and foliage are deterministic.
The MTree manifold trunk/branch mesh is organically joined to authored buttresses
and the ribbon bough using a voxel remesh, followed by silhouette-aware reduction.
"""
from __future__ import annotations

import bpy
import bmesh
import json
import math
import pathlib
import random
import struct
import sys
import time
import zipfile
from mathutils import Vector
import numpy as np

PROJECT = pathlib.Path(__file__).resolve().parents[2]
HERE = PROJECT / 'work' / 'model-authoring'
HERE.mkdir(parents=True, exist_ok=True)
TEXTURES = pathlib.Path(__file__).resolve().parent / 'textures'
OUTPUT = PROJECT / 'public' / 'models'
OUTPUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(HERE / 'tools' / 'mtree-python'))
from m_tree import m_tree as mt

SEED = 102903
rng = random.Random(SEED)
np_rng = np.random.default_rng(SEED)
started = time.time()


def log(*args):
    print(*args, flush=True)


def cp(value):
    return mt.PropertyWrapper(mt.ConstantProperty(value))


def object_mesh(name, vertices, faces):
    mesh = bpy.data.meshes.new(name + '-mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for face in mesh.polygons:
        face.use_smooth = True
    return obj


def mesh_quality(obj):
    """CPU-only topology evidence, independent of the rendered appearance."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    seen = set()
    components = []
    for vertex in bm.verts:
        if vertex in seen:
            continue
        seen.add(vertex)
        pending = [vertex]
        component = []
        while pending:
            current = pending.pop()
            component.append(current)
            for edge in current.link_edges:
                other = edge.other_vert(current)
                if other not in seen:
                    seen.add(other)
                    pending.append(other)
        components.append(component)
    result = {
        'vertices': len(bm.verts), 'faces': len(bm.faces),
        'connectedComponents': len(components),
        'largestComponentVertices': max((len(c) for c in components), default=0),
        'boundaryEdges': sum(edge.is_boundary for edge in bm.edges),
        'nonManifoldEdges': sum(not edge.is_manifold for edge in bm.edges),
        'signedVolume': bm.calc_volume(signed=True),
    }
    bm.free()
    return result


def keep_connected_wood(obj):
    """Discard sub-voxel twig remnants, retaining the connected trunk/roots."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    seen = set()
    components = []
    for vertex in bm.verts:
        if vertex in seen:
            continue
        seen.add(vertex)
        pending = [vertex]
        component = []
        while pending:
            current = pending.pop()
            component.append(current)
            for edge in current.link_edges:
                other = edge.other_vert(current)
                if other not in seen:
                    seen.add(other)
                    pending.append(other)
        components.append(component)
    if len(components) > 1:
        largest = max(components, key=len)
        discarded = [v for component in components if component is not largest for v in component]
        log('Remove sub-voxel disconnected remnants', len(components)-1, 'components,', len(discarded), 'vertices')
        bmesh.ops.delete(bm, geom=discarded, context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def make_cpp_wood():
    trunk = mt.TrunkFunction()
    trunk.seed = SEED
    trunk.length = 6.65
    trunk.start_radius = .72
    trunk.end_radius = .085
    trunk.shape = .62
    trunk.resolution = 5.0
    trunk.randomness = .12
    trunk.up_attraction = .7

    major = mt.BranchFunction()
    major.seed = SEED + 1
    major.length = cp(6.1)
    major.start_radius = cp(.68)
    major.end_radius = .023
    major.distribution.start = .36
    major.distribution.end = .9
    major.distribution.density = 2.15
    major.start_angle = cp(72)
    major.randomness = cp(.22)
    major.flatness = .5
    major.gravity.strength = 1.1
    major.gravity.stiffness = .7
    major.gravity.up_attraction = .16
    major.split.probability = .18
    major.split.radius = .72
    major.split.angle = 38
    major.break_chance = .005
    major.resolution = 3.5
    major.crown.shape = mt.CrownShape.Hemispherical

    secondary = mt.BranchFunction()
    secondary.seed = SEED + 2
    secondary.length = cp(1.9)
    secondary.start_radius = cp(.43)
    secondary.end_radius = .01
    secondary.distribution.start = .30
    secondary.distribution.end = .94
    secondary.distribution.density = 2.4
    secondary.start_angle = cp(52)
    secondary.randomness = cp(.32)
    secondary.flatness = .35
    secondary.gravity.strength = .6
    secondary.gravity.stiffness = .6
    secondary.gravity.up_attraction = .25
    secondary.split.probability = .12
    secondary.split.radius = .65
    secondary.break_chance = .02
    secondary.resolution = 3.5
    secondary.crown.shape = mt.CrownShape.Hemispherical
    trunk.add_child(major)
    major.add_child(secondary)

    tree = mt.Tree()
    tree.set_trunk_function(trunk)
    tree.execute_functions()
    mesher = mt.ManifoldMesher()
    mesher.radial_n_points = 14
    mesher.smooth_iterations = 4
    cpp = mesher.mesh_tree(tree)
    vertices = cpp.get_vertices().reshape(-1, 3).copy()
    polygons = cpp.get_polygons().reshape(-1, 4)[:, ::-1].copy()
    # Preserve the bole's width while gently expanding the upper crown scaffolds.
    for p in vertices:
        spread = 1.0 - .05 * min(1, max(0, (float(p[2]) - 2.2) / 2.0))
        p[0] *= spread
        p[1] *= spread
    log('MTree manifold source', len(vertices), 'vertices, bounds', vertices.min(axis=0), vertices.max(axis=0))
    obj = object_mesh('Bark_MTree_ContinuousBranches', vertices.tolist(), polygons.tolist())
    # MTree's otherwise-connected manifold scaffold leaves terminal rings open.
    # Voxel remeshing an uncapped shell destroys its interior and yields hundreds
    # of floating surface chips. Close the terminal rings before the volume union.
    log('MTree source topology', json.dumps(mesh_quality(obj)))
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    caps = bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    log('Capped MTree terminal rings', len(caps['faces']), json.dumps(mesh_quality(obj)))
    return obj


def tube(name, points, radii, steps=32, sides=16, ellipse=1.0):
    # Smooth piecewise Catmull-Rom centerline; joined parts are remeshed below.
    pts = [Vector(p) for p in points]
    def catmull(t):
        f = t * (len(pts)-1)
        i = min(len(pts)-2, int(f)); u = f-i
        p0,p1,p2,p3 = pts[max(0,i-1)],pts[i],pts[i+1],pts[min(len(pts)-1,i+2)]
        return .5*((2*p1)+(-p0+p2)*u+(2*p0-5*p1+4*p2-p3)*u*u+(-p0+3*p1-3*p2+p3)*u*u*u)
    vv=[];ff=[]
    for j in range(steps+1):
        t=j/steps;c=catmull(t)
        tangent=catmull(min(1,t+.001))-catmull(max(0,t-.001));tangent.normalize()
        reference=Vector((0,0,1)) if abs(tangent.z)<.9 else Vector((1,0,0))
        a=tangent.cross(reference).normalized();b=tangent.cross(a).normalized()
        rt=t*(len(radii)-1);ri=min(len(radii)-2,int(rt));r=radii[ri]*(1-(rt-ri))+radii[ri+1]*(rt-ri)
        for k in range(sides):
            angle=k/sides*math.tau
            v=c + a*(math.cos(angle)*r)+b*(math.sin(angle)*r*ellipse)
            vv.append(tuple(v))
    for j in range(steps):
        for k in range(sides):
            a=j*sides+k;b=j*sides+(k+1)%sides;c=(j+1)*sides+(k+1)%sides;d=(j+1)*sides+k
            ff.append((a,b,c,d))
    ff.append(tuple(reversed(range(sides))))
    ff.append(tuple(steps*sides+k for k in range(sides)))
    return object_mesh(name,vv,ff)


def assemble_wood():
    pieces=[make_cpp_wood()]
    # Mature fused flutes gently spiral around the lower bole, rather than a cylinder.
    for i in range(6):
        angle=i*math.tau/6+.18
        pieces.append(tube('Fused-bole-flute',[
            (.37*math.cos(angle),.37*math.sin(angle),-.12),
            (.49*math.cos(angle+.11),.49*math.sin(angle+.11),.8),
            (.36*math.cos(angle+.22),.36*math.sin(angle+.22),1.8),
            (.30*math.cos(angle+.34),.30*math.sin(angle+.34),2.55),
        ],[.25,.23,.15,.09],steps=22,sides=12))

    contacts=json.loads((pathlib.Path(__file__).resolve().parent/'root-contacts.json').read_text())
    for i,contact in enumerate(contacts):
        x,y,z=contact['x'],-contact['z'],contact['y']
        # The root forms a broad vertical buttress at the bole, then tapers into soil.
        pieces.append(tube('Buttress-%02d'%i,[
            (x*.07,y*.07,1.16), (x*.30,y*.30,.57+z*.12),
            (x*.63,y*.63,.18+z*.62), (x,y,z-.06)
        ],[.32,.29,.17,.025],steps=30,sides=14,ellipse=1.5))
        # One grounded secondary root adds an uneven branching silhouette.
        if i in (0,2,4):
            pieces.append(tube('Root-fork-%02d'%i,[
                (x*.60,y*.60,.12+z*.5),(x*.82-y*.12,y*.82+x*.12,z+.02),
                (x-y*.18,y+x*.18,z-.10)
            ],[.12,.065,.012],steps=14,sides=10))

    # Separate authored foreground bough: bottom surface remains above the 2.2m clearance.
    pieces.append(tube('Authored-ribbon-bough',[
        (.25,-.22,2.37),(.82,-.64,2.72),(1.65,-1.29,2.91),(2.42,-1.94,2.94),
        (2.96,-2.25,3.28),(3.30,-2.42,3.69)
    ],[.28,.245,.19,.125,.07,.025],steps=45,sides=18))

    bpy.ops.object.select_all(action='DESELECT')
    for obj in pieces:obj.select_set(True)
    bpy.context.view_layer.objects.active=pieces[0]
    bpy.ops.object.join()
    wood=bpy.context.object;wood.name='Bark_ContinuousTrunkAndRoots'
    log('Organic union input',len(wood.data.vertices),'vertices')
    remesh=wood.modifiers.new('OrganicUnion','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.046;remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    keep_connected_wood(wood)
    log('Closed organic union topology', json.dumps(mesh_quality(wood)))
    smooth=wood.modifiers.new('ForkMuscleTransitions','SMOOTH');smooth.factor=1.2;smooth.iterations=5
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    # Reduce the whole connected surface, not each crossing tube in isolation.
    triangles=sum(len(p.vertices)-2 for p in wood.data.polygons)
    decimate=wood.modifiers.new('WebSilhouetteReduction','DECIMATE');decimate.ratio=min(1.0,26000/max(1,triangles))
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    changed=wood.data.validate(verbose=False,clean_customdata=True)
    if changed:log('Cleaned degenerate remesh polygons before UV authoring')
    keep_connected_wood(wood)
    for p in wood.data.polygons:p.use_smooth=True
    wood.data.update()
    quality = mesh_quality(wood)
    if quality['connectedComponents'] != 1 or quality['boundaryEdges'] != 0 or quality['nonManifoldEdges'] != 0:
        raise RuntimeError('Authored bark must be one closed connected surface: ' + json.dumps(quality))
    log('Final wood topology', json.dumps(quality))
    log('Organic union output',len(wood.data.vertices),'vertices',sum(len(p.vertices)-2 for p in wood.data.polygons),'triangles')

    # Cylindrical bark coordinates continue vertically through the broad trunk.
    uv=wood.data.uv_layers.new(name='BarkUV')
    for p in wood.data.polygons:
        us=[]
        for li in p.loop_indices:
            co=wood.data.vertices[wood.data.loops[li].vertex_index].co
            us.append(math.atan2(co.y,co.x)/math.tau)
        seam=max(us)-min(us)>.5
        for li,u in zip(p.loop_indices,us):
            co=wood.data.vertices[wood.data.loops[li].vertex_index].co
            if seam and u<0:u+=1
            uv.data[li].uv=(u*4.1,co.z*.55)
    return wood,contacts


def bark_material():
    mat=bpy.data.materials.new('M_Bark');mat.use_nodes=True
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;bsdf=nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value=.92
    bsdf.inputs['Base Color'].default_value=(.32,.28,.22,1)
    image=nodes.new('ShaderNodeTexImage');image.image=bpy.data.images.load(str(TEXTURES/'Bark004_1K-JPG_Color.jpg'));image.image.pack()
    links.new(image.outputs['Color'],bsdf.inputs['Base Color'])
    normal=nodes.new('ShaderNodeTexImage');normal.image=bpy.data.images.load(str(TEXTURES/'Bark004_1K-JPG_NormalGL.jpg'));normal.image.colorspace_settings.name='Non-Color';normal.image.pack()
    bump=nodes.new('ShaderNodeNormalMap');bump.inputs['Strength'].default_value=.7
    links.new(normal.outputs['Color'],bump.inputs['Color']);links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
    return mat


def foliage_material():
    mat=bpy.data.materials.new('M_Leaves');mat.use_nodes=True
    mat.diffuse_color=(.55,.72,.35,1)
    mat.use_backface_culling=False
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value=.82
    bsdf.inputs['Subsurface Weight'].default_value=.05
    image=mat.node_tree.nodes.new('ShaderNodeTexImage')
    image.image=bpy.data.images.load(str(TEXTURES/'oak.png'));image.image.pack()
    tint=mat.node_tree.nodes.new('ShaderNodeVertexColor');tint.layer_name='LeafTint'
    multiply=mat.node_tree.nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1
    mat.node_tree.links.new(image.outputs['Color'],multiply.inputs[1]);mat.node_tree.links.new(tint.outputs['Color'],multiply.inputs[2])
    mat.node_tree.links.new(multiply.outputs[0],bsdf.inputs['Base Color'])
    mat.node_tree.links.new(image.outputs['Alpha'],bsdf.inputs['Alpha'])
    return mat


def build_foliage():
    vertices=[];faces=[];uvs=[];normals=[];colors=[]
    count=10500
    # A single continuous volumetric envelope with lobed edges replaces isolated leaf spheres.
    for i in range(count):
        theta=rng.random()*math.tau
        radius=math.sqrt(rng.random())
        lobes=1+.034*math.sin(theta*5+.7)+.026*math.sin(theta*3-1.2)
        x=math.cos(theta)*radius*5.05*lobes
        y=math.sin(theta)*radius*4.72*lobes
        q=math.sqrt(max(0,1-radius*radius))
        lower=3.77+.65*q+.15*math.sin(theta*3)
        upper=4.70+2.93*q+.14*math.sin(theta*5+.5)
        # Bias toward the outer mantle while keeping a genuinely filled interior.
        t=rng.random()
        z=lower+(upper-lower)*(t**.70)
        # Deliberately preserve the complete foreground ribbon corridor.
        if x>.9 and x<3.2 and y<-.7 and y>-2.7 and z<4.45:
            z+=.4
        pivot=Vector((x,y,z))
        # Card direction follows an outward and slightly upward twig; diverse normals reveal detail.
        growth=Vector((math.cos(theta)*.55+rng.uniform(-.55,.55),math.sin(theta)*.55+rng.uniform(-.55,.55),rng.uniform(-.18,.95))).normalized()
        if rng.random()<.14:growth.z-=.65;growth.normalize()
        normal=Vector((rng.uniform(-.6,.6),rng.uniform(-.6,.6),rng.uniform(.30,1.0))).normalized()
        side=growth.cross(normal)
        if side.length<.05:side=growth.cross(Vector((1,0,0)))
        side.normalize();normal=side.cross(growth).normalized()
        length=rng.uniform(.44,.76);width=length*rng.uniform(.72,.95)
        # Four triangles make a gently curved sprig, with V=0 fixed and V=1 free.
        local=[(-.5,0),(.5,0),(-.5,.5),(.5,.5),(-.5,1),(.5,1)]
        start=len(vertices)
        tint=rng.uniform(.82,1.08)
        green=(.88*tint,.97*tint,.77*tint,1)
        for u,v in local:
            curve=math.sin(v*math.pi)*.065*length
            co=pivot+side*(u*width)+growth*(v*length)-normal*curve
            vertices.append(tuple(co));uvs.append((u+.5,v))
            outward=Vector((x*.055,y*.055,.9)).normalized()
            shading=(normal*.48+outward*.52).normalized()
            normals.append(tuple(shading));colors.append(green)
        faces.extend([(start,start+1,start+3,start+2),(start+2,start+3,start+5,start+4)])
    leaves=object_mesh('Leaves_ContinuousUmbrella',vertices,faces)
    uv=leaves.data.uv_layers.new(name='LeafUV')
    for loop in leaves.data.loops:uv.data[loop.index].uv=uvs[loop.vertex_index]
    col=leaves.data.color_attributes.new(name='LeafTint',type='FLOAT_COLOR',domain='POINT')
    col.data.foreach_set('color',np.asarray(colors,dtype=np.float32).ravel())
    leaves.data.color_attributes.active_color=col
    try:leaves.data.normals_split_custom_set_from_vertices(normals)
    except Exception as e:log('Custom foliage normals unavailable:',e)
    leaves.data.materials.append(foliage_material())
    return leaves


def export_asset(wood,leaves,contacts):
    root=bpy.data.objects.new('TreeRoot',None);bpy.context.collection.objects.link(root)
    root['authoring']='Blender 4.5.9 + MTree 5.6.0 ManifoldMesher; Blender organic remesh and authored buttresses'
    root['seed']=SEED
    root['authoringTool']='Blender 4.5.9 LTS'
    root['mtreeVersion']='5.6.0'
    root['leafCardCount']=10500
    root['rootContacts']=[[c['x'],c['y'],c['z']] for c in contacts]
    root['minimumClearance']=2.2
    root['foliageWind']='LeafUV V=0 twig base; V=1 sprig tip'
    wood.parent=root;leaves.parent=root
    wood['occluder']=True;leaves['foliage']=True
    anchor=bpy.data.objects.new('RibbonAnchor',None);bpy.context.collection.objects.link(anchor);anchor.parent=root
    # It is just below and camera-forward from the branch surface, so silk clears the wood.
    anchor.location=(2.15,-1.88,2.80)
    anchor['description']='Foreground ribbon tie; +Z after glTF is viewer-facing'
    # Blender +Y points back; align the anchor to export with Three.js +Y up, +Z forward.
    # Empty's local axes inherit glTF's standard global Y-up conversion.
    bpy.ops.object.select_all(action='DESELECT')
    for obj in (root,wood,leaves,anchor):obj.select_set(True)
    bpy.context.view_layer.objects.active=wood
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'love-tree-authoring.blend'))
    path=OUTPUT/'love-tree.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
        export_apply=True,export_yup=True,export_extras=True,export_materials='EXPORT',
        export_normals=True,export_texcoords=True,export_vertex_color='ACTIVE')
    # Make foliage alpha testing explicit independently of Blender's viewport blend settings.
    raw=path.read_bytes();json_len,json_type=struct.unpack_from('<II',raw,12)
    doc=json.loads(raw[20:20+json_len].decode('utf-8').rstrip(' \0'))
    for material in doc.get('materials',[]):
        if material.get('name')=='M_Leaves':
            material['alphaMode']='MASK';material['alphaCutoff']=.45;material['doubleSided']=True
    json_raw=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode('utf-8')
    json_raw+=b' '*((-len(json_raw))%4)
    rest=raw[20+json_len:]
    total=12+8+len(json_raw)+len(rest)
    path.write_bytes(struct.pack('<III',0x46546c67,2,total)+struct.pack('<II',len(json_raw),0x4e4f534a)+json_raw+rest)

    all_points=[obj.matrix_world@Vector(v) for obj in (wood,leaves) for v in obj.bound_box]
    mn=[min(p[a] for p in all_points) for a in range(3)]
    mx=[max(p[a] for p in all_points) for a in range(3)]
    metrics={'toolchain':{'blender':bpy.app.version_string,'mtree':'5.6.0'},'seed':SEED,
        'woodTopology':mesh_quality(wood),
        'triangles':{o.name:sum(len(p.vertices)-2 for p in o.data.polygons) for o in (wood,leaves)},
        'authoringBoundsBlenderZUp':{'min':mn,'max':mx},
        'ribbonAnchorThreeYUp':[anchor.location.x,anchor.location.z,-anchor.location.y],
        'rootContacts':[[c['x'],c['y'],c['z']] for c in contacts],
        'glbBytes':path.stat().st_size,'durationSeconds':round(time.time()-started,2)}
    (HERE/'asset-metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8')
    (OUTPUT/'love-tree.manifest.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8')
    log('ASSET_READY',json.dumps(metrics))


bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
wood,contacts=assemble_wood();wood.data.materials.append(bark_material())
leaves=build_foliage()
export_asset(wood,leaves,contacts)
