# xhs-ai-content-flow

> 从热点到发布，一条龙的小红书 AI 内容工作流。给 Claude Code / Hermes 用的 Skill。

大多数 AI 写作工具只解决「写」这一步。写完之后你还要：判断选题、改 AI 味、排版成图、想标题、写摘要。每一步都要自己来，工具切来切去。

这个 Skill 把五步打包成一个完整的流程，每步都有人工审阅节点，最后直接输出能发的东西。

---

## 产物长什么样

跑完一次，你得到：

```
输出目录/
  article-01.png   ← 小红书配图，1080×1440，白底 PingFang 字体
  article-02.png
  article-03.png
  发布版.txt        ← 推荐标题 + 备选标题×3 + 摘要正文 + tags
```

配图和发布文案全部就位，复制粘贴就能发。

<img width="800" height="1144" alt="0a7c689ca023cc9617c467d26285d403" src="https://github.com/user-attachments/assets/a975323c-5531-4d26-90c6-eb26fb4780e9" /><img width="800" height="1144" alt="5b22ceae17f4577b2c095204798a1adb" src="https://github.com/user-attachments/assets/71aebd6e-f1fa-436e-a6a3-01b10875b989" />

---

## 工作流

五步走完，每步都会停下来等你确认，不会自动跑完全程：

```
① 热点发现   →  从 AI Builder 圈的推文里抓热点，筛出 3-5 个候选选题
      ↓
   [你来选题目和角度]
      ↓
② 正文写作   →  按小红书「短文流」结构写，不是博客那种分段章节
      ↓
   [你来审内容，可以要求改角度、补细节]
      ↓
③ 去 AI 味   →  调用 humanizer-zh，去掉「此外」「值得注意的是」这类 AI 腔
      ↓
   [你来确认语气是否自然]
      ↓
④ 配图生成   →  Markdown 转小红书风格长图，自动分页，每页留至少一处加粗
      ↓
⑤ 发布摘要   →  生成标题备选 + 300-400字摘要 + 话题标签，写入 发布版.txt
```

---

## 亮点

**不只是「AI 写作」，是内容生产 SOP**

选题 → 写稿 → 去痕 → 配图 → 发布文案，完整链路封装在一个 Skill 里。每个节点都有明确的人工确认点，你不是在审 AI 的输出，是在做决策。

**去 AI 味是必经步骤，不是可选项**

去痕（humanizer-zh）是强制流程，不能跳过。目标是去掉「填充短语」「否定式排比」「金句腔」，让文章读起来像真人在说话。

**配图渲染经过专门优化**

内置渲染脚本（基于 [sun-md2xhs](https://github.com/sunxfancy/sun-md2xhs) 深度修改）：
- 段落按像素高度贪心填充，最大化每页内容密度
- ASCII 词（版本号、英文、URL）不会被截断在中间
- 统一页面高度，留白落在底部，不会出现内容中间有大空白
- 每页至少一处整句加粗，保持阅读节奏

**产物直接可用**

不是「帮你生成草稿」，是「帮你生成发布包」。配图 + 发布文案同时输出，不需要再做额外处理。

---

## 安装

**要求：** macOS、[bun](https://bun.sh)、Google Chrome

```bash
# 1. 克隆 skill
git clone https://github.com/balablair/xhs-ai-content-flow ~/.claude/skills/xhs-ai-content-flow

# 2. 安装渲染依赖
cd ~/.claude/skills/xhs-ai-content-flow/scripts && bun install

# 3. 安装去痕 skill（必须）
git clone https://github.com/op7418/Humanizer-zh ~/.claude/skills/humanizer-zh

# 4. 初始化配图信息（只需一次）
bun ~/.claude/skills/xhs-ai-content-flow/scripts/md2xhs.ts --init \
  --name "你的小红书ID" \
  --avatar /path/to/avatar.jpg
```

---

## 使用

在 Claude Code 或 Hermes 里直接说：

```
帮我找几个 AI 效率方向的热点选题

用 xhs-ai-content-flow 写一篇关于「用 Claude 替代 50% 日常工作」的小红书

帮我把这篇草稿走完：去痕 → 配图 → 发布摘要
```

---

## 依赖的开源项目

| 项目 | 用途 |
|------|------|
| [humanizer-zh](https://github.com/op7418/Humanizer-zh) | 去除 AI 写作痕迹 |
| [follow-builders](https://github.com/wgafd/follow-builders) | 抓取 AI 圈热点推文 |
| [playwright-core](https://github.com/microsoft/playwright) | 无头 Chrome 渲染配图 |
| [sun-md2xhs](https://github.com/sunxfancy/sun-md2xhs) | 配图渲染原型 |

---

## 适合谁用

- 在小红书发 AI / 效率内容的创作者
- 想把 AI 写作工具用起来但总觉得「写出来不像自己」的人
- 需要稳定内容产出节奏、不想每次都从零开始的人
