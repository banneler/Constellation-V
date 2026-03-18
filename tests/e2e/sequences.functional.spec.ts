import { test, expect } from '@playwright/test';
import { guardian } from '../helpers/guardian-log';
import { SequencesPage } from '../pages/sequences.page';

test.describe('Sequences (functional)', () => {
  test('create sequence and add Email step', async ({ page }) => {
    const seq = new SequencesPage(page);
    guardian.step('Opening Sequences');
    await seq.goto();

    const name = `E2E Seq ${Date.now()}`;
    guardian.step(`Creating sequence via modal: ${name}`);
    await seq.createSequence(name);

    guardian.step('Verifying details panel shows new sequence name');
    await expect(seq.sequenceNameInput()).toHaveValue(name, { timeout: 15_000 });

    guardian.step('Adding Email step to sequence');
    await seq.addEmailStep();
    await expect(page.locator('#sequence-steps-flow')).toContainText('Email', { timeout: 15_000 });
  });
});
