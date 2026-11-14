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
| Furniture | `furniture/loungeSofa.glb` | Low caramel sofa against right wall (`x=+1.42, z=-0.02`), facing the room |
| Furniture | `furniture/pillow.glb` | Lounge sofa cushion |
| Furniture | `furniture/bear.glb` | Plush teddy seated on sofa |
| Furniture | `furniture/loungeChairRelax.glb` | Reading nook armchair (`x=-1.06, z=+0.60`) |
| Furniture | `furniture/tableCoffee.glb` | Center rug coffee table (`x=-0.18, z=-0.04`) |
| Furniture | `furniture/desk.glb` | Back writing desk (`x=+0.18, z=-1.14`) |
| Furniture | `furniture/rugRound.glb` | Living room woven round rug |
| Furniture | `furniture/lampRoundTable.glb` | Writing desk warm lamp |
| Furniture | `furniture/lampRoundFloor.glb` | Reading corner standing floor lamp |
| Furniture | `furniture/pottedPlant.glb` | Small moss-green fern beside right wall (`x=+1.78, z=+0.90`, scale 1.15) |
| Furniture | `furniture/plantSmall1.glb` | Hearth mantel & bookcase shelf accent |
| Food | `food/cup-tea.glb` | Coffee table ceramic teacup |
| Food | `food/mug.glb` | Writing desk mug |
| Holiday | `holiday/wreath.glb` | Chimney breast evergreen wreath |
| Survival | `survival/resource-wood.glb` | Stacked split firewood inside stone hearth |

All custom cabin interior architecture (oak floorboards, back timber walls, door interior trim, exposed ceiling rafters, raised stone hearth & chimney breast, central pendant shade, embers) is original project geometry authored directly in Blender and merged with the Kenney CC0 assets into two vertex-colored meshes (`cabin-interior-furniture` and `cabin-interior-glow`).
