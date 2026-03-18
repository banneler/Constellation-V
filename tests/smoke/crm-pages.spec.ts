import { test } from '@playwright/test';
import { runSmoke } from './smoke-helpers';

/** Root CRM pages with sidebar nav (requires authenticated session from seed). */
const CRM_HTML_PAGES = [
  'accounts.html',
  'admin.html',
  'ai-admin.html',
  'campaigns.html',
  'cognito.html',
  'command-center.html',
  'contacts.html',
  'deals.html',
  'irr.html',
  'marketing-hub.html',
  'proposals.html',
  'sequences.html',
  'social_hub.html',
  'user-guide.html',
] as const;

test.describe('Smoke (CRM — authenticated)', () => {
  for (const file of CRM_HTML_PAGES) {
    test(file, async ({ page }) => {
      await runSmoke(page, file, { shell: 'nav' });
    });
  }
});
