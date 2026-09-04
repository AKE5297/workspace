import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import config from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontPath = path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSansSC-Regular.ttf');

function resolveImagePath(src) {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  try {
    const m = /^\/uploads\/(.+)$/.exec(src);
    if (m) {
      const fp = path.join(config.uploadsDir, m[1]);
      return fs.existsSync(fp) ? fp : null;
    }
    return fs.existsSync(src) ? src : null;
  } catch (e) {
    return null;
  }
}

const FONT_SIZE = 11;
const LINE_GAP = 4;
const MARGIN = 50;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function splitParagraph(doc, text, size) {
  const lines = doc.widthOfString(text, { size }) > CONTENT_WIDTH
    ? doc.splitStringIntoLines(text, { size, width: CONTENT_WIDTH - 10 })
    : [text];
  for (const line of lines) {
    doc.text(line, { continued: false });
  }
}

function renderCodeBlock(doc, block) {
  const lineHeight = 14;
  const codeX = MARGIN + 8;
  const width = CONTENT_WIDTH - 16;
  const textWidth = width - 12;
  const height = Math.max(block.lines.length, 1) * lineHeight + 12;
  const y = doc.y;
  doc.save();
  doc.rect(codeX, y, width, height).fill('#f5f5f5');
  doc.restore();
  doc.fontSize(9).fillColor('#333333');
  block.lines.forEach((line, i) => {
    doc.text(line, codeX + 8, y + 6 + i * lineHeight, { width: textWidth, lineBreak: false });
  });
  doc.y = y + height;
  doc.moveDown(0.4);
}

function renderTable(doc, block) {
  const rows = block.rows;
  if (!rows.length) return;
  const colWidth = CONTENT_WIDTH / block.cols;
  const cellPad = 6;
  const lineHeight = 14;
  const headerRows = block.hasHeader ? 1 : 0;

  const colHeights = rows.map((row, ri) => {
    let maxH = lineHeight;
    row.forEach((cell, ci) => {
      const w = colWidth - cellPad * 2;
      const h = doc.heightOfString(cell, { width: w });
      if (h > maxH) maxH = h;
    });
    return maxH + cellPad * 2;
  });

  let y = doc.y;
  rows.forEach((row, ri) => {
    const h = colHeights[ri];
    let x = MARGIN;
    row.forEach((cell, ci) => {
      doc.save();
      doc.rect(x, y, colWidth, h).stroke('#cccccc');
      if (ri < headerRows) {
        doc.rect(x, y, colWidth, h).fill('#eef2f7');
      }
      doc.restore();
      doc.fillColor(ri < headerRows ? '#222222' : '#333333').fontSize(9);
      doc.text(cell, x + cellPad, y + cellPad, { width: colWidth - cellPad * 2, lineBreak: false });
      x += colWidth;
    });
    y += h;
  });
  doc.y = y;
  doc.moveDown(0.4);
}

function renderBlock(doc, block) {
  switch (block.type) {
    case 'heading': {
      const size = { 1: 22, 2: 18, 3: 15, 4: 13 }[block.level] || 12;
      doc.moveDown(0.6);
      doc.fontSize(size).fillColor('#111111').text(block.text, { continued: false });
      doc.moveDown(0.3);
      break;
    }
    case 'paragraph':
      doc.fontSize(FONT_SIZE).fillColor('#333333');
      splitParagraph(doc, block.text, FONT_SIZE);
      doc.moveDown(0.4);
      break;
    case 'quote':
      doc.moveDown(0.3);
      doc.fillColor('#555555');
      doc.fontSize(FONT_SIZE);
      const quoteX = MARGIN + 8;
      doc.save();
      doc.rect(quoteX - 8, doc.y, 3, doc.heightOfString(block.text, { width: CONTENT_WIDTH - 16 }));
      doc.fill('#409eff');
      doc.restore();
      doc.text(block.text, quoteX, doc.y, { width: CONTENT_WIDTH - 16 });
      doc.moveDown(0.4);
      break;
    case 'list': {
      doc.fontSize(FONT_SIZE).fillColor('#333333');
      block.items.forEach((item, i) => {
        const ordered = block.ordered ? `${i + 1}. ` : '• ';
        doc.text(ordered + item, { continued: false });
      });
      doc.moveDown(0.4);
      break;
    }
    case 'code':
      renderCodeBlock(doc, block);
      break;
    case 'table':
      renderTable(doc, block);
      break;
    case 'hr':
      doc.moveDown(0.4);
      doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_WIDTH, doc.y).strokeColor('#dddddd').stroke();
      doc.moveDown(0.4);
      break;
    case 'image': {
      doc.moveDown(0.3);
      const resolved = resolveImagePath(block.src);
      try {
        if (!resolved) throw new Error('no image');
        doc.image(resolved, { fit: [CONTENT_WIDTH - 20, 300] });
      } catch (e) {
        doc.fillColor('#999999').text('[图片]', { continued: false });
      }
      doc.moveDown(0.3);
      break;
    }
    default:
      break;
  }
}

function parseMarkdown(md) {
  const blocks = [];
  const lines = String(md || '').split('\n');
  let i = 0;
  const inCode = () => blocks[blocks.length - 1]?.type === 'code';

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      if (inCode()) {
        blocks.push({ type: 'paragraph', text: '' });
      } else {
        blocks.push({ type: 'code', lines: [] });
      }
      i++;
      continue;
    }
    if (inCode()) {
      blocks[blocks.length - 1].lines.push(line);
      i++;
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)/.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const text = line.replace(/^\s*>\s?/, '');
      blocks.push({ type: 'quote', text });
      i++;
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }
    if (/^!\[[^\]]*\]\(([^)]+)\)/.test(line)) {
      blocks.push({ type: 'image', src: /^!\[[^\]]*\]\(([^)]+)\)/.exec(line)[1] });
      i++;
      continue;
    }
    if (/^\s*\|/.test(line) && /^\s*\|.*\|\s*$/.test(line)) {
      const table = { type: 'table', cols: 0, hasHeader: false, rows: [] };
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i]
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
        if (/^:?-{2,}:?$/.test(cells[0] || '')) {
          table.hasHeader = table.rows.length > 0;
          i++;
          continue;
        }
        if (table.rows.length === 0) {
          table.hasHeader = true;
          table.cols = cells.length;
        }
        while (cells.length < table.cols) cells.push('');
        table.rows.push(cells.slice(0, table.cols));
        i++;
      }
      if (table.rows.length) blocks.push(table);
      continue;
    }
    if (/^\s*$/.test(line)) {
      if (blocks.length && blocks[blocks.length - 1].type === 'paragraph' && blocks[blocks.length - 1].text === '') {
        i++;
        continue;
      }
      blocks.push({ type: 'paragraph', text: '' });
      i++;
      continue;
    }

    if (blocks[blocks.length - 1]?.type === 'paragraph' && blocks[blocks.length - 1].text) {
      blocks[blocks.length - 1].text += ' ' + stripMd(line);
    } else {
      blocks.push({ type: 'paragraph', text: stripMd(line) });
    }
    i++;
  }
  return blocks.filter((b) => !(b.type === 'paragraph' && !b.text && !inCode()));
}

function stripMd(line) {
  return String(line || '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/^[-*+]\s+/, '');
}

export function mdToPdfBuffer(markdown, options = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: MARGIN, right: MARGIN },
      bufferPages: true
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    try {
      doc.registerFont('NotoSC', fontPath);
    } catch (e) {
      reject(new Error('中文字体加载失败'));
      return;
    }
    doc.font('NotoSC');

    const title = options.title || '';
    if (title) {
      doc.fontSize(24).fillColor('#000000').text(title, { continued: false });
      doc.moveDown(0.8);
      if (options.author) {
        doc.fontSize(10).fillColor('#888888').text(options.author, { continued: false });
        doc.moveDown(0.4);
      }
      if (options.url) {
        doc.fontSize(9).fillColor('#409eff').text(options.url, { continued: false });
        doc.moveDown(0.8);
      }
      doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_WIDTH, doc.y).strokeColor('#eeeeee').stroke();
      doc.moveDown(0.8);
    }

    const blocks = parseMarkdown(markdown);
    for (const block of blocks) {
      if (doc.y > PAGE_HEIGHT - 60) {
        doc.addPage();
      }
      renderBlock(doc, block);
    }

    const footer = options.footer || '';
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const pageNum = i - range.start + 1;
      doc.font('NotoSC');
      doc.fontSize(8).fillColor('#999999');
      if (footer) {
        doc.text(footer, MARGIN, PAGE_HEIGHT - 32, { width: CONTENT_WIDTH, align: 'center' });
      }
      doc.text(String(pageNum), MARGIN, PAGE_HEIGHT - 32, { width: CONTENT_WIDTH, align: 'right' });
      doc.moveTo(MARGIN, PAGE_HEIGHT - 42).lineTo(MARGIN + CONTENT_WIDTH, PAGE_HEIGHT - 42).strokeColor('#eeeeee').stroke();
    }
    doc.end();
  });
}
