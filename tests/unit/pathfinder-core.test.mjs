import test from 'node:test';
import assert from 'node:assert/strict';
import {
    candidateCounts,
    candidateDisplayName,
    confidenceBand,
    emailStatusLabel,
    filterPathfinderCandidates,
    safeExternalUrl
} from '../../js/pathfinder-core.mjs';

const candidates = [
    { id: '1', user_id: 'u1', account_id: 10, status: 'pending', role_family: 'technology', confidence: 0.88 },
    { id: '2', user_id: 'u1', account_id: 10, status: 'approved', role_family: 'network', confidence: 0.91 },
    { id: '3', user_id: 'u2', account_id: 20, status: 'pending', role_family: 'network', confidence: 0.62 }
];

test('filters candidates across owner, account, status, and role', () => {
    assert.deepEqual(
        filterPathfinderCandidates(candidates, {
            ownerId: 'u1',
            accountId: '10',
            status: 'pending',
            roleFamily: 'technology'
        }).map((candidate) => candidate.id),
        ['1']
    );
    assert.equal(filterPathfinderCandidates(candidates, { status: '' }).length, 3);
});

test('summarizes pending, approved, and high-confidence pending candidates', () => {
    assert.deepEqual(candidateCounts(candidates), { pending: 2, approved: 1, high: 1 });
});

test('labels confidence and inferred email honestly', () => {
    assert.equal(confidenceBand(0.8).key, 'high');
    assert.equal(confidenceBand(0.6).key, 'medium');
    assert.equal(confidenceBand(0.59).key, 'low');
    assert.equal(emailStatusLabel({ email_status: 'inferred' }), 'Pattern inferred — unverified');
});

test('formats names and rejects unsafe external URLs', () => {
    assert.equal(candidateDisplayName({ first_name: 'Alex', last_name: 'Rivera' }), 'Alex Rivera');
    assert.equal(safeExternalUrl('https://example.com/profile'), 'https://example.com/profile');
    assert.equal(safeExternalUrl('javascript:alert(1)'), '');
});
