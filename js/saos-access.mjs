/**
 * Shared SAOS access helpers.
 *
 * SAOS ownership is canonicalized through accounts.user_id. account_plans does
 * not have its own owner column; its account_id points to the owned account.
 */

function normalizeId(value) {
    return value == null ? '' : String(value).trim();
}

export function getSaosOwnerIds(appState = {}) {
    const currentUserId = normalizeId(appState.currentUser?.id);
    if (!currentUserId) return [];

    const ownerIds = [currentUserId];
    if (appState.isManager === true) {
        ownerIds.push(...(appState.managedUsers || []).map((user) => (
            normalizeId(user?.id || user?.user_id)
        )));
    }

    return Array.from(new Set(ownerIds.filter(Boolean)));
}

export function getSaosAccountIds(accounts = []) {
    return Array.from(new Set(
        accounts
            .map((account) => Number(account?.id))
            .filter((accountId) => Number.isSafeInteger(accountId) && accountId > 0)
    ));
}

export function resolveAccessibleAccountId(accounts = [], requestedAccountId) {
    const requested = Number(requestedAccountId);
    if (!Number.isSafeInteger(requested) || requested < 1) return null;

    const match = accounts.find((account) => Number(account?.id) === requested);
    return match ? requested : null;
}

export function canUseSaosImpersonation(appState = {}, ownerId) {
    if (appState.isManager !== true) return false;
    const requestedOwnerId = normalizeId(ownerId);
    return requestedOwnerId !== '' && getSaosOwnerIds(appState).includes(requestedOwnerId);
}
