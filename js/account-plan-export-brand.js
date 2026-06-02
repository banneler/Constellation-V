/**
 * GPC corporate brand tokens for Strategic Account OS exports.
 * Aligned with GPC PowerPoint template guide (Arial Nova family, approved palette).
 */

export const GPC_BRAND = Object.freeze({
    navyDark: '#051B2D',
    navyDeep: '#092E4C',
    teal: '#1181AA',
    lime: '#9CCA3C',
    gray: '#D1D1D1',
    textDark: '#051B2D',
    white: '#ffffff',
    fontHeading: '"Arial Nova", Arial, Helvetica, sans-serif',
    fontBody: '"Arial Nova Light", "Arial Nova", Arial, Helvetica, sans-serif',
    companyName: 'Great Plains Communications',
});

export const GPC_LOGO_WHITE = 'assets/gpc/GPC-White-Logo.png';
export const GPC_LOGO_NAVY = 'assets/gpc/GPC-Navy-Logo.png';

/** Native logo asset dimensions — used to preserve aspect ratio in PPTX. */
export const GPC_LOGO_NATURAL_WIDTH = 1022;
export const GPC_LOGO_NATURAL_HEIGHT = 441;
export const GPC_LOGO_ASPECT = GPC_LOGO_NATURAL_WIDTH / GPC_LOGO_NATURAL_HEIGHT;

/**
 * Fit a logo inside a bounding box without stretching.
 * @param {number} maxW
 * @param {number} maxH
 * @param {number} [aspect]
 * @returns {{ w: number, h: number }}
 */
export function fitLogoDimensions(maxW, maxH, aspect = GPC_LOGO_ASPECT) {
    let w = maxW;
    let h = w / aspect;
    if (h > maxH) {
        h = maxH;
        w = h * aspect;
    }
    return { w, h };
}

/**
 * Top-right logo slot — returns x/y/w/h with aspect ratio preserved.
 * @param {number} slotX
 * @param {number} slotY
 * @param {number} slotW
 * @param {number} slotH
 * @param {number} [aspect]
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function positionLogoTopRight(slotX, slotY, slotW, slotH, aspect = GPC_LOGO_ASPECT) {
    const { w, h } = fitLogoDimensions(slotW, slotH, aspect);
    return {
        x: slotX + slotW - w,
        y: slotY + (slotH - h) / 2,
        w,
        h,
    };
}

/**
 * @param {Date} date
 */
export function formatGpcFooterDate(date) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
