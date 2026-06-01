// campaigns.js

import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    formatDate,
    setupModalListeners,
    getCurrentModalCallbacks,
    setCurrentModalCallbacks,
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
    checkAndSetNotifications,
    injectGlobalNavigation,
    filterOutOwnershipOrphanedCrmRows
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    injectGlobalNavigation();
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let state = {
        currentUser: null,
        campaigns: [],
        contacts: [],
        accounts: [],
        activities: [],
        campaignMembers: [],
        selectedCampaignId: null,
        campaignWorkspaceMode: 'create',
        /** @type {Map<string, { champion: boolean, economicBuyer: boolean }>} */
        meddpiccByContactId: new Map(),
    };

    /**
     * ABM Cart state — explicit contact selection replaces filter-based spray-and-pray.
     * Reps curate a spear-fishing list before launch; empty cart blocks creation.
     */
    const abmCartState = {
        contactIds: new Set(),
        expandedAccountIds: new Set(),
        explorerTier: '',
        explorerIndustry: '',
        explorerSearch: '',
    };

    let originalModalContent = {
        title: '',
        body: '',
        actions: '',
        callbacks: {
            onConfirm: null,
            onCancel: null
        }
    };

    let tempCampaignFormState = {
        campaignName: '',
        campaignType: 'Call',
        campaignEmailSubject: '',
        campaignEmailBody: '',
    };

    const getInitials = (name) => {
        if (!name || typeof name !== 'string' || name.trim() === '') return '';
        const parts = name.trim().split(' ').filter(p => p);
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };


    // --- DOM SELECTORS ---
    const activeCampaignList = document.getElementById('campaign-list-active');
    const pastCampaignList = document.getElementById('campaign-list-past');
    const mobileCampaignSelect = document.getElementById('mobile-campaign-select');
    const campaignDetailsContent = document.getElementById('campaign-details-content');
    const campaignDetailsFlippable = document.getElementById('campaign-details-flippable');
    const campaignDetailsEmailBack = document.getElementById('campaign-details-email-back');
    const runCampaignBody = document.getElementById('run-campaign-body');
    const rcSummary = document.getElementById('rc-summary');
    const rcLayout = document.getElementById('rc-layout');
    const rcContactProfileContent = document.getElementById('rc-contact-profile-content');
    const rcContactCard = document.getElementById('rc-contact-card');
    const rcContactContent = rcContactCard ? rcContactCard.querySelector('.run-campaign-contact-content') : null;
    const rcMiddlePanel = document.getElementById('rc-middle-panel');

    const escapeCampaignHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const isEmailCampaignType = (type) => type === 'Guided Email' || type === 'Email';

    const decorateCampaignMergeTokens = (text) => String(text ?? '')
        .replace(/\{FirstName\}/gi, '<span class="campaign-merge-token">First Name</span>')
        .replace(/\{LastName\}/gi, '<span class="campaign-merge-token">Last Name</span>')
        .replace(/\{AccountName\}/gi, '<span class="campaign-merge-token">Account Name</span>')
        .replace(/\[FirstName\]/g, '<span class="campaign-merge-token">First Name</span>')
        .replace(/\[LastName\]/g, '<span class="campaign-merge-token">Last Name</span>')
        .replace(/\[AccountName\]/g, '<span class="campaign-merge-token">Account Name</span>');

    const sanitizeCampaignEmailHtml = (html) => {
        const template = document.createElement('template');
        template.innerHTML = html;
        template.content.querySelectorAll('script, style, iframe, object, embed, form, input, button, link, meta').forEach((el) => el.remove());
        template.content.querySelectorAll('*').forEach((el) => {
            [...el.attributes].forEach((attr) => {
                if (el.tagName === 'A' && attr.name === 'href' && /^(https?:|mailto:)/i.test(attr.value)) return;
                if (el.tagName === 'SPAN' && attr.name === 'class' && attr.value === 'campaign-merge-token') return;
                el.removeAttribute(attr.name);
            });
        });
        return template.innerHTML;
    };

    const formatCampaignEmailPreviewHtml = (rawBody) => {
        const trimmed = String(rawBody ?? '').trim();
        if (!trimmed) {
            return '<p class="campaign-email-preview-empty">(Not set)</p>';
        }

        const withTokens = decorateCampaignMergeTokens(trimmed);
        if (!/<[a-z][\s\S]*>/i.test(trimmed)) {
            return decorateCampaignMergeTokens(escapeCampaignHtml(trimmed)).replace(/\n/g, '<br>');
        }
        return sanitizeCampaignEmailHtml(withTokens);
    };

    const buildCampaignEmailPreviewBlockHtml = (campaign) => {
        const subj = escapeCampaignHtml(campaign.email_subject || '(Not set)');
        const bodyHtml = formatCampaignEmailPreviewHtml(campaign.email_body);
        return `
            <p class="campaign-email-back-subject"><strong>Subject:</strong> ${subj}</p>
            <div class="campaign-email-preview-content">${bodyHtml}</div>`;
    };

    const buildCampaignEmailInlineHtml = (campaign, { heading = 'Email Sent' } = {}) => {
        if (!isEmailCampaignType(campaign.type)) return '';
        return `
            <section class="campaign-completed-email">
                <h4>${heading}</h4>
                <div class="campaign-completed-email-body">
                    ${buildCampaignEmailPreviewBlockHtml(campaign)}
                </div>
            </section>`;
    };

    const NULL_CONTACT_HTML = `
        <span class="run-campaign-null-placeholder">Ready when you are</span>
        <small>Log or skip from here once a contact is loaded.</small>`;

    const NULL_MIDDLE_HTML = `
        <span class="run-campaign-notes-placeholder">Notes</span>
        <textarea disabled placeholder=" " aria-label="Notes (disabled until campaign selected)"></textarea>`;

    const NULL_PROFILE_HTML = '<p class="run-campaign-profile-empty">Select a campaign to begin outreach.</p>';

    const CALL_BLITZ_CONTACT_HTML = `
        <div class="run-campaign-action-bar-inner">
            <a href="#" id="contact-phone-call-blitz" class="run-campaign-primary-channel"></a>
            <div class="run-campaign-contact-actions">
                <button type="button" id="log-call-btn" class="run-campaign-icon-btn run-campaign-icon-log" title="Log Call & Next"><i class="fas fa-check"></i></button>
                <button type="button" id="skip-call-btn" class="run-campaign-icon-btn run-campaign-icon-skip" title="Skip & Next"><i class="fas fa-forward"></i></button>
            </div>
        </div>`;

    const CALL_BLITZ_MIDDLE_HTML = `
        <div class="run-campaign-call-notes-form">
            <div class="run-campaign-body-inner run-campaign-body-box rc-blitz-notes">
                <span class="run-campaign-notes-placeholder" id="call-notes-placeholder">Notes</span>
                <textarea id="call-notes" name="x-call-notes" autocomplete="nope"></textarea>
            </div>
        </div>`;

    const GUIDED_EMAIL_CONTACT_HTML = `
        <div class="run-campaign-action-bar-inner">
            <a href="#" id="contact-email-guided-email" class="run-campaign-primary-channel"></a>
            <div class="run-campaign-contact-actions">
                <button type="button" id="open-email-client-btn" class="run-campaign-icon-btn run-campaign-icon-log" title="Open in Email Client & Next"><i class="fas fa-envelope"></i></button>
                <button type="button" id="skip-email-btn" class="run-campaign-icon-btn run-campaign-icon-skip" title="Skip & Next"><i class="fas fa-forward"></i></button>
            </div>
        </div>`;

    const GUIDED_EMAIL_MIDDLE_HTML = `
        <div class="run-campaign-email-form">
            <span id="email-to-address" class="hidden" aria-hidden="true"></span>
            <input type="text" id="email-subject" name="x-email-subject" placeholder="Subject" autocomplete="one-time-code" readonly>
            <div class="run-campaign-body-inner run-campaign-body-box">
                <span class="run-campaign-notes-placeholder" id="email-body-placeholder">Body</span>
                <textarea id="email-body-textarea" name="x-email-body" autocomplete="nope"></textarea>
                <div class="merge-fields-buttons run-campaign-merge-pills">
                    <button type="button" class="btn-secondary" data-field="[FirstName]">First</button>
                    <button type="button" class="btn-secondary" data-field="[LastName]">Last</button>
                    <button type="button" class="btn-secondary" data-field="[AccountName]">Account</button>
                </div>
            </div>
        </div>`;

    const setNullState = () => {
        if (rcContactCard) rcContactCard.classList.add('run-campaign-null-contact');
        if (rcMiddlePanel) rcMiddlePanel.classList.add('rc-null');
        if (rcContactContent) rcContactContent.innerHTML = NULL_CONTACT_HTML;
        if (rcMiddlePanel) rcMiddlePanel.innerHTML = NULL_MIDDLE_HTML;
        if (rcContactProfileContent) rcContactProfileContent.innerHTML = NULL_PROFILE_HTML;
        if (rcSummary) { rcSummary.classList.add('hidden'); rcSummary.innerHTML = ''; }
        if (rcLayout) rcLayout.classList.remove('hidden');
    };

    const clearNullState = () => {
        if (rcContactCard) rcContactCard.classList.remove('run-campaign-null-contact');
        if (rcMiddlePanel) rcMiddlePanel.classList.remove('rc-null');
    };

    let createCampaignConfirmResolve = null;

    let tomSelectCampaignType = null;
    let tomSelectTier = null;
    let tomSelectIndustry = null;

    function initTomSelect(el, opts = {}) {
        if (typeof window.TomSelect === 'undefined') return null;
        try {
            return new window.TomSelect(el, { create: false, ...opts });
        } catch (e) {
            return null;
        }
    }

    function destroyCampaignTomSelects() {
        [tomSelectCampaignType, tomSelectTier, tomSelectIndustry].forEach(ts => {
            if (ts) { ts.destroy(); }
        });
        tomSelectCampaignType = tomSelectTier = tomSelectIndustry = null;
    }

    function getCampaignSelectValue(id) {
        const el = document.getElementById(id);
        if (!el) return '';
        const map = {
            'campaign-type': tomSelectCampaignType,
            'abm-filter-tier': tomSelectTier,
            'abm-filter-industry': tomSelectIndustry,
        };
        const ts = map[id];
        if (ts) {
            const v = ts.getValue();
            return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
        }
        return el.value ?? '';
    }

    /**
     * Build MEDDPICC role lookup from SAOS influence boards.
     * ABM targeting should prioritize Economic Buyers and Champions — the badges
     * make that visible at cart-building time, not after launch.
     *
     * @param {Array<{ account_id: number, plan: object }>} planRows
     */
    function buildMeddpiccLookup(planRows) {
        const lookup = new Map();
        (planRows || []).forEach((row) => {
            const sections = row?.plan?.current_draft?.sections;
            const mapping = sections?.influence_mapping;
            if (!mapping || typeof mapping !== 'object') return;

            ['executive', 'mid_level', 'technical'].forEach((bucket) => {
                const list = Array.isArray(mapping[bucket]) ? mapping[bucket] : [];
                list.forEach((entry) => {
                    if (!entry?.id) return;
                    const id = String(entry.id);
                    const champion = entry.is_champion === '1' || entry.is_champion === true;
                    const economicBuyer = entry.is_economic_buyer === '1' || entry.is_economic_buyer === true;
                    if (!champion && !economicBuyer) return;
                    const existing = lookup.get(id) || { champion: false, economicBuyer: false };
                    lookup.set(id, {
                        champion: existing.champion || champion,
                        economicBuyer: existing.economicBuyer || economicBuyer,
                    });
                });
            });
        });
        return lookup;
    }

    function getMeddpiccBadgeHtml(contactId) {
        const roles = state.meddpiccByContactId.get(String(contactId));
        if (!roles) return '';
        const badges = [];
        if (roles.champion) badges.push('<span class="abm-meddpicc-badge abm-meddpicc-badge--champion" title="SAOS Champion">Champion</span>');
        if (roles.economicBuyer) badges.push('<span class="abm-meddpicc-badge abm-meddpicc-badge--buyer" title="SAOS Economic Buyer">EB</span>');
        return badges.length ? `<span class="abm-meddpicc-badges">${badges.join('')}</span>` : '';
    }

    function getContactsForAccount(accountId) {
        return state.contacts
            .filter((contact) => Number(contact.account_id) === Number(accountId))
            .sort((a, b) => `${a.last_name || ''} ${a.first_name || ''}`.localeCompare(`${b.last_name || ''} ${b.first_name || ''}`));
    }

    function getFilteredExplorerAccounts() {
        const tierFilter = abmCartState.explorerTier;
        const industryFilter = abmCartState.explorerIndustry;
        const search = abmCartState.explorerSearch.trim().toLowerCase();

        return state.accounts
            .filter((account) => {
                const tier = account.tier || 'Unassigned';
                const tierMatch = !tierFilter || tier === tierFilter;
                const industryMatch = !industryFilter || account.industry === industryFilter;
                const searchMatch = !search || (account.name || '').toLowerCase().includes(search);
                return tierMatch && industryMatch && searchMatch;
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    function buildAccountTierBadgeHtml(tier) {
        const label = tier || 'Unassigned';
        const slug = label.toLowerCase().replace(/\s+/g, '-');
        return `<span class="account-tier-badge account-tier-badge--${slug}">${label}</span>`;
    }

    function isContactInCart(contactId) {
        return abmCartState.contactIds.has(Number(contactId));
    }

    /** Add one contact to the ABM cart (deduped). */
    function addContactToAbmCart(contactId) {
        const id = Number(contactId);
        if (!id) return;
        abmCartState.contactIds.add(id);
        renderAbmCartPane();
        renderAbmAccountExplorer();
    }

    /** Bulk-add every contact under an account — the "account header drop" shortcut. */
    function addAccountContactsToAbmCart(accountId) {
        getContactsForAccount(accountId).forEach((contact) => {
            abmCartState.contactIds.add(contact.id);
        });
        renderAbmCartPane();
        renderAbmAccountExplorer();
    }

    function removeContactFromAbmCart(contactId) {
        abmCartState.contactIds.delete(Number(contactId));
        renderAbmCartPane();
        renderAbmAccountExplorer();
    }

    function clearAbmCart() {
        abmCartState.contactIds.clear();
        renderAbmCartPane();
        renderAbmAccountExplorer();
    }

    function toggleAbmAccountExpanded(accountId) {
        const id = Number(accountId);
        if (abmCartState.expandedAccountIds.has(id)) {
            abmCartState.expandedAccountIds.delete(id);
        } else {
            abmCartState.expandedAccountIds.add(id);
        }
        renderAbmAccountExplorer();
    }

    function initCampaignTomSelects() {
        const campaignTypeEl = document.getElementById('campaign-type');
        const tierEl = document.getElementById('abm-filter-tier');
        const industryEl = document.getElementById('abm-filter-industry');
        if (campaignTypeEl && !campaignTypeEl.tomselect) tomSelectCampaignType = initTomSelect(campaignTypeEl);
        if (tierEl && !tierEl.tomselect) tomSelectTier = initTomSelect(tierEl);
        if (industryEl && !industryEl.tomselect) tomSelectIndustry = initTomSelect(industryEl);
    }

    // --- RENDER FUNCTIONS ---
    const isMobileViewport = () => window.matchMedia('(max-width: 768px)').matches;

    const renderCampaignList = () => {
        if (!activeCampaignList || !pastCampaignList) {
            console.error("Campaign list elements not found.");
            return;
        }

        activeCampaignList.innerHTML = "";
        pastCampaignList.innerHTML = "";
        const activeCampaigns = [];
        const pastCampaigns = [];
        state.campaigns.forEach(campaign => {
            (campaign.completed_at ? pastCampaigns : activeCampaigns).push(campaign);
        });
        const sortedActiveCampaigns = activeCampaigns.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const sortedPastCampaigns = pastCampaigns.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));

        // Mobile flow only runs current campaigns. If a completed campaign is selected, move to current.
        if (isMobileViewport()) {
            const selectedCampaign = state.campaigns.find(c => c.id === state.selectedCampaignId);
            if (selectedCampaign?.completed_at) {
                state.selectedCampaignId = sortedActiveCampaigns[0]?.id ?? null;
            }
        }

        if (sortedActiveCampaigns.length === 0) {
            activeCampaignList.innerHTML = `<div class="list-item-placeholder">No active campaigns.</div>`;
        } else {
            sortedActiveCampaigns.forEach(c => renderCampaignListItem(c, activeCampaignList));
        }

        if (sortedPastCampaigns.length === 0) {
            pastCampaignList.innerHTML = `<div class="list-item-placeholder">No past campaigns.</div>`;
        } else {
            sortedPastCampaigns.forEach(c => renderCampaignListItem(c, pastCampaignList));
        }

        if (mobileCampaignSelect) {
            mobileCampaignSelect.innerHTML = '<option value="">Create new campaign</option>' + sortedActiveCampaigns
                .map((campaign) => `<option value="${campaign.id}">${campaign.name}</option>`)
                .join('');
            const selectedCampaign = state.campaigns.find(c => c.id === state.selectedCampaignId);
            mobileCampaignSelect.value = (selectedCampaign && !selectedCampaign.completed_at)
                ? String(state.selectedCampaignId)
                : '';
        }
    };

    const renderCampaignListItem = (campaign, listElement) => {
        const item = document.createElement("div");
        item.className = "list-item";
        item.dataset.id = campaign.id;
        if (campaign.id === state.selectedCampaignId) item.classList.add("selected");

        item.innerHTML = `
            <div>
                <div>${campaign.name}</div>
                <small>${campaign.type} Campaign</small>
            </div>
        `;
        listElement.appendChild(item);
    };

    let activeRunMode = null; // 'call' | 'guided-email' | 'email-merge' | null

    const updateCampaignWorkspacePillUI = () => {
        const createBtn = document.getElementById('campaign-workspace-create-btn');
        const runBtn = document.getElementById('campaign-workspace-run-btn');
        if (!createBtn || !runBtn) return;
        const isCreate = state.campaignWorkspaceMode === 'create';
        createBtn.classList.toggle('active', isCreate);
        runBtn.classList.toggle('active', !isCreate);
    };

    const setCampaignWorkspaceMode = (mode) => {
        state.campaignWorkspaceMode = mode;
        if (mode === 'create') activeRunMode = null;
        updateCampaignWorkspacePillUI();
        updateCampaignWorkspaceLayout();
    };

    const updateCampaignWorkspaceLayout = () => {
        const panel = document.getElementById('campaign-details');
        if (!panel) return;
        const campaign = state.campaigns.find(c => c.id === state.selectedCampaignId);
        const isCreateMode = state.campaignWorkspaceMode === 'create';
        const isRunMode = state.campaignWorkspaceMode === 'run';
        const hasSelection = Boolean(campaign);
        const isPast = Boolean(campaign?.completed_at);
        const runActive = isRunMode && campaign && !isPast && activeRunMode !== null;

        panel.classList.toggle('campaign-view-create', isCreateMode);
        panel.classList.toggle('campaign-view-run-empty', isRunMode && !hasSelection);
        panel.classList.toggle('campaign-view-selected', isRunMode && hasSelection);
        panel.classList.toggle('campaign-view-past', isRunMode && hasSelection && isPast);
        panel.classList.toggle('campaign-run-active', runActive);
        panel.classList.toggle('campaign-top-active', isRunMode && hasSelection && !runActive);
    };

    const showCampaignCreateView = () => {
        setCampaignWorkspaceMode('create');
        resetCampaignDetailsFlip();
        renderCampaignList();
        if (!state.selectedCampaignId) {
            setNullState();
        }
        updateCampaignWorkspaceLayout();
    };

    const showCampaignRunView = () => {
        if (!state.selectedCampaignId) {
            const activeCampaigns = state.campaigns
                .filter((c) => !c.completed_at)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            state.selectedCampaignId = activeCampaigns[0]?.id ?? null;
        }
        setCampaignWorkspaceMode('run');
        renderCampaignList();
        renderCampaignDetails();
    };

    const renderCampaignDetails = async () => {
        if (campaignDetailsContent) campaignDetailsContent.classList.add('hidden');

        const campaign = state.campaigns.find(c => c.id === state.selectedCampaignId);

        if (!campaign) {
            if (campaignDetailsContent) {
                campaignDetailsContent.innerHTML = `<p class="campaign-details-null-text">Select a campaign to view details.</p>`;
                campaignDetailsContent.classList.remove('hidden');
            }
            activeRunMode = null;
            setNullState();
            updateCampaignWorkspaceLayout();
            return;
        }

        if (campaignDetailsContent) campaignDetailsContent.classList.remove('hidden');

        await loadCampaignMembers(campaign.id);

        if (campaign.completed_at) {
            renderCompletedCampaignSummary(campaign);
        } else {
            renderActiveCampaignDetails(campaign);
        }
        updateCampaignWorkspaceLayout();
    };

    const resetCampaignDetailsFlip = () => {
        if (campaignDetailsFlippable) {
            campaignDetailsFlippable.classList.remove('campaign-details-flipped');
        }
        if (campaignDetailsEmailBack) {
            campaignDetailsEmailBack.innerHTML = '';
        }
    };

    const renderActiveCampaignDetails = (campaign) => {
        resetCampaignDetailsFlip();
        const members = state.campaignMembers.map(member => state.contacts.find(c => c.id === member.contact_id)).filter(Boolean);
        const memberListHtml = members.length > 0 ? members.map(c => {
            const accountName = state.accounts.find(a => a.id === c.account_id)?.name || 'No Account';
            return `<li>${c.first_name} ${c.last_name} <span class="text-medium">(${accountName})</span></li>`;
        }).join('') : '<li>No contacts in this campaign.</li>';

        const hasStarted = state.campaignMembers.some(m => m.status !== 'Pending');
        const statusLabel = 'Active';
        const statusSlug = hasStarted ? 'active' : 'not-started';
        const typeIcon = campaign.type === 'Call'
            ? 'fa-phone'
            : campaign.type === 'Guided Email'
                ? 'fa-paper-plane'
                : 'fa-envelope';

        let emailCtaHtml = '';
        if (campaign.type === 'Guided Email') {
            emailCtaHtml = `
                <button type="button" id="show-email-details-btn" class="campaign-email-cta">
                    <i class="fas fa-envelope"></i>
                    <span>View email</span>
                </button>
            `;
            if (campaignDetailsEmailBack) {
                campaignDetailsEmailBack.innerHTML = `
                    <div class="campaign-email-back-content">
                        ${buildCampaignEmailPreviewBlockHtml(campaign)}
                    </div>`;
            }
        }

        if (campaignDetailsContent) {
            campaignDetailsContent.innerHTML = `
                <div class="campaign-details-header-row">
                    <span class="campaign-details-type-icon"><i class="fas ${typeIcon}"></i></span>
                    <h3 class="campaign-details-name">${campaign.name}</h3>
                    <span class="campaign-details-status-pill campaign-details-status-${statusSlug}">${statusLabel}</span>
                    <button type="button" id="delete-campaign-details-btn" class="btn-danger btn-icon-header campaign-details-delete-btn" title="Delete campaign"><i class="fas fa-trash"></i></button>
                </div>
                <div class="campaign-details-contacts-wrap">
                    <ul class="summary-contact-list">${memberListHtml}</ul>
                </div>
                ${emailCtaHtml}
            `;
            campaignDetailsContent.classList.remove('hidden');
        }

        if (campaign.type === 'Call') {
            renderCallBlitzUI();
        } else if (campaign.type === 'Email') {
            renderRetiredEmailMergeUI();
        } else if (campaign.type === 'Guided Email') {
            renderGuidedEmailUI();
        }
    };

    const renderCompletedCampaignSummary = (campaign) => {
        resetCampaignDetailsFlip();
        const completedMembers = state.campaignMembers.filter(m => m.status === 'Completed');
        const skippedMembers = state.campaignMembers.filter(m => m.status === 'Skipped');
        let memberHtml = (members, status) => {
            if (members.length === 0) return `<li>No contacts were ${status.toLowerCase()}.</li>`;
            return members.map(member => {
                const contact = state.contacts.find(c => c.id === member.contact_id);
                return `<li>${contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown Contact'}</li>`;
            }).join('');
        };
        const typeIcon = campaign.type === 'Call' ? 'fa-phone' : campaign.type === 'Guided Email' ? 'fa-paper-plane' : 'fa-envelope';
        const emailSummaryHtml = buildCampaignEmailInlineHtml(campaign);
        activeRunMode = null;
        setNullState();
        if (campaignDetailsContent) {
            campaignDetailsContent.innerHTML = `
                <div class="campaign-details-header-row">
                    <span class="campaign-details-type-icon"><i class="fas ${typeIcon}"></i></span>
                    <h3 class="campaign-details-name">${campaign.name}</h3>
                    <span class="campaign-details-status-pill campaign-details-status-completed">Completed</span>
                </div>
                <p class="campaign-details-meta"><strong>Completed On:</strong> ${formatDate(campaign.completed_at)}</p>
                ${emailSummaryHtml}
                <hr>
                <h4>Contacts Engaged (${completedMembers.length})</h4>
                <div class="campaign-details-contacts-wrap">
                    <ul class="summary-contact-list">${memberHtml(completedMembers, 'Engaged')}</ul>
                </div>
                <hr>
                <h4>Contacts Skipped (${skippedMembers.length})</h4>
                <div class="campaign-details-contacts-wrap">
                    <ul class="summary-contact-list">${memberHtml(skippedMembers, 'Skipped')}</ul>
                </div>`;
            campaignDetailsContent.classList.remove('hidden');
        }
    };

    const renderCallBlitzUI = () => {
        if (!rcMiddlePanel) return;
        activeRunMode = 'call';
        clearNullState();

        const pendingCalls = state.campaignMembers.filter(m => m.status === 'Pending');
        if (pendingCalls.length > 0) {
            if (rcSummary) { rcSummary.classList.add('hidden'); rcSummary.innerHTML = ''; }
            if (rcLayout) rcLayout.classList.remove('hidden');
            rcContactContent.innerHTML = CALL_BLITZ_CONTACT_HTML;
            rcMiddlePanel.innerHTML = CALL_BLITZ_MIDDLE_HTML;
            displayCurrentCall();
        } else {
            if (rcSummary) {
                rcSummary.innerHTML = `<p>All calls for this campaign are complete!</p>`;
                rcSummary.classList.remove('hidden');
            }
            if (rcLayout) rcLayout.classList.add('hidden');
        }
    };

    const renderRetiredEmailMergeUI = () => {
        if (!rcSummary) return;
        activeRunMode = null;
        clearNullState();
        rcSummary.innerHTML = '<p class="abm-retired-merge-notice">Email Merge campaigns are retired. Create a Guided Email ABM campaign for bespoke outreach.</p>';
        rcSummary.classList.remove('hidden');
        if (rcLayout) rcLayout.classList.add('hidden');
    };

    const renderGuidedEmailUI = () => {
        if (!rcMiddlePanel) return;
        activeRunMode = 'guided-email';
        clearNullState();

        const pendingEmails = state.campaignMembers.filter(m => m.status === 'Pending');
        if (pendingEmails.length > 0) {
            if (rcSummary) { rcSummary.classList.add('hidden'); rcSummary.innerHTML = ''; }
            if (rcLayout) rcLayout.classList.remove('hidden');
            rcContactContent.innerHTML = GUIDED_EMAIL_CONTACT_HTML;
            rcMiddlePanel.innerHTML = GUIDED_EMAIL_MIDDLE_HTML;
            displayCurrentEmail();
        } else {
            if (rcSummary) {
                rcSummary.innerHTML = `<p>All guided emails for this campaign are complete!</p>`;
                rcSummary.classList.remove('hidden');
            }
            if (rcLayout) rcLayout.classList.add('hidden');
        }
    };

    const checkForCampaignCompletion = async (campaignId) => {
        const {
            count,
            error
        } = await supabase.from('campaign_members').select('id', {
            count: 'exact',
            head: true
        }).eq('campaign_id', campaignId).eq('status', 'Pending');
        if (error) {
            console.error("Error checking for campaign completion:", error);
            return;
        }
        if (count === 0) {
            const {
                error: updateError
            } = await supabase.from('campaigns').update({
                completed_at: new Date().toISOString()
            }).eq('id', campaignId);
            if (updateError) console.error("Error marking campaign as complete:", updateError);
            const campaignInState = state.campaigns.find(c => c.id === campaignId);
            if (campaignInState) campaignInState.completed_at = new Date().toISOString();
            renderCampaignList();
        }
    };

    const startCallBlitz = () => {
        if (rcSummary) { rcSummary.classList.add('hidden'); rcSummary.innerHTML = ''; }
        if (rcLayout) rcLayout.classList.remove('hidden');
        if (rcContactContent) rcContactContent.innerHTML = CALL_BLITZ_CONTACT_HTML;
        if (rcMiddlePanel) rcMiddlePanel.innerHTML = CALL_BLITZ_MIDDLE_HTML;
        displayCurrentCall();
    };

    const updateNotesPlaceholder = (textareaId, placeholderId) => {
        const textarea = document.getElementById(textareaId);
        const placeholder = document.getElementById(placeholderId);
        if (!textarea || !placeholder) return;
        placeholder.classList.toggle('hidden', textarea.value.trim() !== '');
    };

    const fitContactLink = (el) => {
        if (!el) return;
        el.style.fontSize = '';
        const len = (el.textContent || '').length;
        if (len > 28) el.style.fontSize = '0.65rem';
        else if (len > 22) el.style.fontSize = '0.7rem';
        else if (len > 16) el.style.fontSize = '0.75rem';
    };

    const buildRunCampaignRecentActivityHtml = (contactId) => {
        const activities = (state.activities || [])
            .filter((act) => act.contact_id === contactId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        if (activities.length === 0) {
            return '<p class="recent-activities-empty">No activities yet.</p>';
        }
        return activities.map((act) => {
            const typeLower = (act.type || '').toLowerCase();
            let iconClass = 'icon-default';
            let icon = 'fa-circle-info';
            let iconPrefix = 'fas';
            if (typeLower.includes('cognito') || typeLower.includes('intelligence')) { icon = 'fa-magnifying-glass'; }
            else if (typeLower.includes('email')) { iconClass = 'icon-email'; icon = 'fa-envelope'; }
            else if (typeLower.includes('call')) { iconClass = 'icon-call'; icon = 'fa-phone'; }
            else if (typeLower.includes('meeting')) { iconClass = 'icon-meeting'; icon = 'fa-video'; }
            else if (typeLower.includes('linkedin')) { iconClass = 'icon-linkedin'; icon = 'fa-linkedin-in'; iconPrefix = 'fa-brands'; }
            return `
                <div class="recent-activity-item">
                    <div class="activity-icon-wrap ${iconClass}"><i class="${iconPrefix} ${icon}"></i></div>
                    <div class="activity-body">
                        <div class="activity-description">${escapeCampaignHtml(act.type)}: ${escapeCampaignHtml(act.description || '')}</div>
                        <div class="activity-date">${escapeCampaignHtml(formatDate(act.date))}</div>
                    </div>
                </div>`;
        }).join('');
    };

    const buildOnDeckContactHtml = (contact, account) => {
        if (!contact) {
            return `
                <section class="run-campaign-on-deck run-campaign-on-deck-empty">
                    <span class="run-campaign-on-deck-label">On deck</span>
                    <p class="run-campaign-on-deck-empty-text">No one else in the queue.</p>
                </section>`;
        }

        const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown Contact';
        const title = String(contact.title ?? '').trim();
        const accountName = account?.name || 'No Account';
        const metaParts = [title, accountName].filter(Boolean);

        return `
            <section class="run-campaign-on-deck">
                <span class="run-campaign-on-deck-label"><i class="fas fa-arrow-down" aria-hidden="true"></i> On deck</span>
                <div class="run-campaign-on-deck-body">
                    <span class="run-campaign-on-deck-name">${escapeCampaignHtml(name)}</span>
                    ${metaParts.length ? `<span class="run-campaign-on-deck-meta">${escapeCampaignHtml(metaParts.join(' · '))}</span>` : ''}
                </div>
            </section>`;
    };

    const renderRunCampaignContactProfile = (contact, account, nextContact = null, nextAccount = null) => {
        if (!rcContactProfileContent || !contact) return;

        const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown Contact';
        const title = String(contact.title ?? '').trim();
        const accountName = account?.name || 'No Account';
        const email = String(contact.email ?? '').trim();
        const phone = String(contact.phone ?? '').trim();
        const notes = String(contact.notes ?? '').trim();

        rcContactProfileContent.innerHTML = `
            <div class="run-campaign-profile-layout">
                <section class="run-campaign-contact-info-card">
                    <div class="run-campaign-profile-header">
                        <div class="run-campaign-profile-heading">
                            <span class="run-campaign-profile-now-label">Now</span>
                            <h4 class="run-campaign-profile-name">${escapeCampaignHtml(name)}</h4>
                            ${title ? `<p class="run-campaign-profile-meta">${escapeCampaignHtml(title)}</p>` : ''}
                        </div>
                        <a href="contacts.html?contactId=${encodeURIComponent(contact.id)}" class="run-campaign-profile-open-link">Open in Contacts</a>
                    </div>
                    <div class="run-campaign-profile-grid">
                        <div class="run-campaign-profile-field">
                            <span class="run-campaign-profile-label">Email</span>
                            ${email
                                ? `<a href="mailto:${escapeCampaignHtml(email)}" class="run-campaign-profile-value run-campaign-profile-link">${escapeCampaignHtml(email)}</a>`
                                : '<span class="run-campaign-profile-value run-campaign-profile-muted">—</span>'}
                        </div>
                        <div class="run-campaign-profile-field">
                            <span class="run-campaign-profile-label">Phone</span>
                            ${phone
                                ? `<a href="tel:${escapeCampaignHtml(phone)}" class="run-campaign-profile-value run-campaign-profile-link">${escapeCampaignHtml(phone)}</a>`
                                : '<span class="run-campaign-profile-value run-campaign-profile-muted">—</span>'}
                        </div>
                        <div class="run-campaign-profile-field">
                            <span class="run-campaign-profile-label">Account</span>
                            <span class="run-campaign-profile-value">${escapeCampaignHtml(accountName)}</span>
                        </div>
                        <div class="run-campaign-profile-field">
                            <span class="run-campaign-profile-label">Title</span>
                            <span class="run-campaign-profile-value">${title ? escapeCampaignHtml(title) : '<span class="run-campaign-profile-muted">—</span>'}</span>
                        </div>
                    </div>
                    ${notes ? `
                        <div class="run-campaign-profile-notes">
                            <span class="run-campaign-profile-label">Contact Notes</span>
                            <p class="run-campaign-profile-notes-body">${escapeCampaignHtml(notes)}</p>
                        </div>` : ''}
                </section>
                ${buildOnDeckContactHtml(nextContact, nextAccount)}
                <section class="run-campaign-activity-card">
                    <h5 class="run-campaign-profile-activities-title">Recent Activity</h5>
                    <div class="recent-activities-list run-campaign-profile-activities-list">${buildRunCampaignRecentActivityHtml(contact.id)}</div>
                </section>
            </div>`;
    };

    const displayCurrentCall = () => {
        const pendingCalls = state.campaignMembers.filter(m => m.status === 'Pending');
        const phoneLinkEl = document.getElementById('contact-phone-call-blitz');
        const callNotesEl = document.getElementById('call-notes');
        const logBtn = document.getElementById('log-call-btn');
        const skipBtn = document.getElementById('skip-call-btn');

        if (!phoneLinkEl || !callNotesEl || !logBtn || !skipBtn) {
            console.error("Missing call blitz elements.");
            return;
        }

        if (pendingCalls.length === 0) {
            renderCampaignDetails();
            showModal("Call Blitz Complete", "All calls for this campaign have been logged or skipped!", () => {
                hideModal();
                loadAllData();
            }, true, '<button class="btn-primary" id="modal-ok-btn">OK</button>');
            return;
        }

        const currentMember = pendingCalls[0];
        const contact = state.contacts.find(c => c.id === currentMember.contact_id);
        const account = contact ? state.accounts.find(a => a.id === contact.account_id) : null;

        if (!contact) {
            console.error("Contact not found for campaign member:", currentMember);
            handleSkipCall({ target: skipBtn });
            return;
        }

        logBtn.dataset.memberId = currentMember.id;
        skipBtn.dataset.memberId = currentMember.id;

        const nextMember = pendingCalls[1];
        const nextContact = nextMember ? state.contacts.find(c => c.id === nextMember.contact_id) : null;
        const nextAccount = nextContact ? state.accounts.find(a => a.id === nextContact.account_id) : null;
        renderRunCampaignContactProfile(contact, account, nextContact, nextAccount);

        phoneLinkEl.href = contact.phone ? `tel:${contact.phone}` : '#';
        phoneLinkEl.innerHTML = contact.phone
            ? `<i class="fas fa-phone" aria-hidden="true"></i><span>${escapeCampaignHtml(contact.phone)}</span>`
            : '<span class="run-campaign-primary-channel-muted">No phone on file</span>';
        if (contact.phone) phoneLinkEl.removeAttribute('tabindex');
        else phoneLinkEl.setAttribute('tabindex', '-1');
        fitContactLink(phoneLinkEl.querySelector('span') || phoneLinkEl);

        callNotesEl.value = '';
        updateNotesPlaceholder('call-notes', 'call-notes-placeholder');
        callNotesEl.focus();
    };

    const handleLogCall = async (event) => {
        const notesEl = document.getElementById('call-notes');
        const notes = notesEl ? notesEl.value.trim() : '';
        if (!notes) {
            alert('Please enter call notes before logging.');
            return;
        }
        
        // CORRECTED: Get memberId from the button that was clicked
        const memberId = Number(event.target.dataset.memberId);
        const currentMember = state.campaignMembers.find(m => m.id === memberId);

        if (!currentMember) {
            console.error("No current campaign member to log call for.");
            return;
        }

        const contact = state.contacts.find(c => c.id === currentMember.contact_id);
        const campaign = state.campaigns.find(c => c.id === currentMember.campaign_id);

        if (!contact || !campaign) {
            console.error("Associated contact or campaign not found for logging activity.");
            return;
        }

        const {
            error: activityError
        } = await supabase.from('activities').insert({
            contact_id: contact.id,
            account_id: contact.account_id,
            type: 'Call',
            description: `Campaign Call: "${campaign.name}". Notes: ${notes}`,
            user_id: getState().effectiveUserId,
            date: new Date().toISOString()
        });
        if (activityError) {
            console.error("Error logging activity:", activityError);
            alert("Failed to log call activity. Please try again.");
            return;
        }

        const {
            error: memberUpdateError
        } = await supabase.from('campaign_members').update({
            status: 'Completed',
            notes: notes,
            completed_at: new Date().toISOString()
        }).eq('id', currentMember.id);
        if (memberUpdateError) {
            console.error("Error updating campaign member status:", memberUpdateError);
            alert("Failed to update campaign member status. Please try again.");
            return;
        }

        currentMember.status = 'Completed'; // Update local state immediately
        state.activities.push({ contact_id: contact.id, account_id: contact.account_id, type: 'Call', description: `Campaign Call: "${campaign.name}". Notes: ${notes}`, user_id: getState().effectiveUserId, date: new Date().toISOString() });
        displayCurrentCall(); // Refresh UI for next call
        await checkForCampaignCompletion(currentMember.campaign_id);
    };

    const handleSkipCall = async (event) => {
        // CORRECTED: Get memberId from the button that was clicked
        const memberId = Number(event.target.dataset.memberId);
        const currentMember = state.campaignMembers.find(m => m.id === memberId);
        if (!currentMember) {
            console.error("No current campaign member to skip call for.");
            return;
        }

        const {
            error: memberUpdateError
        } = await supabase.from('campaign_members').update({
            status: 'Skipped',
            completed_at: new Date().toISOString()
        }).eq('id', currentMember.id);
        if (memberUpdateError) {
            console.error("Error updating campaign member status (skip):", memberUpdateError);
            alert("Failed to skip call. Please try again.");
            return;
        }

        currentMember.status = 'Skipped'; // Update local state immediately
        displayCurrentCall(); // Refresh UI for next call
        await checkForCampaignCompletion(currentMember.campaign_id);
    };

    const startGuidedEmail = () => {
        if (rcSummary) { rcSummary.classList.add('hidden'); rcSummary.innerHTML = ''; }
        if (rcLayout) rcLayout.classList.remove('hidden');
        if (rcContactContent) rcContactContent.innerHTML = GUIDED_EMAIL_CONTACT_HTML;
        if (rcMiddlePanel) rcMiddlePanel.innerHTML = GUIDED_EMAIL_MIDDLE_HTML;
        displayCurrentEmail();
    };

    const displayCurrentEmail = () => {
        const pending = state.campaignMembers.filter(m => m.status === 'Pending');
        const emailToAddressEl = document.getElementById('email-to-address');
        const emailSubjectEl = document.getElementById('email-subject');
        const emailBodyTextareaEl = document.getElementById('email-body-textarea');
        const openEmailBtn = document.getElementById('open-email-client-btn');
        const skipEmailBtn = document.getElementById('skip-email-btn');
        const contactEmailGuided = document.getElementById('contact-email-guided-email');

        if (!emailToAddressEl || !emailSubjectEl || !emailBodyTextareaEl || !openEmailBtn || !skipEmailBtn || !contactEmailGuided) {
            console.error("Missing guided email elements.");
            return;
        }

        if (pending.length === 0) {
            renderCampaignDetails();
            showModal("Guided Email Complete", "All guided emails for this campaign have been processed!", () => {
                hideModal();
                loadAllData();
            }, true, '<button class="btn-primary" id="modal-ok-btn">OK</button>');
            return;
        }

        const currentMember = pending[0];
        const contact = state.contacts.find(c => c.id === currentMember.contact_id);
        const account = contact ? state.accounts.find(a => a.id === contact.account_id) : null;
        const campaign = state.campaigns.find(c => c.id === currentMember.campaign_id);

        if (!contact || !campaign) {
            console.error("Associated contact or campaign not found for guided email.");
            handleSkipEmail({ target: skipEmailBtn });
            return;
        }

        openEmailBtn.dataset.memberId = currentMember.id;
        skipEmailBtn.dataset.memberId = currentMember.id;

        let emailBody = (campaign.email_body || '').trim();
        emailBody = emailBody.replace(/\[FirstName\]/g, contact.first_name || '');
        emailBody = emailBody.replace(/\[LastName\]/g, contact.last_name || '');
        emailBody = emailBody.replace(/\[AccountName\]/g, account ? account.name : '');

        const nextMember = pending[1];
        const nextContact = nextMember ? state.contacts.find(c => c.id === nextMember.contact_id) : null;
        const nextAccount = nextContact ? state.accounts.find(a => a.id === nextContact.account_id) : null;
        renderRunCampaignContactProfile(contact, account, nextContact, nextAccount);

        contactEmailGuided.href = contact.email ? `mailto:${contact.email}` : '#';
        contactEmailGuided.innerHTML = contact.email
            ? `<i class="fas fa-envelope" aria-hidden="true"></i><span>${escapeCampaignHtml(contact.email)}</span>`
            : '<span class="run-campaign-primary-channel-muted">No email on file</span>';
        fitContactLink(contactEmailGuided.querySelector('span') || contactEmailGuided);

        emailToAddressEl.textContent = contact.email || 'No Email';
        emailSubjectEl.value = campaign.email_subject || '';
        emailBodyTextareaEl.value = emailBody;
        updateNotesPlaceholder('email-body-textarea', 'email-body-placeholder');
        emailBodyTextareaEl.focus();
    };

    const handleOpenEmailClient = async (event) => {
        const to = document.getElementById('email-to-address')?.textContent;
        const subject = document.getElementById('email-subject')?.value;
        const body = document.getElementById('email-body-textarea')?.value;

        if (!to || to === 'No Email') {
            alert("Cannot open email client: Contact has no email address.");
            return;
        }

        const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`;
        window.location.href = mailtoLink;

        // CORRECTED: Get memberId from the button that was clicked
        const memberId = Number(event.target.dataset.memberId);
        const currentMember = state.campaignMembers.find(m => m.id === memberId);
        if (!currentMember) {
            console.error("No current campaign member for email client action.");
            return;
        }

        const contact = state.contacts.find(c => c.id === currentMember.contact_id);
        const campaign = state.campaigns.find(c => c.id === currentMember.campaign_id);

        if (!contact || !campaign) {
            console.error("Associated contact or campaign not found for email activity logging.");
            return;
        }

        const {
            error: activityError
        } = await supabase.from('activities').insert({
            contact_id: currentMember.contact_id,
            account_id: contact.account_id,
            type: 'Email',
            description: `Sent guided email for campaign: "${campaign.name}". Subject: ${subject || '(No Subject)'}`,
            user_id: getState().effectiveUserId,
            date: new Date().toISOString()
        });
        if (activityError) console.error("Error logging guided email activity:", activityError);

        const {
            error: memberUpdateError
        } = await supabase.from('campaign_members').update({
            status: 'Completed',
            notes: `Email opened in client. Subject: ${subject || '(No Subject)'}`,
            completed_at: new Date().toISOString()
        }).eq('id', currentMember.id);
        if (memberUpdateError) console.error("Error updating campaign member status (email):", memberUpdateError);

        currentMember.status = 'Completed'; // Update local state immediately
        const newAct = { contact_id: currentMember.contact_id, account_id: contact.account_id, type: 'Email', description: `Sent guided email for campaign: "${campaign.name}". Subject: ${subject || '(No Subject)'}`, user_id: getState().effectiveUserId, date: new Date().toISOString() };
        state.activities.push(newAct);

        // Delay to allow the mail client to open before processing the next item
        setTimeout(async () => {
            displayCurrentEmail();
            await checkForCampaignCompletion(currentMember.campaign_id);
        }, 500);
    };

    const handleSkipEmail = async (event) => {
        // CORRECTED: Get memberId from the button that was clicked
        const memberId = Number(event.target.dataset.memberId);
        const currentMember = state.campaignMembers.find(m => m.id === memberId);
        if (!currentMember) {
            console.error("No current campaign member to skip email for.");
            return;
        }

        const {
            error: memberUpdateError
        } = await supabase.from('campaign_members').update({
            status: 'Skipped',
            completed_at: new Date().toISOString()
        }).eq('id', currentMember.id);
        if (memberUpdateError) {
            console.error("Error updating campaign member status (skip email):", memberUpdateError);
            alert("Failed to skip email. Please try again.");
            return;
        }

        currentMember.status = 'Skipped'; // Update local state immediately
        displayCurrentEmail(); // Refresh UI for next email
        await checkForCampaignCompletion(currentMember.campaign_id);
    };

    // REMOVED: captureFormState and restoreFormState functions are no longer needed
    // REMOVED: handleShowAllContactsClick function is no longer needed

    async function createCampaignAndMembers() {
        const name = document.getElementById('campaign-name')?.value.trim();
        const type = getCampaignSelectValue('campaign-type');
        const tier = getCampaignSelectValue('abm-filter-tier');
        const industry = getCampaignSelectValue('abm-filter-industry');
        let email_subject = '';
        let email_body = '';

        if (!name) {
            alert('Campaign name is required.');
            return false;
        }

        if (type === 'Guided Email') {
            email_subject = document.getElementById('campaign-email-subject')?.value.trim() || '';
            email_body = document.getElementById('campaign-email-body')?.value || '';
            if (!email_subject.trim() || !email_body.trim()) {
                alert('Guided Email campaigns require a bespoke subject and body.');
                return false;
            }
        }

        const cartContactIds = [...abmCartState.contactIds];
        if (cartContactIds.length === 0) {
            alert('Add at least one contact to the ABM cart before saving.');
            return false;
        }

        const matchingContacts = cartContactIds
            .map((id) => state.contacts.find((contact) => contact.id === id))
            .filter(Boolean);

        const confirmEl = document.getElementById('create-campaign-confirm');
        const confirmMsg = document.getElementById('create-campaign-confirm-message');
        if (confirmMsg) {
            confirmMsg.textContent = `Save "${name}" with ${matchingContacts.length} curated contact(s)?`;
        }
        if (confirmEl) confirmEl.classList.remove('hidden');
        const confirmProceed = await new Promise(resolve => {
            createCampaignConfirmResolve = resolve;
        });
        if (confirmEl) confirmEl.classList.add('hidden');
        createCampaignConfirmResolve = null;
        if (!confirmProceed) return false;

        const filter_criteria = {
            tier,
            industry,
            contact_ids: cartContactIds,
            selection_mode: 'abm_cart',
        };

        const { data: newCampaign, error: campaignError } = await supabase.from('campaigns').insert({
            name,
            type,
            filter_criteria,
            email_subject,
            email_body,
            user_id: getState().effectiveUserId,
        }).select().single();

        if (campaignError) {
            alert('Error saving campaign: ' + campaignError.message);
            return false;
        }

        const membersToInsert = matchingContacts.map(c => ({
            campaign_id: newCampaign.id,
            contact_id: c.id,
            user_id: getState().effectiveUserId,
            status: 'Pending',
        }));

        const { error: membersError } = await supabase.from('campaign_members').insert(membersToInsert);
        if (membersError) {
            alert('Error saving campaign members: ' + membersError.message);
            await supabase.from('campaigns').delete().eq('id', newCampaign.id);
            return false;
        }

        alert(`Campaign "${name}" saved with ${matchingContacts.length} ABM target(s).`);
        state.selectedCampaignId = newCampaign.id;
        state.campaignWorkspaceMode = 'run';
        clearAbmCart();
        await loadAllData();
        return true;
    }

    function renderAbmAccountExplorer() {
        const container = document.getElementById('abm-account-explorer');
        if (!container) return;

        const accounts = getFilteredExplorerAccounts();
        if (accounts.length === 0) {
            container.innerHTML = '<p class="abm-explorer-empty">No accounts match your Tier and Industry filters.</p>';
            return;
        }

        container.innerHTML = accounts.map((account) => {
            const expanded = abmCartState.expandedAccountIds.has(account.id);
            const contacts = getContactsForAccount(account.id);
            const contactRows = contacts.map((contact) => {
                const inCart = isContactInCart(contact.id);
                const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed';
                return `
                    <div
                        class="abm-contact-row${inCart ? ' abm-contact-row--in-cart' : ''}"
                        draggable="true"
                        data-abm-drag="contact"
                        data-contact-id="${contact.id}"
                        data-account-id="${account.id}"
                    >
                        <span class="abm-contact-name">${name}</span>
                        ${getMeddpiccBadgeHtml(contact.id)}
                        <button type="button" class="abm-contact-add-btn" data-abm-add-contact="${contact.id}" title="Add to cart">+</button>
                    </div>`;
            }).join('') || '<p class="abm-contact-empty">No contacts on this account.</p>';

            return `
                <div class="abm-account-accordion${expanded ? ' abm-account-accordion--expanded' : ''}" data-account-id="${account.id}">
                    <button
                        type="button"
                        class="abm-account-header"
                        draggable="true"
                        data-abm-drag="account"
                        data-account-id="${account.id}"
                    >
                        <span class="abm-account-chevron" aria-hidden="true" title="Expand contacts">${expanded ? '▾' : '▸'}</span>
                        <span class="abm-account-name">${account.name || 'Unnamed Account'}</span>
                        ${buildAccountTierBadgeHtml(account.tier)}
                        <span class="abm-account-meta">${contacts.length} contact${contacts.length === 1 ? '' : 's'}</span>
                    </button>
                    <div class="abm-account-contacts${expanded ? '' : ' hidden'}">${contactRows}</div>
                </div>`;
        }).join('');
    }

    function renderAbmCartPane() {
        const cartEl = document.getElementById('abm-campaign-cart');
        const countEl = document.getElementById('abm-cart-count');
        if (!cartEl) return;

        const ids = [...abmCartState.contactIds];
        if (countEl) {
            countEl.textContent = `${ids.length} contact${ids.length === 1 ? '' : 's'}`;
        }

        if (ids.length === 0) {
            cartEl.innerHTML = '<p class="abm-cart-empty">Drag contacts — or an entire account header — here to build your ABM list.</p>';
            return;
        }

        cartEl.innerHTML = ids.map((contactId) => {
            const contact = state.contacts.find((row) => row.id === contactId);
            if (!contact) return '';
            const account = state.accounts.find((row) => row.id === contact.account_id);
            const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed';
            return `
                <div class="abm-cart-item" data-contact-id="${contact.id}">
                    <div class="abm-cart-item-main">
                        <strong>${name}</strong>
                        <span class="abm-cart-item-account">${account?.name || 'No Account'}</span>
                        ${getMeddpiccBadgeHtml(contact.id)}
                    </div>
                    <button type="button" class="abm-cart-remove-btn" data-abm-remove-contact="${contact.id}" title="Remove from cart">×</button>
                </div>`;
        }).join('');
    }

    /**
     * Native HTML5 drag-and-drop for the ABM cart.
     * Sales psychology: curating the cart is a forcing function — reps must
     * consciously choose targets instead of exporting an entire filtered segment.
     */
    function setupAbmDragAndDrop() {
        const explorer = document.getElementById('abm-account-explorer');
        const cart = document.getElementById('abm-campaign-cart');
        if (!explorer || !cart) return;

        const setDragPayload = (event, payload) => {
            event.dataTransfer.setData('application/x-abm-payload', JSON.stringify(payload));
            event.dataTransfer.effectAllowed = 'copy';
        };

        explorer.addEventListener('dragstart', (event) => {
            const contactRow = event.target.closest('[data-abm-drag="contact"]');
            if (contactRow) {
                setDragPayload(event, {
                    kind: 'contact',
                    contactId: Number(contactRow.dataset.contactId),
                });
                return;
            }
            const accountHeader = event.target.closest('[data-abm-drag="account"]');
            if (accountHeader) {
                setDragPayload(event, {
                    kind: 'account',
                    accountId: Number(accountHeader.dataset.accountId),
                });
            }
        });

        const handleCartDrop = (event) => {
            event.preventDefault();
            cart.classList.remove('abm-campaign-cart--drag-over');
            let payload;
            try {
                payload = JSON.parse(event.dataTransfer.getData('application/x-abm-payload') || '{}');
            } catch (_) {
                return;
            }
            if (payload.kind === 'contact' && payload.contactId) {
                addContactToAbmCart(payload.contactId);
            } else if (payload.kind === 'account' && payload.accountId) {
                addAccountContactsToAbmCart(payload.accountId);
            }
        };

        cart.addEventListener('dragover', (event) => {
            event.preventDefault();
            cart.classList.add('abm-campaign-cart--drag-over');
        });
        cart.addEventListener('dragleave', () => {
            cart.classList.remove('abm-campaign-cart--drag-over');
        });
        cart.addEventListener('drop', handleCartDrop);
    }

    function setupAbmCampaignBuilderListeners() {
        const launchBtn = document.getElementById('launch-campaign-btn');
        if (launchBtn) {
            launchBtn.addEventListener('click', async () => {
                const ok = await createCampaignAndMembers();
                if (ok) renderAbmCampaignBuilder();
            });
        }

        const clearBtn = document.getElementById('abm-cart-clear');
        if (clearBtn) clearBtn.addEventListener('click', clearAbmCart);

        const campaignTypeSelect = document.getElementById('campaign-type');
        const guidedFields = document.getElementById('abm-guided-email-fields');
        const handleTypeChange = () => {
            const type = getCampaignSelectValue('campaign-type');
            if (guidedFields) guidedFields.classList.toggle('hidden', type !== 'Guided Email');
        };
        campaignTypeSelect?.addEventListener('change', handleTypeChange);
        handleTypeChange();

        document.getElementById('abm-filter-tier')?.addEventListener('change', () => {
            abmCartState.explorerTier = getCampaignSelectValue('abm-filter-tier');
            renderAbmAccountExplorer();
        });
        document.getElementById('abm-filter-industry')?.addEventListener('change', () => {
            abmCartState.explorerIndustry = getCampaignSelectValue('abm-filter-industry');
            renderAbmAccountExplorer();
        });
        document.getElementById('abm-explorer-search')?.addEventListener('input', (event) => {
            abmCartState.explorerSearch = event.target.value || '';
            renderAbmAccountExplorer();
        });

        const explorer = document.getElementById('abm-account-explorer');
        explorer?.addEventListener('click', (event) => {
            const chevron = event.target.closest('.abm-account-chevron');
            if (chevron) {
                event.preventDefault();
                const accordion = chevron.closest('[data-account-id]');
                if (accordion) toggleAbmAccountExpanded(accordion.dataset.accountId);
                return;
            }
            const addBtn = event.target.closest('[data-abm-add-contact]');
            if (addBtn) {
                event.preventDefault();
                addContactToAbmCart(addBtn.dataset.abmAddContact);
            }
        });

        const cart = document.getElementById('abm-campaign-cart');
        cart?.addEventListener('click', (event) => {
            const removeBtn = event.target.closest('[data-abm-remove-contact]');
            if (removeBtn) {
                event.preventDefault();
                removeContactFromAbmCart(removeBtn.dataset.abmRemoveContact);
            }
        });

        setupAbmDragAndDrop();
    }

    function renderAbmCampaignBuilder() {
        const container = document.getElementById('new-campaign-form-container');
        if (!container) return;
        destroyCampaignTomSelects();

        const uniqueIndustries = [...new Set(state.accounts.map(a => a.industry).filter(Boolean))].sort();
        const industryOptions = uniqueIndustries.map(i => `<option value="${i}">${i}</option>`).join('');
        const tierOptions = ['', 'Tier 1', 'Tier 2', 'Tier 3', 'Unassigned']
            .map((tier) => `<option value="${tier}">${tier || 'All Tiers'}</option>`)
            .join('');

        container.innerHTML = `
            <div id="abm-campaign-builder" class="abm-campaign-builder">
                <div class="abm-campaign-config">
                    <div class="abm-config-field">
                        <label for="campaign-name">Campaign Name</label>
                        <input type="text" id="campaign-name" required placeholder="e.g., Tier 1 FinServ Spear">
                    </div>
                    <div class="abm-config-field">
                        <label for="campaign-type">Campaign Type</label>
                        <select id="campaign-type">
                            <option value="Call">Call Blitz</option>
                            <option value="Guided Email">Guided Email</option>
                        </select>
                    </div>
                    <div id="abm-guided-email-fields" class="abm-guided-email-fields hidden">
                        <input type="text" id="campaign-email-subject" name="x-campaign-subject" placeholder="Bespoke subject" autocomplete="one-time-code">
                        <div class="create-campaign-body-inner create-campaign-body-box">
                            <span class="create-campaign-body-placeholder" id="campaign-email-body-placeholder">Bespoke body</span>
                            <textarea id="campaign-email-body" rows="4" name="x-campaign-body" autocomplete="nope"></textarea>
                            <div class="merge-fields-buttons" id="create-campaign-merge-pills">
                                <button type="button" class="btn-secondary" data-field="[FirstName]">First</button>
                                <button type="button" class="btn-secondary" data-field="[LastName]">Last</button>
                                <button type="button" class="btn-secondary" data-field="[AccountName]">Account</button>
                            </div>
                        </div>
                    </div>
                    <button type="button" id="launch-campaign-btn" class="btn-primary abm-launch-btn">Save Campaign</button>
                </div>
                <div class="abm-split-pane">
                    <div class="abm-explorer-pane">
                        <div class="abm-explorer-filters">
                            <div class="abm-filter-field">
                                <label for="abm-filter-tier">Tier</label>
                                <select id="abm-filter-tier">${tierOptions}</select>
                            </div>
                            <div class="abm-filter-field">
                                <label for="abm-filter-industry">Industry</label>
                                <select id="abm-filter-industry"><option value="">All</option>${industryOptions}</select>
                            </div>
                            <div class="abm-filter-field abm-filter-field--search">
                                <label for="abm-explorer-search">Search</label>
                                <input type="search" id="abm-explorer-search" placeholder="Filter accounts…">
                            </div>
                        </div>
                        <div id="abm-account-explorer" class="abm-account-explorer"></div>
                    </div>
                    <div class="abm-cart-pane">
                        <div class="abm-cart-header">
                            <h4 class="subsection-title">The Cart</h4>
                            <span id="abm-cart-count" class="abm-cart-count">0 contacts</span>
                            <button type="button" id="abm-cart-clear" class="btn-secondary btn-sm">Clear</button>
                        </div>
                        <div id="abm-campaign-cart" class="abm-campaign-cart" data-abm-dropzone></div>
                    </div>
                </div>
            </div>`;

        abmCartState.explorerTier = '';
        abmCartState.explorerIndustry = '';
        abmCartState.explorerSearch = '';

        initCampaignTomSelects();
        setupAbmCampaignBuilderListeners();
        renderAbmAccountExplorer();
        renderAbmCartPane();
    }

    function renderCreateCampaignForm() {
        renderAbmCampaignBuilder();
    }

    function handleMergeFieldClick(e) {
        const field = e.target.dataset.field;
        const activeTextarea = document.getElementById('campaign-email-body') || document.getElementById('email-body-textarea');

        if (!activeTextarea || activeTextarea.readOnly) {
            console.error("No editable textarea found for merge field insertion.");
            return;
        }

        activeTextarea.focus();
        try {
            const startPos = activeTextarea.selectionStart;
            const endPos = activeTextarea.selectionEnd;
            activeTextarea.value = activeTextarea.value.substring(0, startPos) + field + activeTextarea.value.substring(endPos);
            activeTextarea.setSelectionRange(startPos + field.length, startPos + field.length);
        } catch (error) {
            activeTextarea.value += field;
        }
        if (activeTextarea.id === 'campaign-email-body') {
            updateNotesPlaceholder('campaign-email-body', 'campaign-email-body-placeholder');
        }
        if (activeTextarea.id === 'email-body-textarea') {
            updateNotesPlaceholder('email-body-textarea', 'email-body-placeholder');
        }
    }

    const handleDeleteSelectedCampaign = () => {
        const campaignId = state.selectedCampaignId;

        if (!campaignId) {
            alert("Please select an active campaign to delete.");
            return;
        }

        const campaign = state.campaigns.find(c => c.id === campaignId);
        if (campaign && campaign.completed_at) {
            alert("Cannot delete a past campaign. Please select an active campaign.");
            return;
        }

        handleDeleteCampaign(campaignId);
    };

    async function handleDeleteCampaign(campaignId) {
        showModal("Confirm Deletion", "Are you sure you want to delete this campaign? This cannot be undone.", async () => {
            await supabase.from('campaign_members').delete().eq('campaign_id', campaignId);
            await supabase.from('campaigns').delete().eq('id', campaignId);
            alert("Campaign and its members deleted successfully!");
            state.selectedCampaignId = null;
            state.campaignWorkspaceMode = 'create';
            await loadAllData();
            showCampaignCreateView();
            return true;
        });
    }

    // --- Data Fetching ---
    async function loadAllData() {
        if (!state.currentUser) {
            console.warn("loadAllData called without a current user. Skipping data fetch.");
            return;
        }
        showGlobalLoader();
        try {
            const [
                 { data: campaigns, error: campaignsError },
                 { data: contacts, error: contactsError },
                 { data: accounts, error: accountsError },
                 { data: activities, error: activitiesError },
                 { data: accountPlans, error: accountPlansError },
            ] = await Promise.all([
                supabase.from("campaigns").select("*").eq("user_id", getState().effectiveUserId),
                supabase.from("contacts").select("*").eq("user_id", getState().effectiveUserId),
                supabase.from("accounts").select("*").eq("user_id", getState().effectiveUserId),
                supabase.from("activities").select("*").eq("user_id", getState().effectiveUserId),
                supabase.from("account_plans").select("account_id, plan"),
            ]);

            if (campaignsError) throw campaignsError;
            if (contactsError) throw contactsError;
            if (accountsError) throw accountsError;
            if (activitiesError) throw activitiesError;
            if (accountPlansError) throw accountPlansError;

            state.campaigns = campaigns || [];
            state.contacts = contacts || [];
            state.accounts = accounts || [];
            state.activities = filterOutOwnershipOrphanedCrmRows(activities || [], state.accounts, state.contacts);
            state.meddpiccByContactId = buildMeddpiccLookup(accountPlans || []);

            renderCampaignList();
            renderCampaignDetails();
            renderCreateCampaignForm();
            updateCampaignWorkspacePillUI();
            updateCampaignWorkspaceLayout();
        } catch (error) {
            console.error("Error loading data:", error.message);
            alert("Failed to load page data. Please try refreshing. Error: " + error.message);
        } finally {
            hideGlobalLoader();
        }
    }

    async function loadCampaignMembers(campaignId) {
        const {
            data,
            error
        } = await supabase.from('campaign_members').select('*').eq('campaign_id', campaignId);
        if (error) {
            console.error('Error fetching campaign members:', error);
            state.campaignMembers = [];
        } else {
            state.campaignMembers = data || [];
        }
    }

    function setupPageEventListeners() {
        setupModalListeners();
        updateActiveNavLink();

        const confirmYesBtn = document.getElementById('create-campaign-confirm-yes');
        const confirmCancelBtn = document.getElementById('create-campaign-confirm-cancel');
        const confirmEl = document.getElementById('create-campaign-confirm');
        if (confirmYesBtn) confirmYesBtn.addEventListener('click', () => { if (confirmEl) confirmEl.classList.add('hidden'); if (createCampaignConfirmResolve) createCampaignConfirmResolve(true); createCampaignConfirmResolve = null; });
        if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', () => { if (confirmEl) confirmEl.classList.add('hidden'); if (createCampaignConfirmResolve) createCampaignConfirmResolve(false); createCampaignConfirmResolve = null; });
        if (mobileCampaignSelect) {
            mobileCampaignSelect.addEventListener('change', () => {
                const raw = mobileCampaignSelect.value;
                state.selectedCampaignId = raw ? Number(raw) : null;
                state.campaignWorkspaceMode = raw ? 'run' : 'create';
                updateCampaignWorkspacePillUI();
                renderCampaignList();
                renderCampaignDetails();
            });
        }

        const createWorkspaceBtn = document.getElementById('campaign-workspace-create-btn');
        const runWorkspaceBtn = document.getElementById('campaign-workspace-run-btn');
        createWorkspaceBtn?.addEventListener('click', () => {
            if (state.campaignWorkspaceMode !== 'create') showCampaignCreateView();
        });
        runWorkspaceBtn?.addEventListener('click', () => {
            if (state.campaignWorkspaceMode !== 'run') showCampaignRunView();
        });

        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.merge-fields-buttons button')) {
                handleMergeFieldClick(e);
            }

            const campaignListItem = e.target.closest('#campaign-list-active .list-item, #campaign-list-past .list-item');
            if (campaignListItem) {
                const newSelectedId = Number(campaignListItem.dataset.id);
                if (newSelectedId !== state.selectedCampaignId) {
                    state.selectedCampaignId = newSelectedId;
                    state.campaignWorkspaceMode = 'run';
                    updateCampaignWorkspacePillUI();
                    renderCampaignList();
                    renderCampaignDetails();
                }
            }
            // REMOVED: No longer need to listen for 'modal-return-btn' clicks.
            if (e.target.id === 'modal-ok-btn') {
                hideModal();
            }
        });

        const emailSubjectEl = document.getElementById('email-subject');
        if (emailSubjectEl) {
            emailSubjectEl.setAttribute('readonly', '');
            emailSubjectEl.addEventListener('focus', () => emailSubjectEl.removeAttribute('readonly'), { once: true });
        }
        const callNotesEl = document.getElementById('call-notes');
        const emailBodyEl = document.getElementById('email-body-textarea');
        const campaignDetailsPanel = document.getElementById('campaign-details');
        if (campaignDetailsPanel) {
            campaignDetailsPanel.addEventListener('input', (e) => {
                if (e.target.id === 'call-notes') updateNotesPlaceholder('call-notes', 'call-notes-placeholder');
                if (e.target.id === 'email-body-textarea') updateNotesPlaceholder('email-body-textarea', 'email-body-placeholder');
                if (e.target.id === 'campaign-email-body') updateNotesPlaceholder('campaign-email-body', 'campaign-email-body-placeholder');
            });
        }
        if (campaignDetailsPanel) {
            campaignDetailsPanel.addEventListener('wheel', (e) => {
                const wrap = e.target.closest('.campaign-details-contacts-wrap');
                if (wrap && wrap.scrollHeight > wrap.clientHeight) {
                    e.preventDefault();
                    wrap.scrollTop += e.deltaY;
                }
            }, { passive: false });
        }
        if (campaignDetailsPanel) {
            campaignDetailsPanel.addEventListener('click', (e) => {
                const logBtn = e.target.closest('#log-call-btn');
                const skipBtn = e.target.closest('#skip-call-btn');
                const openEmailBtn = e.target.closest('#open-email-client-btn');
                const skipEmailBtn = e.target.closest('#skip-email-btn');
                if (logBtn) handleLogCall({ target: logBtn });
                else if (skipBtn) handleSkipCall({ target: skipBtn });
                else if (openEmailBtn) handleOpenEmailClient({ target: openEmailBtn });
                else if (skipEmailBtn) handleSkipEmail({ target: skipEmailBtn });
                else if (e.target.closest('#show-email-details-btn') && campaignDetailsFlippable && campaignDetailsEmailBack && campaignDetailsEmailBack.innerHTML.trim() !== '') {
                    campaignDetailsFlippable.classList.add('campaign-details-flipped');
                } else if (e.target.closest('#campaign-details-back-btn') && campaignDetailsFlippable) {
                    campaignDetailsFlippable.classList.remove('campaign-details-flipped');
                } else if (e.target.id === 'delete-campaign-details-btn') {
                    handleDeleteSelectedCampaign();
                }
            });
        }
    }

    async function initializePage() {
        await loadSVGs();
        const appState = await initializeAppState(supabase);
        if (!appState.currentUser) {
            hideGlobalLoader();
            return;
        }
        state.currentUser = appState.currentUser;
        await setupUserMenuAndAuth(supabase, getState());
        setupPageEventListeners();
        await setupGlobalSearch(supabase, state.currentUser);
        await checkAndSetNotifications(supabase);
        await loadAllData();
        showCampaignCreateView();
        window.addEventListener('effectiveUserChanged', loadAllData);
    }

    initializePage();
});
