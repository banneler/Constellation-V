import type { Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/guardian-log';

/** sequences.html — createSequence, updateSequenceDetails */
export class SequencesPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/sequences.html');
    await waitForAppReady(this.page);
  }

  addSequenceBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#add-sequence-btn');
  }

  sequenceNameInput(): ReturnType<Page['locator']> {
    return this.page.locator('#sequence-name');
  }

  sequenceDescription(): ReturnType<Page['locator']> {
    return this.page.locator('#sequence-description');
  }

  sequenceList(): ReturnType<Page['locator']> {
    return this.page.locator('#sequence-list');
  }

  sequenceDetails(): ReturnType<Page['locator']> {
    return this.page.locator('#sequence-details');
  }

  modalSequenceName(): ReturnType<Page['locator']> {
    return this.page.locator('#modal-sequence-name');
  }

  modalConfirmBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#modal-confirm-btn');
  }

  /** Intent: create new personal sequence */
  async createSequence(name: string): Promise<void> {
    await this.addSequenceBtn().click();
    await this.modalSequenceName().waitFor({ state: 'visible', timeout: 10_000 });
    await this.modalSequenceName().fill(name);
    await this.page.getByRole('button', { name: 'Create' }).click();
    await this.page.locator('#modal-backdrop').waitFor({ state: 'hidden', timeout: 25_000 });
  }

  addStepBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#add-step-btn');
  }

  /** Intent: add Email step to selected sequence */
  async addEmailStep(): Promise<void> {
    await this.addStepBtn().click();
    await this.page.locator('#modal-step-type').fill('Email');
    await this.page.getByRole('button', { name: 'Add Step' }).click();
    await this.page.locator('#modal-backdrop').waitFor({ state: 'hidden', timeout: 20_000 });
  }
}
