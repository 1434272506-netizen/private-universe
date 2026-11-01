# 天空与云层来源

2026-11-01。世界设定为明亮春日下午的云中浮岛。

## 实际复用：Three.js Sky

- 来源：https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Sky.js
- 实际运行版本：项目已有的 three 0.186.1，非随 GitHub dev 分支变化的在线代码。
- 使用天空散射、太阳圆盘、光晕和高空程序云；为浮岛另行调整下半球空气颜色，保持与主光方向一致。
- 原许可 MIT，Copyright © 2010–2026 three.js authors；完整许可保留在依赖的 LICENSE。

## 体积云参考研究

- https://github.com/leoawen/volumetric-clouds
- 阅读其 index.html 的有界体积、密度遮罩、步进积分、光吸收与相位函数设计。
- 本项目 `clouds.js` 是针对小型浮岛独立编写的简化实现，未将参考项目整页或其纹理、HDR、界面与后期管线移植进来。采用本地生成的 32³ 噪声、40 步视线积分与 4 步阳光吸收估计，无外部资源请求。
- 参考代码许可如下，记录来源并保留原版权说明。

MIT License

Copyright (c) 2025 Leonardo Soares Gonçalves

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

## 瀑布局部虹弧

`rainbow.js` 为本项目编写的透明着色效果，固定在实际瀑布出口附近，随视角轻微变化。它是艺术化水雾虹弧，不宣称是严格的水滴光学模拟。
