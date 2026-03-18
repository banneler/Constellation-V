import { test, expect } from '@playwright/test';
import { guardian, guardianCaptureFailure } from '../helpers/guardian-log';
import { SequencesPage } from '../pages/sequences.page';

test.describe('Sequences (functional)', () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      await guardianCaptureFailure(page, testInfo.title);
    }
  });

  test('create sequence and add Email step', async ({ page }) => {
    const seq = new SequencesPage(page);
    page.on('dialog', (d) => d.accept().catch(() => {}));

    guardian.step('Opening Sequences');
    await seq.goto();

    const name = `E2E Seq ${Date.now()}`;
    guardian.step(`Creating sequence: ${name}`);
    await seq.createSequence(name);

    await expect(seq.sequenceNameInput()).toHaveValue(name, { timeout: 25_000 });

    guardian.step('Adding Email step');
    await seq.addEmailStep();
    await expect(page.locator('#sequence-steps-flow')).toContainText('Email', { timeout: 20_000 });
  });
});
