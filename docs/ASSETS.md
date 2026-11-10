# 资源来源与许可说明

## 提供的模型与照片

本项目制作时由需求方提供了 OBJ + MTL + 四张 PBR 贴图，以及透明 WebP 手部照片。仓库包含模型的运行时转换资源、原贴图和手图，用于复现演示；原始 OBJ 输入不重复放入 Git 历史。

发布仓库不等同于声明这些素材为公共领域，也不自动授予模型、贴图、手图的商用、再分发或其他二次使用许可。项目未提供可验证的原素材授权文件；需要复用素材时，请先确认相应权利。

目前没有为整仓库指定统一开源许可证。代码公开可查看，不代表默认为 MIT 或其他开源协议。依赖的许可证不改变项目素材的权利归属。

## 资源清单

| 路径 | 内容 |
| --- | --- |
| `dist/model/original.bin.gz` | 提供模型的全部原始面片、位置与 UV 的紧凑表示 |
| `dist/model/preview.bin.gz` | 同一模型的轻量预览 |
| `dist/model/cloth.bin.gz` | 从提供模型提取、简化的动态袜壳 |
| `dist/model/texture_pbr_20250901.png` | 原颜色贴图 |
| `dist/model/*_roughness.png` | 原粗糙度贴图 |
| `dist/model/*_normal.png` | 原法线贴图，当前主渲染路径未直接使用 |
| `dist/model/*_metallic.png` | 原金属度贴图，当前主渲染路径未直接使用 |
| `dist/hand.webp` | 提供的透明手部照片 |
| `docs/images/model-preview.png` | 从实际模型与原贴图生成的检查渲染 |

## 第三方依赖

- **Three.js r170 / 0.170.0**：运行时已随仓库提供。MIT 许可证完整文本见 [`dist/vendor/THREE-LICENSE.txt`](../dist/vendor/THREE-LICENSE.txt)。上游：[mrdoob/three.js](https://github.com/mrdoob/three.js)。
- **meshoptimizer 1.3.0**：开发阶段的几何简化工具，MIT 许可证见 [`MESHOPTIMIZER-LICENSE.md`](MESHOPTIMIZER-LICENSE.md)。上游：[zeux/meshoptimizer](https://github.com/zeux/meshoptimizer)。
- **sharp 0.35.5**：开发阶段的纹理解码和 CPU 检查渲染输出工具。授权信息以安装包及[上游项目](https://github.com/lovell/sharp)为准；它不包含在浏览器运行时中。
- 在线版样式可加载 Google Fonts 的 Noto Sans SC。离线生成器移除网络字体导入，使用设备字体。

运行演示和生成离线 HTML 不需要安装 meshoptimizer 或 sharp；只有重新处理原始模型时需要这些开发依赖。
