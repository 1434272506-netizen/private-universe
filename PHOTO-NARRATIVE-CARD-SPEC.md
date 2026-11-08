# 💌 私人爱情宇宙：十张照片心流叙事与 3D 拍立得翻转背面小注设计规约
## (PHOTO-NARRATIVE-CARD-SPEC.md)

> **设计架构师**：Antigravity  
> **代码执行方**：Codex / GPT  
> **制定时间**：2026-11-02  
> **规约定位**：核心叙事体验升级。在现有白丝带相册（`src/stories.js`、`src/stories.css`）基础上，将单向平面图片阅读升级为**「3D 拍立得卡片翻转 (3D Polaroid Flip Card)」**与**「十幕心流叙事弧线」**，赋予照片物理触感与私人日记的沉浸质感，同时严格保持与现有 IndexedDB 本机存储、内容编辑器以及自动化回归测试（16 / 16 Suites）的 100% 兼容。

---

## 🌸 一、十张真实照片心流叙事弧线 (The 10-Chapter Emotional Arc)

基于对用户提供的 10 张真实珍藏原图（`photo-01-original.jpg` 至 `photo-10-original.jpg`）的深度意象梳理，将原本零散的照片编排为一条递进式的心流时间线：

| 章节 | 照片文件 | 画面真实场景 | 叙事主题 | 预置建议手写小注 (Back Note Whisper) |
| :---: | :--- | :--- | :---: | :--- |
| **01** | `photo-01-original.jpg` | 夜幕华灯栈桥合影 | **夜幕初见·心动回响** | “那晚桥上的风很大，身后的霓虹很亮，但我的视线里只有你的眼睛。从那一刻起，我知道我的世界多了一束光。” |
| **02** | `photo-02-original.jpg` | 户外头盔与草帽吐舌搞怪 | **并肩同行·风里冒险** | “戴上笨笨的安全头盔，在风里一起做鬼脸。只要和你在一起，连迷路都变成了一场最快乐的奇遇。” |
| **03** | `photo-03-original.jpg` | 午后车座闭眼比耶暖光 | **午后微光·温柔同频** | “车窗外飞驰而过的树影，车厢里轻柔的呼吸。闭上眼睛，听见两颗心跳在同一个节奏里。” |
| **04** | `photo-04-original.jpg` | 室内毫无包袱的瞪眼自拍 | **卸下防备·自在天真** | “不用在乎表情管不管理，不用在乎镜头的角度。能毫无保留地在一个人面前做个傻瓜，是世界上最幸运的事。” |
| **05** | `photo-05-original.jpg` | 小狗蛋糕与蝴蝶蜡烛许愿 | **烛光心愿·年年有你** | “小狗蛋糕上的蜡烛在轻轻跳动。你闭上眼睛许愿的时候，我在心底偷偷祈祷：每一个以后的生日，我都想陪你一起吹灭蜡烛。” |
| **06** | `photo-06-original.jpg` | 落日余晖下依靠肩头 | **日落黄昏·笃定相依** | “太阳落下去的时候，天空被染成了温柔的蜜桃金。你把头靠在我肩上，那一秒，我真希望时间就此静止。” |
| **07** | `photo-07-original.jpg` | 冬夜毛绒大衣与脸颊浅吻 | **凛冬清晨·抵御严寒** | “冬夜的空气很冷，但毛绒大衣里的心跳滚烫。脸颊上轻轻落下的一吻，足以抵挡世间所有的风霜。” |
| **08** | `photo-08-original.jpg` | 古典红栏楼阁旗袍回眸 | **惊艳时光·为你着迷** | “朱红色的回廊，雕梁画栋的古亭。世间风景万千，可你在我镜头里轻轻一侧身，就美成了我心底一辈子的惊艳。” |
| **09** | `photo-09-original.jpg` | 双手托腮搞怪身后守护 | **默契同频·身后有我** | “你捧着脸对着镜头古灵精怪，我在你身后悄悄探出脑袋。别害怕前方的路，你一回头，我永远都在。” |
| **10** | `photo-10-original.jpg` | 车内摸头宠溺生动日常 | **浮岛永恒·私家宇宙** | “揉乱你头发时的笑闹，车座上并肩的琐碎日常。我们的爱情不是轰轰烈烈的口号，而是把每一个平凡的日子，都过成闪闪发光的私家宇宙。” |

> [!NOTE]
> **说明与约束**：
> - `src/personal-content.js` 中的 `providedPhotoImport.photos` 必须保留现有的空白 `caption: ""` 与 `date: ""` 初始状态，以确保 `npm run check:content` 和 `scripts/review-original-photos.mjs` 中的 SHA-256 与初始空白字段测试绝对绿灯；
> - 上述 10 幕叙事文案作为**「背面小注推荐灵感 (Story Inspirations)」**，当用户未在编辑器中输入个人笔记时，背面呈现轻量诗意引导；用户在页面点击编辑并保存后，将优先显示用户亲笔写就的个性化文字。

---

## 🎨 二、3D 拍立得物理结构与视觉美学 (Polaroid 3D Flip Mechanics)

### 1. 物理层级与 DOM 架构 (`src/stories.js`)

在保持现有 `.album-page`、`.story-photograph` 与 `.album-caption` 选择器不破损的前提下，将展示核心重构为具有真实厚度与空间透视的 3D 卡片：

```html
<figure class="memory-reader album-page" data-index="0" data-current="true">
  <!-- 3D 空间透视视口 -->
  <div class="photo-card-viewport" aria-label="3D 照片卡片">
    <!-- 3D 旋转物理卡片实体 -->
    <div class="photo-card-flipper" role="region" aria-label="可翻转照片与背面小注">
      
      <!-- 正面：纯白相框高保真原图 -->
      <div class="photo-card-face photo-card-front">
        <div class="story-photograph">
          <img src="/memories/photo-01-original.jpg" alt="照片 1" />
        </div>
        <!-- 正面底部轻量触感提示 -->
        <div class="photo-front-bar">
          <span class="photo-card-tag">✦ 珍藏定格 ✦</span>
          <button type="button" class="photo-flip-trigger" aria-label="翻转查看背面手写小注">
            <span class="flip-icon" aria-hidden="true">↺</span> 翻转看背面
          </button>
        </div>
      </div>

      <!-- 背面：棉浆纸质手写信笺与邮戳 -->
      <div class="photo-card-face photo-card-back" aria-hidden="true">
        <div class="photo-back-surface">
          <!-- 顶部邮戳与记忆标签 -->
          <div class="photo-back-header">
            <div class="photo-postmark" aria-hidden="true">
              <span class="postmark-ring">MEMORIES</span>
              <span class="postmark-date">2026.11</span>
            </div>
            <div class="photo-back-seal">💌</div>
          </div>
          
          <!-- 手写小注核心文字区域 -->
          <div class="photo-back-content">
            <h4 class="photo-back-title">夜幕初见·心动回响</h4>
            <p class="photo-back-text">“那晚桥上的风很大，身后的霓虹很亮，但我的视线里只有你的眼睛…”</p>
            <time class="story-date">2026-10-29</time>
          </div>

          <!-- 背面操作栏 -->
          <div class="photo-back-actions">
            <button type="button" class="photo-flip-back-trigger" aria-label="翻回正面照片">
              <span class="flip-icon" aria-hidden="true">↻</span> 翻回正面
            </button>
            <button type="button" class="photo-edit-note-trigger" aria-label="编辑这张照片的小注">
              ✎ 补写小注
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- 保留原生 figcaption 用于可访问性与测试套件断言 -->
  <figcaption class="album-caption" tabindex="0">
    <span>夜幕初见·心动回响</span>
    <time class="story-date">2026-10-29</time>
  </figcaption>
</figure>
```

---

### 2. 核心 CSS 3D 变换与纸质纹理 (`src/stories.css`)

```css
/* 3D 卡片视口与透视深度 */
.photo-card-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  perspective: 1400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 3D 旋转物理卡片实体 */
.photo-card-flipper {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.65s cubic-bezier(0.25, 1, 0.35, 1);
  will-change: transform;
}

/* 翻转激活态 */
.photo-card-flipper.is-flipped {
  transform: rotateY(180deg);
}

/* 正反面基础卡片样式 */
.photo-card-face {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 6px;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  overflow: hidden;
  box-shadow: 
    0 4px 14px rgba(45, 52, 40, 0.08),
    0 16px 36px rgba(35, 42, 30, 0.12),
    inset 0 0 0 1px rgba(255, 255, 255, 0.6);
}

/* 正面：纯白相纸质感 */
.photo-card-front {
  background: #fdfcf7;
  display: flex;
  flex-direction: column;
  padding: 12px 12px 10px;
}

.photo-card-front .story-photograph {
  flex: 1 1 0;
  min-height: 0;
  background: #222520;
  border-radius: 4px;
}

.photo-front-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px 2px;
  font-size: 11px;
}

/* 背面：复古棉浆信笺纹理 */
.photo-card-back {
  background: #faf6ea;
  background-image: 
    radial-gradient(ellipse at 85% 15%, rgba(255, 255, 255, 0.6), transparent 50%),
    repeating-linear-gradient(0deg, rgba(165, 155, 125, 0.04) 0px, transparent 1px, transparent 24px);
  transform: rotateY(180deg);
  display: flex;
  flex-direction: column;
  padding: 24px 28px 20px;
  border: 1px solid rgba(188, 180, 155, 0.4);
}

/* 背面邮戳与手写文字排版 */
.photo-back-surface {
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: space-between;
}

.photo-back-title {
  font: 500 18px/1.6 var(--chinese);
  color: #3f392f;
  margin: 0 0 14px;
  letter-spacing: 0.06em;
}

.photo-back-text {
  font: 400 15px/2.2 var(--chinese);
  color: #554e42;
  letter-spacing: 0.03em;
  white-space: pre-wrap;
  flex: 1;
  overflow-y: auto;
  text-align: justify;
}

/* 翻转按钮轻量呼吸触感 */
.photo-flip-trigger,
.photo-flip-back-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid rgba(180, 170, 140, 0.4);
  background: rgba(255, 255, 255, 0.65);
  font: 11px/1.5 var(--chinese);
  color: #6a6456;
  cursor: pointer;
  transition: all 0.2s ease;
}

.photo-flip-trigger:hover,
.photo-flip-back-trigger:hover {
  background: #ffffff;
  color: #2b2721;
  border-color: #8c7d66;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

/* 减弱动态模式（prefers-reduced-motion）优雅降级：去除 3D 旋转，改为平滑淡入淡出 */
@media (prefers-reduced-motion: reduce) {
  .photo-card-flipper {
    transition: none;
    transform: none !important;
  }
  .photo-card-flipper.is-flipped .photo-card-front {
    display: none;
  }
  .photo-card-flipper.is-flipped .photo-card-back {
    position: relative;
    transform: none;
    display: flex;
  }
}
```

---

## ⚡ 三、交互状态机与无障碍协同 (State Machine & Accessibility)

### 1. 翻页与翻转状态自动复位
- **翻页重置**：当用户点击「下一页」或「上一页」切换照片时，若当前卡片处于背面翻转态（`.is-flipped`），**必须自动复位为正面**，确保观众浏览每张照片时首先感受到视觉原图的震撼，再由其主动翻开背面揭晓文字彩蛋；
- **双向翻转触发**：
  - 点击底部的「翻转看背面 ↺」/「翻回正面 ↻」明确按钮；
  - 双击或轻触照片卡片本身；
  - 键盘快捷键：当焦点位于照片卡片时，按下 `Space`（空格键）或 `F` 键可直接切换正反翻转。
- **无障碍状态同步**：
  - 卡片翻转时，同步更新 `photo-card-flipper` 的 `aria-expanded` 与正反面的 `aria-hidden`；
  - 向屏幕阅读器通过 `aria-live` 播报：“已翻转至第 X 张照片背面小注”与“已翻回照片正面”。

---

## 🛡️ 四、兼容性守护与自动化回归基准

为了守护工程质量，必须严格保证以下既有规范不受影响：

1. **原图字节零侵入**：
   - 绝不改动 `public/memories/photo-01-original.jpg` 至 `photo-10-original.jpg` 的原文件字节；
   - `src/personal-content.js` 必须维持原始 SHA-256 和字节数。
2. **测试套件 100% 绿灯**：
   - `npm run check:content`
   - `node scripts/review-original-photos.mjs`
   - `node scripts/review-photo-paging.mjs`
   - `npm test`（全项目 16 组回归测试必须全绿，无任何降级）。
3. **编辑器与离线备份**：
   - 用户在「＋ 收藏一段」中对照片修改 caption/date，保存至 IndexedDB 后，翻转背面能实时同步显示最新的个性化笔记。

---

## 🚀 五、交付与执行分工

- **Antigravity (设计架构师)**：已制定本设计规约并冻结架构；
- **Codex / GPT (代码执行方)**：
  1. 依据本规约实现 `src/stories.js` 与 `src/stories.css` 中的 3D 拍立得翻转 DOM 与样式；
  2. 注入规约中的 10 幕心流叙事与背面小注文案，支持邮戳排版与翻转微交互；
  3. 运行全链路测试 `npm test`，确保 16 组回归测试 100% 通过；
  4. 生成卡片正面与翻转背面的 QA 截图供架构师验收。
