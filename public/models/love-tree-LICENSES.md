# Love Garden tree asset provenance

The tree geometry was authored for this project with Blender 4.5.9 LTS and
MTree 5.6.0's native ManifoldMesher, followed by Blender voxel fusion and smoothing
of the authored buttresses and foreground ribbon branch. The leaf mantle and UVs
are authored by the reproducible project script.

## Bark maps

`Bark004_1K-JPG_Color.jpg` and `Bark004_1K-JPG_NormalGL.jpg` originate from
[ambientCG Bark004](https://ambientcg.com/view?id=Bark004), licensed under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
The unchanged maps were obtained from the EZ-Tree demo's texture distribution.

## Oak foliage image

`oak.png` is bundled with [Daniel Greenheck's EZ-Tree](https://github.com/dgreenheck/ez-tree),
under the project's MIT license. The image is embedded unchanged in the GLB.

MIT License

Copyright (c) 2024 Daniel Greenheck

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Tooling

- [Blender 4.5.9](https://download.blender.org/release/Blender4.5/), official portable distribution.
- [MTree 5.6.0](https://github.com/GoodPie/modular_tree/releases/tag/5.6.0),
  plugin GPLv3 / native core MIT. Authoring tooling is not embedded in the GLB.

This GLB is the actual exported model. The `mother_tree_*.jpg` pictures elsewhere
in this project are AI concept references and were not used as rendered proof.
