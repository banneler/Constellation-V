const fs = require('fs');
const path = require('path');
const { layout } = require('./layout');

const templates = {
  confirmation: {
    subject: 'Welcome to Constellation — confirm your email',
    html: layout({
      kicker: 'Welcome aboard',
      title: 'Confirm your Constellation account',
      bodyHtml: `
        <p style="margin:0 0 12px;">You're almost in. Confirm <strong style="color:#0f172a;">{{ .Email }}</strong> to finish creating your Constellation CRM account.</p>
        <p style="margin:0;">Once confirmed, you can sign in and start running account strategy and execution in one place.</p>
      `,
      ctaLabel: 'Confirm email & get started',
      footerNote: 'If you did not create a Constellation account, you can ignore this email.'
    })
  },
  invite: {
    subject: "You're invited to Constellation CRM",
    html: layout({
      kicker: 'Team invite',
      title: "You've been invited to Constellation",
      bodyHtml: `
        <p style="margin:0 0 12px;">A teammate invited <strong style="color:#0f172a;">{{ .Email }}</strong> to join their Constellation CRM workspace.</p>
        <p style="margin:0;">Accept the invite to set your password and jump into Command Center.</p>
      `,
      ctaLabel: 'Accept invitation',
      footerNote: 'If you were not expecting this invite, you can ignore this email.'
    })
  },
  recovery: {
    subject: 'Reset your Constellation password',
    html: layout({
      kicker: 'Security',
      title: 'Reset your password',
      bodyHtml: `
        <p style="margin:0 0 12px;">We received a request to reset the password for <strong style="color:#0f172a;">{{ .Email }}</strong>.</p>
        <p style="margin:0;">Choose a new password using the button below. The link expires shortly.</p>
      `,
      ctaLabel: 'Reset password',
      footerNote: "If you didn't request a reset, you can safely ignore this email."
    })
  },
  magic_link: {
    subject: 'Your Constellation sign-in link',
    html: layout({
      kicker: 'Sign in',
      title: 'Your one-time sign-in link',
      bodyHtml: `
        <p style="margin:0 0 12px;">Use the button below to sign in to Constellation as <strong style="color:#0f172a;">{{ .Email }}</strong>.</p>
        <p style="margin:0;">This link expires shortly and can only be used once.</p>
      `,
      ctaLabel: 'Sign in to Constellation',
      footerNote: "If you didn't request this link, you can ignore this email."
    })
  },
  email_change: {
    subject: 'Confirm your new Constellation email',
    html: layout({
      kicker: 'Account update',
      title: 'Confirm your new email address',
      bodyHtml: `
        <p style="margin:0 0 12px;">Confirm <strong style="color:#0f172a;">{{ .NewEmail }}</strong> as the new email for your Constellation account.</p>
        <p style="margin:0;">Until you confirm, your existing email remains active.</p>
      `,
      ctaLabel: 'Confirm new email',
      footerNote: "If you didn't request this change, contact your Constellation admin."
    })
  }
};

const outDir = __dirname;
const manifest = {};

for (const [key, value] of Object.entries(templates)) {
  const file = path.join(outDir, `${key}.html`);
  fs.writeFileSync(file, value.html.trim() + '\n', 'utf8');
  manifest[key] = { subject: value.subject, file: `${key}.html` };
  console.log(`Wrote ${key}.html`);
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('Wrote manifest.json');
