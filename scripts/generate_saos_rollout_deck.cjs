const pptxgen = require('pptxgenjs');
const path = require('path');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Great Plains Communications';
pptx.company = 'Great Plains Communications';
pptx.subject = 'Strategic Account Operating System rollout';
pptx.title = 'SAOS Retreat Rollout';
pptx.lang = 'en-US';
pptx.theme = {
  headFontFace: 'Arial',
  bodyFontFace: 'Arial',
  lang: 'en-US',
};
pptx.defineLayout({ name: 'LAYOUT_WIDE', width: 13.333, height: 7.5 });

const W = 13.333;
const H = 7.5;
const M = 0.62;

const C = {
  navy: '051B2D',
  navy2: '092E4C',
  navy3: '0D3B5C',
  teal: '1181AA',
  lime: '9CCA3C',
  ink: '0F172A',
  slate: '334155',
  muted: '64748B',
  soft: '94A3B8',
  line: 'D9E3EC',
  panel: 'F8FAFC',
  panel2: 'EEF5F8',
  white: 'FFFFFF',
  amber: 'B45309',
};

let slideNo = 0;

function addNotes(slide, notes) {
  if (notes && typeof slide.addNotes === 'function') slide.addNotes(notes);
}

function addFooter(slide, label = 'Strategic Account OS Rollout') {
  slide.addShape(pptx.ShapeType.line, {
    x: M,
    y: 7.02,
    w: W - M * 2,
    h: 0,
    line: { color: C.line, width: 0.7 },
  });
  slide.addText(label.toUpperCase(), {
    x: M,
    y: 7.15,
    w: 5.8,
    h: 0.18,
    fontSize: 6.7,
    bold: true,
    color: C.soft,
    charSpace: 1.6,
    margin: 0,
  });
  slide.addText(String(slideNo).padStart(2, '0'), {
    x: W - M - 0.45,
    y: 7.15,
    w: 0.45,
    h: 0.18,
    fontSize: 6.7,
    bold: true,
    color: C.soft,
    align: 'right',
    margin: 0,
  });
}

function addBrandTab(slide, color = C.teal) {
  slide.addShape(pptx.ShapeType.rect, {
    x: M,
    y: 0.47,
    w: 1.32,
    h: 0.07,
    fill: { color },
    line: { type: 'none' },
  });
}

function addTitle(slide, title, subtitle, opts = {}) {
  addBrandTab(slide, opts.accent || C.teal);
  slide.addText(title, {
    x: M,
    y: opts.y ?? 0.78,
    w: opts.w ?? 11.35,
    h: opts.h ?? 0.7,
    fontSize: opts.size ?? 25,
    bold: true,
    color: opts.color ?? C.ink,
    margin: 0,
    fit: 'shrink',
    breakLine: true,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: M,
      y: opts.subY ?? 1.42,
      w: opts.subW ?? 10.8,
      h: opts.subH ?? 0.32,
      fontSize: opts.subSize ?? 10.7,
      color: opts.subColor ?? C.muted,
      margin: 0,
      fit: 'shrink',
      breakLine: true,
    });
  }
}

function addSlide(work) {
  const slide = pptx.addSlide();
  slideNo += 1;
  slide.background = { color: C.white };
  work(slide);
  addFooter(slide);
  return slide;
}

function addDarkSlide(work) {
  const slide = pptx.addSlide();
  slideNo += 1;
  slide.background = { color: C.navy };
  work(slide);
  addFooterDark(slide);
  return slide;
}

function addFooterDark(slide) {
  slide.addShape(pptx.ShapeType.line, {
    x: M,
    y: 7.02,
    w: W - M * 2,
    h: 0,
    line: { color: '25455C', width: 0.7, transparency: 15 },
  });
  slide.addText('STRATEGIC ACCOUNT OS ROLLOUT', {
    x: M,
    y: 7.15,
    w: 5.8,
    h: 0.18,
    fontSize: 6.7,
    bold: true,
    color: 'AFC1CE',
    charSpace: 1.6,
    margin: 0,
  });
  slide.addText(String(slideNo).padStart(2, '0'), {
    x: W - M - 0.45,
    y: 7.15,
    w: 0.45,
    h: 0.18,
    fontSize: 6.7,
    bold: true,
    color: 'AFC1CE',
    align: 'right',
    margin: 0,
  });
}

function pill(slide, text, x, y, w, color = C.teal) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.34,
    rectRadius: 0.06,
    fill: { color, transparency: 89 },
    line: { color, transparency: 35, width: 0.8 },
  });
  slide.addText(text.toUpperCase(), {
    x: x + 0.1,
    y: y + 0.1,
    w: w - 0.2,
    h: 0.11,
    fontSize: 6.5,
    bold: true,
    color,
    charSpace: 1.2,
    margin: 0,
    fit: 'shrink',
  });
}

function card(slide, cfg) {
  const { x, y, w, h, kicker, title, body, color = C.teal, fill = C.panel } = cfg;
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.09,
    fill: { color: fill },
    line: { color: C.line, width: 0.9 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w: 0.06,
    h,
    fill: { color },
    line: { type: 'none' },
  });
  if (kicker) pill(slide, kicker, x + 0.22, y + 0.2, Math.min(1.6, w - 0.42), color);
  slide.addText(title, {
    x: x + 0.24,
    y: y + (kicker ? 0.68 : 0.26),
    w: w - 0.48,
    h: 0.43,
    fontSize: 13.4,
    bold: true,
    color: C.ink,
    margin: 0,
    fit: 'shrink',
    breakLine: true,
  });
  slide.addText(body, {
    x: x + 0.24,
    y: y + (kicker ? 1.18 : 0.84),
    w: w - 0.48,
    h: h - (kicker ? 1.36 : 1.02),
    fontSize: 10.1,
    color: C.slate,
    margin: 0,
    fit: 'shrink',
    breakLine: true,
    valign: 'top',
  });
}

function takeaway(slide, cfg) {
  const { kicker = 'Takeaway', text, x = 8.35, y = 2.2, w = 3.62, h = 1.7, color = C.teal } = cfg;
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: C.navy, transparency: 2 },
    line: { color: C.navy2, width: 0.8 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w: 0.07,
    h,
    fill: { color },
    line: { type: 'none' },
  });
  slide.addText(kicker.toUpperCase(), {
    x: x + 0.28,
    y: y + 0.25,
    w: w - 0.55,
    h: 0.16,
    fontSize: 7.4,
    bold: true,
    color,
    charSpace: 1.3,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText(text, {
    x: x + 0.28,
    y: y + 0.65,
    w: w - 0.55,
    h: h - 0.85,
    fontSize: 15.4,
    bold: true,
    color: C.white,
    margin: 0,
    fit: 'shrink',
    breakLine: true,
    valign: 'mid',
  });
}

function promptBar(slide, cfg) {
  const { label = 'Manager prompt', text, x = 0.95, y = 5.18, w = 10.6, color = C.teal } = cfg;
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.86,
    rectRadius: 0.08,
    fill: { color: color === C.lime ? 'FBFDF7' : C.panel },
    line: { color: C.line, width: 0.9 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w: 0.07,
    h: 0.86,
    fill: { color },
    line: { type: 'none' },
  });
  pill(slide, label, x + 0.24, y + 0.2, 1.6, color);
  slide.addText(text, {
    x: x + 0.24,
    y: y + 0.57,
    w: w - 0.48,
    h: 0.2,
    fontSize: 12.7,
    bold: true,
    color: C.ink,
    margin: 0,
    fit: 'shrink',
  });
}

function list(slide, items, x, y, w, opts = {}) {
  const color = opts.color || C.teal;
  const fontSize = opts.fontSize || 14;
  const gap = opts.gap || 0.48;
  items.forEach((text, i) => {
    const yy = y + i * gap;
    slide.addShape(pptx.ShapeType.ellipse, {
      x,
      y: yy + 0.08,
      w: 0.13,
      h: 0.13,
      fill: { color },
      line: { type: 'none' },
    });
    slide.addText(text, {
      x: x + 0.28,
      y: yy,
      w,
      h: 0.32,
      fontSize,
      color: opts.textColor || C.ink,
      margin: 0,
      fit: 'shrink',
      breakLine: true,
    });
  });
}

function statement(slide, text, x, y, w, color = C.ink, size = 25) {
  slide.addText(text, {
    x,
    y,
    w,
    h: 1.2,
    fontSize: size,
    bold: true,
    color,
    margin: 0,
    fit: 'shrink',
    breakLine: true,
  });
}

function divider(num, title, subtitle, notes) {
  addDarkSlide((slide) => {
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: H, fill: { color: C.teal }, line: { type: 'none' } });
    slide.addText(String(num).padStart(2, '0'), {
      x: M,
      y: 1.1,
      w: 1.2,
      h: 0.5,
      fontSize: 24,
      bold: true,
      color: C.lime,
      margin: 0,
    });
    slide.addText(title, {
      x: M,
      y: 2.05,
      w: 8.2,
      h: 0.8,
      fontSize: 34,
      bold: true,
      color: C.white,
      margin: 0,
      fit: 'shrink',
    });
    slide.addText(subtitle, {
      x: M,
      y: 3.04,
      w: 7.6,
      h: 0.48,
      fontSize: 14,
      color: 'C7D5DE',
      margin: 0,
      fit: 'shrink',
      breakLine: true,
    });
    slide.addShape(pptx.ShapeType.line, { x: M, y: 4.22, w: 4.4, h: 0, line: { color: C.teal, width: 2 } });
    slide.addShape(pptx.ShapeType.rtTriangle, { x: 9.25, y: 0, w: 2.4, h: 7.5, fill: { color: C.navy2 }, line: { type: 'none' } });
    slide.addShape(pptx.ShapeType.rtTriangle, { x: 10.65, y: 1.85, w: 2.68, h: 5.65, fill: { color: C.lime }, flipH: true, line: { type: 'none' } });
    addNotes(slide, notes);
  });
}

function cover() {
  addDarkSlide((slide) => {
    slide.addText('GREAT PLAINS COMMUNICATIONS', {
      x: M,
      y: 0.62,
      w: 4.8,
      h: 0.22,
      fontSize: 8,
      bold: true,
      charSpace: 1.4,
      color: 'C7D5DE',
      margin: 0,
    });
    slide.addShape(pptx.ShapeType.rect, { x: M, y: 2.0, w: 1.55, h: 0.08, fill: { color: C.teal }, line: { type: 'none' } });
    slide.addText('Strategic Account\nOperating System', {
      x: M,
      y: 2.35,
      w: 7.2,
      h: 1.35,
      fontSize: 35,
      bold: true,
      color: C.white,
      margin: 0,
      breakLine: true,
      fit: 'shrink',
    });
    slide.addText('Retreat rollout deck | Strategic Accounts team', {
      x: M,
      y: 4.18,
      w: 6.8,
      h: 0.26,
      fontSize: 12,
      color: 'C7D5DE',
      margin: 0,
    });
    slide.addText('Turn account knowledge into account strategy.', {
      x: M,
      y: 5.9,
      w: 8.0,
      h: 0.36,
      fontSize: 16,
      bold: true,
      color: C.lime,
      margin: 0,
    });
    slide.addShape(pptx.ShapeType.rect, { x: 8.7, y: 0, w: 4.63, h: H, fill: { color: C.navy2 }, line: { type: 'none' } });
    slide.addShape(pptx.ShapeType.rtTriangle, { x: 7.3, y: 0, w: 3.0, h: H, fill: { color: C.teal }, line: { type: 'none' } });
    slide.addShape(pptx.ShapeType.rtTriangle, { x: 9.25, y: 0, w: 2.55, h: H, fill: { color: C.navy }, line: { type: 'none' } });
    addNotes(slide, 'Open with the premise: this is not a CRM feature launch. It is a shared operating system for how elite account teams think, plan, and coach strategic pursuits.');
  });
}

cover();

addSlide((slide) => {
  addTitle(slide, 'Why we are launching SAOS', 'Strategic accounts need strategic judgment, not another place to type notes.');
  statement(slide, 'CRM captures activity.\nSAOS captures judgment.', 0.86, 2.22, 5.1, C.ink, 29);
  list(slide, [
    'Understand operating reality better than anyone else',
    'Turn individual instincts into a repeatable team discipline',
    'Explain why the account would change, why now, and why GPC'
  ], 6.75, 2.15, 5.0, { fontSize: 13.2, gap: 0.68 });
  addNotes(slide, 'Set the emotional frame: this is about raising the standard of account thinking. The team already has talent; SAOS gives that talent a common language.');
});

addSlide((slide) => {
  addTitle(slide, 'The accounts we are built to win', 'Multi-location, high-visibility, large-wallet enterprises where network decisions affect business outcomes.');
  card(slide, { x: 0.78, y: 2.1, w: 3.75, h: 2.7, kicker: 'Profile', title: 'Complex operators', body: 'Distributed sites, HQ influence, operational dependencies, IT/security/procurement complexity.' });
  card(slide, { x: 4.8, y: 2.1, w: 3.75, h: 2.7, kicker: 'Pressure', title: 'High consequence', body: 'Outages, application performance, security risk, cloud access, public trust, customer experience.' });
  card(slide, { x: 8.82, y: 2.1, w: 3.75, h: 2.7, kicker: 'GPC edge', title: 'Local + enterprise', body: 'Midwest network depth, responsive local teams, 24/7 NOC, custom solutions, managed services.' });
  addNotes(slide, 'Use familiar logos verbally if desired. The slide is deliberately category-based so it works for the whole team.');
});

addSlide((slide) => {
  addTitle(slide, 'The central translation', 'Customers do not buy network connectivity in the abstract.');
  statement(slide, 'They buy business confidence.', 0.92, 2.22, 7.8, C.ink, 31);
  list(slide, [
    'Reduced operational fragility',
    'More resilient multi-site operations',
    'Lower security and continuity risk',
    'Better customer, patient, student, citizen, or employee experience',
    'A provider they can trust when something goes sideways'
  ], 1.0, 3.48, 6.9, { fontSize: 13.3, gap: 0.42 });
  takeaway(slide, { kicker: 'Executive language', text: 'Translate every GPC capability into the risk it removes or the confidence it creates.', x: 8.35, y: 2.38, w: 3.7, h: 2.0, color: C.lime });
  addNotes(slide, 'This is the bridge from product to executive language. Push the team to phrase GPC capabilities in customer outcomes.');
});

addSlide((slide) => {
  addTitle(slide, 'Five beliefs behind SAOS', 'The methodology rests on a few non-negotiable selling truths.');
  const items = [
    'Strategic selling starts with account selection.',
    'Status quo is the real competitor.',
    'The org chart is not the buying map.',
    'Expansion is designed before the first deal closes.',
    'Momentum must be logged, not guessed.',
  ];
  items.forEach((text, i) => {
    const y = 1.95 + i * 0.66;
    slide.addShape(pptx.ShapeType.roundRect, { x: 0.92, y, w: 0.43, h: 0.33, rectRadius: 0.04, fill: { color: C.teal }, line: { type: 'none' } });
    slide.addText(String(i + 1), { x: 0.92, y: y + 0.08, w: 0.43, h: 0.1, fontSize: 8, bold: true, color: C.white, align: 'center', margin: 0 });
    slide.addText(text, { x: 1.62, y: y - 0.02, w: 6.45, h: 0.34, fontSize: 15.3, bold: true, color: C.ink, margin: 0 });
  });
  takeaway(slide, { kicker: 'Method, not form', text: 'The tool is only valuable if it changes how we inspect accounts and coach judgment.', x: 8.45, y: 2.05, w: 3.55, h: 1.95 });
  addNotes(slide, 'These five beliefs are a useful executive summary of the entire handbook.');
});

addSlide((slide) => {
  addTitle(slide, 'The SAOS flow', 'A pursuit moves from account selection to execution discipline.');
  const steps = ['Account Snapshot', 'The Big Play', 'Competing Priorities', 'The Blindspots', 'Influence Mapping', 'Account Expansion', 'The Battlefield', 'Strategic Entry Points', 'How They Buy', '30 / 60 / 90 Plan', 'Relationship Timeline'];
  steps.forEach((s, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.84 + col * 4.08;
    const y = 2.0 + row * 0.72;
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w: 3.52, h: 0.46, rectRadius: 0.06, fill: { color: i < 2 ? C.panel2 : C.panel }, line: { color: C.line, width: 0.7 } });
    slide.addText(String(i + 1).padStart(2, '0'), { x: x + 0.15, y: y + 0.13, w: 0.33, h: 0.12, fontSize: 6.8, bold: true, color: C.teal, margin: 0 });
    slide.addText(s, { x: x + 0.58, y: y + 0.11, w: 2.72, h: 0.14, fontSize: 8.4, bold: true, color: C.ink, margin: 0, fit: 'shrink' });
  });
  addNotes(slide, 'Make this feel like a sales motion, not a form list. The flow moves from why this account to what happens next.');
});

divider(1, 'Account Snapshot', 'The investment thesis: why this account deserves strategic attention.', 'Explain that tiering is not bureaucracy. It is resource allocation.');

addSlide((slide) => {
  addTitle(slide, 'Account Snapshot: the discussion', 'The question is not "is this account big?" The question is "what kind of pursuit is this?"');
  list(slide, [
    'Logo, wallet, wedge, reference, defense play, or all of the above?',
    'What is the expansion potential and strategic timing?',
    'How patient should we be?',
    'Does this account deserve executive sponsorship from our side?'
  ], 0.95, 2.22, 9.7, { fontSize: 14.2, gap: 0.52 });
  promptBar(slide, { label: 'Manager prompt', text: 'Why this account, and why now?', x: 0.95, y: 5.18, w: 10.6, color: C.lime });
  addNotes(slide, 'Useful transition: if we cannot articulate why the account matters, the rest of the plan becomes busywork.');
});

divider(2, 'The Big Play', 'The boardroom reason to change.', 'This is the heart of the methodology. Push for a change thesis, not a product pitch.');

addSlide((slide) => {
  addTitle(slide, 'Product language vs. change language', 'The customer has to feel the cost of standing still.');
  card(slide, { x: 0.85, y: 2.1, w: 5.45, h: 2.55, kicker: 'Weak', title: 'Sell SD-WAN and DIA', body: 'Product-first language. It describes what we want to sell, not why the account must change.', color: C.amber, fill: 'FFF8F1' });
  card(slide, { x: 6.92, y: 2.1, w: 5.45, h: 2.55, kicker: 'Strong', title: 'Their branch model is too fragile', body: 'Business-first language. It names risk, urgency, executive relevance, and why GPC is credible.', color: C.teal });
  addNotes(slide, 'This is a great slide for team discussion. Ask people to rewrite weak product pitches into change theses.');
});

divider(3, 'Competing Priorities', 'Name the tension, then solve through it.', 'Use this to show why generic messaging fails. Strategic accounts are balancing internal contradictions.');

addSlide((slide) => {
  addTitle(slide, 'Tensions create the real buying story', 'The strongest message respects both sides of the tradeoff.');
  list(slide, ['Scale vs. reliability', 'Innovation vs. governance/security', 'Cost vs. agility', 'Cloud vs. control', 'Speed vs. stability', 'Centralization vs. flexibility'], 0.95, 2.12, 4.8, { fontSize: 13.6, gap: 0.4 });
  slide.addShape(pptx.ShapeType.line, { x: 6.2, y: 2.0, w: 0, h: 3.0, line: { color: C.line, width: 1.1 } });
  pill(slide, 'Example', 6.85, 2.08, 1.05, C.teal);
  statement(slide, 'Move faster into cloud without giving up performance visibility, security, and local accountability.', 6.85, 2.75, 5.1, C.ink, 20);
  addNotes(slide, 'This helps reps sound like they understand the business. The account is not just choosing a provider; they are resolving a tradeoff.');
});

divider(4, 'The Blindspots', 'Discovery discipline: convert uncertainty into the next question.', 'Blindspots are not weaknesses. They are the agenda for earning better strategy.');

addSlide((slide) => {
  addTitle(slide, 'Blindspots protect us from fake confidence', 'A strong plan is honest about what it does not know.');
  list(slide, ['Unknown procurement process', 'Unknown incumbent contract term', 'Unknown executive sponsor', 'Unknown technical risk', 'Unknown budget owner', 'Unknown pain severity'], 0.95, 2.15, 4.85, { fontSize: 13.3, gap: 0.38, color: C.lime });
  card(slide, { x: 6.55, y: 2.15, w: 5.55, h: 1.92, kicker: 'Better question', title: 'Who owns the business impact of downtime?', body: 'IT, operations, finance, local site leadership, or executive leadership?', color: C.lime, fill: 'FBFDF7' });
  addNotes(slide, 'Encourage managers to praise honest unknowns. The issue is not having gaps; the issue is not converting gaps into next actions.');
});

divider(5, 'Influence Mapping', 'The account is not one person. It is a political system.', 'This is where MEDDPICC enters the plan: champion and economic buyer are explicit roles.');

addSlide((slide) => {
  addTitle(slide, 'Champion is not the same as Economic Buyer', 'Friendliness is not influence. Influence is what happens when we are not in the room.');
  card(slide, { x: 0.9, y: 2.08, w: 5.35, h: 2.75, kicker: 'Champion', title: 'Coaches and helps us win', body: 'Has influence, wants the outcome, shares process and politics, may or may not own budget.', color: C.teal });
  card(slide, { x: 7.05, y: 2.08, w: 5.35, h: 2.75, kicker: 'Economic Buyer', title: 'Can prioritize money and impact', body: 'Owns business impact, can release or approve spend, must understand why change matters.', color: C.lime, fill: 'FBFDF7' });
  addNotes(slide, 'This is a likely high-value coaching moment. Ask the team where they have confused a friendly contact for a champion.');
});

addSlide((slide) => {
  addTitle(slide, 'Access path is a strategy, not a wish', 'We need a deliberate bridge from current access to decision access.');
  list(slide, ['Current access: who talks to us today?', 'Desired access: who must hear the story?', 'Bridge contact: who can credibly open the door?', 'Reason: why would they make the introduction?', 'Message: what earns the meeting?'], 0.95, 2.18, 6.95, { fontSize: 14.5, gap: 0.48 });
  takeaway(slide, { kicker: 'Access rule', text: '“Get higher” is not a strategy. A credible bridge, reason, and message is.', x: 8.45, y: 2.23, w: 3.55, h: 1.9 });
  addNotes(slide, 'Use this to move teams from "we need to get higher" to an actual plan for getting higher.');
});

divider(6, 'Account Expansion', 'The first win should create proof, trust, and the next conversation.', 'Expansion is designed before close, not discovered after close.');

addSlide((slide) => {
  addTitle(slide, 'Expansion is a sequence, not a product menu', 'The wedge matters because it changes what the account believes about us.');
  const pairs = [['Wireless backup', 'Continuity proof'], ['Dedicated Internet', 'Performance and reliability proof'], ['Managed firewall', 'Risk reduction proof'], ['SD-WAN', 'Multi-site control proof'], ['Cloud Connect', 'Secure app access proof']];
  pairs.forEach((p, i) => {
    const y = 1.95 + i * 0.55;
    slide.addText(p[0], { x: 1.0, y, w: 2.55, h: 0.22, fontSize: 11.4, bold: true, color: C.ink, margin: 0 });
    slide.addShape(pptx.ShapeType.line, { x: 3.85, y: y + 0.11, w: 1.05, h: 0, line: { color: C.teal, width: 1.1, endArrowType: 'triangle' } });
    slide.addText(p[1], { x: 5.25, y, w: 4.5, h: 0.22, fontSize: 11.4, color: C.slate, margin: 0 });
  });
  promptBar(slide, { label: 'Manager prompt', text: 'What first move gives us permission to become more strategic?', x: 0.95, y: 5.25, w: 10.75, color: C.teal });
  addNotes(slide, 'Reinforce that white space is not everything we could sell. It is a designed path from wedge to expansion.');
});

divider(7, 'The Battlefield', 'Respect incumbent gravity before trying to displace it.', 'The incumbent is there for a reason. Understanding that reason improves our displacement strategy.');

addSlide((slide) => {
  addTitle(slide, 'Why incumbents survive dissatisfaction', 'Even unhappy accounts stay when switching feels risky.');
  list(slide, ['Existing contracts and procurement familiarity', 'Embedded integrations and support routines', 'Executive relationships', 'Operational dependency', 'The known provider feels safer than change'], 0.95, 2.18, 5.3, { fontSize: 13.4, gap: 0.42, color: C.amber });
  card(slide, { x: 6.75, y: 2.1, w: 5.35, h: 2.05, kicker: 'GPC angle', title: 'Show why they have outgrown the current model', body: 'Name the gravity, then show the safer path forward.', color: C.teal });
  addNotes(slide, 'This helps avoid lazy competitor talk. Great displacement respects why the current provider still has the account.');
});

divider(8, 'Strategic Entry Points', 'Turn account strategy into person-specific action.', 'Enterprise selling happens through individuals with different motivations, styles, and fears.');

addSlide((slide) => {
  addTitle(slide, 'Every important person gets a tailored playbook', 'If every contact gets the same message, we do not have an influence strategy.');
  list(slide, ['Why do they matter?', 'What pressure are they under?', 'What communication style will work?', 'What should we avoid saying?', 'What is the next best move?', 'Can they bridge us to someone else?'], 0.95, 2.1, 6.85, { fontSize: 14.2, gap: 0.43 });
  takeaway(slide, { kicker: 'Influence strategy', text: 'Different people need different proof, pressure, and next moves.', x: 8.55, y: 2.15, w: 3.35, h: 1.75, color: C.lime });
  addNotes(slide, 'This section is the practical pre-call companion. It should make the next customer conversation sharper.');
});

divider(9, 'How They Buy', 'The technical need and the buying motion are not the same thing.', 'Two accounts with the same technical problem may require completely different pursuit strategies.');

addSlide((slide) => {
  addTitle(slide, 'Design the buying motion', 'Misread the buying process and we create friction instead of momentum.');
  card(slide, { x: 0.78, y: 2.05, w: 3.75, h: 2.6, kicker: 'Friction', title: 'Process load', body: 'Bureaucracy, procurement, legal, security, finance, consensus requirements.' });
  card(slide, { x: 4.8, y: 2.05, w: 3.75, h: 2.6, kicker: 'Psychology', title: 'Change appetite', body: 'Risk tolerance, vendor loyalty, decision velocity, technical sophistication.' });
  card(slide, { x: 8.82, y: 2.05, w: 3.75, h: 2.6, kicker: 'Bypass', title: 'Legitimate path', body: 'Pilot, risk workshop, executive sponsor, site proof, business impact review.' });
  addNotes(slide, 'Make clear this is not about shortcutting procurement. It is about finding the legitimate path through complexity.');
});

divider(10, '30 / 60 / 90 Plan', 'Strategy without next moves is theater.', 'This is where methodology becomes execution.');

addSlide((slide) => {
  addTitle(slide, 'The Give/Get principle', 'If the customer gives nothing, we may not have real momentum.');
  const rows = [['We deliver a network design', 'They provide site inventory'], ['We schedule an executive workshop', 'They bring IT, finance, and operations'], ['We produce a resiliency assessment', 'They share outage history'], ['We bring security expertise', 'They include the security decision-maker'], ['We draft pricing', 'They confirm decision process and timing']];
  rows.forEach((r, i) => {
    const y = 1.9 + i * 0.62;
    slide.addText(r[0], { x: 0.95, y, w: 4.35, h: 0.24, fontSize: 11.8, bold: true, color: C.ink, margin: 0 });
    slide.addText('GET', { x: 5.55, y: y + 0.02, w: 0.42, h: 0.16, fontSize: 6.3, bold: true, color: C.teal, align: 'center', margin: 0 });
    slide.addShape(pptx.ShapeType.line, { x: 6.15, y: y + 0.12, w: 0.72, h: 0, line: { color: C.line, width: 1 } });
    slide.addText(r[1], { x: 7.1, y, w: 4.6, h: 0.24, fontSize: 11.8, color: C.slate, margin: 0 });
  });
  addNotes(slide, 'This slide should change behavior immediately. Ask reps to name the customer commitment required for every next step.');
});

divider(11, 'Relationship Timeline', 'Separate activity from meaningful signal.', 'Momentum is not guessed. It is logged through changes in access, learning, pain, commitments, and urgency.');

addSlide((slide) => {
  addTitle(slide, 'Activity vs. signal', 'A signal tells us what changed.');
  card(slide, { x: 0.9, y: 2.15, w: 5.35, h: 2.35, kicker: 'Activity', title: 'Had call with IT', body: 'Something happened. It may or may not indicate strategic progress.', color: C.amber, fill: 'FFF8F1' });
  card(slide, { x: 7.05, y: 2.15, w: 5.35, h: 2.35, kicker: 'Signal', title: 'IT confirmed outages are now visible to operations leadership', body: 'Something changed. We learned pain, urgency, audience, and likely next move.', color: C.teal });
  addNotes(slide, 'This is the best way to explain the signals-only export policy. Executives need meaningful change, not every CRM activity.');
});

addSlide((slide) => {
  addTitle(slide, 'Operating cadence', 'SAOS becomes powerful when it changes the review conversation.');
  card(slide, { x: 0.78, y: 2.04, w: 3.75, h: 2.65, kicker: 'Weekly', title: 'Strategic account review', body: 'Why this account? Why now? Who matters? What changed? What does the customer owe us?' });
  card(slide, { x: 4.8, y: 2.04, w: 3.75, h: 2.65, kicker: 'Monthly', title: 'Portfolio review', body: 'Find weak Big Plays, missing economic buyers, activity without signals, and accounts needing executive sponsorship.' });
  card(slide, { x: 8.82, y: 2.04, w: 3.75, h: 2.65, kicker: 'Every call', title: 'Pre/post discipline', body: 'Prepare with Big Play, Blindspots, Entry Points. Afterward, log what changed.' });
  addNotes(slide, 'Position this as a coaching rhythm. The manager question becomes: what did the plan teach us this week?');
});

addSlide((slide) => {
  addTitle(slide, 'Quality bar', 'A strong SAOS plan is clear enough for any leader to inspect.');
  list(slide, ['Specific: names, dates, triggers, sites, providers, pain, and next moves', 'Executive-relevant: written in business language, not product shorthand', 'Politically aware: maps influence and access honestly', 'Evidence-based: separates assumptions from known facts', 'Expansion-minded: starts with the wedge and thinks beyond it', 'Current: updated as the account changes'], 0.95, 2.06, 7.0, { fontSize: 12.8, gap: 0.46, color: C.lime });
  takeaway(slide, { kicker: 'Inspection test', text: 'A leader should understand the pursuit without needing the rep to narrate the whole history.', x: 8.35, y: 2.32, w: 3.65, h: 1.85, color: C.lime });
  addNotes(slide, 'This is a useful slide to define what good looks like without over-policing completion percentage.');
});

addSlide((slide) => {
  addTitle(slide, 'Red flags', 'These are coaching moments, not shame moments.');
  list(slide, ['The Big Play sounds like a product pitch.', 'No economic buyer is identified.', 'The champion is just someone who likes us.', 'The incumbent is treated as incompetent without evidence.', 'Account expansion is a product menu.', 'The 30 / 60 / 90 Plan has no customer commitments.', 'The Relationship Timeline is all activity and no signals.'], 0.95, 1.92, 7.05, { fontSize: 12.8, gap: 0.41, color: C.amber });
  takeaway(slide, { kicker: 'Coach the gap', text: 'Red flags are not failures. They show where the next coaching question belongs.', x: 8.35, y: 2.32, w: 3.65, h: 1.65, color: C.amber });
  addNotes(slide, 'Use this as the diagnostic checklist for early adoption. If these appear, the plan needs coaching, not more fields.');
});

addSlide((slide) => {
  addTitle(slide, 'Workshop exercise', 'Pick one real Tier 1 account. Answer only three questions.');
  card(slide, { x: 0.78, y: 2.15, w: 3.75, h: 2.25, kicker: 'Question 1', title: 'What is The Big Play?', body: 'Compare answers across the room. Disagreement exposes the strategy gap.' });
  card(slide, { x: 4.8, y: 2.15, w: 3.75, h: 2.25, kicker: 'Question 2', title: 'Who is the economic buyer and who is the champion?', body: 'Separate friendliness from influence and budget authority.', color: C.lime, fill: 'FBFDF7' });
  card(slide, { x: 8.82, y: 2.15, w: 3.75, h: 2.25, kicker: 'Question 3', title: 'What is the first wedge and what does it unlock?', body: 'Expansion starts with the first proof point.', color: C.navy2 });
  addNotes(slide, 'This is the interactive section for the retreat. Keep it simple. The power is in comparing answers.');
});

addDarkSlide((slide) => {
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: H, fill: { color: C.teal }, line: { type: 'none' } });
  slide.addText('Change the inspection question.', { x: M, y: 1.0, w: 5.5, h: 0.28, fontSize: 11, color: 'C7D5DE', margin: 0 });
  slide.addText('Instead of', { x: M, y: 2.05, w: 2.0, h: 0.16, fontSize: 8, bold: true, color: 'AFC1CE', charSpace: 1.2, margin: 0 });
  slide.addText('"Did you update the plan?"', { x: M, y: 2.42, w: 7.1, h: 0.48, fontSize: 24, bold: true, color: 'F59E0B', margin: 0 });
  slide.addText('Ask', { x: M, y: 4.1, w: 2.0, h: 0.16, fontSize: 8, bold: true, color: 'AFC1CE', charSpace: 1.2, margin: 0 });
  slide.addText('"What did the plan teach us this week?"', { x: M, y: 4.48, w: 9.4, h: 0.52, fontSize: 25, bold: true, color: C.lime, margin: 0 });
  addNotes(slide, 'This line is sticky. It turns SAOS from data entry into learning discipline.');
});

addSlide((slide) => {
  addTitle(slide, 'Launch expectations', 'Suggested minimum standard for early adoption.');
  list(slide, ['Tier the account and explain why it matters.', 'Write a real Big Play and action-forcing event.', 'Map champion, economic buyer, blockers, and access path.', 'Define the first wedge and expansion path.', 'Log meaningful signals after major interactions.', 'Maintain a 30 / 60 / 90 Plan with customer commitments.'], 0.95, 2.08, 7.0, { fontSize: 13.6, gap: 0.44 });
  takeaway(slide, { kicker: 'Launch bar', text: 'The first standard is clarity, not perfection.', x: 8.65, y: 2.35, w: 3.25, h: 1.45, color: C.teal });
  addNotes(slide, 'Frame as a launch baseline. You can adjust the exact standard before the retreat.');
});

addSlide((slide) => {
  addTitle(slide, 'What good looks like', 'Any leader should be able to read the plan and understand the pursuit.');
  list(slide, ['Why the account matters', 'Why the account may change', 'Where GPC can create differentiated value', 'Who must be influenced', 'Where the risk is', 'What we will do next', 'What the customer must do next', 'What expansion could become possible'], 0.95, 1.95, 7.0, { fontSize: 13.2, gap: 0.36, color: C.lime });
  takeaway(slide, { kicker: 'Simple standard', text: 'Clear plans create faster coaching, better executive help, and sharper customer action.', x: 8.35, y: 2.35, w: 3.65, h: 1.7, color: C.lime });
  addNotes(slide, 'This is a nice close before the final call to action.');
});

addDarkSlide((slide) => {
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: H, fill: { color: C.teal }, line: { type: 'none' } });
  slide.addText('The close', { x: M, y: 0.85, w: 4.5, h: 0.38, fontSize: 14, bold: true, color: 'C7D5DE', margin: 0 });
  slide.addText('The best plans will not be the longest.\nThey will be the clearest.', {
    x: M,
    y: 1.75,
    w: 8.3,
    h: 0.82,
    fontSize: 27,
    bold: true,
    color: C.white,
    margin: 0,
    breakLine: true,
    fit: 'shrink',
  });
  slide.addText('Why this account?   Why change?   Why now?\nWhy GPC?   Who matters?   What happens next?', {
    x: M,
    y: 3.35,
    w: 10.8,
    h: 0.8,
    fontSize: 18,
    bold: true,
    color: C.lime,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText('SAOS gives us the common operating system to answer those questions with precision.', {
    x: M,
    y: 5.45,
    w: 9.6,
    h: 0.28,
    fontSize: 12.5,
    color: 'C7D5DE',
    margin: 0,
  });
  addNotes(slide, 'End with energy. This is the hard launch of a team standard, not a software demo.');
});

const out = path.join(process.cwd(), 'docs', 'saos', 'SAOS_Retreat_Rollout_Deck.pptx');
pptx.writeFile({ fileName: out });
