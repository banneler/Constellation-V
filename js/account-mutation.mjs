function errorText(error) {
    return [
        error?.message,
        error?.details,
        error?.hint,
        error?.code,
        error?.status,
        error?.name
    ].filter(Boolean).join(' ').toLowerCase();
}

export function getAccountMutationErrorMessage(error, action = 'save') {
    const verb = action === 'create' ? 'create' : 'save';
    const text = errorText(error);

    if (error?.code === '23505' || text.includes('duplicate key') || text.includes('unique constraint')) {
        return 'An account with this name already exists. Choose a different name or open the existing account.';
    }
    if (
        error?.status === 401
        || error?.code === 'PGRST301'
        || text.includes('jwt')
        || text.includes('session')
        || text.includes('not authenticated')
        || text.includes('authentication')
    ) {
        return `Your sign-in session is no longer valid. Sign in again, then ${verb} the account.`;
    }
    if (
        error?.status === 403
        || error?.code === '42501'
        || text.includes('row-level security')
        || text.includes('row level security')
        || text.includes('permission denied')
        || text.includes('not authorized')
    ) {
        return `You do not have access to ${verb} this account. Ask your administrator to verify your account access.`;
    }
    if (
        error instanceof TypeError
        || text.includes('failed to fetch')
        || text.includes('network')
        || text.includes('load failed')
        || text.includes('timeout')
        || text.includes('offline')
    ) {
        return `The account could not be ${verb === 'create' ? 'created' : 'saved'} because of a connection problem. Check your connection and try again.`;
    }
    return `We couldn't ${verb} this account. Please try again. If the problem continues, contact your administrator.`;
}
