"""Blender 4.5 headless original cabin accessories; authored in Three.js metres.
Canonical copy: scripts/authoring/create_cabin_parts.py. Work copy is runnable verbatim.
Blender Z-up (x,-z,y) exports to Three Y-up (x,y,z). No third-party assets.
"""
import bpy, math, json, random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/models/cabin-parts.glb'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
collection=bpy.data.collections.new('CabinArtisanParts');bpy.context.scene.collection.children.link(collection)
rng=random.Random(923)
def P(x,y,z):return (x,-z,y)
def own(o,mat):
 for c in list(o.users_collection):c.objects.unlink(o)
 collection.objects.link(o);o.data.materials.append(mat);return o

def metal(name,color,metallic=.82):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metallic
 image=bpy.data.images.new(name+'-wear-roughness',64,64);pixels=[]
 for y in range(64):
  for x in range(64):
   r=.35+.2*(.5+.5*math.sin(x*.32+y*.19)*math.cos(y*.24))*.7+.06*rng.random();pixels.extend((r,r,r,1))
 image.pixels=pixels;image.colorspace_settings.name='Non-Color';image.pack();tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;m.node_tree.links.new(tex.outputs['Color'],p.inputs['Roughness']);return m
brass=metal('Cabin_Aged_Bronze',(.35,.235,.105));iron=metal('Cabin_Worn_Iron',(.055,.065,.054))
def simple(name,color,rough=.4,metalness=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metalness;return m
frost=simple('Cabin_Lamp_Glass',(.77,.85,.83),.24);p=frost.node_tree.nodes.get('Principled BSDF');p.inputs['Alpha'].default_value=.32;p.inputs['IOR'].default_value=1.5;p.inputs['Coat Weight'].default_value=.75;frost.surface_render_method='DITHERED'
wick=simple('Cabin_Wick_Emission',(.9,.54,.16));p=wick.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(1,.38,.07,1);p.inputs['Emission Strength'].default_value=1.2

def cube(x,y,z,w,h,d,mat=iron,bevel=0,yaw=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=P(x,y,z));o=own(bpy.context.object,mat);o.scale=(w,d,h);o.rotation_euler.z=yaw
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('Forged rounded edges','BEVEL');mod.width=bevel;mod.segments=1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o

def cylinder(x,y,z,r,h,mat=brass,axis='y',vertices=8):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=h,location=P(x,y,z));o=own(bpy.context.object,mat)
 if axis=='z':o.rotation_euler.x=math.pi/2
 if axis=='x':o.rotation_euler.y=math.pi/2
 return o

def rivet(x,y,z,mat=brass,r=.004):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=r,location=P(x,y,z));o=own(bpy.context.object,mat)
 for f in o.data.polygons:f.use_smooth=True
 return o

def torus(x,y,z,r,t,mat=brass,segments=20,minor=4,front=True):
 bpy.ops.mesh.primitive_torus_add(major_segments=segments,minor_segments=minor,major_radius=r,minor_radius=t,location=P(x,y,z));o=own(bpy.context.object,mat)
 if front:o.rotation_euler.x=math.pi/2
 for f in o.data.polygons:f.use_smooth=True
 return o

def beam(a,b,r=.004,mat=iron):
 av,bv=Vector(P(*a)),Vector(P(*b));d=bv-av
 bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=r,depth=d.length,location=(av+bv)/2);o=own(bpy.context.object,mat);o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o

def join(objects,name):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 return o

# Door ring, rounded strike plate and four small fasteners, directly against the door.
a=[cube(.29,1.21,2.038,.085,.15,.014,iron,.006),cylinder(.29,1.245,2.052,.017,.017,brass,'z'),torus(.29,1.20,2.078,.045,.0065,brass,24,5)]
for x in [.26,.32]:
 for y in [1.15,1.27]:a.append(rivet(x,y,2.050,r=.0045))
a.extend([cube(.29,1.175,2.048,.006,.019,.004,iron),cylinder(.29,1.188,2.05,.008,.004,iron,'z')]);door=join(a,'door-hardware')

# Four real sets of window fittings batched into one mesh to minimize draw calls.
window_parts=[]
for index,(x,z,yaw) in enumerate([(-1.36,1.89,0),(1.36,1.89,0),(-2.27,.1,-math.pi/2),(2.27,.1,math.pi/2)]):
 def W(u,v,d):return (x+u*math.cos(yaw)+d*math.sin(yaw),1.52+v,z-u*math.sin(yaw)+d*math.cos(yaw))
 for v in [-.28,.28]:
  for u in [-.555,-.515]:window_parts.append(cube(*W(u,v,.119),.036,.065,.008,iron,.003,yaw))
  window_parts.append(cylinder(*W(-.535,v,.135),.009,.079,brass))
  for u in [-.562,-.508]:
   for dy in [-.021,.021]:window_parts.append(rivet(*W(u,v+dy,.126),r=.0035))
 window_parts.extend([cube(*W(0,-.035,.138),.042,.08,.008,iron,.003,yaw),cube(*W(.025,-.035,.15),.105,.014,.012,brass,.003,yaw)])
 for dy in [-.024,.024]:window_parts.append(rivet(*W(0,-.035+dy,.145),r=.0035))
windows_mesh=join(window_parts,'window-hardware')
windows_mesh['window_count']=4

# Chimney's little draught cone sits on the existing stone cover, with a bird guard below.
a=[]
bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=.23,radius2=.018,depth=.17,location=P(-1.55,4.843,-.9));a.append(own(bpy.context.object,brass));a.append(torus(-1.55,4.761,-.9,.23,.008,iron,20,4,False))
for side in [-1,1]:
 for axis in ['x','z']:
  for i in range(5):
   u=(i-2)*.105
   a.append(cube(-1.55+(side*.317 if axis=='x' else u),4.53,-.9+(u if axis=='x' else side*.317),.003 if axis=='x' else .006,.17,.006 if axis=='x' else .003,iron))
  for y in [4.465,4.53,4.595]:a.append(cube(-1.55+(side*.317 if axis=='x' else 0),y,-.9+(0 if axis=='x' else side*.317),.003 if axis=='x' else .52,.003,.52 if axis=='x' else .003,iron))
  points=[]
  for i in range(6):
   u=-.25+i*.1;y=4.46+.14*math.sin(math.pi*i/5);points.append((-1.55+(side*.324 if axis=='x' else u),y,-.9+(u if axis=='x' else side*.324)))
  for p,q in zip(points,points[1:]):a.append(beam(p,q,.005))
chimney=join(a,'chimney-cap-detail')

# Copper kerosene lantern replaces the hanging procedural lantern, at the same support hook.
x,z=-.88,2.47
a=[cylinder(x,1.81,z,.104,.055,iron,vertices=12),cylinder(x,1.85,z,.079,.055,brass,vertices=12),cylinder(x,2.09,z,.105,.025,brass,vertices=12),torus(x,2.205,z,.057,.006,brass,20,4)]
bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.13,radius2=.055,depth=.057,location=P(x,2.13,z));a.append(own(bpy.context.object,iron))
for dx in [-.081,.081]:
 for dz in [-.065,.065]:a.append(cylinder(x+dx,1.972,z+dz,.005,.235,brass,vertices=6))
a.extend([beam((x-.09,2.09,z),(x-.045,2.19,z),.005),beam((x+.09,2.09,z),(x+.045,2.19,z),.005),cylinder(x,1.93,z,.026,.028,brass,vertices=8)])
lamp=join(a,'porch-hanging-lamp')
glass=[]
for dz in [-.066,.066]:glass.append(cube(x,1.972,z+dz,.146,.21,.003,frost))
for dx in [-.077,.077]:glass.append(cube(x+dx,1.972,z,.003,.21,.129,frost))
o=join(glass,'porch-hanging-lamp-glass');o.parent=lamp
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.013,location=P(x,1.952,z));o=own(bpy.context.object,wick);o.scale=(.55,.55,1.65);o.name='porch-lamp-wick-mesh';o.parent=lamp
marker=bpy.data.objects.new('porch-lamp-wick',None);collection.objects.link(marker);marker.location=P(x,1.952,z);marker.parent=lamp;marker['purpose']='warm light attachment'

# Triangulate before counting/export; budget measures triangles, stricter than polygon count.
counts={}
for o in list(collection.objects):
 if o.type!='MESH':continue
 bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Export triangle budget','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=mod.name)
 counts[o.name]=len(o.data.polygons)
assert sum(counts.values())<=5000,counts
OUT.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for o in collection.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False,export_extras=True,export_lights=False)
manifest={'blender':bpy.app.version_string,'triangles':counts,'totalTriangles':sum(counts.values()),'units':'metres, Three.js Y-up','bytes':OUT.stat().st_size,'groups':['door-hardware','window-hardware','chimney-cap-detail','porch-hanging-lamp'],'windowSets':4,'wickMarker':'porch-lamp-wick','authoringScript':'scripts/authoring/create_cabin_parts.py'}
OUT.with_suffix('.manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');print('CABIN_PARTS_READY',json.dumps(manifest))
