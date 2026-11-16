# Cabin Interior 3D Assets Provenance (`cabin-interior.glb`)

All external 3D furniture and prop models baked into `public/models/cabin-interior.glb` are sourced from verified **CC0 1.0 Universal (Public Domain)** upstream packages with zero attribution requirement (documented here for full project traceability):

- **Source Repository**: [`shorepine/kenney`](https://github.com/shorepine/kenney) (Mirror of Kenney's official CC0 3D asset packs)
- **License**: `CC0 1.0 Universal (Public Domain Dedication)` (`work/references/kenney/LICENSE.txt`)
- **Authoring Script**: [`scripts/authoring/create_cabin_interior.py`](../../scripts/authoring/create_cabin_interior.py)

## Bundled CC0 Models (`3d/` subset)

| Category | Asset File | Interior Placement |
| :--- | :--- | :--- |
| Furniture | `furniture/bookcaseOpen.glb` | Back-right study corner (`x=+1.44, z=-1.24`) |
| Furniture | `furniture/books.glb` | Coffee table, desk, bookcase shelves |
| Furniture | `furniture/loungeSofa.glb` | Forest-green sofa with walnut frame against right wall (`x=+1.42, z=-0.02`) |
| Original | Soft lavender back cushion | Smooth original cushion supporting the piglet on the green sofa; replaces the imported pillow. |
| Original | Sleeping pink piglet | Lifted pear body, compact attached crown ears, 22mm button snout, shallow peach nostrils, curved smiling eyelids, pale hugging paws and fine lavender silk bow. Authored at 20×12; face curves and colour gradients are protected during optimization. |
| Furniture | `furniture/loungeChairRelax.glb` | Reading nook armchair (`x=-1.06, z=+0.60`) |
| Furniture | `furniture/pillowLong.glb` | Green bolster on the lavender reading chair |
| Furniture | `furniture/tableCoffee.glb` | Center rug coffee table (`x=-0.18, z=-0.04`) |
| Furniture | `furniture/desk.glb` | Back writing desk (`x=+0.18, z=-1.14`) |
| Furniture | `furniture/rugRound.glb` | Living room woven round rug |
| Furniture | `furniture/lampRoundTable.glb` | Writing desk warm lamp |
| Furniture | `furniture/lampRoundFloor.glb` | Reading corner standing floor lamp |
| Furniture | `furniture/pottedPlant.glb` | Three moss-green plants beside the right wall, inner window and study corner |
| Furniture | `furniture/plantSmall1.glb` | Hearth mantel accent |
| Furniture | `furniture/plantSmall2.glb`, `furniture/plantSmall3.glb` | Succulents among green/lavender book spines |
| Furniture | `furniture/radio.glb` | Walnut and brass vintage radio on the middle bookcase shelf |
| Furniture | `furniture/lampWall.glb` | Paired brass wall lamps above the desk; baked illumination, no additional real-time lights |
| Food | `food/cup-tea.glb` | Coffee table ceramic teacup |
| Food | `food/cup-saucer.glb` | Teacup saucer and cookie plate |
| Food | `food/cookie.glb` | Three butter cookies beside the original open purple book |
| Food | `food/mug.glb` | Writing desk mug |
| Holiday | `holiday/wreath.glb` | Chimney breast evergreen wreath |
| Survival | `survival/resource-wood.glb` | Stacked split firewood inside stone hearth |

All custom cabin interior architecture (oak floorboards, back timber walls, door interior trim, exposed ceiling rafters, raised stone hearth & chimney breast, central pendant shade, embers) is original project geometry authored directly in Blender and merged with the Kenney CC0 assets into two vertex-colored meshes (`cabin-interior-furniture` and `cabin-interior-glow`).

Static fire cones are removed from the GLB. Three original shader flame layers and fifteen ember particles are generated at runtime by `src/natural/cabin.js`, aligned to the existing recessed firebox. The gilt couple portrait, open foil-edged journal and quill are original merged geometry. No external textures or additional real-time lights are used.

Exterior ivory-painted grain, linen curtains, green/lavender wool plaid, rocker, tea service, cookies, floristry and ivy are original procedural assets in `src/natural/cabin-artistry.js` and `src/natural/cabin.js`. Their textile maps are generated locally on Canvas; the extended brass sign curls and blown hurricane glass are authored in `scripts/authoring/create_cabin_parts.py`.
