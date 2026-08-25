import test from 'node:test';
import assert from 'node:assert/strict';
import { getAccountMutationErrorMessage } from '../../js/account-mutation.mjs';

test('account mutation errors map duplicate and access failures deterministically', () => {
    assert.equal(
        getAccountMutationErrorMessage({ code: '23505', message: 'duplicate key value violates unique constraint' }, 'create'),
        'An account with this name already exists. Choose a different name or open the existing account.'
    );
    assert.match(
        getAccountMutationErrorMessage({ code: '42501', message: 'new row violates row-level security policy' }, 'save'),
        /do not have access to save this account/
    );
});

test('account mutation errors map auth, network, and unknown failures safely', () => {
    assert.match(
        getAccountMutationErrorMessage({ status: 401, message: 'JWT expired' }, 'save'),
        /Sign in again/
    );
    assert.match(
        getAccountMutationErrorMessage(new TypeError('Failed to fetch'), 'create'),
        /connection problem/
    );
    const fallback = getAccountMutationErrorMessage({ message: 'database host secret-internal-detail' }, 'save');
    assert.equal(
        fallback,
        "We couldn't save this account. Please try again. If the problem continues, contact your administrator."
    );
    assert.equal(fallback.includes('secret-internal-detail'), false);
});
