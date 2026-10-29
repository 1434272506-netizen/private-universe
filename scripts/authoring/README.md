# 母树资产制作

运行网站只需要 `public/models/love-tree.glb`，无需安装 Blender。

本轮真实制作环境是官方便携 Blender 4.5.9 LTS 和 MTree 5.6.0 Windows 原生核心。MTree 生成枝干，Blender 修补开放边界并融合定制板根和挂带枝；叶幕由固定随机种子的连续包络生成。纹理来源与许可见 `public/models/love-tree-LICENSES.md`，原始纹理同时保存在本目录 `textures/`。

制作工具放在未跟踪的 `work/model-authoring/tools/`：

- `blender/blender-4.5.9-windows-x64/blender.exe`
- `mtree-python/m_tree/`：从 MTree Windows 发布包中的 CPython 3.11 wheel 解出的核心。

如需在新机器重建，使用 [Blender 官方 4.5 下载目录](https://download.blender.org/release/Blender4.5/) 和 [MTree 5.6.0 官方发布](https://github.com/GoodPie/modular_tree/releases/tag/5.6.0) 准备上述工具。Blender Windows ZIP 的官方 SHA-256 为 `41da973b9bf95bb312cbeff4d1982feb13259b43c821686b9bafea4dfe5477cf`，本轮下载已核对。

在项目根目录执行：

```powershell
node scripts/authoring/sample-root-contacts.mjs
& .\work\model-authoring\tools\blender\blender-4.5.9-windows-x64\blender.exe --background --python .\scripts\authoring\create-love-tree.py
```

输出为实际 GLB、`public/models/love-tree.manifest.json`、`work/model-authoring/love-tree-authoring.blend`。Blend 已打包使用的纹理，可直接打开编辑。根端采样读取项目真实 `ground()` 函数；地形改变后应重新采样和制作。

脚本在融合后验证木质体必须连通且没有开放边，避免未封口枝干被体素操作切碎。叶片 UV 的 V=0 为固定端，V=1 为摆动端。`RibbonAnchor` 随 GLB 导出，丝带由前端挂在该节点下。

本轮以固定输入重建的 GLB 与已验收文件逐字节相同。概念 JPG 仅供设计参考，浏览器实机截图和实际 GLB 才用于本轮验收。
