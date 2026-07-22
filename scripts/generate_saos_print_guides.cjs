const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('@playwright/test');

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, 'docs', 'saos');
const SOURCE = path.join(DOCS_DIR, 'SAOS_HANDBOOK.md');
const STRATEGIC_ACCOUNTS_LOGO = path.resolve(ROOT, '..', 'Strategic-Ascent', 'svg', 'Strategic Ascent-05.svg');
const STRATEGIC_ACCOUNTS_WATERMARK = STRATEGIC_ACCOUNTS_LOGO;

const OUTPUTS = {
  userMd: path.join(DOCS_DIR, 'SAOS_USER_HANDBOOK.md'),
  leaderMd: path.join(DOCS_DIR, 'SAOS_LEADER_GUIDE.md'),
  userPdf: path.join(DOCS_DIR, 'SAOS_User_Handbook.pdf'),
  leaderPdf: path.join(DOCS_DIR, 'SAOS_Leader_Guide.pdf'),
};

const BRAND = {
  navy: '#051B2D',
  navy2: '#092E4C',
  teal: '#1181AA',
  lime: '#9CCA3C',
  ink: '#0F172A',
  slate: '#334155',
  muted: '#64748B',
  line: '#D9E3EC',
  panel: '#F8FAFC',
  amber: '#B45309',
};

function readSource() {
  return fs.readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n');
}

function sliceSection(source, startHeading, endHeading = null) {
  const start = source.indexOf(startHeading);
  if (start === -1) throw new Error(`Missing heading: ${startHeading}`);
  const end = endHeading ? source.indexOf(endHeading, start + startHeading.length) : source.length;
  if (endHeading && end === -1) throw new Error(`Missing heading: ${endHeading}`);
  return source.slice(start, end).trim();
}

function retitle(section, title) {
  return section.replace(/^# .+$/m, `# ${title}`);
}

function buildGuides(source) {
  const frontMatter = sliceSection(source, '# Strategic Account Operating System Handbook', '## The Rollout Conversation');
  const example = sliceSection(source, '## Example: Multi-Location Enterprise Pursuit', '## Facilitation Guide For Rollout');
  const faq = sliceSection(source, '## Frequently Asked Questions', '## Open Questions For Rollout');
  const closing = sliceSection(source, '## Closing Principle');

  const userGuide = [
    retitle(frontMatter, 'SAOS User Handbook'),
    '## Field Example',
    example.replace(/^## Example: Multi-Location Enterprise Pursuit/m, '### Multi-Location Enterprise Pursuit'),
    faq,
    closing,
  ].join('\n\n');

  const leaderIntro = [
    '# SAOS Leader Guide',
    '',
    '## Purpose',
    '',
    'This guide is for managers, directors, and executive sponsors responsible for rolling out, inspecting, coaching, and sustaining the Strategic Account Operating System.',
    '',
    'The user handbook explains how an individual contributor should think through the account. This leader guide explains how to turn that thinking into a team standard.',
  ].join('\n');

  const leaderGuide = [
    leaderIntro,
    sliceSection(source, '## The Rollout Conversation', '## Frequently Asked Questions'),
    faq,
    sliceSection(source, '## Open Questions For Rollout'),
  ].join('\n\n');

  fs.writeFileSync(OUTPUTS.userMd, `${userGuide.trim()}\n`);
  fs.writeFileSync(OUTPUTS.leaderMd, `${leaderGuide.trim()}\n`);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

const SECTION_DECKS = {
  Purpose: 'What SAOS is and why strategic account planning needs its own discipline.',
  'Why SAOS Exists': 'The business case for translating product strength into customer pressure.',
  'The Core Mindset': 'The beliefs behind stronger account judgment.',
  'How To Use The Handbook': 'How to apply the guide in planning, discussion, and inspection.',
  'GPC Strategic Account Profile': 'The account profile where SAOS creates the most leverage.',
  'Section Guide': 'The operating components of a complete strategic account plan.',
  'Field Example': 'A practical example of the thinking in context.',
  'Frequently Asked Questions': 'Common questions before the rollout conversation.',
  'Closing Principle': 'The simplest standard for strong strategic account plans.',
};

function toClassName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function dataUri(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function stampPdfWatermark(pdfPath, watermarkPath) {
  const script = `
import sys
from pathlib import Path
import fitz

pdf_path = Path(sys.argv[1])
watermark_path = Path(sys.argv[2])
width = float(sys.argv[3]) * 72
right = float(sys.argv[4]) * 72
bottom = float(sys.argv[5]) * 72
opacity = float(sys.argv[6])

svg_doc = fitz.open(str(watermark_path))
pix = svg_doc[0].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=True)
if pix.alpha:
    alpha = bytearray(pix.samples[pix.n - 1::pix.n])
    for index, value in enumerate(alpha):
        alpha[index] = round(value * opacity)
    pix.set_alpha(bytes(alpha), premultiply=0)

doc = fitz.open(pdf_path)
for page_number, page in enumerate(doc):
    if page_number == 0:
        continue
    rect = fitz.Rect(
        page.rect.x1 - right - width,
        page.rect.y1 - bottom - width,
        page.rect.x1 - right,
        page.rect.y1 - bottom,
    )
    page.insert_image(rect, pixmap=pix, overlay=True, keep_proportion=True)

tmp_path = pdf_path.with_suffix(".watermarked.pdf")
doc.save(tmp_path, garbage=4, deflate=True)
doc.close()
tmp_path.replace(pdf_path)
`;

  execFileSync('python3', ['-c', script, pdfPath, watermarkPath, '1.62', '0.34', '0.24', '0.055'], {
    stdio: 'inherit',
  });
}

function parseList(lines, startIndex, ordered) {
  const tag = ordered ? 'ol' : 'ul';
  const items = [];
  let i = startIndex;
  const pattern = ordered ? /^\d+\.\s+(.+)$/ : /^-\s+(.+)$/;

  while (i < lines.length) {
    const match = lines[i].match(pattern);
    if (!match) break;
    items.push(`<li>${inlineMarkdown(match[1])}</li>`);
    i += 1;
  }

  return {
    html: `<${tag}>\n${items.join('\n')}\n</${tag}>`,
    nextIndex: i,
  };
}

function markdownToHtml(markdown) {
  const lines = markdown.split('\n');
  const html = [];
  let paragraph = [];
  let sectionOpen = false;
  let cardOpen = false;
  let currentSectionTitle = '';
  let currentH4Title = '';
  let pendingQuoteType = '';

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function closeCard() {
    if (!cardOpen) return;
    html.push('</article>');
    cardOpen = false;
  }

  function closeSection() {
    closeCard();
    if (!sectionOpen) return;
    html.push('</section>');
    sectionOpen = false;
  }

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    if (line.startsWith('# ')) {
      flushParagraph();
      closeSection();
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      closeSection();
      currentSectionTitle = line.slice(3);
      currentH4Title = '';
      pendingQuoteType = '';
      const deck = SECTION_DECKS[currentSectionTitle];
      const sectionClasses = [
        'guide-section',
        `guide-section--${toClassName(currentSectionTitle)}`,
      ].join(' ');
      html.push(`<section class="${sectionClasses}"><h2>${inlineMarkdown(currentSectionTitle)}</h2>`);
      if (deck) {
        html.push(`<p class="section-deck">${inlineMarkdown(deck)}</p>`);
      }
      sectionOpen = true;
      continue;
    }

    if (line.startsWith('### ')) {
      flushParagraph();
      closeCard();
      currentH4Title = '';
      pendingQuoteType = '';
      const cardTitle = line.slice(4);
      const moduleMatch = currentSectionTitle === 'Section Guide' ? cardTitle.match(/^(\d+)\.\s+(.+)$/) : null;
      const cardClasses = ['guide-card'];
      if (moduleMatch) cardClasses.push('module-card');
      html.push(`<article class="${cardClasses.join(' ')}">`);
      if (moduleMatch) {
        html.push(`<h3><span class="module-number">${inlineMarkdown(moduleMatch[1])}</span><span>${inlineMarkdown(moduleMatch[2])}</span></h3>`);
      } else {
        html.push(`<h3>${inlineMarkdown(cardTitle)}</h3>`);
      }
      cardOpen = true;
      continue;
    }

    if (line.startsWith('#### ')) {
      flushParagraph();
      currentH4Title = line.slice(5);
      pendingQuoteType = '';
      html.push(`<h4 class="detail-heading detail-heading--${toClassName(currentH4Title)}">${inlineMarkdown(currentH4Title)}</h4>`);
      continue;
    }

    if (line.startsWith('> ')) {
      flushParagraph();
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2));
        i += 1;
      }
      i -= 1;
      const quoteType = pendingQuoteType || toClassName(currentH4Title);
      const quoteClass = quoteType ? ` class="quote quote--${quoteType}"` : ' class="quote"';
      html.push(`<blockquote${quoteClass}>${quoteLines.map((quoteLine) => inlineMarkdown(quoteLine)).join('<br>')}</blockquote>`);
      pendingQuoteType = '';
      continue;
    }

    if (/^(Weak|Strong):$/.test(line)) {
      flushParagraph();
      pendingQuoteType = line.replace(':', '').toLowerCase();
      html.push(`<p class="example-label example-label--${pendingQuoteType}">${inlineMarkdown(line)}</p>`);
      continue;
    }

    if (/^-\s+/.test(line)) {
      flushParagraph();
      const parsed = parseList(lines.map((entry) => entry.trim()), i, false);
      html.push(parsed.html);
      i = parsed.nextIndex - 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      const parsed = parseList(lines.map((entry) => entry.trim()), i, true);
      html.push(parsed.html);
      i = parsed.nextIndex - 1;
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  closeSection();
  return html.join('\n');
}

function getTitle(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1] : 'SAOS Guide';
}

function getToc(markdown) {
  return markdown
    .split('\n')
    .filter((line) => /^##\s+/.test(line))
    .map((line) => line.replace(/^##\s+/, '').trim());
}

function documentHtml(markdown, meta) {
  const title = getTitle(markdown);
  const toc = getToc(markdown);
  const body = markdownToHtml(markdown.replace(/^#\s+.+$/m, '').trim());
  const logo = dataUri(STRATEGIC_ACCOUNTS_LOGO);
  const watermark = dataUri(STRATEGIC_ACCOUNTS_WATERMARK);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: Letter;
      margin: 0.58in 0.62in 0.72in;
    }

    @page:first {
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: ${BRAND.ink};
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10.4pt;
      line-height: 1.48;
      background: white;
    }

    .print-header {
      position: fixed;
      top: -0.37in;
      left: 0;
      right: 0;
      z-index: 10;
      height: 0.28in;
      display: none;
      align-items: center;
      justify-content: space-between;
      font-size: 6.8pt;
      font-weight: 700;
      letter-spacing: 0.11em;
      text-transform: uppercase;
      color: ${BRAND.muted};
    }

    .print-header span:nth-child(2) {
      color: ${BRAND.teal};
    }

    .print-header img {
      width: 0.88in;
      height: auto;
      object-fit: contain;
    }

    .print-rule {
      display: none;
      position: fixed;
      top: -0.08in;
      left: 0;
      right: 0;
      height: 0.025in;
      z-index: 10;
      background: linear-gradient(90deg, ${BRAND.navy} 0 28%, ${BRAND.teal} 28% 60%, ${BRAND.lime} 60% 100%);
    }

    .page-watermark {
      position: fixed;
      right: 0.34in;
      bottom: 0.24in;
      width: 1.62in;
      height: 1.62in;
      background: url("${watermark}") center / contain no-repeat;
      opacity: 0.055;
      z-index: 0;
      pointer-events: none;
    }

    .cover,
    .print-header,
    .print-rule,
    .toc,
    .doc-body {
      position: relative;
      z-index: 1;
    }

    .cover {
      width: 8.5in;
      min-height: 11in;
      margin: 0;
      padding: 0;
      position: relative;
      overflow: hidden;
      color: ${BRAND.ink};
      background:
        radial-gradient(circle at 82% 18%, rgba(156, 202, 60, 0.16), transparent 2.55in),
        linear-gradient(90deg, #FFFFFF 0%, #F8FCFA 50%, #EEF9F2 76%, #DDF4E5 100%);
      break-after: page;
    }

    .cover::before {
      content: "";
      position: absolute;
      top: 0;
      right: 0;
      width: 4.2in;
      height: 11in;
      background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(17, 129, 170, 0.08));
    }

    .cover-content {
      position: relative;
      z-index: 1;
      width: 5.85in;
      padding: 0.76in 0 0 0.72in;
    }

    .cover-logo {
      display: block;
      width: 1.95in;
      height: auto;
      margin-bottom: 0.92in;
    }

    .eyebrow {
      margin: 0 0 0.16in;
      color: ${BRAND.teal};
      font-size: 7.5pt;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .accent {
      width: 0.9in;
      height: 0.045in;
      margin-bottom: 0.28in;
      background: ${BRAND.lime};
      border-radius: 99px;
    }

    .cover h1 {
      margin: 0;
      color: ${BRAND.ink};
      font-size: 32pt;
      line-height: 1.04;
      letter-spacing: -0.04em;
      font-weight: 800;
    }

    .subtitle {
      width: 4.85in;
      margin-top: 0.28in;
      color: ${BRAND.slate};
      font-size: 13pt;
      line-height: 1.45;
    }

    .cover-principles {
      display: flex;
      gap: 0.12in;
      flex-wrap: wrap;
      margin-top: 0.62in;
      width: 5.15in;
    }

    .cover-principles span {
      border: 1px solid ${BRAND.line};
      border-radius: 999px;
      padding: 0.075in 0.14in;
      color: ${BRAND.teal};
      background: rgba(255, 255, 255, 0.78);
      font-size: 7.6pt;
      font-weight: 800;
      letter-spacing: 0.065em;
      text-transform: uppercase;
    }

    .cover-footer {
      position: absolute;
      left: 0.72in;
      right: 0.72in;
      bottom: 0.56in;
      z-index: 1;
      border-top: 1px solid ${BRAND.line};
      padding-top: 0.18in;
      color: ${BRAND.muted};
      font-size: 7.4pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .toc {
      break-after: page;
      border-top: 0.035in solid ${BRAND.teal};
      padding: 0.14in 0 0;
      margin-bottom: 0.35in;
      background: white;
    }

    .toc h2 {
      margin-top: 0;
      break-before: auto;
      padding: 0;
      border: 0;
      border-radius: 0;
      color: ${BRAND.ink};
      background: transparent;
    }

    .toc-intro {
      max-width: 6.05in;
      margin: 0.08in 0 0.24in;
      color: ${BRAND.slate};
      font-size: 10pt;
    }

    .toc-list {
      columns: 2;
      column-gap: 0.62in;
      max-width: 6.9in;
      border-top: 1px solid ${BRAND.line};
      margin: 0;
      padding: 0.13in 0 0 0.2in;
    }

    .toc-list li {
      margin-bottom: 0.09in;
      padding-left: 0.03in;
      break-inside: avoid;
    }

    h2 {
      margin: 0 0 0.08in;
      padding: 0.14in 0 0;
      border-top: 0.035in solid ${BRAND.teal};
      color: ${BRAND.ink};
      background: transparent;
      font-size: 20pt;
      line-height: 1.12;
      letter-spacing: -0.025em;
      break-after: avoid;
    }

    .section-deck {
      max-width: 6.35in;
      margin: 0 0 0.24in;
      color: ${BRAND.slate};
      font-size: 11.1pt;
      line-height: 1.38;
    }

    .doc-body h2::before {
      content: "${meta.sectionLabel}";
      display: block;
      margin-bottom: 0.07in;
      color: ${BRAND.teal};
      font-size: 6.8pt;
      line-height: 1;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    h2:first-of-type {
      margin-top: 0;
    }

    h3 {
      margin: 0 0 0.14in;
      color: ${BRAND.navy};
      font-size: 15pt;
      line-height: 1.16;
      letter-spacing: -0.015em;
      break-after: avoid;
    }

    h4 {
      margin: 0.2in 0 0.06in;
      color: ${BRAND.teal};
      font-size: 8.8pt;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      break-after: avoid;
    }

    p {
      margin: 0 0 0.1in;
    }

    ul,
    ol {
      margin: 0.08in 0 0.16in 0.22in;
      padding: 0;
    }

    li {
      margin: 0 0 0.055in;
      padding-left: 0.03in;
    }

    li::marker {
      color: ${BRAND.teal};
      font-weight: 700;
    }

    blockquote {
      margin: 0.14in 0 0.18in;
      padding: 0.16in 0.18in;
      border-left: 0.055in solid ${BRAND.lime};
      border-radius: 0.07in;
      color: ${BRAND.ink};
      background: #FBFDF7;
      break-inside: avoid;
    }

    .quote--weak {
      border-left-color: ${BRAND.amber};
      background: #FFFBEB;
    }

    .quote--strong,
    .quote--good-example {
      border-left-color: ${BRAND.lime};
      background: #FBFDF7;
    }

    .quote--closing-principle {
      border-left-color: ${BRAND.teal};
      background: #F3FAFD;
      font-weight: 700;
    }

    .example-label {
      margin: 0.12in 0 0.05in;
      color: ${BRAND.slate};
      font-weight: 700;
    }

    .example-label--weak {
      color: ${BRAND.amber};
    }

    .example-label--strong {
      color: ${BRAND.teal};
    }

    .guide-section {
      break-before: page;
      padding-top: 0.08in;
    }

    .guide-section:first-child {
      break-before: auto;
    }

    .guide-section > p,
    .guide-section > ul,
    .guide-section > ol,
    .guide-section > blockquote {
      max-width: 7.05in;
    }

    .guide-card {
      position: relative;
      margin: 0.2in 0 0.22in;
      padding: 0.02in 0 0;
      background: transparent;
      break-inside: auto;
    }

    .guide-card + .guide-card {
      margin-top: 0.22in;
      padding-top: 0.18in;
      border-top: 1px solid ${BRAND.line};
    }

    .guide-section--section-guide .guide-card {
      margin-top: 0.18in;
    }

    .guide-section--section-guide .module-card {
      break-before: page;
      margin-top: 0;
      padding: 0.02in 0 0;
    }

    .guide-section--section-guide .module-card:first-of-type {
      break-before: auto;
    }

    .module-card h3 {
      display: flex;
      align-items: baseline;
      gap: 0.12in;
      padding-bottom: 0.08in;
      border-bottom: 1px solid ${BRAND.line};
    }

    .module-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 0.28in;
      height: 0.28in;
      border-radius: 999px;
      color: white;
      background: ${BRAND.teal};
      font-size: 9pt;
      line-height: 1;
      letter-spacing: 0;
    }

    .guide-card p:last-child,
    .guide-card ul:last-child,
    .guide-card ol:last-child,
    .guide-card blockquote:last-child {
      margin-bottom: 0;
    }

    .guide-card h4 {
      margin-top: 0.16in;
      padding-top: 0.12in;
      border-top: 1px solid ${BRAND.line};
    }

    .guide-card h4:first-of-type {
      margin-top: 0;
      padding-top: 0;
      border-top: none;
    }

    code {
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 0.94em;
      color: ${BRAND.navy2};
      background: ${BRAND.panel};
      border: 1px solid ${BRAND.line};
      border-radius: 0.03in;
      padding: 0.01in 0.035in;
    }

    strong {
      color: ${BRAND.ink};
    }

    h3 + h4,
    h4 + p,
    h4 + ul,
    h4 + ol {
      break-before: avoid;
    }

    h3,
    h4,
    blockquote,
    li {
      break-inside: avoid;
    }

    .doc-body > p,
    .doc-body > ul,
    .doc-body > ol,
    .doc-body > blockquote {
      max-width: 7.05in;
    }

    @media print {
      .page-watermark {
        display: none;
      }

      .cover + .print-header,
      .cover + .print-header + .print-rule {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="page-watermark" aria-hidden="true"></div>
  <section class="cover">
    <div class="cover-content">
      <img class="cover-logo" src="${logo}" alt="Strategic Accounts">
      <p class="eyebrow">Strategic Accounts</p>
      <div class="accent"></div>
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(meta.subtitle)}</p>
      <div class="cover-principles">
        <span>Account Selection</span>
        <span>Operating Discipline</span>
        <span>Executive Trust</span>
      </div>
    </div>
    <div class="cover-footer">Strategic Account Operating System</div>
  </section>
  <div class="print-header">
    <span>${escapeHtml(meta.runningLeft)}</span>
    <span>${escapeHtml(meta.runningDoc)}</span>
    <img src="${logo}" alt="">
  </div>
  <div class="print-rule" aria-hidden="true"></div>
  <section class="toc">
    <h2>Contents</h2>
    <p class="toc-intro">The handbook follows the SAOS conversation from purpose and mindset through the practical sections used in account planning.</p>
    <ol class="toc-list">
      ${toc.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('\n')}
    </ol>
  </section>
  <main class="doc-body">
    ${body}
  </main>
</body>
</html>`;
}

async function writePdf(markdownPath, pdfPath, meta) {
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  const html = documentHtml(markdown, meta);
  const htmlPath = pdfPath.replace(/\.pdf$/i, '.html');
  fs.writeFileSync(htmlPath, html);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({
    path: pdfPath,
    format: 'Letter',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
  });
  stampPdfWatermark(pdfPath, STRATEGIC_ACCOUNTS_WATERMARK);
  await browser.close();
}

async function main() {
  const source = readSource();
  buildGuides(source);

  await writePdf(OUTPUTS.userMd, OUTPUTS.userPdf, {
    subtitle: 'Field handbook for strategic account planning',
    audience: 'For account owners, specialists, sales engineers, and pursuit teams.',
    runningLeft: 'Great Plains Communications',
    runningDoc: 'SAOS User Handbook',
    sectionLabel: 'SAOS User Handbook',
    footerLeft: 'SAOS User Handbook',
  });

  await writePdf(OUTPUTS.leaderMd, OUTPUTS.leaderPdf, {
    subtitle: 'Rollout and coaching guide for strategic account leaders',
    audience: 'For managers, directors, executive sponsors, and team facilitators.',
    runningLeft: 'Great Plains Communications',
    runningDoc: 'SAOS Leader Guide',
    sectionLabel: 'SAOS Leader Guide',
    footerLeft: 'SAOS Leader Guide',
  });

  console.log(`Wrote ${path.relative(ROOT, OUTPUTS.userMd)}`);
  console.log(`Wrote ${path.relative(ROOT, OUTPUTS.leaderMd)}`);
  console.log(`Wrote ${path.relative(ROOT, OUTPUTS.userPdf)}`);
  console.log(`Wrote ${path.relative(ROOT, OUTPUTS.leaderPdf)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
