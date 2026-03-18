const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

const outPath = path.join(__dirname, '..', 'js', 'env.config.js');
const content = `// Auto-generated at build time from environment variables
export const SUPABASE_URL = ${JSON.stringify(SUPABASE_URL)};
export const SUPABASE_ANON_KEY = ${JSON.stringify(SUPABASE_ANON_KEY)};
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log('Wrote js/env.config.js');
console.log(
  `[inject-env] SUPABASE_URL length: ${SUPABASE_URL.length}, SUPABASE_ANON_KEY length: ${SUPABASE_ANON_KEY.length}`
);
