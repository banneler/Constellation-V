#!/usr/bin/env node
/**
 * Push branded Constellation Auth email templates to a Supabase project.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/push-auth-email-templates.js --project-ref iudcdraytwduxkoromut
 *   node scripts/push-auth-email-templates.js --project-ref iudcdraytwduxkoromut --site-url https://sales.constellation-crm.com
 *
 * Token: Dashboard → Account → Access Tokens, or macOS Keychain "Supabase CLI".
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function parseArgs(argv) {
  const out = { projectRef: null, siteUrl: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--project-ref') out.projectRef = argv[++i];
    if (argv[i] === '--site-url') out.siteUrl = argv[++i];
  }
  return out;
}

function getAccessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  try {
    const raw = execSync('security find-generic-password -s "Supabase CLI" -w', {
      encoding: 'utf8'
    }).trim();
    if (raw.startsWith('go-keyring-base64:')) {
      return Buffer.from(raw.slice('go-keyring-base64:'.length), 'base64').toString('utf8');
    }
    return raw;
  } catch {
    return '';
  }
}

async function main() {
  const { projectRef, siteUrl } = parseArgs(process.argv.slice(2));
  if (!projectRef) {
    console.error('Missing --project-ref');
    process.exit(1);
  }

  const token = getAccessToken();
  if (!token) {
    console.error('Missing SUPABASE_ACCESS_TOKEN (or Supabase CLI keychain entry)');
    process.exit(1);
  }

  // Ensure HTML is current
  require('../supabase/email-templates/build.js');

  const templatesDir = path.join(__dirname, '..', 'supabase', 'email-templates');
  const manifest = JSON.parse(fs.readFileSync(path.join(templatesDir, 'manifest.json'), 'utf8'));

  const payload = {
    mailer_subjects_confirmation: manifest.confirmation.subject,
    mailer_templates_confirmation_content: fs.readFileSync(path.join(templatesDir, 'confirmation.html'), 'utf8'),
    mailer_subjects_invite: manifest.invite.subject,
    mailer_templates_invite_content: fs.readFileSync(path.join(templatesDir, 'invite.html'), 'utf8'),
    mailer_subjects_recovery: manifest.recovery.subject,
    mailer_templates_recovery_content: fs.readFileSync(path.join(templatesDir, 'recovery.html'), 'utf8'),
    mailer_subjects_magic_link: manifest.magic_link.subject,
    mailer_templates_magic_link_content: fs.readFileSync(path.join(templatesDir, 'magic_link.html'), 'utf8'),
    mailer_subjects_email_change: manifest.email_change.subject,
    mailer_templates_email_change_content: fs.readFileSync(path.join(templatesDir, 'email_change.html'), 'utf8')
  };

  if (siteUrl) {
    payload.site_url = siteUrl;
    payload.uri_allow_list = [
      `${siteUrl.replace(/\/$/, '')}/**`,
      'https://constellation-sales.vercel.app/**',
      'http://localhost:3000/**',
      'http://127.0.0.1:3000/**'
    ].join(',');
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Failed (${res.status}): ${text}`);
    process.exit(1);
  }

  const json = JSON.parse(text);
  console.log('Updated auth email templates for', projectRef);
  console.log('confirmation subject:', json.mailer_subjects_confirmation);
  console.log('site_url:', json.site_url);
  console.log('confirmation starts with:', String(json.mailer_templates_confirmation_content || '').slice(0, 80));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
