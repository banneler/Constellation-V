import { test, expect } from '@playwright/test';
import { guardian } from '../helpers/guardian-log';
import { ProposalsPage } from '../pages/proposals.page';

test.describe('Proposals (functional)', () => {
  test('proposal module toggles update main UI; properties filled', async ({ page }) => {
    const p = new ProposalsPage(page);
    guardian.step('Loading Proposals builder');
    await p.goto();

    guardian.step('Selecting Impact & ROI module — expect section visible');
    await p.selectProposalModuleImpactRoi();
    await expect(p.impactRoiSection()).toBeVisible({ timeout: 10_000 });
    await expect(p.impactRoiSection()).not.toHaveClass(/hidden/);

    guardian.step('Selecting Custom Page module');
    await p.selectProposalModuleCustomPage();
    await expect(p.customTextSection()).toBeVisible({ timeout: 10_000 });

    guardian.step('Filling RFP / Business name for compile readiness');
    await p.fillProposalProperties(`RFP ${Date.now()}`, 'E2E Business');
    await expect(p.globalRfp()).toHaveValue(/RFP/);
    await expect(p.globalBiz()).toHaveValue('E2E Business');
  });
});
