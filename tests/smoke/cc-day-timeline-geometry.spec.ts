import { test, expect } from '@playwright/test';

/**
 * Static fixture: events + hover must sit inside the month modal day pane,
 * at/right of the ledger rule — never near viewport y≈0 (the "air ball").
 */
test.describe('Command Center day timeline ledger', () => {
  test('events stay inside modal day pane, right of the ledger', async ({ page }) => {
    await page.goto('/tests/fixtures/cc-day-timeline-ledger.html');
    await page.waitForSelector('.cc-day-timeline-event');

    const geometry = await page.evaluate(() => {
      const modal = document.querySelector('.cc-month-calendar-modal');
      const dayPanel = document.querySelector('.cc-month-day-panel');
      const rule = document.querySelector('.cc-day-timeline-rule');
      const canvas = document.querySelector('.cc-day-timeline-canvas');
      const track = document.querySelector('.cc-day-timeline-track');
      if (!modal || !dayPanel || !rule || !canvas || !track) {
        return { ok: false, reason: 'missing modal/day panel/rule/canvas/track' };
      }

      const modalRect = modal.getBoundingClientRect();
      const panelRect = dayPanel.getBoundingClientRect();
      const ruleRight = rule.getBoundingClientRect().right;
      const canvasRect = canvas.getBoundingClientRect();
      const trackRect = track.getBoundingClientRect();
      const canvasCs = getComputedStyle(canvas);

      const nodes = [
        ...document.querySelectorAll('.cc-day-timeline-event'),
        ...document.querySelectorAll('.cc-day-timeline-hover'),
      ];

      const results = nodes.map((el) => {
        const r = el.getBoundingClientRect();
        const insideModal =
          r.top >= modalRect.top - 1 &&
          r.bottom <= modalRect.bottom + 1 &&
          r.left >= modalRect.left - 1 &&
          r.right <= modalRect.right + 1;
        const insidePanel =
          r.top >= panelRect.top - 1 &&
          r.bottom <= panelRect.bottom + 1 &&
          r.left >= panelRect.left - 1 &&
          r.right <= panelRect.right + 1;
        const rightOfRule = r.left + 0.5 >= ruleRight;
        const notViewportAirBall = r.top > 40;
        return {
          className: el.className,
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
          ruleRight,
          insideModal,
          insidePanel,
          rightOfRule,
          notViewportAirBall,
          ok: insideModal && insidePanel && rightOfRule && notViewportAirBall && r.height > 0,
        };
      });

      return {
        ok:
          results.length > 0 &&
          results.every((r) => r.ok) &&
          canvasCs.position === 'relative' &&
          canvasRect.height > 40 &&
          trackRect.height > 40,
        canvasPosition: canvasCs.position,
        canvasHeight: canvasRect.height,
        trackHeight: trackRect.height,
        modalTop: modalRect.top,
        results,
      };
    });

    expect(geometry.ok, JSON.stringify(geometry, null, 2)).toBe(true);
  });
});
