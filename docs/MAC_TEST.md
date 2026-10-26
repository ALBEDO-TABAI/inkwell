# Inkwell Mac 测试版（arm64，未签名）

适用于 Apple Silicon（M1 及以后）的 Mac，macOS 13 或更新版本。

## 文件
- 最新：`/workspace/dist-parts/inkwell-mac-arm64-v4.zip`（约 115 MB，2026-10-26 23:53 JST，来自 77ad0f2，版本 0.4.0：评论、媒体块、标签页块、提醒、快速搜索窗口（⇧⌘K）、托盘、模板库、完整设置、导入导出、繁体中文、动效）
- 上一版：v3（df41571）
  - md5 `437b1772530885d411c82e8ff01a1292`
- `inkwell-mac-arm64-v2.zip`（22:26，来自 0915893：数据库视图 / 预览 / 页面内查找），md5 `0de66e7361477ab8158e590497e394d3`
- 旧版：`inkwell-mac-arm64-v1.zip`（21:45，M4 之前），md5 `59cedbcf2a33597b69b9cd433263470a`
- 分卷（每卷 25 MB）：`inkwell-mac-arm64-vN.zip.part00` … `part04`
- 校验：`MD5SUMS.txt`（全部版本），`MD5SUMS-vN.txt`（单个版本）

如果下载的是分卷，先合并，再核对 md5：
```bash
cat inkwell-mac-arm64-v4.zip.part* > inkwell-mac-arm64-v4.zip
md5 inkwell-mac-arm64-v4.zip        # 应与 MD5SUMS-v4.txt 第一行一致
```

## 安装与打开
1. 双击 zip 解压，把 `Inkwell.app` 拖到「应用程序」文件夹。
2. 这个版本没有开发者签名，第一次打开要绕过 Gatekeeper，以下二选一：
   - 在 Finder 里**右键（或按住 Control 点按）`Inkwell.app` → 打开**，在弹窗里再点「打开」。
   - 或者在终端执行：
     ```bash
     xattr -dr com.apple.quarantine /Applications/Inkwell.app
     ```
3. 如果提示「已损坏，无法打开」，就是 quarantine 属性还在，执行上面的 `xattr` 命令即可。

## 说明
- 数据存在本机 SQLite：`~/Library/Application Support/Inkwell/inkwell.db`；窗口和选项卡状态存在同目录的 `window-state.json`。
- 第一次启动会写入示例工作区（REA 参考页）。要从头再来，用菜单「帮助 → 故障排除 → 重置并删除所有本地数据」。
- 全部离线运行，不连接任何服务器。
- 快捷键：⌘T 新选项卡，⌘N 新页面，⌘K 搜索，⌘\ 侧边栏，⌘1–9 切换选项卡，⌘[ / ⌘] 后退 / 前进。
- 还没做：自动更新、签名和公证。
- 遇到问题，用「帮助 → 故障排除 → 在 Finder 中显示日志」找到日志后发给我。
