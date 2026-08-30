import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontPath = path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSansSC-Regular.ttf');

const FONT_SIZE = 11;
const LINE_GAP = 4;
const MARGIN = 50;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function splitParagraph(doc, text, size) {
  const lines = doc.widthOfString(text, { size }) > CONTENT_WIDTH
    ? doc.splitStringIntoLines(text, { size, width: CONTENT_WIDTH - 10 })
    : [text];
  for (const line of lines) {
    doc.text(line, { continued: false });
  }
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
      doc.fontSize(9).fillColor('#333333');
      block.lines.forEach((line) => {
        doc.text(line, MARGIN + 12, doc.y, { width: CONTENT_WIDTH - 24 });
      });
      doc.moveDown(0.4);
      break;
    case 'hr':
      doc.moveDown(0.4);
      doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_WIDTH, doc.y).strokeColor('#dddddd').stroke();
      doc.moveDown(0.4);
      break;
    case 'image':
      doc.moveDown(0.3);
      try {
        doc.image(block.src, { fit: [CONTENT_WIDTH - 20, 300] });
      } catch (e) {
        doc.fillColor('#999999').text('[图片]', { continued: false });
      }
      doc.moveDown(0.3);
      break;
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
      if (doc.y > doc.page.height - 60) {
        doc.addPage();
      }
      renderBlock(doc, block);
    }
    doc.end();
  });
}
