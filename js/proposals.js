// proposals.js – nav + SVG bootstrap only; Enterprise logic in enterprise-proposals-embed.js

import { injectGlobalNavigation, loadSVGs, hideGlobalLoader } from './shared_constants.js';

document.addEventListener('DOMContentLoaded', async () => {
    injectGlobalNavigation();
    await loadSVGs();
    // Proposals page has no data load; keep loader visible for 1.5s for consistent UX
    setTimeout(hideGlobalLoader, 1500);
});
