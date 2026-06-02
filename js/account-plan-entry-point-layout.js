/**
 * Shared entry-point pagination + density rules for dossier PDF and exec PPTX.
 *
 * Layout modes:
 * - slim:    triple stacks (3 profiles on one page)
 * - roomy:   double stacks (2 or 4 profiles on one page)
 * - default: single profile or unmatched counts
 */

/**
 * @param {number} totalProfiles
 * @returns {{ start: number, count: number }[]}
 */
export function planEntryPointPageRanges(totalProfiles) {
    if (totalProfiles <= 0) return [];
    if (totalProfiles <= 3) return [{ start: 0, count: totalProfiles }];
    if (totalProfiles === 4) {
        return [{ start: 0, count: 2 }, { start: 2, count: 2 }];
    }
    if (totalProfiles === 5) {
        return [{ start: 0, count: 3 }, { start: 3, count: 2 }];
    }
    if (totalProfiles === 6) {
        return [{ start: 0, count: 3 }, { start: 3, count: 3 }];
    }

    /** @type {{ start: number, count: number }[]} */
    const ranges = [];
    let start = 0;
    let remaining = totalProfiles;

    while (remaining > 0) {
        if (remaining > 6) {
            ranges.push({ start, count: 3 });
            start += 3;
            remaining -= 3;
            continue;
        }

        if (remaining === 6) {
            ranges.push({ start, count: 3 }, { start: start + 3, count: 3 });
            break;
        }
        if (remaining === 5) {
            ranges.push({ start, count: 3 }, { start: start + 3, count: 2 });
            break;
        }
        if (remaining === 4) {
            ranges.push({ start, count: 2 }, { start: start + 2, count: 2 });
            break;
        }
        if (remaining === 3) {
            ranges.push({ start, count: 3 });
            break;
        }
        if (remaining === 2) {
            ranges.push({ start, count: 2 });
            break;
        }

        const prev = ranges[ranges.length - 1];
        if (prev && prev.count < 3) {
            prev.count += 1;
        } else {
            ranges.push({ start, count: 1 });
        }
        break;
    }

    return ranges;
}

/**
 * @param {number} profileCount
 * @returns {'slim' | 'roomy' | 'default'}
 */
export function getEntryPointLayoutMode(profileCount) {
    if (profileCount === 3) return 'slim';
    if (profileCount === 2 || profileCount === 4) return 'roomy';
    return 'default';
}

/**
 * @param {number} profileCount
 * @returns {string | null}
 */
export function getEntryPointPdfLayoutModifier(profileCount) {
    if (profileCount === 3) return 'ap-export-target-profiles-body--per-page-3';
    if (profileCount === 2 || profileCount === 4) return 'ap-export-target-profiles-body--per-page-2';
    return null;
}
