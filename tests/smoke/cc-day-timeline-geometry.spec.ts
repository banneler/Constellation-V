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

      const isPaintedBackground = (bg: string) => {
        const v = (bg || '').replace(/\s+/g, '').toLowerCase();
        return !!v && v !== 'transparent' && v !== 'rgba(0,0,0,0)' && v !== '#0000';
      };

      const nodes = [
        ...document.querySelectorAll('.cc-day-timeline-event'),
        ...document.querySelectorAll('.cc-day-timeline-hover'),
      ];

      const results = nodes.map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const isHover = el.classList.contains('cc-day-timeline-hover');
        const hoverVisible =
          !isHover || (el.classList.contains('is-active') && isPaintedBackground(cs.backgroundColor));
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
          backgroundColor: cs.backgroundColor,
          hoverVisible,
          ruleRight,
          insideModal,
          insidePanel,
          rightOfRule,
          notViewportAirBall,
          ok:
            insideModal &&
            insidePanel &&
            rightOfRule &&
            notViewportAirBall &&
            r.height > 0 &&
            hoverVisible,
        };
      });

      const hover = document.querySelector('.cc-day-timeline-hover.is-active');
      const hoverBg = hover ? getComputedStyle(hover).backgroundColor : null;

      return {
        ok:
          results.length > 0 &&
          results.every((r) => r.ok) &&
          canvasCs.position === 'relative' &&
          canvasRect.height > 40 &&
          trackRect.height > 40 &&
          isPaintedBackground(hoverBg || ''),
        canvasPosition: canvasCs.position,
        canvasHeight: canvasRect.height,
        trackHeight: trackRect.height,
        modalTop: modalRect.top,
        hoverBg,
        results,
      };
    });

    expect(geometry.ok, JSON.stringify(geometry, null, 2)).toBe(true);
  });

  test('60-min event height equals one hour slot; body has padding-top >= 6px', async ({ page }) => {
    await page.goto('/tests/fixtures/cc-day-timeline-ledger.html');
    await page.waitForSelector('.cc-day-timeline-event[data-duration-min="60"]');

    const check = await page.evaluate(() => {
      const canvas = document.querySelector('.cc-day-timeline-canvas');
      const events = [...document.querySelectorAll('.cc-day-timeline-event[data-duration-min="60"]')];
      if (!canvas || events.length < 1) {
        return { ok: false, reason: 'missing canvas or 60-min events' };
      }
      const canvasH = canvas.getBoundingClientRect().height;
      const hourSlot = canvasH / 11;
      const results = events.map((el) => {
        const body = el.querySelector('.cc-day-timeline-event-body');
        const r = el.getBoundingClientRect();
        const bodyCs = body ? getComputedStyle(body) : null;
        const padTop = bodyCs ? parseFloat(bodyCs.paddingTop) : 0;
        const heightOk = Math.abs(r.height - hourSlot) <= 1.5;
        const padOk = padTop >= 6;
        return {
          title: el.textContent?.trim().slice(0, 40),
          height: r.height,
          hourSlot,
          padTop,
          heightOk,
          padOk,
          ok: heightOk && padOk,
        };
      });
      return { ok: results.every((r) => r.ok), canvasH, hourSlot, results };
    });

    expect(check.ok, JSON.stringify(check, null, 2)).toBe(true);
  });

  test('45-min event height is 45/660 of the track (exclusive end)', async ({ page }) => {
    await page.goto('/tests/fixtures/cc-day-timeline-ledger.html');
    await page.waitForSelector('.cc-day-timeline-event[data-duration-min="45"]');

    const check = await page.evaluate(() => {
      const canvas = document.querySelector('.cc-day-timeline-canvas');
      const el = document.querySelector('.cc-day-timeline-event[data-duration-min="45"]');
      if (!canvas || !el) return { ok: false, reason: 'missing 45-min event' };
      const canvasH = canvas.getBoundingClientRect().height;
      const expected = (45 / 660) * canvasH;
      const h = el.getBoundingClientRect().height;
      return {
        ok: Math.abs(h - expected) <= 1.5,
        height: h,
        expected,
        canvasH,
      };
    });

    expect(check.ok, JSON.stringify(check, null, 2)).toBe(true);
  });

  test('pointermove activates hour-band hover ghost with painted background', async ({ page }) => {
    await page.goto('/tests/fixtures/cc-day-timeline-hover-live.html');
    await page.waitForSelector('#cc-day-timeline-track');

    const track = page.locator('#cc-day-timeline-track');
    const box = await track.boundingBox();
    expect(box, 'track bounding box').toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.35);
    await page.waitForTimeout(50);

    const hover = await page.evaluate(() => {
      const el = document.querySelector('.cc-day-timeline-hover');
      if (!el) return { ok: false, reason: 'missing hover' };
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const bg = (cs.backgroundColor || '').replace(/\s+/g, '').toLowerCase();
      const painted = !!bg && bg !== 'transparent' && bg !== 'rgba(0,0,0,0)' && bg !== '#0000';
      return {
        ok: el.classList.contains('is-active') && painted && r.height > 20 && r.width > 40,
        isActive: el.classList.contains('is-active'),
        backgroundColor: cs.backgroundColor,
        opacity: cs.opacity,
        height: r.height,
        width: r.width,
        top: el.style.top,
      };
    });

    expect(hover.ok, JSON.stringify(hover, null, 2)).toBe(true);
  });

  test('clicking event chip opens edit, not create; Google color is on the DOM', async ({ page }) => {
    await page.goto('/tests/fixtures/cc-day-timeline-hover-live.html');
    await page.waitForSelector('.cc-day-timeline-event[data-event-id="evt-2"]');

    const chip = page.locator('.cc-day-timeline-event[data-event-id="evt-2"]');
    const pe = await chip.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pe).toBe('auto');

    const colorAttr = await chip.getAttribute('data-event-color');
    expect(colorAttr).toBe('#F83A22');
    const inlineVar = await chip.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--cc-event-color').trim());
    expect(inlineVar.toUpperCase()).toBe('#F83A22');

    await chip.click();
    const action = await page.evaluate(() => (window as any).__ccLastAction);
    expect(action).toEqual({ type: 'edit', eventId: 'evt-2' });
  });
});
