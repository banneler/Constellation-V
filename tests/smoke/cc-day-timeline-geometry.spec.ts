import { test, expect } from '@playwright/test';

/**
 * Static fixture: events + hover must sit at/right of the ledger rule.
 * No auth — serves local HTML + compiled output.css.
 */
test.describe('Command Center day timeline ledger', () => {
  test('events and hover stay right of the vertical rule', async ({ page }) => {
    await page.goto('/tests/fixtures/cc-day-timeline-ledger.html');
    await page.waitForSelector('.cc-day-timeline-event');

    const geometry = await page.evaluate(() => {
      const rule = document.querySelector('.cc-day-timeline-rule');
      if (!rule) return { ok: false, reason: 'missing rule' };
      const ruleRight = rule.getBoundingClientRect().right;
      const nodes = [
        ...document.querySelectorAll('.cc-day-timeline-event'),
        ...document.querySelectorAll('.cc-day-timeline-hover'),
      ];
      const results = nodes.map((el) => {
        const left = el.getBoundingClientRect().left;
        return {
          className: el.className,
          left,
          ruleRight,
          ok: left + 0.5 >= ruleRight,
        };
      });
      return {
        ok: results.length > 0 && results.every((r) => r.ok),
        ruleRight,
        results,
      };
    });

    expect(geometry.ok, JSON.stringify(geometry, null, 2)).toBe(true);
  });
});
