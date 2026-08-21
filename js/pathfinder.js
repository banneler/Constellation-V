import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    setupModalListeners,
    showModal,
    hideModal,
    updateActiveNavLink,
    setupUserMenuAndAuth,
    initializeAppState,
    getState,
    loadSVGs,
    showGlobalLoader,
    hideGlobalLoader,
    setupGlobalSearch,
    updateLastVisited,
    checkAndSetNotifications,
    injectGlobalNavigation,
    showToast
} from './shared_constants.js';
import {
    candidateCounts,
    candidateDisplayName,
    confidenceBand,
    emailStatusLabel,
    escapePathfinderHtml,
    filterPathfinderCandidates,
    formatConfidenceReason,
    safeExternalUrl
} from './pathfinder-core.mjs';
import { isPathfinderEnabled } from './pathfinder-feature.mjs';

document.addEventListener('DOMContentLoaded', async () => {
    injectGlobalNavigation();
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const state = {
        currentUser: null,
        enabled: false,
        candidates: [],
        accounts: [],
        filters: {
            accountId: new URLSearchParams(window.location.search).get('accountId') || '',
            status: 'pending',
            roleFamily: ''
        },
        tomSelects: {}
    };

    const content = document.getElementById('pathfinder-content');
    const disabled = document.getElementById('pathfinder-disabled');
    const candidateGrid = document.getElementById('pathfinder-candidates');
    const resultsSummary = document.getElementById('pathfinder-results-summary');
    const accountFilter = document.getElementById('pathfinder-account-filter');
    const statusFilter = document.getElementById('pathfinder-status-filter');
    const roleFilter = document.getElementById('pathfinder-role-filter');

    function accountFor(candidate) {
        return state.accounts.find((account) => String(account.id) === String(candidate.account_id));
    }

    function sourcesFor(candidate) {
        return candidate.pathfinder_candidate_sources || candidate.sources || [];
    }

    function renderCandidate(candidate) {
        const account = accountFor(candidate);
        const band = confidenceBand(candidate.confidence);
        const confidencePercent = Math.round((Number(candidate.confidence) || 0) * 100);
        const emailClass = candidate.email_status === 'inferred' ? 'is-inferred' : candidate.email_status === 'public' ? 'is-public' : 'is-unavailable';
        const sources = sourcesFor(candidate);
        const evidenceLinks = sources.slice(0, 2).map((source) => {
            const url = safeExternalUrl(source.source_url);
            const title = escapePathfinderHtml(source.source_title || source.source_url || 'Source');
            return url
                ? `<a href="${escapePathfinderHtml(url)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i>${title}</a>`
                : `<span>${title}</span>`;
        }).join('');
        const reviewed = candidate.status !== 'pending';

        return `
            <article class="pathfinder-candidate-card" data-candidate-id="${escapePathfinderHtml(candidate.id)}">
                <div class="pathfinder-candidate-top">
                    <div>
                        <div class="pathfinder-candidate-name">${escapePathfinderHtml(candidateDisplayName(candidate))}</div>
                        <div class="pathfinder-candidate-title">${escapePathfinderHtml(candidate.title)}</div>
                    </div>
                    <span class="pathfinder-confidence pathfinder-confidence-${band.key}" title="${confidencePercent}% confidence">${escapePathfinderHtml(band.label)} · ${confidencePercent}%</span>
                </div>
                <div class="pathfinder-candidate-context">
                    <span><i class="fa-solid fa-building"></i>${escapePathfinderHtml(account?.name || 'Unknown account')}</span>
                    <span><i class="fa-solid fa-layer-group"></i>${candidate.role_family === 'network' ? 'Network & Infrastructure' : 'Technology Leadership'}</span>
                </div>
                <div class="pathfinder-email ${emailClass}">
                    <i class="fa-solid fa-envelope"></i>
                    <div>
                        <strong>${escapePathfinderHtml(candidate.email_address || 'No email found')}</strong>
                        <small>${escapePathfinderHtml(emailStatusLabel(candidate))}${candidate.email_pattern_samples ? ` · ${candidate.email_pattern_samples} pattern sample${candidate.email_pattern_samples === 1 ? '' : 's'}` : ''}</small>
                    </div>
                </div>
                <div class="pathfinder-evidence-links">${evidenceLinks || '<span>No source links available</span>'}</div>
                <div class="pathfinder-card-footer">
                    <span class="pathfinder-status pathfinder-status-${escapePathfinderHtml(candidate.status)}">${escapePathfinderHtml(candidate.status)}</span>
                    <div class="pathfinder-card-actions">
                        <button type="button" class="btn-secondary pathfinder-evidence-btn" data-candidate-id="${escapePathfinderHtml(candidate.id)}">Evidence</button>
                        ${reviewed
                            ? candidate.crm_contact_id
                                ? `<a class="btn-primary" href="contacts.html?contactId=${encodeURIComponent(candidate.crm_contact_id)}">Open Contact</a>`
                                : ''
                            : `<button type="button" class="btn-primary pathfinder-review-btn" data-candidate-id="${escapePathfinderHtml(candidate.id)}">Review</button>`}
                    </div>
                </div>
            </article>
        `;
    }

    function render() {
        const counts = candidateCounts(state.candidates);
        document.getElementById('pathfinder-pending-count').textContent = counts.pending;
        document.getElementById('pathfinder-high-count').textContent = counts.high;
        document.getElementById('pathfinder-approved-count').textContent = counts.approved;

        const filtered = filterPathfinderCandidates(state.candidates, state.filters);
        resultsSummary.textContent = `${filtered.length} candidate${filtered.length === 1 ? '' : 's'} shown`;
        candidateGrid.innerHTML = filtered.length
            ? filtered.map(renderCandidate).join('')
            : `<div class="pathfinder-empty pathfinder-grid-empty">
                <i class="fa-solid fa-compass"></i>
                <h3>No candidates match these filters</h3>
                <p>Try another status or run Pathfinder from an account.</p>
               </div>`;
    }

    function initTomSelect(element, key) {
        if (!element || typeof window.TomSelect === 'undefined') return;
        if (state.tomSelects[key]) state.tomSelects[key].destroy();
        state.tomSelects[key] = new window.TomSelect(element, {
            create: false,
            allowEmptyOption: true,
            maxItems: 1,
            onChange(value) {
                state.filters[key] = value || '';
                render();
            }
        });
    }

    function populateFilters() {
        accountFilter.innerHTML = '<option value="">All Accounts</option>' + state.accounts
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            .map((account) => `<option value="${escapePathfinderHtml(account.id)}">${escapePathfinderHtml(account.name)}</option>`)
            .join('');
        accountFilter.value = state.filters.accountId;

        initTomSelect(accountFilter, 'accountId');
        initTomSelect(statusFilter, 'status');
        initTomSelect(roleFilter, 'roleFamily');
        state.tomSelects.accountId?.setValue(state.filters.accountId, true);
        state.tomSelects.status?.setValue(state.filters.status, true);
    }

    async function loadData() {
        showGlobalLoader();
        try {
            const { data: orgSettings, error: settingsError } = await supabase
                .from('org_settings')
                .select('pathfinder_enabled')
                .eq('id', 1)
                .maybeSingle();
            if (settingsError) throw settingsError;

            state.enabled = isPathfinderEnabled(orgSettings);
            content.classList.toggle('hidden', !state.enabled);
            disabled.classList.toggle('hidden', state.enabled);
            if (!state.enabled) return;

            const effectiveOwnerId = getState().effectiveUserId || state.currentUser.id;
            const candidateQuery = supabase
                .from('pathfinder_candidates')
                .select('*, pathfinder_candidate_sources(*)')
                .eq('user_id', effectiveOwnerId)
                .order('discovered_at', { ascending: false });
            const accountQuery = supabase
                .from('accounts')
                .select('id, name, user_id')
                .eq('user_id', effectiveOwnerId)
                .order('name');

            const [
                { data: candidates, error: candidateError },
                { data: accounts, error: accountError }
            ] = await Promise.all([candidateQuery, accountQuery]);
            if (candidateError) throw candidateError;
            if (accountError) throw accountError;

            state.candidates = candidates || [];
            state.accounts = accounts || [];
            populateFilters();
            render();
        } catch (error) {
            console.error('Pathfinder load failed:', error);
            showToast(`Unable to load Pathfinder: ${error.message}`, 'error');
            candidateGrid.innerHTML = '<div class="pathfinder-empty"><h3>Unable to load Pathfinder</h3><p>Please try again.</p></div>';
        } finally {
            hideGlobalLoader();
        }
    }

    function renderEvidence(candidate) {
        const reasons = Array.isArray(candidate.confidence_reasons)
            ? candidate.confidence_reasons.map(formatConfidenceReason).filter(Boolean)
            : [];
        const sources = sourcesFor(candidate);
        const sourceHtml = sources.length
            ? sources.map((source) => {
                const url = safeExternalUrl(source.source_url);
                return `<div class="pathfinder-source">
                    <div class="pathfinder-source-heading">
                        <strong>${escapePathfinderHtml(source.source_title || 'Public source')}</strong>
                        ${url ? `<a href="${escapePathfinderHtml(url)}" target="_blank" rel="noopener noreferrer">Open source <i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ''}
                    </div>
                    <p>${escapePathfinderHtml(source.evidence_excerpt)}</p>
                    <small>Observed ${escapePathfinderHtml(new Date(source.observed_at || source.created_at).toLocaleDateString())}</small>
                </div>`;
            }).join('')
            : '<p class="placeholder-text">No source evidence was stored.</p>';
        const reasonHtml = reasons.length
            ? `<ul>${reasons.map((reason) => `<li>${escapePathfinderHtml(reason)}</li>`).join('')}</ul>`
            : '<p class="placeholder-text">No confidence details were stored.</p>';

        showModal(
            `Evidence: ${candidateDisplayName(candidate)}`,
            `<div class="pathfinder-evidence-modal">
                <h4>Why Pathfinder surfaced this person</h4>
                ${reasonHtml}
                <h4>Source evidence</h4>
                ${sourceHtml}
             </div>`,
            null,
            false,
            '<button id="modal-ok-btn" class="btn-primary">Close</button>'
        );
    }

    function reviewCandidate(candidate) {
        const inferredWarning = candidate.email_status === 'inferred'
            ? '<div class="pathfinder-review-warning"><i class="fa-solid fa-triangle-exclamation"></i>This email was inferred from an account pattern and has not been verified.</div>'
            : '';
        const body = `
            <form id="pathfinder-review-form" class="pathfinder-review-form">
                ${inferredWarning}
                <div class="pathfinder-form-row">
                    <label>First name<input id="pathfinder-first-name" required value="${escapePathfinderHtml(candidate.first_name)}"></label>
                    <label>Last name<input id="pathfinder-last-name" required value="${escapePathfinderHtml(candidate.last_name)}"></label>
                </div>
                <label>Title<input id="pathfinder-title" required value="${escapePathfinderHtml(candidate.title)}"></label>
                <label>Role family
                    <select id="pathfinder-role-family">
                        <option value="technology" ${candidate.role_family === 'technology' ? 'selected' : ''}>Technology Leadership</option>
                        <option value="network" ${candidate.role_family === 'network' ? 'selected' : ''}>Network &amp; Infrastructure</option>
                    </select>
                </label>
                <label>Email
                    <input id="pathfinder-email" type="email" value="${escapePathfinderHtml(candidate.email_address || '')}" placeholder="No email">
                </label>
                <label>Email evidence
                    <select id="pathfinder-email-status">
                        <option value="unavailable" ${candidate.email_status === 'unavailable' ? 'selected' : ''}>Unavailable</option>
                        <option value="public" ${candidate.email_status === 'public' ? 'selected' : ''}>Publicly listed</option>
                        <option value="inferred" ${candidate.email_status === 'inferred' ? 'selected' : ''}>Pattern inferred — unverified</option>
                    </select>
                </label>
                <div class="pathfinder-form-row">
                    <label>Phone<input id="pathfinder-phone" value="${escapePathfinderHtml(candidate.phone || '')}"></label>
                    <label>Location<input id="pathfinder-location" value="${escapePathfinderHtml(candidate.location || '')}"></label>
                </div>
                <label>Public profile URL<input id="pathfinder-profile-url" type="url" value="${escapePathfinderHtml(candidate.profile_url || '')}"></label>
            </form>`;

        showModal(
            `Review: ${candidateDisplayName(candidate)}`,
            body,
            async () => {
                let email = document.getElementById('pathfinder-email').value.trim();
                let emailStatus = document.getElementById('pathfinder-email-status').value;
                if (emailStatus === 'unavailable') email = '';
                if (!email && emailStatus !== 'unavailable') {
                    showToast('Enter an email address or mark it unavailable.', 'error');
                    return false;
                }
                if (!email) emailStatus = 'unavailable';
                const updates = {
                    first_name: document.getElementById('pathfinder-first-name').value.trim(),
                    last_name: document.getElementById('pathfinder-last-name').value.trim(),
                    title: document.getElementById('pathfinder-title').value.trim(),
                    role_family: document.getElementById('pathfinder-role-family').value,
                    email_address: email || null,
                    email_status: emailStatus,
                    phone: document.getElementById('pathfinder-phone').value.trim() || null,
                    location: document.getElementById('pathfinder-location').value.trim() || null,
                    profile_url: document.getElementById('pathfinder-profile-url').value.trim() || null
                };
                if (!updates.first_name || !updates.last_name || !updates.title) {
                    showToast('First name, last name, and title are required.', 'error');
                    return false;
                }
                const { error: updateError } = await supabase
                    .from('pathfinder_candidates')
                    .update(updates)
                    .eq('id', candidate.id);
                if (updateError) {
                    showToast(`Unable to save candidate: ${updateError.message}`, 'error');
                    return false;
                }
                const { data: contactId, error: approvalError } = await supabase
                    .rpc('approve_pathfinder_candidate', { p_candidate_id: candidate.id });
                if (approvalError) {
                    showToast(`Unable to approve candidate: ${approvalError.message}`, 'error');
                    return false;
                }
                showToast(`Contact ${contactId ? 'approved' : 'linked'} successfully.`, 'success');
                await loadData();
                return true;
            },
            true,
            '<button id="modal-confirm-btn" class="btn-primary">Approve &amp; Create Contact</button><button id="pathfinder-reject-btn" class="btn-danger">Reject</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>',
            null,
            { closeOnBackdropClick: false }
        );
        document.getElementById('pathfinder-reject-btn')?.addEventListener('click', async () => {
            const { error } = await supabase.rpc('reject_pathfinder_candidate', { p_candidate_id: candidate.id });
            if (error) {
                showToast(`Unable to reject candidate: ${error.message}`, 'error');
                return;
            }
            hideModal();
            showToast('Candidate rejected. Pathfinder will preserve this decision.', 'success');
            await loadData();
        });
    }

    candidateGrid.addEventListener('click', (event) => {
        const evidenceButton = event.target.closest('.pathfinder-evidence-btn');
        const reviewButton = event.target.closest('.pathfinder-review-btn');
        const id = evidenceButton?.dataset.candidateId || reviewButton?.dataset.candidateId;
        if (!id) return;
        const candidate = state.candidates.find((item) => item.id === id);
        if (!candidate) return;
        if (evidenceButton) renderEvidence(candidate);
        if (reviewButton) reviewCandidate(candidate);
    });

    document.getElementById('pathfinder-clear-filters').addEventListener('click', () => {
        state.filters = { accountId: '', status: 'pending', roleFamily: '' };
        Object.entries(state.tomSelects).forEach(([key, control]) => {
            control.setValue(state.filters[key] || '', true);
        });
        window.history.replaceState({}, '', 'pathfinder.html');
        render();
    });
    document.getElementById('pathfinder-refresh-btn').addEventListener('click', loadData);
    window.addEventListener('effectiveUserChanged', () => {
        state.filters.accountId = '';
        window.history.replaceState({}, '', 'pathfinder.html');
        loadData();
    });

    setupModalListeners();
    const globalState = await initializeAppState(supabase);
    if (!globalState?.currentUser) return;
    state.currentUser = globalState.currentUser;
    await setupUserMenuAndAuth(supabase, globalState);
    await setupGlobalSearch(supabase);
    await checkAndSetNotifications(supabase);
    updateActiveNavLink();
    await loadSVGs();
    updateLastVisited(supabase, 'pathfinder');
    await loadData();
});
