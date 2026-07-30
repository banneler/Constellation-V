const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
// Comma-separated allow-list for client UX (server enforcement is the Auth hook + signup_email_domains table).
const APPROVED_SIGNUP_DOMAINS = (process.env.APPROVED_SIGNUP_DOMAINS || '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const outPath = path.join(__dirname, '..', 'js', 'env.config.js');
const content = `// Auto-generated at build time from environment variables
export const SUPABASE_URL = ${JSON.stringify(SUPABASE_URL)};
export const SUPABASE_ANON_KEY = ${JSON.stringify(SUPABASE_ANON_KEY)};
export const APPROVED_SIGNUP_DOMAINS = ${JSON.stringify(APPROVED_SIGNUP_DOMAINS)};
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log('Wrote js/env.config.js');
console.log(
  `[inject-env] SUPABASE_URL length: ${SUPABASE_URL.length}, SUPABASE_ANON_KEY length: ${SUPABASE_ANON_KEY.length}, APPROVED_SIGNUP_DOMAINS: ${APPROVED_SIGNUP_DOMAINS.join(',') || '(none)'}`
);
