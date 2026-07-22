const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

const ROOT = process.cwd();
const LOGO = path.join(ROOT, 'assets', 'constellation-logo-full.svg');
const OUTPUT = path.join(ROOT, 'docs', 'Constellation_CRM_User_Handbook_Deck.pptx');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Constellation CRM';
pptx.company = 'Constellation CRM';
pptx.subject = 'Constellation CRM User Handbook';
pptx.title = 'Constellation CRM User Handbook';
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
  blue: '3B82F6',
  blue2: '1D4ED8',
  paleBlue: 'DBEAFE',
  paleBlue2: 'EFF6FF',
  ink: '0F172A',
  slate: '334155',
  muted: '64748B',
  soft: '94A3B8',
  line: 'E2E8F0',
  panel: 'F8FAFC',
  white: 'FFFFFF',
  green: '22C55E',
  amber: 'F59E0B',
};

const logoData = `data:image/svg+xml;base64,${fs.readFileSync(LOGO, 'base64')}`;
let slideNo = 0;

function addNotes(slide, notes) {
  if (notes && typeof slide.addNotes === 'function') slide.addNotes(notes);
}

function addLogo(slide, x = M, y = 0.42, w = 1.2) {
  slide.addImage({ data: logoData, x, y, w, h: w * 0.667 });
}

function addFooter(slide) {
  slide.addShape(pptx.ShapeType.line, {
    x: M,
    y: 7.04,
    w: W - M * 2,
    h: 0,
    line: { color: C.line, width: 0.7 },
  });
  slide.addText('CONSTELLATION CRM USER GUIDE', {
    x: M,
    y: 7.16,
    w: 5.2,
    h: 0.16,
    fontSize: 6.6,
    bold: true,
    color: C.soft,
    charSpace: 1.35,
    margin: 0,
  });
  slide.addText(String(slideNo).padStart(2, '0'), {
    x: W - M - 0.5,
    y: 7.16,
    w: 0.5,
    h: 0.16,
    fontSize: 6.6,
    bold: true,
    color: C.soft,
    align: 'right',
    margin: 0,
  });
}

function addRightWash(slide) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 8.25,
    y: -1.35,
    w: 6.4,
    h: 9.8,
    fill: { color: C.paleBlue, transparency: 18 },
    line: { type: 'none' },
  });
  slide.addShape(pptx.ShapeType.arc, {
    x: 9.92,
    y: 5.65,
    w: 2.45,
    h: 1.7,
    adjustPoint: 0.35,
    line: { color: C.blue, transparency: 82, width: 1.0 },
    fill: { color: C.white, transparency: 100 },
    rotate: 8,
  });
}

function newSlide(opts = {}) {
  const slide = pptx.addSlide();
  slideNo += 1;
  slide.background = { color: C.white };
  if (opts.wash) addRightWash(slide);
  return slide;
}

function finishSlide(slide, notes) {
  addFooter(slide);
  addNotes(slide, notes);
}

function brandRule(slide, x = M, y = 0.55, w = 1.32) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.06,
    rectRadius: 0.02,
    fill: { color: C.blue },
    line: { type: 'none' },
  });
}

function title(slide, text, subtitle, opts = {}) {
  brandRule(slide, M, opts.ruleY ?? 0.48, opts.ruleW ?? 1.35);
  slide.addText(text, {
    x: M,
    y: opts.y ?? 0.8,
    w: opts.w ?? 11.7,
    h: opts.h ?? 0.62,
    fontFace: 'Arial',
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
      w: opts.subW ?? 10.7,
      h: opts.subH ?? 0.35,
      fontSize: opts.subSize ?? 10.6,
      color: opts.subColor ?? C.muted,
      margin: 0,
      fit: 'shrink',
      breakLine: true,
    });
  }
}

function pill(slide, text, x, y, w, color = C.blue) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.36,
    rectRadius: 0.1,
    fill: { color: C.white, transparency: 0 },
    line: { color: C.line, width: 0.8 },
  });
  slide.addText(text.toUpperCase(), {
    x: x + 0.13,
    y: y + 0.105,
    w: w - 0.26,
    h: 0.14,
    fontSize: 7.8,
    bold: true,
    color,
    charSpace: 1.1,
    margin: 0,
    fit: 'shrink',
  });
}

function card(slide, cfg) {
  const { x, y, w, h, kicker, heading, body, color = C.blue, fill = C.panel } = cfg;
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: C.line, width: 0.8 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w: 0.05,
    h,
    fill: { color },
    line: { type: 'none' },
  });
  if (kicker) pill(slide, kicker, x + 0.22, y + 0.19, Math.min(w - 0.44, 1.68), color);
  slide.addText(heading, {
    x: x + 0.25,
    y: y + (kicker ? 0.64 : 0.27),
    w: w - 0.5,
    h: 0.38,
    fontSize: 13.2,
    bold: true,
    color: C.ink,
    margin: 0,
    fit: 'shrink',
    breakLine: true,
  });
  slide.addText(body, {
    x: x + 0.25,
    y: y + (kicker ? 1.08 : 0.78),
    w: w - 0.5,
    h: h - (kicker ? 1.24 : 0.94),
    fontSize: 9.5,
    color: C.slate,
    margin: 0,
    fit: 'shrink',
    breakLine: true,
    valign: 'top',
  });
}

function dotList(slide, items, x, y, w, opts = {}) {
  const gap = opts.gap ?? 0.38;
  const fontSize = opts.fontSize ?? 12.3;
  items.forEach((item, i) => {
    const yy = y + i * gap;
    slide.addShape(pptx.ShapeType.ellipse, {
      x,
      y: yy + 0.06,
      w: 0.12,
      h: 0.12,
      fill: { color: opts.color ?? C.blue },
      line: { type: 'none' },
    });
    slide.addText(item, {
      x: x + 0.26,
      y: yy,
      w,
      h: 0.24,
      fontSize,
      color: opts.textColor ?? C.ink,
      margin: 0,
      fit: 'shrink',
      breakLine: true,
    });
  });
}

function numberList(slide, items, x, y, w, opts = {}) {
  const gap = opts.gap ?? 0.5;
  items.forEach((item, i) => {
    const yy = y + i * gap;
    slide.addText(String(i + 1), {
      x,
      y: yy,
      w: 0.32,
      h: 0.2,
      fontSize: 10.5,
      bold: true,
      color: C.blue,
      margin: 0,
    });
    slide.addText(item, {
      x: x + 0.48,
      y: yy,
      w,
      h: 0.24,
      fontSize: opts.fontSize ?? 12.0,
      color: C.ink,
      margin: 0,
      fit: 'shrink',
      breakLine: true,
    });
  });
}

function statement(slide, text, x, y, w, h, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: opts.fill ?? C.panel },
    line: { color: C.line, width: 0.8 },
  });
  slide.addText(text, {
    x: x + 0.35,
    y: y + 0.3,
    w: w - 0.7,
    h: h - 0.6,
    fontSize: opts.fontSize ?? 17,
    bold: true,
    color: opts.color ?? C.ink,
    margin: 0,
    fit: 'shrink',
    breakLine: true,
    valign: 'mid',
  });
}

function twoColumn(slide, left, right) {
  card(slide, { x: 0.82, y: 2.02, w: 5.55, h: 3.05, ...left });
  card(slide, { x: 6.95, y: 2.02, w: 5.55, h: 3.05, ...right });
}

function coverSlide() {
  const slide = newSlide({ wash: true });
  addLogo(slide, 0.78, 0.62, 1.72);
  brandRule(slide, 0.82, 2.05, 1.3);
  slide.addText('Constellation CRM\nUser Handbook', {
    x: 0.82,
    y: 2.45,
    w: 6.4,
    h: 0.95,
    fontSize: 34,
    bold: true,
    color: C.ink,
    margin: 0,
    fit: 'shrink',
    breakLine: true,
  });
  slide.addText('A practical guide to the main CRM operating system: what each module does, why it matters, and how users work through the day.', {
    x: 0.82,
    y: 3.78,
    w: 6.9,
    h: 0.56,
    fontSize: 13.6,
    color: C.slate,
    margin: 0,
    fit: 'shrink',
    breakLine: true,
  });
  pill(slide, 'Clarity Over Chaos', 0.82, 4.82, 2.04);
  pill(slide, 'Automate The Annoying Stuff', 3.05, 4.82, 2.55);
  pill(slide, 'Intelligence Is A Sales Advantage', 0.82, 5.32, 3.08);
  finishSlide(slide, 'Opening cover. Position the deck as a polished, synthesized companion to the full user handbook.');
}

function agendaSlide() {
  const slide = newSlide();
  title(slide, 'How the System Fits Together', 'Constellation is organized around the real operating flow of sales work.');
  const items = [
    'Navigate and find records',
    'Start the day in Command Center',
    'Work people and companies',
    'Manage pipeline and forecast',
    'Execute outreach',
    'Act on intelligence',
    'Model, propose, and plan strategically',
  ];
  numberList(slide, items, 0.92, 2.08, 4.9, { gap: 0.49, fontSize: 12.4 });
  statement(slide, 'The CRM is most valuable when it turns sales data into sales movement.', 7.05, 2.22, 4.5, 2.25, { fontSize: 20 });
  finishSlide(slide, 'Use this slide to frame the rest of the training: operating flow first, feature names second.');
}

function addModuleCards(slide, cards, y = 1.82) {
  const w = 3.82;
  cards.forEach((item, i) => {
    card(slide, {
      x: 0.72 + i * 4.12,
      y,
      w,
      h: 2.35,
      kicker: item.kicker,
      heading: item.heading,
      body: item.body,
      color: item.color ?? C.blue,
      fill: item.fill ?? C.panel,
    });
  });
}

function slides() {
  coverSlide();

  {
    const slide = newSlide();
    title(slide, 'The Big Idea', 'Constellation is a system of engagement, not just a place to store records.');
    twoColumn(slide,
      {
        kicker: 'Traditional CRM',
        heading: 'Stores What Happened',
        body: 'Accounts, contacts, activities, deals, tasks, and records of work.',
        color: C.muted,
      },
      {
        kicker: 'Constellation',
        heading: 'Turns Work Into Movement',
        body: 'Priorities, outreach, intelligence, pipeline health, proposals, business cases, and strategic account planning.',
        color: C.blue,
        fill: C.paleBlue2,
      });
    finishSlide(slide, 'Contrast system of record with system of engagement.');
  }

  {
    const slide = newSlide();
    title(slide, 'Three Operating Principles', 'These principles should shape how users interpret every page.');
    addModuleCards(slide, [
      { kicker: '01', heading: 'Clarity Over Chaos', body: 'Briefings, filters, status icons, and clean views show what needs attention.' },
      { kicker: '02', heading: 'Automate the Annoying Stuff', body: 'Sequences, campaigns, imports, AI writing, and exports reduce repetitive work.' },
      { kicker: '03', heading: 'Intelligence Is an Advantage', body: 'Cognito, AI briefings, activity insights, and Social Hub create better timing and language.' },
    ]);
    finishSlide(slide, 'This is the conceptual spine of the handbook.');
  }

  agendaSlide();

  {
    const slide = newSlide();
    title(slide, 'Navigation and Search', 'The shared shell keeps users from getting trapped in one module.');
    addModuleCards(slide, [
      { kicker: 'Search', heading: 'Find Records Fast', body: 'Global search jumps to contacts, accounts, and deals from anywhere.' },
      { kicker: 'Menu', heading: 'Templates and Session Controls', body: 'CSV templates, AI Admin access when available, and logout live in the bottom menu.' },
      { kicker: 'Signals', heading: 'Notification Dots', body: 'Cognito and Social Hub bells show new intelligence or content since last visit.' },
    ], 2.0);
    finishSlide(slide, 'Summarize navigation before moving into modules.');
  }

  {
    const slide = newSlide();
    title(slide, 'Command Center Is the Daily Starting Point', 'One page for priorities, tasks, due outreach, and recent work.');
    dotList(slide, [
      'AI Daily Briefing prioritizes what matters now',
      'My Tasks keeps manual follow-up visible',
      'Sequence Steps executes due outreach',
      'Recent Activities shows what just happened',
      'Log to Salesforce closes the compliance loop',
    ], 0.95, 2.05, 5.8, { gap: 0.45, fontSize: 13.2 });
    statement(slide, 'Start here when you need to decide what to do next.', 7.35, 2.35, 4.2, 1.75, { fontSize: 19 });
    finishSlide(slide, 'Command Center is the user daily rhythm slide.');
  }

  {
    const slide = newSlide();
    title(slide, 'Contacts and Accounts Are the Relationship Core', 'People and companies are separate views of the same sales reality.');
    twoColumn(slide,
      {
        kicker: 'Contacts',
        heading: 'Person-Level Execution',
        body: 'Sequence status, AI email drafting, activity insight, BCC email history, tasks, and Salesforce activity logging.',
      },
      {
        kicker: 'Accounts',
        heading: 'Company-Level Context',
        body: 'Firmographics, org chart, deals, proposals, AI briefing, meeting agenda, activities, tasks, and SAOS entry point.',
      });
    finishSlide(slide, 'Contacts are the relationship hub; Accounts are the company 360 view.');
  }

  {
    const slide = newSlide();
    title(slide, 'Contacts: What Good Usage Looks Like', 'A useful contact record helps a rep know who the person is and what to do next.');
    dotList(slide, [
      'Correct account, title, email, phone, and notes',
      'Sequence enrollment reflects the current outreach path',
      'Activities and BCC-logged emails capture meaningful history',
      'AI insight is useful because the activity history is current',
      'Tasks are linked when follow-up matters',
    ], 0.95, 2.02, 7.2, { gap: 0.48, fontSize: 13 });
    card(slide, {
      x: 8.72,
      y: 2.12,
      w: 3.35,
      h: 2.1,
      kicker: 'Rule',
      heading: 'If the Person Matters, Keep the Context Current.',
      body: 'Weak contact records create weak outreach.',
      fill: C.paleBlue2,
    });
    finishSlide(slide, 'Explain practical contact hygiene.');
  }

  {
    const slide = newSlide();
    title(slide, 'Accounts: Meeting Prep in One Place', 'The account page should answer the core customer context questions.');
    addModuleCards(slide, [
      { kicker: 'Context', heading: 'Who Are They?', body: 'Firmographics, customer status, Salesforce/ZoomInfo links, and notes.' },
      { kicker: 'Motion', heading: 'What Is Active?', body: 'Current deals, proposals, activities, tasks, and contact relationships.' },
      { kicker: 'Prep', heading: 'What Should We Say?', body: 'AI briefing, agenda builder, org chart, and strategic account plan handoff.' },
    ], 1.9);
    finishSlide(slide, 'Accounts are the pre-meeting view.');
  }

  {
    const slide = newSlide();
    title(slide, 'Deals: Forecast and Pipeline Discipline', 'Deals is where opportunity status becomes forecast language.');
    dotList(slide, [
      'Commit means the rep is calling the deal for the current close month',
      'Best Case includes all open deals closing this month',
      'Renewals stay visible but are excluded from new-business forecast metrics',
      'Closed Lost preserves history; deals are not deleted',
      'Board view manages stage movement; list view manages detail',
    ], 0.95, 2.0, 7.1, { gap: 0.43, fontSize: 12.7 });
    statement(slide, 'A useful pipeline is honest enough for leadership to act on.', 8.5, 2.32, 3.55, 1.7, { fontSize: 18.2 });
    finishSlide(slide, 'Define the deal operating standards.');
  }

  {
    const slide = newSlide();
    title(slide, 'Campaigns and Sequences Solve Different Problems', 'Both support outreach discipline, but they are not interchangeable.');
    twoColumn(slide,
      {
        kicker: 'Campaigns',
        heading: 'Curated Outreach Sprints',
        body: 'One-time Call Blitz or Guided Email runs. Users choose exact contacts through the cart and work them directly in Campaigns.',
      },
      {
        kicker: 'Sequences',
        heading: 'Reusable Multi-Touch Playbooks',
        body: 'Step-based outreach paths with delays, owners, AI generation, imports, and bulk assignment. Due steps are worked later.',
      });
    finishSlide(slide, 'Clarify campaigns vs sequences early.');
  }

  {
    const slide = newSlide();
    title(slide, 'The Outreach Engine', 'A simple operating model for repeatable prospecting and follow-up.');
    numberList(slide, [
      'Build or import a sequence',
      'Enroll the right contacts',
      'Work due steps from Command Center or Contacts',
      'Use campaigns for short focused sprints',
      'Log meaningful outcomes and follow-up tasks',
    ], 1.05, 2.0, 7.2, { gap: 0.52, fontSize: 13.1 });
    card(slide, {
      x: 8.65,
      y: 2.2,
      w: 3.45,
      h: 2.2,
      kicker: 'Standard',
      heading: 'Outreach Should Leave a Trail.',
      body: 'The next rep, manager, or AI summary should be able to see what happened.',
      fill: C.paleBlue2,
    });
    finishSlide(slide, 'Describe sequence/campaign execution as an operating loop.');
  }

  {
    const slide = newSlide();
    title(slide, 'Cognito Turns Account News Into Action', 'Intelligence is only valuable if it creates a next move.');
    dotList(slide, [
      'Review new alerts and high relevance scores first',
      'Open Action Center for AI-drafted outreach',
      'Select the right contact with an email address',
      'Copy or open the draft in your email client',
      'Log the interaction and create a follow-up task',
      'Mark completed when the signal has been handled',
    ], 0.95, 1.95, 7.4, { gap: 0.4, fontSize: 12.3 });
    statement(slide, 'Do not just read the signal. Convert it into customer action.', 8.75, 2.28, 3.25, 1.92, { fontSize: 17.3 });
    finishSlide(slide, 'Cognito workflow slide.');
  }

  {
    const slide = newSlide();
    title(slide, 'Social Hub Supports Consistent Public Presence', 'Share relevant content without starting from a blank page.');
    addModuleCards(slide, [
      { kicker: 'AI Content', heading: 'Curated News', body: 'News articles with AI-assisted LinkedIn captions.' },
      { kicker: 'Marketing', heading: 'Approved Campaign Posts', body: 'Pre-approved copy with image library support when available.' },
      { kicker: 'Important', heading: 'User Still Posts Manually', body: 'Constellation copies text and opens LinkedIn. The rep pastes and posts.' },
    ], 1.92);
    finishSlide(slide, 'Set expectations that Social Hub does not post automatically.');
  }

  {
    const slide = newSlide();
    title(slide, 'IRR and Proposals Move Deals Toward Approval', 'When opportunity work becomes financial or customer-facing, these tools take over.');
    twoColumn(slide,
      {
        kicker: 'IRR',
        heading: 'Model the Business Case',
        body: 'Multi-site inputs, target IRR, timeline settings, stress testing, Salesforce CSV import, PDF and CSV exports.',
      },
      {
        kicker: 'Proposals',
        heading: 'Deliver the Customer Artifact',
        body: 'Reusable modules, cover letter, pricing options, Salesforce import, compile/generate workflow, .spec save, account-linked proposals.',
      });
    finishSlide(slide, 'Connect IRR/proposals to late-stage opportunity support.');
  }

  {
    const slide = newSlide();
    title(slide, 'SAOS Is the Strategic Planning Layer', 'Use SAOS when account work needs more than tactical CRM execution.');
    dotList(slide, [
      'The account is strategically important',
      'Multiple stakeholders influence the decision',
      'The path to change is unclear',
      'Expansion potential matters',
      'Leadership needs a clear plan or export',
    ], 0.95, 2.05, 6.3, { gap: 0.44, fontSize: 13 });
    statement(slide, 'Main CRM captures execution. SAOS captures strategic judgment.', 7.75, 2.25, 4.0, 1.85, { fontSize: 18.8 });
    finishSlide(slide, 'SAOS pointer only; refer to SAOS handbook for depth.');
  }

  {
    const slide = newSlide();
    title(slide, 'External Systems: The Practical Reality', 'Constellation reduces switching, but some actions still finish outside the CRM.');
    addModuleCards(slide, [
      { kicker: 'Salesforce', heading: 'Official Task and Record Sync', body: 'Activity logging opens pre-filled Salesforce tasks; imports support IRR and proposals.' },
      { kicker: 'ZoomInfo', heading: 'Research Enrichment', body: 'Account and contact workflows can open ZoomInfo for deeper research.' },
      { kicker: 'LinkedIn', heading: 'User-Completed Actions', body: 'Sequence and Social Hub actions may copy text and open LinkedIn, but users complete the post or message.' },
    ], 1.86);
    finishSlide(slide, 'Clarify external system behavior.');
  }

  {
    const slide = newSlide();
    title(slide, 'What Good Daily Usage Looks Like', 'Useful CRM work creates clear next action.');
    dotList(slide, [
      'Review AI Daily Briefing',
      'Clear urgent tasks',
      'Work due sequence steps',
      'Log meaningful activity',
      'Act on high-value Cognito alerts',
    ], 1.0, 2.0, 5.8, { gap: 0.44, fontSize: 13.2 });
    card(slide, {
      x: 7.45,
      y: 1.95,
      w: 4.3,
      h: 2.35,
      kicker: 'Quality bar',
      heading: 'The Record Should Explain What Happened and What Should Happen Next.',
      body: 'If it only stores noise, it is not helping the rep or the team.',
      fill: C.paleBlue2,
    });
    finishSlide(slide, 'Daily usage standard.');
  }

  {
    const slide = newSlide();
    title(slide, 'Before Forecast, Meetings, and Proposals', 'Three moments where CRM discipline shows up clearly.');
    addModuleCards(slide, [
      { kicker: 'Forecast', heading: 'Be Honest', body: 'Commit only real deals, update close months, flag renewals, and move losses to Closed Lost.' },
      { kicker: 'Meetings', heading: 'Prep From the Account', body: 'Review contacts, org chart, activities, deals, proposals, AI briefing, agenda, and SAOS if needed.' },
      { kicker: 'Proposals', heading: 'Clean Before Delivery', body: 'Confirm properties, pricing, placeholders, compile checks, and save to the account.' },
    ], 1.86);
    finishSlide(slide, 'Highlight high-leverage CRM quality moments.');
  }

  {
    const slide = newSlide({ wash: true });
    addLogo(slide, 0.78, 0.62, 1.28);
    slide.addText('The Close', {
      x: 0.82,
      y: 1.5,
      w: 4,
      h: 0.24,
      fontSize: 11,
      bold: true,
      color: C.slate,
      margin: 0,
    });
    slide.addText('The Best CRM Usage Creates a Clear Next Action.', {
      x: 0.82,
      y: 2.05,
      w: 7.0,
      h: 0.82,
      fontSize: 25.5,
      bold: true,
      color: C.ink,
      margin: 0,
      fit: 'shrink',
      breakLine: true,
    });
    statement(slide, 'If a record does not help you decide what happened, what matters, who is involved, what should change, or what to do next, it is just storage.', 0.82, 3.65, 8.6, 1.4, { fontSize: 17.2, fill: C.white });
    finishSlide(slide, 'Closing principle from the handbook.');
  }
}

slides();

pptx.writeFile({ fileName: OUTPUT }).then(() => {
  console.log(`Wrote ${OUTPUT}`);
});
