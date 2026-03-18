import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/**
 * Logs structured failure details to CI stdout for Guardian / self-healing review.
 * Playwright still writes screenshots to test-results/ and HTML report.
 */
export default class GuardianReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status !== 'failed' && result.status !== 'timedOut') return;
    const title = test.titlePath().join(' › ');
    console.error('\n[Guardian E2E] ═══════════════════════════════════════');
    console.error(`[Guardian E2E] FAILED: ${title}`);
    console.error(`[Guardian E2E] Status: ${result.status}`);
    if (result.error?.message) {
      console.error(`[Guardian E2E] Message:\n${result.error.message}`);
    }
    if (result.error?.stack) {
      console.error(`[Guardian E2E] Stack (first lines):\n${result.error.stack.split('\n').slice(0, 12).join('\n')}`);
    }
    const attachments = result.attachments?.filter((a) => a.name?.includes('screenshot') || a.path?.includes('test-results'));
    if (attachments?.length) {
      console.error('[Guardian E2E] Attachments:', attachments.map((a) => a.path || a.name).join(', '));
    }
    console.error('[Guardian E2E] Review: test-results/ + playwright-report/index.html');
    console.error('[Guardian E2E] ═══════════════════════════════════════\n');
  }
}
