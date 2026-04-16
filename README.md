# xhs-ai-content-flow

小红书 AI 内容生产全流程 Skill，适用于 [Claude Code](https://claude.ai/code) / [Hermes](https://github.com/NousTech/hermes)。

从热点发现到图文发布，五步走完，产物是配图 + 可直接复制的发布文案。

---

## 工作流

```
热点抓取（follow-builders）
    ↓
[PAUSE] 选题确认
    ↓
正文写作
    ↓
[PAUSE] 草稿审阅
    ↓
去痕处理（humanizer-zh）
    ↓
[PAUSE] 去痕审阅
    ↓
配图生成（md2xhs）
    ↓
发布摘要生成
    ↓
[PAUSE] 最终确认 → 发布
```

每个 `[PAUSE]` 节点都会等用户确认后再继续，不会自动跑完全程。

---

## 产物

```
输出目录/
  article-01.png     ← 小红书配图（每页 1080×1440px）
  article-02.png
  ...
  发布版.txt          ← 推荐标题 + 备选标题×3 + 摘要 + tags
```

---

## 安装

### 1. 安装 Skill

```bash
git clone https://github.com/balablair/xhs-ai-content-flow ~/.claude/skills/xhs-ai-content-flow
cd ~/.claude/skills/xhs-ai-content-flow/scripts
bun install
```

### 2. 安装依赖 Skill

本 Skill 依赖 [humanizer-zh](https://github.com/op7418/Humanizer-zh) 进行去 AI 痕迹处理，需单独安装：

```bash
git clone https://github.com/op7418/Humanizer-zh ~/.claude/skills/humanizer-zh
```

### 3. 初始化配图配置（首次使用）

```bash
bun ~/.claude/skills/xhs-ai-content-flow/scripts/md2xhs.ts --init \
  --name "你的小红书ID" \
  --avatar /path/to/avatar.jpg
```

配置保存到 `~/.md2xhsrc`，之后无需重复填写。

---

## 使用方式

在 Claude Code 或 Hermes 中直接描述需求：

```
帮我找几个 AI 效率方向的热点选题

用 xhs-ai-content-flow 写一篇关于「用 Claude 替代 50% 日常工作」的小红书

帮我把这篇草稿走完：去痕 → 配图 → 发布摘要
```

---

## 选题框架

| 类型 | 特征 | 适合场景 |
|------|------|---------|
| 蹭热点型 | 有明确事件/人物，立场清晰 | 快速响应 AI 圈新动态 |
| 反差故事型 | 反直觉、有冲突、有情绪张力 | 建立信任感和真实感 |
| 认知颠覆型 | 挑战主流共识 | 引发讨论，促转发 |
| 工具教程型 | 步骤清晰，有具体用法 | 搜索流量长尾 |
| 个人经历型 | 时间对比 + 真实踩坑细节 | 建立个人 IP |

---

## 配图规格

| 项目 | 值 |
|------|---|
| 尺寸 | 1080 × 1440px（3:4） |
| 字体 | PingFang SC |
| 字号 | 36px |
| 行距 | 1.8 |
| 分页逻辑 | 按像素高度贪心填充，ASCII 词不断行 |

---

## 依赖的开源项目

| 项目 | 用途 | 许可证 |
|------|------|--------|
| [humanizer-zh](https://github.com/op7418/Humanizer-zh) | 去除 AI 写作痕迹 | MIT |
| [follow-builders](https://github.com/wgafd/follow-builders) | 抓取 AI 圈热点推文 | MIT |
| [playwright-core](https://github.com/microsoft/playwright) | 无头 Chrome 渲染配图 | Apache 2.0 |
| [sun-md2xhs](https://github.com/sunxfancy/sun-md2xhs) | 配图渲染原型参考 | MIT |

`scripts/md2xhs.ts` 在 sun-md2xhs 基础上重写，主要改动：
- 修复 `space-between` 导致的页面内空白散布
- 段落按字符数填满页面，不在 ASCII 词中间断行
- 移除「」自动加粗，只保留 `**text**` 语法
- 统一高度：所有页取最大自然高度，留白落在底部

---

## 系统要求

- macOS（依赖系统 Chrome）
- [bun](https://bun.sh)
- Google Chrome（`/Applications/Google Chrome.app`）
