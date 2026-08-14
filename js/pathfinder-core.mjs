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

export function safeExternalUrl(value) {
    try {
        const parsed = new URL(String(value || ''));
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch {
        return '';
    }
}

export function escapePathfinderHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
