import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'frontend', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });
const backendModules = path.join(root, 'backend', 'node_modules');

// 生成简单的 PNG 图标（蓝色底 + 白色剪刀图形，用 SVG 转 PNG 由 sharp 处理）
const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#409eff"/>
  <g stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="34" cy="66" r="10" fill="#fff"/>
    <circle cx="66" cy="66" r="10" fill="#fff"/>
    <path d="M40 62 L70 30"/>
    <path d="M60 62 L30 30"/>
    <path d="M44 60 L56 52"/>
  </g>
</svg>`;

for (const size of [192, 512]) {
  const svgContent = svg(size);
  const out = path.join(outDir, `icon-${size}.png`);
  try {
    const sharp = (await import(path.join(backendModules, 'sharp', 'lib', 'index.js'))).default;
    await sharp(Buffer.from(svgContent)).png().toFile(out);
    console.log(`[icons] generated ${out}`);
  } catch (e) {
    console.warn(`[icons] sharp 不可用（${e.message}），跳过生成`);
  }
}

// 同时复制到扩展目录
fs.mkdirSync(path.join(root, 'extension'), { recursive: true });
for (const size of [192, 512]) {
  const src = path.join(outDir, `icon-${size}.png`);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(root, 'extension', `icon-${size}.png`));
  }
}
