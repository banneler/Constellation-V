import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    canUseSaosImpersonation,
    getSaosAccountIds,
    getSaosOwnerIds,
    resolveAccessibleAccountId,
} from '../../js/saos-access.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('standard users receive only their own SAOS owner scope', () => {
    const state = {
        currentUser: { id: 'owner-a' },
        isManager: false,
        managedUsers: [{ id: 'owner-b' }],
    };

    assert.deepEqual(getSaosOwnerIds(state), ['owner-a']);
    assert.equal(canUseSaosImpersonation(state, 'owner-b'), false);
});

test('managers retain team SAOS and validated impersonation scope', () => {
    const state = {
        currentUser: { id: 'manager-a' },
        isManager: true,
        managedUsers: [{ id: 'owner-b' }, { user_id: 'owner-c' }],
    };

    assert.deepEqual(getSaosOwnerIds(state), ['manager-a', 'owner-b', 'owner-c']);
    assert.equal(canUseSaosImpersonation(state, 'owner-b'), true);
    assert.equal(canUseSaosImpersonation(state, 'outside-owner'), false);
});

test('account lists and deep links reject IDs outside the loaded ownership scope', () => {
    const ownedAccounts = [{ id: 10, user_id: 'owner-a' }, { id: 20, user_id: 'owner-a' }];

    assert.deepEqual(getSaosAccountIds(ownedAccounts), [10, 20]);
    assert.equal(resolveAccessibleAccountId(ownedAccounts, '20'), 20);
    assert.equal(resolveAccessibleAccountId(ownedAccounts, '999'), null);
    assert.equal(resolveAccessibleAccountId(ownedAccounts, 'not-an-id'), null);
});

test('shared authenticated nav exposes SAOS without weakening manager-only modules', () => {
    const sharedConstants = fs.readFileSync(path.join(repoRoot, 'js/shared_constants.js'), 'utf8');
    const saosNav = sharedConstants.match(/<a href="saos-dashboard\.html"[^>]*>/)?.[0] || '';
    const insightsNav = sharedConstants.match(/<a href="insights\.html"[^>]*>/)?.[0] || '';
    const pathfinderNav = sharedConstants.match(/<a href="pathfinder\.html"[^>]*>/)?.[0] || '';

    assert.match(saosNav, /class="nav-button"/);
    assert.doesNotMatch(saosNav, /manager-only|hidden|aria-hidden/);
    assert.match(insightsNav, /data-manager-only-nav="true"/);
    assert.match(pathfinderNav, /id="pathfinder-nav-button"/);
    assert.match(pathfinderNav, /hidden/);
});

test('database policies derive SAOS ownership from accounts.user_id', () => {
    const policySql = fs.readFileSync(path.join(repoRoot, 'sql/account_plans.sql'), 'utf8');
    const managerSql = fs.readFileSync(path.join(repoRoot, 'sql/rls_managers_manage_team_crm.sql'), 'utf8');

    for (const operation of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        assert.match(policySql, new RegExp(`account_plans_${operation.toLowerCase()}_own`));
    }
    assert.match(policySql, /a\.id = account_plans\.account_id[\s\S]*a\.user_id = auth\.uid\(\)/);
    assert.match(policySql, /ALTER TABLE public\.account_plans ENABLE ROW LEVEL SECURITY/);
    assert.match(managerSql, /account_plans_manager_all[\s\S]*USING \(is_manager\(\) = true\)/);
});

test('dashboard reads, deep links, and autosave retain the account ownership scope', () => {
    const dashboard = fs.readFileSync(path.join(repoRoot, 'js/saos-dashboard.js'), 'utf8');
    const accounts = fs.readFileSync(path.join(repoRoot, 'js/accounts.js'), 'utf8');
    const planData = fs.readFileSync(path.join(repoRoot, 'js/account-plan-data.js'), 'utf8');

    assert.match(dashboard, /from\('accounts'\)\.select\('\*'\)\.in\('user_id', ownerIds\)/);
    assert.match(dashboard, /from\('account_plans'\)[\s\S]*\.in\('account_id', scopedAccountIds\)/);
    assert.match(accounts, /resolveAccessibleAccountId\(state\.accounts, accountIdFromUrl\)/);
    assert.match(planData, /updateQuery = updateQuery\.eq\('account_id', accountIdNum\)/);
});
