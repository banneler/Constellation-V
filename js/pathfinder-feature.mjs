export function isPathfinderEnabled(orgSettings) {
    return orgSettings?.pathfinder_enabled === true;
}

export function applyPathfinderNavigation(root, enabled) {
    const pathfinderNav = root?.getElementById?.('pathfinder-nav-button');
    if (!pathfinderNav) return false;

    const shouldShow = enabled === true;
    pathfinderNav.classList.toggle('hidden', !shouldShow);
    pathfinderNav.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    return true;
}
