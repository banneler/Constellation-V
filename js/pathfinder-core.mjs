import { safeExternalUrl } from './external-url.mjs';

export { safeExternalUrl };

export function normalizePathfinderFilters(filters = {}) {
    return {
        ownerId: String(filters.ownerId || ''),
        accountId: String(filters.accountId || ''),
        status: String(filters.status ?? 'pending'),
        roleFamily: String(filters.roleFamily || '')
    };
}

export function filterPathfinderCandidates(candidates = [], filters = {}) {
    const normalized = normalizePathfinderFilters(filters);
    return candidates.filter((candidate) => {
        if (normalized.ownerId && String(candidate.user_id) !== normalized.ownerId) return false;
        if (normalized.accountId && String(candidate.account_id) !== normalized.accountId) return false;
        if (normalized.status && candidate.status !== normalized.status) return false;
        if (normalized.roleFamily && candidate.role_family !== normalized.roleFamily) return false;
        return true;
    });
}

export function confidenceBand(value) {
    const confidence = Number(value) || 0;
    if (confidence >= 0.8) return { key: 'high', label: 'High confidence' };
    if (confidence >= 0.6) return { key: 'medium', label: 'Medium confidence' };
    return { key: 'low', label: 'Low confidence' };
}

const CONFIDENCE_FACTOR_LABELS = {
    source_authority: 'Source authority',
    company_match: 'Company match',
    role_match: 'Role match',
    recency: 'Recency',
    corroboration: 'Corroboration'
};

const CONFIDENCE_FACTOR_SCORE_LABELS = {
    source_authority: 'authoritative',
    company_match: 'match',
    role_match: 'match',
    recency: 'freshness',
    corroboration: 'corroboration'
};

function confidencePercentage(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.round(Math.max(0, Math.min(1, number)) * 100);
}

export function formatConfidenceReason(reason) {
    if (typeof reason === 'string') return reason.trim();
    if (!reason || typeof reason !== 'object' || Array.isArray(reason)) return '';

    const fallbackText = [reason.label, reason.message, reason.reason]
        .find((value) => typeof value === 'string' && value.trim());
    const factor = typeof reason.factor === 'string'
        ? reason.factor.trim().toLowerCase().replace(/[\s-]+/g, '_')
        : '';
    if (!factor) return fallbackText?.trim() || '';

    const label = CONFIDENCE_FACTOR_LABELS[factor]
        || factor.split('_').filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
    const score = confidencePercentage(reason.score);
    const weight = confidencePercentage(reason.weight);
    const scoreDescription = score === null
        ? ''
        : `: ${score}% ${CONFIDENCE_FACTOR_SCORE_LABELS[factor] || 'score'}`;
    const weightDescription = weight === null ? '' : ` (${weight}% weight)`;

    return `${label}${scoreDescription}${weightDescription}`;
}

export function candidateDisplayName(candidate = {}) {
    return [candidate.first_name, candidate.last_name].filter(Boolean).join(' ').trim() || 'Unnamed candidate';
}

export function emailStatusLabel(candidate = {}) {
    if (candidate.email_status === 'public') return 'Publicly listed';
    if (candidate.email_status === 'inferred') return 'Pattern inferred — unverified';
    return 'No email found';
}

export function candidateCounts(candidates = []) {
    return candidates.reduce((counts, candidate) => {
        if (candidate.status === 'pending') counts.pending += 1;
        if (candidate.status === 'approved') counts.approved += 1;
        if (candidate.status === 'pending' && Number(candidate.confidence) >= 0.8) counts.high += 1;
        return counts;
    }, { pending: 0, approved: 0, high: 0 });
}

export function escapePathfinderHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
