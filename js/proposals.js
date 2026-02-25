// proposals.js – nav + SVG bootstrap only; Enterprise logic in enterprise-proposals-embed.js

import { injectGlobalNavigation, loadSVGs } from './shared_constants.js';

document.addEventListener('DOMContentLoaded', async () => {
    injectGlobalNavigation();
    await loadSVGs();
});
