# 运行、离线生成与部署

## 在线演示

地址：**https://nylon-elastic-studio-nov10.majorsnail16384.chatgpt.site/**

2026-11-11 的直接 HTTP 请求返回 200。站点由 Sites 承载，实际访问仍可能受网络、账户和宿主平台可用性影响。若出现认证要求或内置浏览器崩溃，优先尝试现代 Chrome / Edge；也可以运行本地服务器或生成离线版。这不是对所有浏览器与所有网络环境的可用性保证。

## 本地运行

```sh
git clone https://github.com/engrecho/nylon-elastic-studio.git
cd nylon-elastic-studio
npm start
```

启动演示只需要 Node.js 22+；运行时 Three.js、模型和纹理已在 `dist/`。打开 http://localhost:5188 。服务器在前台运行，按 Ctrl+C 停止。

默认端口 5188；服务器仅用于本地开发，不是生产 HTTP 服务。已有演示占用端口时，请先停止已有服务，或使用其他静态服务器托管 `dist/`。不要双击 `dist/index.html`：它使用 ES 模块和文件请求，应通过 HTTP 访问。

## 单文件离线版

```sh
npm run build:offline
```

生成 `outputs/NYLON-offline.html`，直接用 Chrome / Edge 打开。它包含 Three.js、轻量模型、动态袜壳、颜色 / 粗糙度纹理、手图及应用代码，无需联网和本地服务器。体积约 32 MB，首次打开需要解码资源。

完整 150 万面模型没有内嵌到单文件，避免扩大体积和内存占用；完整精度使用本地服务或在线演示。离线文件属于生成产物，未提交到 Git 源码历史，可从 GitHub Release 获取或自行生成。

## 模型重建输入

**仅重新生成模型资源时**安装构建依赖：

```sh
npm ci
```

将原始资源放入 `reference-model/`：

```text
reference-model/
  source.obj
  material.mtl
  texture_pbr_20250901.png
  texture_pbr_20250901_metallic.png
  texture_pbr_20250901_roughness.png
  texture_pbr_20250901_normal.png
```

然后执行：

```sh
npm run prepare:model -- reference-model/source.obj
npm run build:offline
npm test
```

可将 OBJ 路径换成其他文件名；当前准备脚本仍固定从 `reference-model/` 读取上述贴图名。输入 OBJ 未随仓库重复发布，仓库已包含转换后的完整几何和显示资源，足以运行与检查。`reference-model/` 在 `.gitignore` 中。

脚本使用当前模型的尺寸、居中参数和袜口高度阈值。替换为不同人物模型时，需要调整 `prepare-model.cjs` 与 `dist/model-loader.js` 中的尺寸约定，并重新检查腿部区域；不能把该脚本视作任意人物的一键分割工具。

## 自动检查

```sh
npm test
```

检查离线脚本语法、原模和袜壳数据、顶点来源、局部拉伸、对侧腿隔离、局部法线碰撞约束、回弹、重置、离线资源与手图状态。GitHub Actions 在推送和 PR 时运行同一套检查。

这些检查不启动浏览器，不证明最终 GPU 材质外观或触控体验正确。人工验收建议在实际 Chrome / Edge 中依次检查默认外观、六种外观选项、双腿拖动、松手、完整精度、原模对照与重置。

## 静态部署

将 `dist/` 的全部内容部署到静态站点根目录即可，不需要后端数据库、密钥或构建服务。部署时保留 `model/` 和 `vendor/` 的相对位置。

需要正确返回 JavaScript / PNG / WebP 等 MIME 类型，允许同源读取二进制模型。`*.bin.gz` 是由应用自行解压的 gzip 文件，**不要让服务器在响应层透明解压它，也不要额外设置会触发浏览器自动解压的 `Content-Encoding: gzip`**；浏览器交给应用的应当仍是原始 gzip 字节。

仓库源代码不包含原 Sites 项目的 `.openai` 配置或仓库写入凭据。迁移到其他主机时无需原部署系统。

## 常见问题

| 现象 | 检查方法 |
| --- | --- |
| 一直显示加载中 | 看是否已下载约数十 MB 的贴图 / 几何，检查网络请求与浏览器控制台 |
| WebGL 不可用 | 使用支持硬件加速的现代浏览器，并确认设备能创建 WebGL 上下文 |
| 解压报错 | 检查浏览器是否支持 `DecompressionStream`，以及主机是否提前解压了 `.bin.gz` |
| `ERR_CONNECTION_REFUSED` | 本地服务未启动或端口不同，重新运行 `npm start` |
| `EADDRINUSE` | 5188 已有服务监听，停止重复的服务 |
| 源码页双击打不开 | 改用 HTTP 服务，或打开生成的单文件离线版 |
| 完整精度卡顿 | 切回默认 18 万面预览；完整原模约 150 万面且贴图为 4K |
| 换袜后皮肤与原图不同 | 原包无裸肤贴图，当前是材质近似重建；用原模对照检查原始外观 |
| 衣物边缘或极端拖动穿插 | 当前只有局部法线约束，无完整全局碰撞与自碰撞 |
