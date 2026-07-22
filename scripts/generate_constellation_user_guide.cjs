const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('@playwright/test');

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'docs', 'CONSTELLATION_CRM_USER_HANDBOOK.md');
const OUTPUT_HTML = path.join(ROOT, 'docs', 'CONSTELLATION_CRM_USER_HANDBOOK.html');
const OUTPUT_PDF = path.join(ROOT, 'docs', 'Constellation_CRM_User_Handbook.pdf');
const CONSTELLATION_LOGO = path.join(ROOT, 'assets', 'constellation-logo-full.svg');
const CONSTELLATION_WATERMARK = path.join(ROOT, 'assets', 'constellation-logo-c.svg');

const BRAND = {
  blue: '#3B82F6',
  blueDark: '#1D4ED8',
  iconBlue: '#377FED',
  slate: '#334155',
  ink: '#0F172A',
  muted: '#64748B',
  line: '#E2E8F0',
  panel: '#F8FAFC',
  softBlue: '#EFF6FF',
  white: '#FFFFFF',
};

const SECTION_DECKS = {
  Purpose: 'What this guide covers and what it intentionally leaves out.',
  'The Big Idea': 'Why Constellation exists as an operating layer for sales work.',
  'How To Use This Handbook': 'How to use the guide for onboarding, daily reference, and quality checks.',
  '1. Navigation, Search, And User Menu': 'How to move through Constellation and find records fast.',
  '2. Command Center: Your Daily Starting Point': 'The daily hub for priorities, tasks, sequence steps, and recent work.',
  '3. Contacts: Your Relationship Hub': 'The person-level workspace for outreach, sequence status, activity, and AI support.',
  '4. Accounts: Your 360-Degree Company View': 'The company-level view of contacts, deals, proposals, intelligence, and strategy.',
  '5. Deals: Pipeline, Forecasting, And Board View': 'Forecast, update, filter, and inspect pipeline health.',
  '6. Campaigns: Curated Outreach Sprints': 'Short, intentional outreach runs for focused contact lists.',
  '7. Sequences: Multi-Touch Playbooks': 'Reusable follow-up paths built once and executed over time.',
  '8. Cognito Intelligence: Turn Account News Into Outreach': 'Account news and buying signals converted into outreach and follow-up.',
  '9. Social Hub: Share Curated Content On LinkedIn': 'Rep-facing content sharing for relevant news and marketing posts.',
  '10. Multi-Site IRR Calculator: Modeling, Approval, And Exports': 'Financial modeling for complex multi-site opportunities.',
  '11. Enterprise Proposal Builder: Modules, Pricing, And PDF Delivery': 'Customer-ready proposal assembly, pricing, and PDF generation.',
  '12. Strategic Account OS: When To Leave The Main CRM': 'When tactical CRM work becomes strategic account planning.',
  '13. Import, Export, And External Systems': 'How Constellation connects to CSV, Salesforce, ZoomInfo, and LinkedIn.',
  '14. What Good CRM Usage Looks Like': 'Practical standards for daily, weekly, meeting, forecast, and proposal hygiene.',
  '15. Common Questions': 'Quick answers to common CRM usage questions.',
  'Closing Principle': 'The simplest standard for useful CRM work.',
};

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

function toClassName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseList(lines, startIndex, ordered) {
  const tag = ordered ? 'ol' : 'ul';
  const pattern = ordered ? /^\d+\.\s+(.+)$/ : /^-\s+(.+)$/;
  const items = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i].trim();
    const match = line.match(pattern);
    if (!match) break;
    items.push(`<li>${inlineMarkdown(match[1])}</li>`);
    i += 1;
  }

  return {
    html: `<${tag}>${items.join('')}</${tag}>`,
    nextIndex: i,
  };
}

function extractToc(markdown) {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3).trim())
    .filter((title) => title !== 'Purpose');
}

function markdownToHtml(markdown) {
  const lines = markdown.split('\n');
  const html = [];
  let paragraph = [];
  let sectionOpen = false;
  let subsectionOpen = false;

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function closeSection() {
    closeSubsection();
    if (!sectionOpen) return;
    html.push('</section>');
    sectionOpen = false;
  }

  function closeSubsection() {
    if (!subsectionOpen) return;
    html.push('</section>');
    subsectionOpen = false;
  }

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    if (line === '---') {
      flushParagraph();
      continue;
    }

    if (line.startsWith('# ')) {
      flushParagraph();
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      closeSection();
      const title = line.slice(3);
      const deck = SECTION_DECKS[title];
      html.push(`<section class="guide-section guide-section--${toClassName(title)}">`);
      html.push(`<h2>${inlineMarkdown(title)}</h2>`);
      if (deck) html.push(`<p class="section-deck">${inlineMarkdown(deck)}</p>`);
      sectionOpen = true;
      continue;
    }

    if (line.startsWith('### ')) {
      flushParagraph();
      closeSubsection();
      const heading = line.slice(4);
      const className = `subsection subsection--${toClassName(heading)}`;
      html.push(`<section class="subsection-block subsection-block--${toClassName(heading)}">`);
      html.push(`<h3 class="${className}">${inlineMarkdown(heading)}</h3>`);
      subsectionOpen = true;
      continue;
    }

    if (line.startsWith('#### ')) {
      flushParagraph();
      html.push(`<h4>${inlineMarkdown(line.slice(5))}</h4>`);
      continue;
    }

    if (/^-\s+/.test(line)) {
      flushParagraph();
      const parsed = parseList(lines, i, false);
      html.push(parsed.html);
      i = parsed.nextIndex - 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      const parsed = parseList(lines, i, true);
      html.push(parsed.html);
      i = parsed.nextIndex - 1;
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  closeSubsection();
  closeSection();
  return html.join('\n');
}

function tocHtml(markdown) {
  const headings = extractToc(markdown);
  return `
    <section class="toc">
      <div class="toc-kicker">Contents</div>
      <h2>How This Guide Is Organized</h2>
      <ol class="toc-list">
        ${headings.map((heading) => `<li><span>${inlineMarkdown(heading.replace(/^\d+\.\s+/, ''))}</span></li>`).join('')}
      </ol>
    </section>
  `;
}

function documentHtml(markdown) {
  const body = markdownToHtml(markdown);
  const logoSvg = fs.readFileSync(CONSTELLATION_LOGO, 'utf8').replace(/<\?xml[^>]*>\s*/i, '');
  const watermark = dataUri(CONSTELLATION_WATERMARK);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Constellation CRM User Handbook</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page {
      size: Letter;
      margin: 0.62in 0.64in 0.66in;
    }

    @page:first {
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: ${BRAND.white};
      color: ${BRAND.ink};
      font-family: "Inter", Arial, sans-serif;
      font-size: 9.8pt;
      line-height: 1.48;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .cover {
      position: relative;
      width: 8.5in;
      min-height: 11in;
      overflow: hidden;
      background:
        radial-gradient(circle at 82% 18%, rgba(59, 130, 246, 0.12), transparent 2.6in),
        linear-gradient(90deg, ${BRAND.white} 0%, #F8FBFF 50%, #EEF5FF 76%, #DBEAFE 100%);
      page-break-after: always;
    }

    .cover::before {
      content: "";
      position: absolute;
      top: 0;
      right: 0;
      width: 4.2in;
      height: 11in;
      background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(59, 130, 246, 0.08));
    }

    .cover-content {
      position: relative;
      z-index: 1;
      width: 5.8in;
      padding: 0.76in 0 0 0.72in;
    }

    .cover-logo {
      width: 2.02in;
      height: auto;
      display: block;
      margin-bottom: 0.92in;
    }

    .cover-logo svg {
      display: block;
      width: 100%;
      height: auto;
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
    .toc,
    main {
      position: relative;
      z-index: 1;
    }

    .cover-rule {
      width: 0.9in;
      height: 0.045in;
      background: ${BRAND.blue};
      border-radius: 99px;
      margin-bottom: 0.28in;
    }

    .cover h1 {
      margin: 0;
      color: ${BRAND.ink};
      font-size: 32pt;
      line-height: 1.04;
      letter-spacing: -0.04em;
      font-weight: 800;
    }

    .cover-subtitle {
      width: 4.7in;
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
      width: 4.9in;
    }

    .cover-principles span {
      border: 1px solid ${BRAND.line};
      border-radius: 999px;
      padding: 0.075in 0.14in;
      color: ${BRAND.blueDark};
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
      padding-top: 0.18in;
      border-top: 1px solid ${BRAND.line};
      color: ${BRAND.muted};
      font-size: 7.4pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .toc {
      page-break-after: always;
      min-height: 9.3in;
      padding-top: 0.12in;
    }

    .toc-kicker,
    .section-label {
      color: ${BRAND.blue};
      font-size: 7pt;
      font-weight: 800;
      letter-spacing: 0.13em;
      text-transform: uppercase;
    }

    .toc h2 {
      margin: 0.1in 0 0.26in;
      padding: 0;
      border: 0;
      color: ${BRAND.ink};
      font-size: 21pt;
      line-height: 1.1;
      letter-spacing: -0.03em;
    }

    .toc-list {
      columns: 2;
      column-gap: 0.34in;
      margin: 0;
      padding-left: 0.22in;
      counter-reset: toc;
    }

    .toc-list li {
      break-inside: avoid;
      margin: 0 0 0.14in;
      padding-left: 0.04in;
      color: ${BRAND.ink};
      font-weight: 650;
      line-height: 1.3;
    }

    .toc-list li::marker {
      color: ${BRAND.blue};
      font-weight: 800;
    }

    main h1 {
      display: none;
    }

    .guide-section {
      break-before: page;
      padding-top: 0.05in;
    }

    .guide-section:first-of-type {
      break-before: auto;
    }

    .guide-section h2 {
      margin: 0 0 0.08in;
      padding-top: 0.12in;
      border-top: 0.04in solid ${BRAND.blue};
      color: ${BRAND.ink};
      font-size: 19.5pt;
      line-height: 1.12;
      letter-spacing: -0.035em;
      font-weight: 800;
    }

    .section-deck {
      margin: 0 0 0.24in;
      max-width: 6.4in;
      color: ${BRAND.muted};
      font-size: 9.4pt;
      line-height: 1.45;
    }

    h3 {
      margin: 0.24in 0 0.08in;
      color: ${BRAND.ink};
      font-size: 12.4pt;
      line-height: 1.22;
      letter-spacing: -0.018em;
      font-weight: 800;
      break-after: avoid;
    }

    .subsection-block {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    h3.subsection--what-it-is,
    h3.subsection--why-it-matters,
    h3.subsection--key-things-you-can-do,
    h3.subsection--what-good-looks-like {
      margin-top: 0.18in;
    }

    h4 {
      margin: 0.16in 0 0.06in;
      color: ${BRAND.slate};
      font-size: 10.2pt;
      font-weight: 800;
      break-after: avoid;
    }

    p {
      margin: 0 0 0.105in;
      color: ${BRAND.slate};
    }

    strong {
      color: ${BRAND.ink};
      font-weight: 800;
    }

    code {
      padding: 0.01in 0.04in;
      border: 1px solid ${BRAND.line};
      border-radius: 0.04in;
      background: ${BRAND.panel};
      color: ${BRAND.blueDark};
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 8.5pt;
    }

    ul,
    ol {
      margin: 0.04in 0 0.15in 0.2in;
      padding: 0;
      color: ${BRAND.slate};
    }

    li {
      margin: 0 0 0.052in;
      padding-left: 0.02in;
    }

    li::marker {
      color: ${BRAND.blue};
      font-weight: 800;
    }

    .guide-section > ul,
    .guide-section > ol {
      break-inside: avoid;
    }

    .guide-section--purpose,
    .guide-section--the-big-idea,
    .guide-section--how-to-use-this-handbook {
      break-before: auto;
    }

    .guide-section--the-big-idea,
    .guide-section--how-to-use-this-handbook {
      margin-top: 0.25in;
      padding: 0.18in 0.2in 0.04in;
      border: 1px solid ${BRAND.line};
      border-radius: 0.12in;
      background: ${BRAND.panel};
      break-inside: avoid;
    }

    .guide-section--the-big-idea h2,
    .guide-section--how-to-use-this-handbook h2 {
      border-top: 0;
      padding-top: 0;
      font-size: 16.5pt;
    }

    .guide-section--closing-principle {
      min-height: 8in;
    }

    .guide-section--closing-principle p:last-child {
      margin-top: 0.26in;
      padding: 0.24in 0.3in;
      border: 1px solid ${BRAND.line};
      border-radius: 0.16in;
      background: linear-gradient(135deg, ${BRAND.panel}, ${BRAND.white});
      color: ${BRAND.ink};
      font-size: 13.4pt;
      line-height: 1.38;
      font-weight: 700;
    }

    @media print {
      .page-watermark {
        display: none;
      }

      a {
        color: inherit;
        text-decoration: none;
      }
    }
  </style>
</head>
<body>
  <div class="page-watermark" aria-hidden="true"></div>
  <section class="cover">
    <div class="cover-content">
      <div class="cover-logo" aria-label="Constellation CRM">${logoSvg}</div>
      <div class="cover-rule"></div>
      <h1>Constellation CRM<br>User Handbook</h1>
      <p class="cover-subtitle">A practical guide to the main CRM operating system: what each module does, why it matters, and how to use it in daily sales work.</p>
      <div class="cover-principles">
        <span>Clarity Over Chaos</span>
        <span>Automate The Annoying Stuff</span>
        <span>Intelligence Is A Sales Advantage</span>
      </div>
    </div>
    <div class="cover-footer">Constellation CRM User Guide</div>
  </section>
  ${tocHtml(markdown)}
  <main>
    ${body}
  </main>
</body>
</html>`;
}

async function writePdf() {
  const markdown = fs.readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n');
  const html = documentHtml(markdown);

  fs.writeFileSync(OUTPUT_HTML, html);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1500 } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.pdf({
      path: OUTPUT_PDF,
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: false,
      preferCSSPageSize: true,
    });
    stampPdfWatermark(OUTPUT_PDF, CONSTELLATION_WATERMARK);
  } finally {
    await browser.close();
  }

  console.log(`Wrote ${OUTPUT_HTML}`);
  console.log(`Wrote ${OUTPUT_PDF}`);
}

writePdf().catch((error) => {
  console.error(error);
  process.exit(1);
});
