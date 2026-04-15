#!/usr/bin/env bun
/**
 * md2xhs — Markdown → Xiaohongshu-style image cards
 *
 * First-time setup (saves name & avatar to ~/.md2xhsrc):
 *   bun md2xhs.ts --init --name "你的名字" --avatar /path/to/avatar.jpg
 *
 * Usage:
 *   bun md2xhs.ts <input.md> [options]
 *
 * Options:
 *   --out <dir>        Output directory (default: ./output)
 *   --avatar <path>    Avatar image path (overrides config)
 *   --name <name>      Display name (overrides config)
 *   --date <date>      Date string (default: today)
 *   --width <px>       Card width in px (default: 1080, height = width * 4/3)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, basename, extname } from "node:path";
import { spawnSync } from "node:child_process";

// ─── Environment checks ────────────────────────────────────────────────────

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!existsSync(CHROME_PATH)) {
  console.error("Error: Google Chrome not found.");
  console.error(`  Expected: ${CHROME_PATH}`);
  console.error("  Install from: https://www.google.com/chrome/");
  process.exit(1);
}

let chromium: import("playwright-core").BrowserType;
try {
  ({ chromium } = await import("playwright-core"));
} catch {
  console.log("playwright-core not found, installing...");
  const r = spawnSync("bun", ["add", "playwright-core"], {
    cwd: import.meta.dir,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.error("Failed to install playwright-core. Run manually: bun add playwright-core");
    process.exit(1);
  }
  ({ chromium } = await import("playwright-core"));
}

// ─── Config file ───────────────────────────────────────────────────────────

const CONFIG_PATH = resolve(process.env.HOME || "~", ".md2xhsrc");

interface Config {
  name?: string;
  avatar?: string;
}

function loadConfig(): Config {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(cfg: Config): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
}

// ─── CLI args ──────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

function getArg(flag: string, fallback: string): string {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1]! : fallback;
}

// ── --init mode ────────────────────────────────────────────────────────────
if (argv.includes("--init")) {
  const name = getArg("--name", "");
  const avatar = getArg("--avatar", "");
  if (!name || !avatar) {
    console.error("Usage: bun md2xhs.ts --init --name \"你的名字\" --avatar /path/to/avatar.jpg");
    process.exit(1);
  }
  if (!existsSync(resolve(avatar))) {
    console.error(`Error: avatar file not found: ${avatar}`);
    process.exit(1);
  }
  saveConfig({ name, avatar: resolve(avatar) });
  console.log(`✓ Config saved to ${CONFIG_PATH}`);
  console.log(`  name:   ${name}`);
  console.log(`  avatar: ${resolve(avatar)}`);
  process.exit(0);
}

// ── Normal mode ────────────────────────────────────────────────────────────
const config = loadConfig();

const inputFile = argv.find((a) => !a.startsWith("--") && a.endsWith(".md"));
if (!inputFile) {
  console.error("Usage: bun md2xhs.ts <input.md> [--out <dir>] [--avatar <path>] [--name <name>] [--date <date>] [--width <px>]");
  console.error("First time? Run: bun md2xhs.ts --init --name \"你的名字\" --avatar /path/to/avatar.jpg");
  process.exit(1);
}

const inputPath = resolve(inputFile);
const outDir = resolve(getArg("--out", "./output"));
const avatarPath = getArg("--avatar", config.avatar || "");
const displayName = getArg("--name", config.name || "");

if (!displayName) {
  console.error("Error: --name is required (or run --init to save it once).");
  process.exit(1);
}
if (!avatarPath) {
  console.error("Error: --avatar is required (or run --init to save it once).");
  process.exit(1);
}

const cardWidth = parseInt(getArg("--width", "1080"), 10);
const cardHeight = Math.round(cardWidth * 4 / 3); // 3:4 ratio

const rawDate = getArg("--date", "");
const today = rawDate || (() => {
  const d = new Date();
  return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, "0")}月${String(d.getDate()).padStart(2, "0")}日`;
})();

// ─── Parse Markdown ────────────────────────────────────────────────────────

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[] };

function parseMarkdown(md: string): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed || /^---+$/.test(trimmed)) { i++; continue; }

    const hm = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      blocks.push({ type: "heading", level: hm[1]!.length, text: hm[2]! });
      i++;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const parts: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith(">")) {
        parts.push(lines[i]!.trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", text: parts.join(" ") });
      continue;
    }

    if (/^[-*+]\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i]!)) {
        items.push(lines[i]!.trim().replace(/^[-*+]\s/, ""));
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    // Hash-tag lines (e.g. "#AI #认知 #Agent")
    if (/^#[\w\u4e00-\u9fa5]+(\s+#[\w\u4e00-\u9fa5]+)*$/.test(trimmed)) {
      blocks.push({ type: "tag", text: trimmed });
      i++;
      continue;
    }

    blocks.push({ type: "paragraph", text: trimmed });
    i++;
  }

  return blocks;
}

// ─── Render inline markdown ────────────────────────────────────────────────

function renderInline(text: string): string {
  let s = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // **bold**
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return s;
}

// ─── Avatar → base64 ──────────────────────────────────────────────────────

function avatarToBase64(path: string): string {
  try {
    const buf = readFileSync(path);
    const ext = extname(path).slice(1).toLowerCase();
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

const avatarDataUrl = avatarToBase64(avatarPath);

// ─── Block → inner HTML ────────────────────────────────────────────────────

const CARD_PAD = 48;  // horizontal & top padding
const CONTENT_WIDTH = cardWidth - CARD_PAD * 2;

// ─── Compact spacing: reduced line-height + tighter gaps ──────────────────────
const BLOCK_GAP = 24;       // was 42 — tighter between-block spacing
const HEADER_GAP = 24;       // was 36 — tighter header-to-content gap

function blockToInnerHtml(block: Block): string {
  switch (block.type) {
    case "heading": {
      const size = block.level <= 2 ? "1.15em" : "1em";
      return `<p class="block heading" style="font-size:${size};font-weight:700;">${renderInline(block.text)}</p>`;
    }
    case "paragraph":
      return `<p class="block para">${renderInline(block.text)}</p>`;
    case "quote":
      return `<p class="block para" style="color:#555;">${renderInline(block.text)}</p>`;
    case "list": {
      const items = block.items.map((item) => `<li>${renderInline(item)}</li>`).join("");
      return `<ul class="block list">${items}</ul>`;
    }
    case "tag": {
      // Each tag gets its own span with blue color and spacing
      const tags = block.text.split(/\s+/).filter(Boolean);
      const tagSpans = tags.map(t => `<span style="color:#4F62E8;font-size:34px;margin-right:16px;">${t}</span>`).join("");
      return `<div class="block tags">${tagSpans}</div>`;
    }
  }
}

// ─── Shared CSS ────────────────────────────────────────────────────────────

function cardCss(fixedHeight?: number): string {
  const heightCss = fixedHeight ? `height: ${fixedHeight}px;` : `height: auto;`;
  return `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${cardWidth}px;
    background: #ffffff;
    font-family: -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    color: #1a1a1a;
  }
  .card {
    width: ${cardWidth}px;
    ${heightCss}
    background: #fff;
    display: flex;
    flex-direction: column;
    padding: ${CARD_PAD}px ${CARD_PAD}px 40px;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: ${HEADER_GAP}px;
    flex-shrink: 0;
  }
  .avatar { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .meta { display: flex; flex-direction: column; gap: 6px; }
  .name-row { display: flex; align-items: center; gap: 8px; }
  .name { font-size: 40px; font-weight: 600; color: #1a1a1a; line-height: 1.2; }
  .verified { width: 36px; height: 36px; flex-shrink: 0; }
  .date { font-size: 32px; color: #999; line-height: 1.2; }
  .content { flex: 1; color: #1a1a1a; font-size: 36px; display: flex; flex-direction: column; justify-content: flex-start; gap: ${BLOCK_GAP}px; }
  .block { margin-bottom: 0; }
  .para { font-size: 36px; line-height: 1.8; }
  .heading { line-height: 1.5; }
  .list { list-style: none; padding: 0; font-size: 36px; line-height: 1.8; counter-reset: list-counter; }
  .list li { padding-left: 1.5em; margin-bottom: 6px; position: relative; counter-increment: list-counter; }
  .list li::before { content: counter(list-counter); position: absolute; left: 0; font-weight: 700; }
  .tags { margin-top: 48px; }
  strong { font-weight: 700; }
  `;
}

// ─── Measurement HTML ──────────────────────────────────────────────────────

function generateMeasureHtml(blocks: Block[]): string {
  const avatarHtml = avatarDataUrl
    ? `<img class="avatar" src="${avatarDataUrl}" />`
    : `<div class="avatar" style="background:#eee;"></div>`;

  // Each block in its own wrapper; since each .block is the only child of its wrapper,
  // :last-child applies → margin-bottom: 0. We measure pure content height, add BLOCK_GAP separately.
  const blocksHtml = blocks.map((b, i) =>
    `<div id="b${i}" style="width:${CONTENT_WIDTH}px;">${blockToInnerHtml(b)}</div>`
  ).join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
${cardCss()}
</style>
</head>
<body>
<!-- Empty card: measures chrome (header + footer + padding) -->
<div class="card" id="chrome-card">
  <div class="header">
    ${avatarHtml}
    <div class="meta">
      <div class="name-row">
        <span class="name">${displayName}</span>
        <svg class="verified" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="12" fill="#1890ff"/>
          <path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="date">${today}</span>
    </div>
  </div>
  <div class="content" style="flex:0;height:0;"></div>
</div>
<!-- Blocks for individual height measurement -->
<div id="measure-blocks" style="padding:0;">
${blocksHtml}
</div>
</body></html>`;
}

// ─── Pixel-based greedy pagination with paragraph splitting ───────────────────

const FONT_SIZE_PX = 36;
const LINE_HEIGHT_RATIO = 1.8;
const LINE_HEIGHT_PX = FONT_SIZE_PX * LINE_HEIGHT_RATIO; // ~64.8px per line
const CHARS_PER_LINE = Math.floor((cardWidth - CARD_PAD * 2) / FONT_SIZE_PX); // ~27 chars/line

// Split a paragraph so the first part fits within remainingHeight.
// Returns [firstPart, remainder] or null if split isn't worthwhile.
function splitParagraph(text: string, remainingHeight: number): [string, string] | null {
  const linesAvailable = Math.floor(remainingHeight / LINE_HEIGHT_PX);
  if (linesAvailable < 2) return null; // not worth splitting for < 2 lines

  // +1 line buffer: ASCII chars are narrower than Chinese so pure char-count
  // underestimates capacity; the extra slack is absorbed by unified height.
  const targetChars = (linesAvailable + 1) * CHARS_PER_LINE;
  if (targetChars >= text.length) return null; // whole thing fits anyway

  // Don't break mid-ASCII-token (e.g. "kimi-k2p5-rl-0317", URLs, version strings).
  // If the cut point lands inside an ASCII word, back up to the word's start.
  let splitAt = Math.min(targetChars, text.length);
  const isAsciiWordChar = (c: string) => /[a-zA-Z0-9\-_.%+@#]/.test(c);
  if (splitAt < text.length && isAsciiWordChar(text[splitAt]!)) {
    while (splitAt > 0 && isAsciiWordChar(text[splitAt - 1]!)) splitAt--;
  }

  const first = text.slice(0, splitAt).trim();
  const rest = text.slice(splitAt).trim();
  if (!first || !rest) return null;
  return [first, rest];
}

// If placing a heading would leave < MIN_HEADING_KEEP_FRACTION of the page unfilled,
// push it to the next page to avoid orphaned headings.
const MIN_HEADING_KEEP_FRACTION = 0.30;

function paginateByPixels(blocks: Block[], blockHeights: number[], availableHeight: number): Block[][] {
  const pages: Block[][] = [];
  let current: Block[] = [];
  let usedHeight = 0;

  for (let i = 0; i < blocks.length; i++) {
    const bh = blockHeights[i]!;
    const block = blocks[i]!;
    const isHeading = block.type === "heading";
    const currentRemaining = availableHeight - usedHeight;

    // Smart lookahead for headings
    if (isHeading && current.length > 0 && bh > currentRemaining * MIN_HEADING_KEEP_FRACTION) {
      pages.push(current);
      current = [];
      usedHeight = 0;
    }

    current.push(block);
    usedHeight = current.length === 1 ? bh : usedHeight + BLOCK_GAP + bh;

    // If we've overshot, try to split paragraph, otherwise push whole block to next page
    if (usedHeight > availableHeight && current.length > 1) {
      const overflowBlock = current.pop()!;
      usedHeight -= BLOCK_GAP + bh;

      // Try splitting paragraph to fill remaining space
      if (overflowBlock.type === "paragraph") {
        const remainingOnPage = availableHeight - usedHeight - BLOCK_GAP;
        const split = splitParagraph(overflowBlock.text, remainingOnPage);
        if (split) {
          const [firstPart, restPart] = split;
          current.push({ type: "paragraph", text: firstPart });
          pages.push(current);
          current = [{ type: "paragraph", text: restPart }];
          usedHeight = blockHeights[i]! - (remainingOnPage > 0 ? remainingOnPage : 0);
          continue;
        }
      }

      // No split: push overflow block to next page entirely
      if (usedHeight === 0) {
        current = [overflowBlock];
        usedHeight = bh;
      } else {
        pages.push(current);
        current = [overflowBlock];
        usedHeight = bh;
      }
    }
  }

  if (current.length > 0) pages.push(current);
  return pages;
}

// ─── Page HTML ────────────────────────────────────────────────────────────

function generatePageHtml(blocks: Block[], pageIndex: number, totalPages: number, fixedHeight: number): string {
  const contentHtml = blocks.map(b => blockToInnerHtml(b)).join("\n");

  const avatarHtml = avatarDataUrl
    ? `<img class="avatar" src="${avatarDataUrl}" />`
    : `<div class="avatar" style="background:#eee;"></div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${cardCss(fixedHeight)}</style>
</head>
<body>
<div class="card">
  <div class="header">
    ${avatarHtml}
    <div class="meta">
      <div class="name-row">
        <span class="name">${displayName}</span>
        <svg class="verified" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="12" fill="#1890ff"/>
          <path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="date">${today}</span>
    </div>
  </div>
  <div class="content">
    ${contentHtml}
  </div>
</div>
</body>
</html>`;
}

// ─── Main ──────────────────────────────────────────────────────────────────

const md = readFileSync(inputPath, "utf8");
const blocks = parseMarkdown(md);
let totalPages = 0;

mkdirSync(outDir, { recursive: true });
const tmpDir = `${outDir}/.tmp-html`;
mkdirSync(tmpDir, { recursive: true });

const slugBase = basename(inputPath, extname(inputPath));

const browser = await chromium.launch({
  executablePath: CHROME_PATH,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  // ── Pass 0: measure chrome height + each block's pixel height ─────────────
  const measureHtmlPath = resolve(`${tmpDir}/measure.html`);
  writeFileSync(measureHtmlPath, generateMeasureHtml(blocks), "utf8");

  const measurePage = await browser.newPage();
  let blockHeights: number[] = [];
  let chromeHeight = 0;

  try {
    await measurePage.setViewportSize({ width: cardWidth, height: 8000 });
    await measurePage.goto(`file://${measureHtmlPath}`, { waitUntil: "load" });

    const result = await measurePage.evaluate((count: number) => {
      const chrome = document.getElementById("chrome-card")!.getBoundingClientRect().height;
      const heights: number[] = [];
      for (let i = 0; i < count; i++) {
        const el = document.getElementById(`b${i}`);
        heights.push(el ? el.getBoundingClientRect().height : 0);
      }
      return { chrome, heights };
    }, blocks.length);

    chromeHeight = Math.ceil(result.chrome);
    blockHeights = result.heights.map(h => Math.ceil(h));
  } finally {
    await measurePage.close();
  }

  const availableHeight = cardHeight - chromeHeight;
  console.log(`Chrome: ${chromeHeight}px, content area: ${availableHeight}px`);

  // ── Pixel-based pagination ────────────────────────────────────────────────
  const pages = paginateByPixels(blocks, blockHeights, availableHeight);
  totalPages = pages.length;
  console.log(`Parsed ${blocks.length} blocks → ${pages.length} pages`);

  // ── Pass 1: measure natural heights (handles overflow edge cases) ──────────
  const naturalHeights: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    const html = generatePageHtml(pages[i]!, i, pages.length, cardHeight);
    const htmlPath = resolve(`${tmpDir}/${slugBase}-${String(i + 1).padStart(2, "0")}.html`);
    writeFileSync(htmlPath, html, "utf8");

    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: cardWidth, height: cardHeight + 2000 });
      await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
      const h = await page.evaluate(() => {
        const card = document.querySelector(".card") as HTMLElement | null;
        return card ? card.scrollHeight : document.body.scrollHeight;
      });
      naturalHeights.push(h);
    } finally {
      await page.close();
    }
  }

  // Unified height: at least cardHeight, expand if any page overflows
  const maxHeight = Math.max(cardHeight, ...naturalHeights);
  console.log(`Unified height: ${maxHeight}px`);

  // ── Pass 2: render final images ────────────────────────────────────────────
  for (let i = 0; i < pages.length; i++) {
    const html = generatePageHtml(pages[i]!, i, pages.length, maxHeight);
    const htmlPath = resolve(`${tmpDir}/${slugBase}-${String(i + 1).padStart(2, "0")}.html`);
    const pngPath = resolve(`${outDir}/${slugBase}-${String(i + 1).padStart(2, "0")}.png`);

    writeFileSync(htmlPath, html, "utf8");

    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: cardWidth, height: maxHeight });
      await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
      await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: cardWidth, height: maxHeight } });
      console.log(`✓ Page ${i + 1}/${pages.length}: ${basename(pngPath)} (${maxHeight}px)`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

console.log(`\nDone! ${totalPages} images → ${outDir}`);
