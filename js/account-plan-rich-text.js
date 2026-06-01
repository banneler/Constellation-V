/**
 * Shared rich-text formatters for 30/60/90 plan horizons.
 */

const BULLET_PREFIX = /^[\u2022\u2023\u2043\u2219*\-–—]\s+|^\d+[.)]\s+/;

/**
 * @param {string} text
 */
function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {string} text
 */
function enrichPlanHorizonInline(text) {
    let html = escapeHtml(text);
    html = html.replace(
        /\((owners?:\s*[^)]+)\)/gi,
        ' <span class="plan-horizon-meta">($1)</span>'
    );
    html = html.replace(
        /\b(owners?:\s*[\w\s+&/,-]+)$/i,
        '<span class="plan-horizon-meta">$1</span>'
    );
    return html;
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function formatPlanHorizonRichHtml(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return '<p class="plan-horizon-empty">—</p>';

    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const isBulletBlock = lines.length > 0 && lines.every((line) => BULLET_PREFIX.test(line));

    if (isBulletBlock) {
        const items = lines.map((line) => {
            const content = line.replace(BULLET_PREFIX, '');
            return `<li>${enrichPlanHorizonInline(content)}</li>`;
        }).join('');
        return `<ul class="plan-horizon-list">${items}</ul>`;
    }

    return lines
        .map((line) => `<p class="plan-horizon-para">${enrichPlanHorizonInline(line)}</p>`)
        .join('');
}

/**
 * Compact HTML preview for the strategic rail card.
 * @param {unknown} raw
 * @param {number} [maxItems]
 */
export function formatPlanHorizonRailPreviewHtml(raw, maxItems = 3) {
    const text = String(raw ?? '').trim();
    if (!text) return '—';

    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const bullets = lines.filter((line) => BULLET_PREFIX.test(line)).slice(0, maxItems);

    if (bullets.length === 0) {
        const preview = text.length > 160 ? `${text.slice(0, 159)}…` : text;
        return escapeHtml(preview);
    }

    const items = bullets.map((line) => {
        const content = line.replace(BULLET_PREFIX, '');
        return `<li>${enrichPlanHorizonInline(content)}</li>`;
    }).join('');

    return `<ul class="plan-horizon-list plan-horizon-list--compact">${items}</ul>`;
}
