import test from 'node:test';
import assert from 'node:assert/strict';
import {
    candidateCounts,
    candidateDisplayName,
    confidenceBand,
    emailStatusLabel,
    filterPathfinderCandidates,
    formatConfidenceReason,
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

test('formats structured confidence factors for the evidence modal', () => {
    assert.deepEqual(
        [
            { factor: 'source_authority', score: 1, weight: 0.25 },
            { factor: 'company_match', score: 0.9, weight: 0.3 },
            { factor: 'role_match', score: 0.8, weight: 0.25 },
            { factor: 'recency', score: 0.55, weight: 0.1 },
            { factor: 'corroboration', score: 0.5, weight: 0.1 }
        ].map(formatConfidenceReason),
        [
            'Source authority: 100% authoritative (25% weight)',
            'Company match: 90% match (30% weight)',
            'Role match: 80% match (25% weight)',
            'Recency: 55% freshness (10% weight)',
            'Corroboration: 50% corroboration (10% weight)'
        ]
    );
});

test('keeps legacy confidence text and safely handles malformed reasons', () => {
    assert.equal(formatConfidenceReason('Official company leadership page'), 'Official company leadership page');
    assert.equal(formatConfidenceReason({ factor: 'industry_signal', score: 0.72 }), 'Industry Signal: 72% score');
    assert.equal(formatConfidenceReason({ message: 'Verified by an analyst' }), 'Verified by an analyst');
    assert.equal(formatConfidenceReason({ factor: 'role_match', score: 'invalid' }), 'Role match');
    assert.equal(formatConfidenceReason({}), '');
    assert.equal(formatConfidenceReason(null), '');
});

test('formats names and rejects unsafe external URLs', () => {
    assert.equal(candidateDisplayName({ first_name: 'Alex', last_name: 'Rivera' }), 'Alex Rivera');
    assert.equal(safeExternalUrl('https://example.com/profile'), 'https://example.com/profile');
    assert.equal(safeExternalUrl('javascript:alert(1)'), '');
});
