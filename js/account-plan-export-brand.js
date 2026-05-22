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

/**
 * @param {Date} date
 */
export function formatGpcFooterDate(date) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
