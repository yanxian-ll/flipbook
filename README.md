# Flipbook Studio

一个基于 React + Vite 的电子画册编辑器，支持照片排版、模板编辑、翻页预览、导出，以及 Windows / macOS / Linux 桌面端构建。

## 功能

- 画册创建与本地保存
- 单页 / 双页编辑模式
- 照片素材库与批量选择
- 页面模板与自定义模板
- 文字、贴纸、纸胶带等装饰元素
- 页面背景、纹理与封面 / 后封面设置
- 拖拽排序、裁剪与页面预览
- 翻页动画预览
- PDF / 图片等导出能力
- 本地版本历史
- Electron 桌面端
- GitHub Actions 多平台自动构建与 Release 发布

## 技术栈

- React 19
- TypeScript
- Vite
- Zustand + Immer
- Dexie / IndexedDB
- Konva / react-konva
- react-pageflip / page-flip
- Electron
- electron-builder

## 本地开发

建议使用 Node.js 22。

```bash
git clone https://github.com/yanxian-ll/flipbook.git
cd flipbook
npm ci
npm run dev
```

开发服务器默认运行在：

```text
http://127.0.0.1:5173
```

## 常用命令

```bash
npm run dev          # 启动 Web 开发环境
npm run typecheck    # TypeScript 类型检查
npm test             # 运行测试
npm run build        # 构建 Web 版本
```

## 桌面端

项目使用 Electron 作为桌面端外壳，核心 React/Vite 编辑器代码与 Web 版本共用。

### 本地运行桌面版

```bash
npm run desktop:dev
```

### Windows

```bash
npm run desktop:win
```

生成 NSIS `.exe` 安装包。

### macOS

```bash
npm run desktop:mac
```

生成 Intel x64 和 Apple Silicon arm64 的 `.dmg`。

### Linux

```bash
npm run desktop:linux
```

生成 x64 `.AppImage`。

桌面构建产物默认位于：

```text
release/
```

## GitHub Actions 自动发布

仓库包含 `Desktop Release` workflow，可直接在 GitHub 上完成三平台构建和 Release 发布。

在 GitHub 仓库中进入：

```text
Actions → Desktop Release → Run workflow
```

输入版本号，例如：

```text
v0.1.1
```

GitHub Actions 会自动构建：

- Windows x64 `.exe`
- macOS Intel x64 `.dmg`
- macOS Apple Silicon arm64 `.dmg`
- Linux x64 `.AppImage`

构建完成后会自动创建对应 GitHub Release，并上传上述安装包。

也可以通过推送 `v*` tag 触发：

```bash
git tag -a v0.1.1 -m "Flipbook Studio v0.1.1"
git push origin v0.1.1
```

## 项目结构

```text
flipbook/
├─ src/                     # React / TypeScript 核心应用
│  ├─ app/                  # 页面与编辑器 UI
│  ├─ components/           # 通用组件
│  ├─ domain/               # 画册数据模型与模板逻辑
│  ├─ editor/               # 画布与编辑能力
│  ├─ export/               # 导出功能
│  ├─ panels/               # 编辑面板
│  └─ store/                # 编辑状态
├─ electron/                # Electron 桌面端入口
├─ public/                  # 静态资源
├─ .github/workflows/       # CI 与桌面端自动发布
├─ electron-builder.yml     # 桌面打包配置
└─ package.json
```

## CI

普通 CI 会执行：

```bash
npm ci
npm run typecheck
npm test
npm run build
```

桌面端相关修改还会触发 Windows / macOS / Linux 实际打包验证。

## 桌面发布说明

当前桌面构建默认未配置商业代码签名。

因此：

- Windows 可能出现 SmartScreen 提示
- macOS 可能出现 Gatekeeper 提示

正式公开分发时，可以进一步配置 Windows Code Signing，以及 Apple Developer 签名和 notarization。

---

**Flipbook Studio** — Create, edit and export interactive photo books across Web and desktop platforms.
