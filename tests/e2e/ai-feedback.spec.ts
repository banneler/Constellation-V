import { test, expect } from '@playwright/test';
import { guardianRun } from '../helpers/guardian-log';

type FeedbackEvents = {
  inserts: Array<{ table: string; payload: Record<string, unknown> }>;
  updates: Array<{
    table: string;
    payload: Record<string, unknown>;
    eq?: { column: string; value: string };
  }>;
};

test.describe('AI feedback memory', () => {
  test('shared feedback widget creates context and saves rating/comment once', async ({ page }) => {
    await guardianRun(page, 'open host page', async () => {
      await page.goto('/ai-admin.html', { waitUntil: 'load' });
    });

    await guardianRun(page, 'mount shared feedback widget with fake Supabase client', async () => {
      await page.evaluate(async () => {
        const events: FeedbackEvents = { inserts: [], updates: [] };
        (window as typeof window & { __feedbackEvents?: FeedbackEvents }).__feedbackEvents = events;

        const fakeSupabase = {
          from(table: string) {
            return {
              insert(payload: Record<string, unknown>) {
                events.inserts.push({ table, payload });
                return {
                  select() {
                    return {
                      async single() {
                        return { data: { id: 'ctx-e2e-feedback' }, error: null };
                      },
                    };
                  },
                };
              },
              update(payload: Record<string, unknown>) {
                const updateEvent = { table, payload };
                events.updates.push(updateEvent);
                return {
                  async eq(column: string, value: string) {
                    updateEvent.eq = { column, value };
                    return { error: null };
                  },
                };
              },
            };
          },
        };

        const host = document.createElement('section');
        host.id = 'e2e-feedback-host';
        document.body.appendChild(host);

        const aiMemory = await import('/js/ai-memory.js');
        await aiMemory.mountAIFeedback(host, fakeSupabase, {
          userId: 'user-e2e',
          prompt: 'E2E prompt requiring concise outreach',
          response: 'E2E generated response',
          label: 'Was this E2E AI response useful?',
          functionId: 'contacts-email',
        });
      });
    });

    const feedback = page.locator('#e2e-feedback-host .ai-feedback');
    const submit = feedback.locator('.ai-feedback-submit');

    await expect(feedback).toBeVisible();
    await expect(feedback).toHaveAttribute('data-context-id', 'ctx-e2e-feedback');

    await guardianRun(page, 'require rating before submit', async () => {
      await submit.click();
      await expect(feedback.locator('.ai-feedback-status')).toContainText('Select a rating');
    });

    await guardianRun(page, 'save selected rating and comment', async () => {
      await feedback.locator('.ai-feedback-rating-btn[data-rating="4"]').click();
      await feedback.locator('.ai-feedback-text').fill('Keep this concise and outcome-led.');
      await submit.click();

      await expect(submit).toHaveText('Feedback Saved');
      await expect(submit).toHaveAttribute('data-saved', 'true');
      await expect(feedback.locator('.ai-feedback-status')).toContainText('improve future AI responses');
    });

    await guardianRun(page, 'verify Supabase insert and update payloads', async () => {
      const events = await page.evaluate(
        () => (window as typeof window & { __feedbackEvents?: FeedbackEvents }).__feedbackEvents
      );

      expect(events?.inserts).toEqual([
        {
          table: 'personal_context',
          payload: {
            user_id: 'user-e2e',
            function_id: 'contacts-email',
            prompt: 'E2E prompt requiring concise outreach',
            response: 'E2E generated response',
            processed: false,
          },
        },
      ]);
      expect(events?.updates).toEqual([
        {
          table: 'personal_context',
          payload: {
            rating: 4,
            feedback: 'Keep this concise and outcome-led.',
          },
          eq: {
            column: 'id',
            value: 'ctx-e2e-feedback',
          },
        },
      ]);
    });
  });
});
