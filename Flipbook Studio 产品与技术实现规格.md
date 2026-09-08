# Flipbook Studio 产品与技术实现规格

> Version: 1.0  
> Product Type: Digital Photo Book / Scrapbook Editor  
> Reference Experience: FLIPIN 类数字画册产品  
> Target: Web + Desktop  
> Primary Goal: 用户可以快速上传照片，自动生成一本数字画册，并通过可视化编辑器继续调整，最终翻页预览、导出和分享。

---

# 1. 产品定义

Flipbook Studio 是一个 Local-first 的数字画册制作工具。

用户无需专业设计能力，只需要：

1. 创建画册
2. 选择视觉风格
3. 上传照片
4. 系统自动排版
5. 调整页面
6. 添加文字 / 贴纸 / 背景
7. 翻页预览
8. 导出 JPG / PDF
9. 后续支持 MP4 / 在线分享

核心体验不是“从空白 Canvas 开始设计”，而是：

> 系统先自动生成一个足够好看的结果，用户再进行修改。

---

# 2. 产品原则

整个产品设计遵循以下原则。

## 2.1 自动生成优先

用户上传照片后立即得到一本基本完成的画册。

不要要求用户：

- 手动创建每一页
- 手动添加所有照片
- 手动选择每页布局

系统首先提供结果，然后允许修改。

---

## 2.2 渐进式复杂度

普通用户首先看到：

- 替换图片
- 添加文字
- 更换布局
- 更换背景
- 添加贴纸

高级能力隐藏在二级操作中：

- 图层
- Crop
- Rotation
- Z-index
- 对齐
- 抠图
- 精确尺寸
- 页面参数

避免初次进入编辑器时工具过多。

---

## 2.3 Local-first

第一版本：

- 不要求注册
- 不要求登录
- 用户照片默认不上传服务器
- 数据保存在 IndexedDB
- 自动保存

后续再增加：

- Account
- Cloud Sync
- Share Link
- Collaboration

---

## 2.4 编辑与阅读分离

编辑模式：

```text
Konva Canvas
```

负责：

- 拖拽
- 缩放
- Crop
- Rotate
- 排版

阅读模式：

```text
StPageFlip / react-pageflip
```

负责：

- 翻书
- Page turn animation
- Cover
- Spread

不要让同一套 DOM 同时承担编辑和翻页。

---

# 3. 用户核心流程

```text
启动应用
   ↓
我的书架
   ↓
新建画册
   ↓
选择画册风格
   ↓
上传照片
   ↓
自动分析照片
   ↓
自动生成画册
   ↓
进入编辑器
   ↓
修改页面
   ↓
自动保存
   ↓
预览画册
   ↓
导出 / 分享
```

---

# 4. 信息架构

```text
/
├── Bookshelf
│
├── Create
│   ├── Theme
│   ├── Upload
│   └── Generating
│
├── Editor
│   ├── Cover
│   ├── Pages
│   ├── Assets
│   ├── Layout
│   ├── Text
│   ├── Stickers
│   └── Background
│
├── Preview
│
└── Export
```

推荐路由：

```text
/
 /create
 /editor/:bookId
 /preview/:bookId
 /share/:shareId
```

---

# 5. 页面一：我的书架 Bookshelf

## 5.1 页面目标

用户打开软件后的主入口。

用户可以：

- 查看所有本地画册
- 创建画册
- 打开画册
- 重命名
- 删除
- 复制
- 导出
- 查看最后编辑时间

---

## 5.2 UI

```text
┌──────────────────────────────────────────────────────┐
│ Flipbook Studio                         Settings ⚙   │
├──────────────────────────────────────────────────────┤
│                                                      │
│ 我的画册                              + 新建画册     │
│                                                      │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐           │
│ │           │ │           │ │           │           │
│ │   Cover   │ │   Cover   │ │   Cover   │           │
│ │           │ │           │ │           │           │
│ └───────────┘ └───────────┘ └───────────┘           │
│ Japan Trip   Summer 2026   Untitled                  │
│ 2小时前      3天前          08/01                     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 5.3 画册卡片交互

点击卡片：

```text
进入 /editor/:bookId
```

Hover：

```text
···
```

菜单：

```text
打开
重命名
复制
导出
删除
```

删除必须二次确认。

---

## 5.4 空状态

```text
还没有画册

把照片变成一本可以翻阅的数字画册。

[ 创建第一本画册 ]
```

---

# 6. 页面二：创建画册

创建流程使用 Step Flow。

```text
Step 1
选择风格

Step 2
上传照片

Step 3
自动生成
```

---

# 7. Step 1：选择风格

首版提供两个主题。

## Theme A

```text
Editorial
```

特点：

- 留白
- 大图
- Serif Title
- 简洁
- 杂志感

---

## Theme B

```text
Scrapbook
```

特点：

- 高饱和
- Sticker
- Polaroid
- Tape
- Paper texture
- 手绘元素

---

## 后续主题

```text
Minimal
Travel
Wedding
Family
Retro
Film
Journal
Kids
```

---

# 8. Step 2：上传照片

支持：

```text
点击上传
Drag & Drop
多选
```

首版建议：

```text
Min: 3
Recommended: 8–20
Soft Limit: 50
```

页面：

```text
┌───────────────────────────────────────┐
│ 上传你的照片                           │
│                                       │
│ ┌───────────────────────────────────┐ │
│ │                                   │ │
│ │       拖照片到这里                │ │
│ │                                   │ │
│ │       或 [选择照片]               │ │
│ │                                   │ │
│ └───────────────────────────────────┘ │
│                                       │
│ 10 photos                             │
│                                       │
│ [← 返回]                  [开始制作]  │
└───────────────────────────────────────┘
```

---

# 9. 照片预处理

上传后分析：

```text
width
height
aspectRatio
orientation
fileSize
mimeType
```

计算：

```ts
orientation =
  ratio > 1.2
    ? "landscape"
    : ratio < 0.8
    ? "portrait"
    : "square"
```

后续可增加：

```text
face detection
main subject detection
blur detection
duplicate detection
color analysis
```

第一版不需要 AI。

---

# 10. 自动生成画册

点击：

```text
开始制作
```

进入 generating 页面。

动画文案可以依次显示：

```text
正在整理照片…
正在挑选版式…
正在制作封面…
正在装订画册…
完成。
```

期间后台执行：

```text
Create Book
→ Create Cover
→ Analyze Assets
→ Pick Layouts
→ Create Pages
→ Assign Assets
→ Create Page Elements
→ Save IndexedDB
```

完成后：

```text
/editor/:bookId
```

---

# 11. Layout Engine

自动排版是产品核心模块之一。

不要写死页面 HTML。

所有 Layout 采用标准模板定义。

---

# 12. Layout 数据模型

例如：

```ts
interface LayoutPreset {
  id: string
  name: string

  minImages: number
  maxImages: number

  slots: LayoutSlot[]
}

interface LayoutSlot {
  x: number
  y: number

  width: number
  height: number

  preferredOrientation?:
    | "portrait"
    | "landscape"
    | "square"
    | "any"
}
```

坐标使用：

```text
0–1 normalized coordinates
```

例如：

```json
{
  "id": "two-column",
  "minImages": 2,
  "maxImages": 2,
  "slots": [
    {
      "x": 0.05,
      "y": 0.05,
      "width": 0.43,
      "height": 0.9
    },
    {
      "x": 0.52,
      "y": 0.05,
      "width": 0.43,
      "height": 0.9
    }
  ]
}
```

---

# 13. 第一版 Layout 数量

建议实现：

```text
1 image × 5
2 images × 8
3 images × 8
4 images × 8

合计约 29 个。
```

---

# 14. Layout 示例

## 单图

```text
┌─────────────────┐
│                 │
│                 │
│      PHOTO      │
│                 │
│                 │
└─────────────────┘
```

---

## 双图

```text
┌────────┬────────┐
│        │        │
│ PHOTO  │ PHOTO  │
│        │        │
└────────┴────────┘
```

---

## 三图

```text
┌─────────────────┐
│      PHOTO      │
├────────┬────────┤
│ PHOTO  │ PHOTO  │
└────────┴────────┘
```

---

# 15. Editor 页面

Editor 是整个产品最重要页面。

布局：

```text
┌───────────────────────────────────────────────────────┐
│ ← Bookshelf     Book Name       ↶ ↷      Preview Export│
├───────────┬───────────────────────────────────────────┤
│           │                                           │
│ Photos    │                                           │
│           │                                           │
│ Layout    │           ┌─────────┬─────────┐            │
│           │           │         │         │            │
│ Text      │           │  PAGE   │  PAGE   │            │
│           │           │         │         │            │
│ Stickers  │           └─────────┴─────────┘            │
│           │                                           │
│ Background│                                           │
│           │                                           │
├───────────┴───────────────────────────────────────────┤
│ Cover │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ +                  │
└───────────────────────────────────────────────────────┘
```

---

# 16. Editor 区域组成

Editor 分成五块：

```text
Top Toolbar
Sidebar
Canvas Workspace
Context Toolbar
Page Strip
```

---

# 17. Top Toolbar

左侧：

```text
←
Book Title
```

中部：

```text
Undo
Redo
```

右侧：

```text
Autosaved ✓
Preview
Export
```

---

# 18. Sidebar

Sidebar 一级菜单：

```text
Photos
Layouts
Text
Stickers
Background
Cover
```

点击后：

```text
展开 Secondary Panel
```

---

# 19. Photos Panel

显示该画册已经上传的素材。

```text
Photos

[ + Upload ]

▣ ▣ ▣
▣ ▣ ▣
▣ ▣ ▣
```

用户可以：

```text
点击 → 添加到当前页

Drag → 拖入 Canvas

··· → 删除素材
```

已经使用过的素材可以显示：

```text
✓
```

但允许重复使用。

---

# 20. Layout Panel

显示布局缩略图：

```text
Layouts

┌─────┐
│ ███ │
└─────┘

┌─────┐
│█│█  │
└─────┘

┌─────┐
│ ███ │
│ █ █ │
└─────┘
```

点击 Layout：

```text
替换当前 Page Layout
```

如果当前页存在照片：

```text
自动重新分配到新 Layout
```

不删除照片资产。

---

# 21. Text Panel

提供：

```text
Add Heading
Add Subtitle
Add Body Text
Add Caption
```

以及预设：

```text
Big Editorial
Handwritten
Magazine Caption
Date
Quote
```

---

# 22. Sticker Panel

分类：

```text
Tape
Arrows
Shapes
Stars
Hearts
Paper
Polaroid
Travel
Numbers
Hand Drawn
```

Sticker 推荐使用：

```text
SVG
PNG
WebP
```

SVG 优先。

---

# 23. Background Panel

支持：

```text
Solid Color
Texture
Image
Pattern
```

默认：

```text
White
Cream
Black
Paper
Pastel
```

---

# 24. Cover Panel

封面单独处理。

功能：

```text
Cover Layout
Cover Image
Title
Subtitle
Color
Texture
```

后续支持：

```text
Cutout Cover
Window Cover
```

---

# 25. Canvas Workspace

使用：

```text
react-konva
```

编辑 Canvas 不直接使用 DOM。

核心组件：

```text
EditorStage
PageCanvas
ImageElement
TextElement
StickerElement
ShapeElement
Transformer
SelectionBox
GuideLines
```

---

# 26. Page 尺寸系统

所有页面使用逻辑尺寸。

例如：

```ts
const PAGE_WIDTH = 1200
const PAGE_HEIGHT = 1600
```

Canvas 显示时缩放。

不要根据屏幕尺寸改变页面真实坐标。

显示比例：

```ts
viewportScale =
  availableHeight / PAGE_HEIGHT
```

---

# 27. Spread

桌面默认显示：

```text
LEFT PAGE + RIGHT PAGE
```

```text
┌────────────┬────────────┐
│            │            │
│ LEFT PAGE  │ RIGHT PAGE │
│            │            │
└────────────┴────────────┘
```

中间显示书脊：

```text
spine shadow
```

第一页面：

```text
Cover
```

可以单页显示。

---

# 28. Element 类型

统一：

```ts
type EditorElement =
  | ImageElement
  | TextElement
  | StickerElement
  | ShapeElement
```

---

# 29. BaseElement

```ts
interface BaseElement {
  id: string

  type:
    | "image"
    | "text"
    | "sticker"
    | "shape"

  x: number
  y: number

  width: number
  height: number

  rotation: number

  opacity: number

  zIndex: number

  locked?: boolean
}
```

---

# 30. ImageElement

```ts
interface ImageElement extends BaseElement {
  type: "image"

  assetId: string

  crop: {
    x: number
    y: number
    width: number
    height: number
  }

  fit: "cover" | "contain"

  cornerRadius?: number

  border?: {
    width: number
    color: string
  }

  shadow?: {
    blur: number
    opacity: number
    offsetX: number
    offsetY: number
  }
}
```

---

# 31. TextElement

```ts
interface TextElement extends BaseElement {
  type: "text"

  text: string

  fontFamily: string
  fontSize: number
  fontWeight: number

  color: string

  align:
    | "left"
    | "center"
    | "right"

  lineHeight: number

  letterSpacing: number
}
```

---

# 32. StickerElement

```ts
interface StickerElement extends BaseElement {
  type: "sticker"

  src: string
}
```

---

# 33. 图片操作

点击照片后显示 Transformer。

支持：

```text
Select
Move
Resize
Rotate
Delete
Duplicate
Crop
Replace
Bring Forward
Send Backward
```

---

# 34. Context Toolbar

选择图片：

```text
┌──────────────────────────────────────────┐
│ Replace | Crop | Cutout | Duplicate | 🗑 │
└──────────────────────────────────────────┘
```

选择文字：

```text
Font
Size
Weight
Color
Align
Delete
```

选择 Sticker：

```text
Flip
Opacity
Duplicate
Delete
```

---

# 35. 图片 Crop 模式

Normal Mode：

```text
移动整个元素
```

Crop Mode：

```text
图片容器不动
图片内部移动 / 缩放
```

交互：

```text
Double Click Image
→ Crop Mode

Enter
→ Confirm

Escape
→ Cancel
```

---

# 36. Keyboard Shortcuts

```text
Cmd/Ctrl + Z      Undo

Cmd/Ctrl + Shift + Z
Redo

Cmd/Ctrl + C
Copy

Cmd/Ctrl + V
Paste

Cmd/Ctrl + D
Duplicate

Delete
Delete element

Arrow
Move 1px

Shift + Arrow
Move 10px

Escape
Deselect

Enter
Edit / Confirm
```

---

# 37. Selection

单选：

```text
click
```

多选：

```text
Shift + click
```

框选：

```text
drag empty canvas
```

后续支持。

---

# 38. 对齐辅助线

元素拖动时检测：

```text
Page Center
Page Edge
Other Element Edge
Other Element Center
```

显示 guide。

例如：

```text
         │
         │
┌──────┐ │
│IMAGE │ │
└──────┘ │
         │
```

接近：

```text
5–8 px
```

自动吸附。

---

# 39. Page Strip

底部：

```text
Cover | 1 | 2 | 3 | 4 | 5 | +
```

支持：

```text
点击 → 切换页面

Drag → 调整顺序

+ → Add Page

Right Click / ···
→ Duplicate
→ Delete
```

---

# 40. Add Page

点击：

```text
+
```

弹出：

```text
Blank Page
1 Photo
2 Photos
3 Photos
4 Photos
```

也可以：

```text
Auto Layout
```

---

# 41. Page 数据结构

```ts
interface Page {
  id: string

  type:
    | "cover"
    | "normal"

  background: PageBackground

  elements: EditorElement[]

  layoutId?: string

  order: number
}
```

---

# 42. Book 数据结构

```ts
interface FlipBook {
  id: string

  title: string

  themeId: string

  format: {
    width: number
    height: number
  }

  coverPageId: string

  pages: Page[]

  assets: Asset[]

  createdAt: number

  updatedAt: number

  version: number
}
```

---

# 43. Asset

```ts
interface Asset {
  id: string

  type:
    | "image"
    | "sticker"

  name: string

  mimeType: string

  width: number
  height: number

  storageKey: string

  thumbnailKey?: string

  createdAt: number
}
```

---

# 44. IndexedDB

使用：

```text
Dexie
```

Database：

```text
flipbookStudio
```

Tables：

```text
books
assets
snapshots
settings
```

---

# 45. 图片存储

不要将 Base64 写进 Book JSON。

应该：

```text
IndexedDB Blob
```

Book JSON 只引用：

```text
assetId
```

---

# 46. 自动保存

任何修改：

```text
State Update
    ↓
debounce 800–1500ms
    ↓
IndexedDB
```

顶部显示：

```text
Saving…
```

然后：

```text
Saved ✓
```

---

# 47. Zustand Store

建议：

```ts
interface EditorStore {
  book: FlipBook | null

  activePageIds: string[]

  selectedElementIds: string[]

  activePanel:
    | "photos"
    | "layouts"
    | "text"
    | "stickers"
    | "background"
    | "cover"
    | null

  mode:
    | "select"
    | "crop"
    | "text-edit"

  zoom: number

  addElement(): void
  updateElement(): void
  deleteElement(): void

  addPage(): void
  deletePage(): void

  undo(): void
  redo(): void
}
```

---

# 48. Undo / Redo

不要直接保存完整 Blob 历史。

只跟踪：

```text
Book document state
```

照片 Blob 不进入 History。

可以：

```text
Past
Present
Future
```

或者 Patch：

```text
Immer patches
```

推荐：

```text
Immer patches
```

---

# 49. Preview

点击：

```text
Preview
```

进入：

```text
/preview/:bookId
```

预览页面禁止编辑。

---

# 50. Preview UI

```text
┌────────────────────────────────────────┐
│ ← Back                     Fullscreen │
│                                        │
│               BOOK                     │
│                                        │
│          drag corner to flip           │
│                                        │
│                  3 / 16                │
└────────────────────────────────────────┘
```

---

# 51. 翻页

使用：

```text
StPageFlip
```

或：

```text
react-pageflip
```

要求：

```text
Hard Cover
Soft Inner Pages
Landscape Spread
Mobile Portrait
Drag Page Corner
Click Navigation
Keyboard Navigation
```

---

# 52. Preview Renderer

不要直接把 Konva Stage 塞到 Flipbook。

编辑完成后：

```text
Page JSON
→ PageRenderer
→ Rendered Image / DOM
→ PageFlip
```

首版推荐：

```text
render page → image
```

稳定性最高。

---

# 53. Export

Export Modal：

```text
Export

Image
PDF
Video

Quality

○ Standard
○ High
● Ultra

[ Export ]
```

---

# 54. JPG Export

支持：

```text
Single pages
All pages
Spread
```

流程：

```text
Page
→ Offscreen Konva Stage
→ pixelRatio
→ Blob
→ ZIP
```

---

# 55. Export Quality

例如：

```text
Standard
pixelRatio = 1

High
pixelRatio = 2

Ultra
pixelRatio = 3
```

---

# 56. PDF Export

流程：

```text
Book
 ↓
Render Page
 ↓
PNG / JPEG
 ↓
pdf-lib
 ↓
PDF
```

PDF 页面尺寸与画册比例一致。

---

# 57. PDF 目标

第一版：

```text
Digital quality
```

后续：

```text
Print quality
300 DPI
Bleed
Crop Marks
CMYK workflow
```

---

# 58. MP4

第一版本不实现。

UI 可以隐藏。

第二阶段：

```text
Page Render
→ Frames
→ Transition
→ FFmpeg
→ MP4
```

桌面版优先使用：

```text
Tauri sidecar + FFmpeg
```

---

# 59. Background Removal

第二阶段实现。

技术：

```text
@imgly/background-removal
```

流程：

```text
Select Image
→ Cutout
→ Worker
→ Remove Background
→ WebP
→ Create New Asset
→ Replace Element Asset
```

处理时显示：

```text
正在抠图…
```

允许取消。

---

# 60. 模板系统

Theme 不等于 Layout。

Theme：

```text
font
color
background
stickers
default layouts
decorations
```

Layout：

```text
page geometry
```

---

# 61. Theme 数据

```ts
interface Theme {
  id: string

  name: string

  typography: {
    headingFont: string
    bodyFont: string
  }

  colors: string[]

  backgrounds: string[]

  layoutIds: string[]

  stickerPackIds: string[]
}
```

---

# 62. Template

后续可以支持完整 Page Template：

```ts
interface PageTemplate {
  id: string

  preview: string

  elements: TemplateElement[]
}
```

用户点击：

```text
Apply Template
```

即可生成整个页面。

---

# 63. Responsive

Desktop：

```text
完整编辑器
```

Tablet：

```text
简化编辑器
```

Mobile：

第一版：

```text
Bookshelf
Create
Preview
Basic Edit
```

不要尝试第一版在手机实现完整专业编辑。

---

# 64. Desktop App

Web 稳定后加入：

```text
Tauri
```

目标：

```text
Windows
macOS
```

共享：

```text
React codebase
```

---

# 65. 技术栈

推荐：

```text
React
TypeScript
Vite

Tailwind CSS
Radix UI

Konva
react-konva

Zustand
Immer

Dexie
IndexedDB

StPageFlip
react-pageflip

pdf-lib

JSZip

Tauri
```

---

# 66. 项目目录

```text
flipbook-studio/
│
├── src/
│
│   ├── app/
│   │   ├── bookshelf/
│   │   ├── create/
│   │   ├── editor/
│   │   ├── preview/
│   │   └── settings/
│
│   ├── editor/
│   │
│   │   ├── canvas/
│   │   │   ├── EditorStage.tsx
│   │   │   ├── PageCanvas.tsx
│   │   │   ├── SpreadCanvas.tsx
│   │   │   └── SelectionTransformer.tsx
│   │
│   │   ├── elements/
│   │   │   ├── ImageElement.tsx
│   │   │   ├── TextElement.tsx
│   │   │   ├── StickerElement.tsx
│   │   │   └── ShapeElement.tsx
│   │
│   │   ├── layouts/
│   │   │   ├── presets/
│   │   │   ├── applyLayout.ts
│   │   │   └── autoLayout.ts
│   │
│   │   ├── history/
│   │   │   └── historyManager.ts
│   │
│   │   ├── guides/
│   │   │   └── snapping.ts
│   │
│   │   └── renderer/
│   │       ├── renderPage.ts
│   │       └── renderBook.ts
│
│   ├── panels/
│   │   ├── PhotosPanel.tsx
│   │   ├── LayoutPanel.tsx
│   │   ├── TextPanel.tsx
│   │   ├── StickerPanel.tsx
│   │   ├── BackgroundPanel.tsx
│   │   └── CoverPanel.tsx
│
│   ├── components/
│   │   ├── toolbar/
│   │   ├── dialogs/
│   │   ├── buttons/
│   │   └── ui/
│
│   ├── store/
│   │   ├── editorStore.ts
│   │   └── appStore.ts
│
│   ├── db/
│   │   ├── database.ts
│   │   ├── bookRepository.ts
│   │   └── assetRepository.ts
│
│   ├── export/
│   │   ├── imageExport.ts
│   │   ├── pdfExport.ts
│   │   └── zipExport.ts
│
│   ├── themes/
│   │   ├── editorial/
│   │   └── scrapbook/
│
│   ├── types/
│   │   ├── book.ts
│   │   ├── page.ts
│   │   ├── element.ts
│   │   └── asset.ts
│
│   └── utils/
│
├── public/
│
│   ├── stickers/
│   ├── textures/
│   ├── templates/
│   └── previews/
│
└── src-tauri/
```

---

# 67. 开发阶段

不要一次实现所有功能。

---

# Phase 0：项目骨架

完成：

```text
React
Router
Tailwind
Radix
Zustand
Dexie
```

页面：

```text
Bookshelf
Create
Editor
Preview
```

此阶段不实现复杂 Canvas。

---

# Phase 1：数据系统

实现：

```text
Book model
Page model
Element model
Asset model
IndexedDB
Autosave
```

验收：

```text
创建画册
关闭网页
重新打开
数据仍然存在
```

---

# Phase 2：基础 Canvas

实现：

```text
PageCanvas
Image Element
Selection
Move
Resize
Rotate
Delete
```

验收：

用户可以：

```text
添加一张图片
拖动
缩放
旋转
刷新
位置保持
```

---

# Phase 3：多页面

实现：

```text
Page
Spread
Page Strip
Add Page
Delete Page
Reorder
```

---

# Phase 4：Create Flow

实现：

```text
Theme
Upload
Generate
Auto Layout
```

完成后用户第一次可以完整：

```text
Upload → Book
```

---

# Phase 5：编辑工具

加入：

```text
Text
Sticker
Background
Layouts
Duplicate
Layer
```

---

# Phase 6：图片高级能力

```text
Crop
Replace
Pan
Fit
Border
Shadow
```

---

# Phase 7：Undo / Redo

实现：

```text
History
Keyboard Shortcut
```

---

# Phase 8：Preview

实现：

```text
Page Renderer
PageFlip
Fullscreen
```

---

# Phase 9：Export

实现：

```text
JPG
ZIP
PDF
```

---

# Phase 10：Polish

实现：

```text
Snapping
Guide
Animations
Loading
Empty states
Keyboard
Accessibility
Error handling
Performance
```

---

# 68. MVP Definition

满足下面流程即可定义 MVP 完成：

```text
打开 App

→ 新建画册

→ 选择 Theme

→ 上传 10 张照片

→ 自动生成 5–8 页画册

→ 修改图片位置

→ 修改 Layout

→ 添加文字

→ 添加 Sticker

→ 修改背景

→ 新建页面

→ 删除页面

→ 自动保存

→ 刷新后恢复

→ 翻页预览

→ 导出 PDF
```

---

# 69. MVP 暂时不要实现

为了避免 Codex 扩大范围，明确禁止第一阶段实现：

```text
Authentication
Cloud Sync
Payments
Collaboration
AI
MP4
Printing
Order Book
Social Network
Comments
Analytics Dashboard
Mobile Full Editor
```

---

# 70. 性能要求

目标：

```text
20 pages
100 images
```

编辑器保持流畅。

避免：

```text
所有页面同时完整 Canvas Render
```

只渲染：

```text
active spread
```

缩略图使用：

```text
cached preview
```

---

# 71. 图片优化

上传原图后生成：

```text
original Blob
preview image
thumbnail
```

Editor 使用：

```text
preview
```

Export 使用：

```text
original
```

这样避免 20MB 手机照片直接放进 Canvas。

---

# 72. Autosave 要求

必须：

```text
debounce
```

不要每次 drag move 都写 IndexedDB。

正确流程：

```text
dragMove
→ UI state update

dragEnd
→ commit document state
→ autosave
```

---

# 73. 错误处理

必须处理：

```text
Unsupported File
Image Decode Error
IndexedDB Error
Insufficient Storage
Export Error
Corrupted Book
```

用户不应该看到：

```text
Unhandled Promise Rejection
```

---

# 74. 空状态

Photos：

```text
还没有照片

上传照片开始制作。
```

Sticker：

```text
暂无该分类素材。
```

Bookshelf：

```text
还没有画册。
```

---

# 75. Loading State

统一使用：

```text
Spinner
Skeleton
Progress
```

上传大量照片时：

```text
8 / 20
```

不要只有无限 Spinner。

---

# 76. Confirmation

删除：

```text
Page
Book
Unused Asset
```

使用确认 Dialog。

Element 删除：

```text
不确认
```

因为可以 Undo。

---

# 77. UX 细节

Editor 打开后默认：

```text
第一页 Spread
```

选择元素后：

```text
自动显示 Context Toolbar
```

点击 Canvas 空白：

```text
取消选择
```

双击文字：

```text
进入 Text Edit
```

双击图片：

```text
进入 Crop
```

Escape：

```text
退出当前模式
```

---

# 78. UI Design Direction

整体风格：

```text
Minimal editor UI
+
Rich content canvas
```

软件本身 UI 应该克制。

画册可以丰富。

不要：

```text
整个编辑器都做 Scrapbook 风格
```

否则视觉层级混乱。

---

# 79. 建议视觉参数

Editor：

```text
background:
neutral light gray

canvas:
paper white

sidebar:
white

border:
soft neutral

radius:
8–12px

shadow:
subtle
```

重点视觉始终是：

```text
Book
```

而不是 Toolbar。

---

# 80. Canvas Interaction Rules

所有 drag：

```text
Pointer Down
→ Select
→ Drag
→ Snap
→ Drag End
→ Commit History
```

Resize：

```text
Transform Start
→ Transform
→ Transform End
→ Normalize width / height
→ Reset scale
→ Commit History
```

不要长期保存：

```text
scaleX
scaleY
```

作为 Resize。

建议 Transform End 时换算：

```ts
width *= scaleX
height *= scaleY

scaleX = 1
scaleY = 1
```

避免后续 Crop 计算复杂。

---

# 81. Z-index

所有 page elements：

```text
array order = render order
```

最后一个：

```text
top
```

操作：

```text
Bring Forward
Send Backward
Bring To Front
Send To Back
```

通过改变数组顺序完成。

---

# 82. PageRenderer

必须建立独立 Renderer。

API：

```ts
renderPage(
  page: Page,
  assets: Asset[],
  options?: RenderOptions
): Promise<Blob>
```

同一套 Renderer 用于：

```text
Thumbnail
Preview
JPG
PDF
```

避免四套渲染逻辑。

---

# 83. Thumbnail

页面修改后：

```text
debounce
→ render low resolution thumbnail
→ IndexedDB
```

Page Strip 读取 Thumbnail。

不要实时缩小完整 Canvas。

---

# 84. Testing

重点测试：

```text
Book creation
Page CRUD
Element CRUD
Autosave
Undo
Layout application
Asset persistence
Export
```

建议：

```text
Vitest
React Testing Library
Playwright
```

---

# 85. E2E 核心测试

测试流程：

```text
Create Book
→ Upload Fixtures
→ Generate
→ Move Image
→ Add Text
→ Reload
→ Verify State
→ Preview
→ Export
```

这是最重要 E2E。

---

# 86. Codex 开发规则

Codex 实现项目时遵守以下规则。

## Rule 1

不要在单个组件写大量业务逻辑。

```text
UI
Store
Domain
Persistence
Renderer
```

分离。

---

## Rule 2

任何 Editor 改动必须通过 Store Action。

禁止：

```text
component directly mutate book
```

---

## Rule 3

任何 Book 持久化必须通过：

```text
Repository
```

不要组件直接操作 Dexie。

---

## Rule 4

任何 export 必须通过：

```text
PageRenderer
```

---

## Rule 5

不要将：

```text
Blob
Base64
HTML
Konva Node
```

保存进 Book JSON。

只保存可序列化 Document Model。

---

## Rule 6

UI 组件保持可复用。

例如：

```text
Button
Dialog
Popover
Slider
Tabs
Tooltip
```

使用统一组件。

---

# 87. Codex 首轮任务

首次让 Codex 开始实现时，可直接使用：

```text
Read PRODUCT_SPEC.md completely before coding.

Implement Phase 0 and Phase 1 only.

Requirements:

1. Create a React + TypeScript + Vite application.
2. Configure Tailwind CSS.
3. Add routing.
4. Implement routes:
   /
   /create
   /editor/:bookId
   /preview/:bookId
5. Create the domain models described in PRODUCT_SPEC.md.
6. Add Zustand stores.
7. Add Dexie IndexedDB persistence.
8. Implement Bookshelf CRUD.
9. Implement Create Book flow skeleton.
10. Add autosave infrastructure.
11. Do NOT implement canvas editing yet.
12. Do NOT add authentication, cloud, AI, payment, MP4 or backend.

Keep domain logic outside React components.

At the end:
- run TypeScript check
- run lint
- run tests
- fix all errors
- provide a summary of changed files.
```

---

# 88. Codex 第二轮任务

```text
Implement Phase 2 of PRODUCT_SPEC.md.

Goal:
Build the basic Konva-based page editor.

Requirements:

- install Konva and react-konva
- implement EditorStage
- implement PageCanvas
- implement ImageElement
- implement selection
- implement Transformer
- support:
  - move
  - resize
  - rotate
  - delete
- persist all transformations through editorStore
- transformations must survive reload
- commit history only on interaction end
- do not save Konva objects into application state
- keep coordinates in logical page coordinate space

Add tests where practical.

Do not implement Crop, Text, Stickers or PageFlip yet.
```

---

# 89. Codex 第三轮任务

```text
Implement the Create → Auto Layout flow.

Requirements:

- photo upload
- image metadata analysis
- asset persistence
- thumbnail generation
- orientation detection
- layout preset system
- create at least:
  5 one-image layouts
  8 two-image layouts
  8 three-image layouts
  8 four-image layouts
- implement autoLayout()
- distribute uploaded photos across generated pages
- save generated book
- open the editor when generation finishes

Do not use AI.
```

---

# 90. Codex 后续执行原则

之后每次只给 Codex 一个阶段。

不要一次要求：

```text
把整个应用做完
```

推荐：

```text
一个 Phase
→ 编码
→ 测试
→ Review
→ Commit
→ 下一 Phase
```

这样能显著减少架构漂移。

---

# 91. Definition of Done

一个功能只有满足：

```text
UI complete

Interaction complete

State persisted

Reload works

Error state exists

TypeScript passes

Tests pass
```

才算完成。

---

# 92. 第一版本最终用户体验

理想体验：

```text
打开 Flipbook Studio

        ↓

点击「新建画册」

        ↓

选择「Scrapbook」

        ↓

上传 15 张旅行照片

        ↓

等待数秒视觉生成流程

        ↓

一本完成度约 70% 的画册已经出现

        ↓

用户替换某个 Layout

        ↓

拖动两张照片

        ↓

增加：
TOKYO
SEP 2026

        ↓

加入 Tape Sticker

        ↓

切换第二页背景

        ↓

点击 Preview

        ↓

像实体书一样翻页

        ↓

点击 Export PDF

        ↓

得到完整数字画册
```

这就是整个产品第一阶段需要达到的核心体验。

---

# 93. 产品核心优先级

如果开发过程中必须做取舍：

```text
1. 自动生成一本好看的画册
2. 编辑体验稳定
3. 数据永不轻易丢失
4. 翻页预览有质感
5. 导出结果正确
6. 高级功能
```

任何时候不要为了增加新功能牺牲：

```text
Canvas stability
Autosave
Image quality
Undo reliability
```

---

# 94. 最终架构总结

```text
                    ┌─────────────────────┐
                    │      React UI       │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │    Zustand Store    │
                    └──────┬────────┬─────┘
                           │        │
                 ┌─────────▼──┐ ┌──▼────────────┐
                 │Editor Engine│ │ Domain Model  │
                 │   Konva     │ │ Book / Page   │
                 └──────┬──────┘ └──────┬────────┘
                        │               │
                  ┌─────▼─────┐   ┌─────▼──────┐
                  │ Renderer  │   │ Repository │
                  └─────┬─────┘   └─────┬──────┘
                        │               │
             ┌──────────┼──────────┐    │
             │          │          │    │
           Preview     JPG        PDF   │
             │                         │
         PageFlip               IndexedDB
```

核心原则：

```text
Document Model 是唯一事实来源。

Canvas 只是编辑 Document 的界面。

Preview 是 Document 的阅读形式。

Export 是 Document 的输出形式。

IndexedDB 是 Document 的持久化形式。
```

只要始终遵守这一原则，后续增加：

```text
Cloud
AI
Templates
Collaboration
Mobile
Printing
Video
```

都不需要推翻现有架构。