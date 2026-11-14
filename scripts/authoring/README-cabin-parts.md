# Cabin artisan parts and glass

Build with the installed Blender 4.5.9 executable:

```powershell
& './work/model-authoring/tools/blender/blender-4.5.9-windows-x64/blender.exe' --background --python './scripts/authoring/create_cabin_parts.py'
```

The requested work copy at `work/model-authoring/create_cabin_parts.py` is identical. The canonical script is kept here because `work/` is ignored by Git. Both locations resolve the project root independently of the shell's working directory.

Output: `public/models/cabin-parts.glb`, with a JSON manifest beside it. All assets and roughness textures are generated in Blender from scratch. No add-ons or external textures are required.

| Component | Triangles |
|---|---:|
| door-hardware | 432 |
| window-hardware, four sets | 2,080 |
| chimney-cap-detail | 1,004 |
| porch-hanging-lamp, glass and wick | 552 |
| Total | 4,068 |

Geometry is authored in cabin-local metres. Three.js (x,y,z) maps to Blender (x,-z,y), then glTF exports Y-up. Mesh transforms are baked before parenting. `porch-lamp-wick` is an Empty locating the small runtime point light. Metallic materials have Principled metallic=.82 and an embedded linear roughness texture ranging from .35 to .55.

`makeCabin().loadParts()` fetches and parses the optional GLB, caches its Promise, registers real meshes in `walls`, swaps the GLB glass/wick to the cabin's live materials and hides the corresponding procedural fallback widgets. Failed loads preserve the procedural cabin. Engine initialization awaits optional parts before the final occlusion registry, obstacle boxes and initial shader compilation.

Main windows use 16 disconnected physical panes (four per window) plus thin edge strips, merged by material for batching. Door transom, lanterns and candle cup use the separate frosted material. Shared vertex-tinted procedural materials receive neutral white vertex tints on imported meshes. Both glass materials have transmission=0 and reuse the existing PMREM; no additional transmission or environment-capture pass is introduced.

Three.js reflectivity is an accessor alias for IOR, not a separate degree of freedom. reflectivity=.96 implies IOR≈2.247. This implementation preserves realistic glass IOR=1.52, whose accessor reflectivity≈.516. Clearcoat=1 and environment gain provide the stronger reflection requested. The requested envMapIntensity 5.5→3.2 multiplies scene.environmentIntensity (.14→.042); a small shader uniform preserves both the per-material gain and the garden's day/night exposure, avoiding a bright daytime reflection painted across night windows.

Verification: `node scripts/review-cabin.mjs`. This checks the fixed structural baseline, all material parameters, real GLB attachment coordinates, triangle budget, registration/idempotence, malformed-asset fallback and 12 day/sunset/night architectural screenshots.
