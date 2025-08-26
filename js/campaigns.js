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
    loadSVGs,
    setupGlobalSearch,
    checkAndSetNotifications
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let state = {
        currentUser: null,
        campaigns: [],
        contacts: [],
        accounts: [],
        emailTemplates: [],
        user_quotas: [],
        campaignMembers: [],
        selectedCampaignId: null
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
    const newCampaignBtn = document.getElementById('new-campaign-btn');
    const manageTemplatesBtn = document.getElementById('manage-templates-btn');
    const deleteCampaignBtn = document.getElementById('delete-campaign-btn');
    const activeCampaignList = document.getElementById('campaign-list-active');
    const pastCampaignList = document.getElementById('campaign-list-past');
    const campaignDetailsContent = document.getElementById('campaign-details-content');
    const callBlitzUI = document.getElementById('call-blitz-ui');
    const emailMergeUI = document.getElementById('email-merge-ui');
    const guidedEmailUI = document.getElementById('guided-email-ui');

    // --- RENDER FUNCTIONS ---
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

        if (activeCampaigns.length === 0) {
            activeCampaignList.innerHTML = `<div class="list-item-placeholder">No active campaigns.</div>`;
        } else {
            activeCampaigns.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach(c => renderCampaignListItem(c, activeCampaignList));
        }

        if (pastCampaigns.length === 0) {
            pastCampaignList.innerHTML = `<div class="list-item-placeholder">No past campaigns.</div>`;
        } else {
            pastCampaigns.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).forEach(c => renderCampaignListItem(c, pastCampaignList));
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

    const renderCampaignDetails = async () => {
        [campaignDetailsContent, callBlitzUI, emailMergeUI, guidedEmailUI].forEach(el => {
            if (el) el.classList.add('hidden');
        });

        const campaign = state.campaigns.find(c => c.id === state.selectedCampaignId);

        if (deleteCampaignBtn) {
            const canDelete = campaign && !campaign.completed_at;
            deleteCampaignBtn.disabled = !canDelete;
        }

        if (!campaign) {
            if (campaignDetailsContent) {
                campaignDetailsContent.innerHTML = `<p>Select a campaign to see its details or create a new one.</p>`;
                campaignDetailsContent.classList.remove('hidden');
            }
            return;
        }

        await loadCampaignMembers(campaign.id);

        if (campaign.completed_at) {
            renderCompletedCampaignSummary(campaign);
        } else {
            renderActiveCampaignDetails(campaign);
        }
    };

    const renderActiveCampaignDetails = (campaign) => {
        const members = state.campaignMembers.map(member => state.contacts.find(c => c.id === member.contact_id)).filter(Boolean);
        const memberListHtml = members.length > 0 ? members.map(c => {
            const accountName = state.accounts.find(a => a.id === c.account_id)?.name || 'No Account';
            return `<li>${c.first_name} ${c.last_name} <span class="text-medium">(${accountName})</span></li>`;
        }).join('') : '<li>No contacts in this campaign.</li>';

        let emailInfoHtml = '';
        if (campaign.type === 'Email' || campaign.type === 'Guided Email') {
            emailInfoHtml = `
                <hr>
                <h4>Email Content</h4>
                <p><strong>Subject:</strong> ${campaign.email_subject || '(Not set)'}</p>
                <div class="email-body-summary">${campaign.email_body || '(Not set)'}</div>
            `;
        }

        if (campaignDetailsContent) {
            campaignDetailsContent.innerHTML = `
                <h4>${campaign.name}</h4>
                <p><strong>Type:</strong> ${campaign.type}</p>
                <p><strong>Status:</strong> Active</p>
                <hr>
                <h4>Included Contacts (${members.length})</h4>
                <ul class="summary-contact-list">${memberListHtml}</ul>
                ${emailInfoHtml}
            `;
            campaignDetailsContent.classList.remove('hidden');
        }

        if (campaign.type === 'Call' && callBlitzUI) {
            renderCallBlitzUI();
        } else if (campaign.type === 'Email' && emailMergeUI) {
            renderEmailMergeUI();
        } else if (campaign.type === 'Guided Email' && guidedEmailUI) {
            renderGuidedEmailUI();
        }
    };

    const renderCompletedCampaignSummary = (campaign) => {
        const completedMembers = state.campaignMembers.filter(m => m.status === 'Completed');
        const skippedMembers = state.campaignMembers.filter(m => m.status === 'Skipped');
        let memberHtml = (members, status) => {
            if (members.length === 0) return `<li>No contacts were ${status.toLowerCase()}.</li>`;
            return members.map(member => {
                const contact = state.contacts.find(c => c.id === member.contact_id);
                return `<li>${contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown Contact'}</li>`;
            }).join('');
        };
        let emailBodyHtml = '';
        if (campaign.email_body) {
            emailBodyHtml = `<h4>Email Template Used</h4><div class="email-body-summary">${campaign.email_body}</div>`;
        }
        if (campaignDetailsContent) {
            campaignDetailsContent.innerHTML = `
                <h4>${campaign.name}</h4>
                <p><strong>Status:</strong> Complete</p>
                <p><strong>Completed On:</strong> ${formatDate(campaign.completed_at)}</p>
                <hr>
                <h4>Contacts Engaged (${completedMembers.length})</h4>
                <ul>${memberHtml(completedMembers, 'Engaged')}</ul>
                <hr>
                <h4>Contacts Skipped (${skippedMembers.length})</h4>
                <ul>${memberHtml(skippedMembers, 'Skipped')}</ul>
                ${emailBodyHtml}`;
            campaignDetailsContent.classList.remove('hidden');
        }
    };

    const renderCallBlitzUI = () => {
        if (!callBlitzUI) return;
        callBlitzUI.classList.remove('hidden');
        const summaryView = document.getElementById('call-summary-view');
        const activeCallView = document.getElementById('active-call-view');
        const summaryText = document.getElementById('call-summary-text');
        const startBtn = document.getElementById('start-calling-btn');

        if (!summaryView || !activeCallView || !summaryText || !startBtn) {
            console.error("Call Blitz UI elements not found.");
            return;
        }

        const pendingCalls = state.campaignMembers.filter(m => m.status === 'Pending');
        if (pendingCalls.length > 0) {
            summaryText.textContent = `This campaign has ${pendingCalls.length} call(s) remaining.`;
            startBtn.classList.remove('hidden');
        } else {
            summaryText.textContent = 'All calls for this campaign are complete!';
            startBtn.classList.add('hidden');
        }
        summaryView.classList.remove('hidden');
        activeCallView.classList.add('hidden');
    };

    const renderEmailMergeUI = () => {
        if (!emailMergeUI) return;
        emailMergeUI.classList.remove('hidden');
        const summaryText = document.getElementById('email-summary-text');
        if (summaryText) {
            summaryText.textContent = `This campaign includes ${state.campaignMembers.length} contact(s).`;
        }
    };

    const renderGuidedEmailUI = () => {
        if (!guidedEmailUI) return;
        guidedEmailUI.classList.remove('hidden');
        const summaryView = document.getElementById('guided-email-summary-view');
        const activeEmailView = document.getElementById('active-email-view');
        const summaryText = document.getElementById('guided-email-summary-text');
        const startBtn = document.getElementById('start-guided-email-btn');

        if (!summaryView || !activeEmailView || !summaryText || !startBtn) {
            console.error("Guided Email UI elements not found.");
            return;
        }

        const pendingEmails = state.campaignMembers.filter(m => m.status === 'Pending');
        if (pendingEmails.length > 0) {
            summaryText.textContent = `This campaign has ${pendingEmails.length} email(s) to send.`;
            startBtn.classList.remove('hidden');
        } else {
            summaryText.textContent = 'All guided emails for this campaign are complete!';
            startBtn.classList.add('hidden');
        }
        summaryView.classList.remove('hidden');
        activeEmailView.classList.add('hidden');
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
        const summaryView = document.getElementById('call-summary-view');
        const activeCallView = document.getElementById('active-call-view');
        if (!summaryView || !activeCallView) return;

        summaryView.classList.add('hidden');
        activeCallView.classList.remove('hidden');
        displayCurrentCall();
    };

    const displayCurrentCall = () => {
        const pendingCalls = state.campaignMembers.filter(m => m.status === 'Pending');
        const contactNameEl = document.getElementById('contact-name-call-blitz');
        const contactCompanyEl = document.getElementById('contact-company-call-blitz');
        const phoneLinkEl = document.getElementById('contact-phone-call-blitz');
        const callNotesEl = document.getElementById('call-notes');

        if (!contactNameEl || !contactCompanyEl || !phoneLinkEl || !callNotesEl) {
            console.error("Missing call blitz contact info elements.");
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
            handleSkipCall({ target: { dataset: { memberId: currentMember.id } } });
            return;
        }

        document.getElementById('log-call-btn').dataset.memberId = currentMember.id;
        document.getElementById('skip-call-btn').dataset.memberId = currentMember.id;

        contactNameEl.textContent = `${contact.first_name || ''} ${contact.last_name || ''}`;
        contactCompanyEl.textContent = account ? account.name : 'No Company';
        phoneLinkEl.href = `tel:${contact.phone || ''}`;
        phoneLinkEl.textContent = contact.phone || 'No Phone Number';
        callNotesEl.value = '';
        callNotesEl.focus();
    };

    const handleLogCall = async (event) => {
        const notesEl = document.getElementById('call-notes');
        const notes = notesEl ? notesEl.value.trim() : '';
        if (!notes) {
            alert('Please enter call notes before logging.');
            return;
        }

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
            user_id: state.currentUser.id,
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

        currentMember.status = 'Completed';
        displayCurrentCall();
        await checkForCampaignCompletion(currentMember.campaign_id);
    };

    const handleSkipCall = async (event) => {
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

        currentMember.status = 'Skipped';
        displayCurrentCall();
        await checkForCampaignCompletion(currentMember.campaign_id);
    };

    const startGuidedEmail = () => {
        const summaryView = document.getElementById('guided-email-summary-view');
        const activeEmailView = document.getElementById('active-email-view');
        if (!summaryView || !activeEmailView) return;

        summaryView.classList.add('hidden');
        activeEmailView.classList.remove('hidden');
        displayCurrentEmail();
    };

    const displayCurrentEmail = () => {
        const pending = state.campaignMembers.filter(m => m.status === 'Pending');
        const emailToAddressEl = document.getElementById('email-to-address');
        const emailSubjectEl = document.getElementById('email-subject');
        const emailBodyTextareaEl = document.getElementById('email-body-textarea');

        if (!emailToAddressEl || !emailSubjectEl || !emailBodyTextareaEl) {
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
            handleSkipEmail({ target: { dataset: { memberId: currentMember.id } } });
            return;
        }

        document.getElementById('open-email-client-btn').dataset.memberId = currentMember.id;
        document.getElementById('skip-email-btn').dataset.memberId = currentMember.id;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = campaign.email_body || '';
        let emailBody = tempDiv.textContent || tempDiv.innerText || '';

        emailBody = emailBody.replace(/\[FirstName\]/g, contact.first_name || '');
        emailBody = emailBody.replace(/\[LastName\]/g, contact.last_name || '');
        emailBody = emailBody.replace(/\[AccountName\]/g, account ? account.name : '');

        emailToAddressEl.textContent = contact.email || 'No Email';
        emailSubjectEl.value = campaign.email_subject || '';
        emailBodyTextareaEl.value = emailBody;
        emailBodyTextareaEl.focus();
    };


    const handleOpenEmailClient = async (event) => {
        const to = document.getElementById('email-to-address')?.textContent;
        const subject = document.getElementById('email-subject')?.value;
        const body = document.getElementById('email-body-textarea')?.value;

        if (!to) {
            alert("Cannot open email client: Contact has no email address.");
            return;
        }

        const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`;
        window.location.href = mailtoLink;

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
            user_id: state.currentUser.id,
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

        currentMember.status = 'Completed';

        setTimeout(async () => {
            displayCurrentEmail();
            await checkForCampaignCompletion(currentMember.campaign_id);
        }, 500);
    };

    const handleSkipEmail = async (event) => {
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

        currentMember.status = 'Skipped';
        displayCurrentEmail();
        await checkForCampaignCompletion(currentMember.campaign_id);
    };

    async function handleNewCampaignClick() {
        const visibleTemplates = state.emailTemplates.filter(template =>
            !template.is_cloned || template.user_id === state.currentUser.id
        );

        const myTemplates = visibleTemplates
            .filter(t => t.user_id === state.currentUser.id)
            .sort((a, b) => a.name.localeCompare(b.name));

        const sharedTemplates = visibleTemplates
            .filter(t => t.user_id !== state.currentUser.id)
            .sort((a, b) => a.name.localeCompare(b.name));

        let myTemplatesOptions = '';
        if (myTemplates.length > 0) {
            myTemplatesOptions = `
                <optgroup label="My Templates">
                    ${myTemplates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                </optgroup>
            `;
        }

        let sharedTemplatesOptions = '';
        if (sharedTemplates.length > 0) {
            const sharedOptionsHtml = sharedTemplates.map(t => {
                const creator = state.user_quotas.find(p => p && p.user_id === t.user_id);
                const creatorName = creator ? creator.full_name : '';
                const initials = getInitials(creatorName);
                const displayName = `${t.name} ${initials ? `(${initials})` : ''}`.trim();
                return `<option value="${t.id}">${displayName}</option>`;
            }).join('');

            sharedTemplatesOptions = `
                <optgroup label="Shared Templates">
                    ${sharedOptionsHtml}
                </optgroup>
            `;
        }
        const templateOptions = myTemplatesOptions + sharedTemplatesOptions;

        const uniqueIndustries = [...new Set(state.accounts.map(a => a.industry).filter(Boolean))].sort();
        const industryOptions = uniqueIndustries.map(i => `<option value="${i}">${i}</option>`).join('');

        const modalBody = `
            <div id="new-campaign-form">
                <label for="campaign-name">Campaign Name:</label>
                <input type="text" id="campaign-name" required placeholder="e.g., Q3 Tech Customer Outreach">
                <label for="campaign-type">Campaign Type:</label>
                <select id="campaign-type"><option value="Call">Call Blitz</option><option value="Email">Email Merge</option><option value="Guided Email">Guided Email</option></select>
                <div id="email-section-container" class="hidden">
                    <label for="email-source-type">Email Source:</label>
                    <select id="email-source-type"><option value="write">Write New Email</option><option value="template">Use a Template</option></select>
                    <div id="template-select-container" class="hidden">
                        <label for="template-selector">Select Template:</label>
                        <select id="template-selector"><option value="">--Select--</option>${templateOptions}</select>
                    </div>
                    <div id="email-write-container">
                        <label for="campaign-email-subject">Email Subject:</label>
                        <input type="text" id="campaign-email-subject" placeholder="Your email subject line">
                        <label for="campaign-email-body">Email Message:</label>
                        <div class="merge-fields-buttons">
                            <button type="button" class="btn-secondary" data-field="[FirstName]">First Name</button>
                            <button type="button" class="btn-secondary" data-field="[LastName]">Last Name</button>
                            <button type="button" class="btn-secondary" data-field="[AccountName]">Account Name</button>
                        </div>
                        <textarea id="campaign-email-body" rows="8" placeholder="Hi [FirstName], ..."></textarea>
                    </div>
                    <div id="template-email-preview" class="hidden">
                        <p><strong>Subject:</strong> <span id="preview-template-subject"></span></p>
                        <div id="preview-template-body" class="email-body-summary"></div>
                    </div>
                </div>
                <hr><h4>Filter Target Contacts</h4>
                <label for="filter-industry">Account Industry:</label><select id="filter-industry"><option value="">All</option>${industryOptions}</select>
                <label for="filter-status">Customer Status:</label><select id="filter-status"><option value="">All</option><option value="customer">Customers Only</option><option value="prospect">Prospects Only</option></select>
                <div id="contact-preview-container" style="margin-top: 1rem;"></div>
            </div>`;
        
        showModal("Create New Campaign", modalBody, createCampaignAndMembers);
        setupCampaignModalListeners(); // FIX: Call listeners AFTER modal is in the DOM.
    }

    // FIX: This function now correctly sets up listeners and THEN initializes TinyMCE
    function setupCampaignModalListeners() {
        const industryFilter = document.getElementById('filter-industry');
        const statusFilter = document.getElementById('filter-status');
        const campaignTypeSelect = document.getElementById('campaign-type');
        const emailSectionContainer = document.getElementById('email-section-container');
        const emailSourceSelect = document.getElementById('email-source-type');
        const templateSelectContainer = document.getElementById('template-select-container');
        const emailWriteContainer = document.getElementById('email-write-container');
        const templateSelector = document.getElementById('template-selector');
        const subjectInput = document.getElementById('campaign-email-subject');
        const templateEmailPreview = document.getElementById('template-email-preview');
        const previewTemplateSubject = document.getElementById('preview-template-subject');
        const previewTemplateBody = document.getElementById('preview-template-body');

        const updateContactPreview = () => {
            const industry = industryFilter?.value;
            const status = statusFilter?.value;
            const accountIdsByIndustry = industry ? new Set(state.accounts.filter(a => a.industry === industry).map(a => a.id)) : null;
            const matchingContacts = state.contacts.filter(contact => {
                const account = contact.account_id ? state.accounts.find(a => a.id === contact.account_id) : null;
                if (!account) return false;
                const industryMatch = !accountIdsByIndustry || accountIdsByIndustry.has(account.id);
                const statusMatch = !status || (status === 'customer' && account.is_customer) || (status === 'prospect' && !account.is_customer);
                return industryMatch && statusMatch;
            });
            const previewContainer = document.getElementById('contact-preview-container');
            if (previewContainer) {
                let previewHtml = `<p><strong>${matchingContacts.length}</strong> contacts match your filters.</p>`;
                const listContent = matchingContacts.map(c => {
                    const accountName = state.accounts.find(a => a.id === c.account_id)?.name || 'No Account';
                    return `<li><strong>${c.first_name || ''} ${c.last_name || ''}</strong> <span class="text-medium">(${accountName})</span></li>`;
                }).join('');
                if (matchingContacts.length > 0) {
                    previewHtml += `<div class="table-container-scrollable" style="max-height: 150px;"><ul class="summary-contact-list">${listContent}</ul></div>`;
                }
                previewContainer.innerHTML = previewHtml;
            }
        };

        const handleCampaignTypeChange = () => {
            const showEmailSection = campaignTypeSelect?.value === 'Email' || campaignTypeSelect?.value === 'Guided Email';
            if (emailSectionContainer) {
                emailSectionContainer.classList.toggle('hidden', !showEmailSection);
            }
        };

        const handleEmailSourceChange = () => {
            const useTemplate = emailSourceSelect?.value === 'template';
            if (templateSelectContainer) templateSelectContainer.classList.toggle('hidden', !useTemplate);
            if (emailWriteContainer) emailWriteContainer.classList.toggle('hidden', useTemplate);
            if (templateEmailPreview) {
                templateEmailPreview.classList.toggle('hidden', !useTemplate);
                if (useTemplate) handleTemplateSelectChange();
            }
            if (subjectInput) subjectInput.readOnly = useTemplate;
        };

        const handleTemplateSelectChange = () => {
            const templateId = Number(templateSelector?.value);
            const template = state.emailTemplates.find(t => t.id === templateId);
            if (subjectInput) subjectInput.value = template ? template.subject || '' : '';
            tinymce.get('campaign-email-body')?.setContent(template ? template.body || '' : '');
            if (previewTemplateSubject) previewTemplateSubject.textContent = template ? template.subject || '(No Subject)' : '';
            if (previewTemplateBody) previewTemplateBody.innerHTML = template ? template.body || '(No Content)' : '';
        };

        campaignTypeSelect?.addEventListener('change', handleCampaignTypeChange);
        emailSourceSelect?.addEventListener('change', handleEmailSourceChange);
        templateSelector?.addEventListener('change', handleTemplateSelectChange);
        industryFilter?.addEventListener('change', updateContactPreview);
        statusFilter?.addEventListener('change', updateContactPreview);
        
        handleCampaignTypeChange();
        handleEmailSourceChange();
        updateContactPreview();

        tinymce.remove('#campaign-email-body');
        tinymce.init({
            selector: '#campaign-email-body',
            plugins: 'lists link image table code help wordcount',
            toolbar: 'undo redo | blocks | bold italic | alignleft aligncenter alignright | bullist numlist outdent indent | link image | code',
            height: 300,
            menubar: false
        });
    }

    async function createCampaignAndMembers() {
        const name = document.getElementById('campaign-name')?.value.trim();
        const type = document.getElementById('campaign-type')?.value;
        const industry = document.getElementById('filter-industry')?.value;
        const status = document.getElementById('filter-status')?.value;
        let email_subject = '';
        let email_body = '';

        if (!name) {
            alert('Campaign name is required.');
            return false;
        }

        if (type === 'Email' || type === 'Guided Email') {
            const emailSource = document.getElementById('email-source-type')?.value;
            if (emailSource === 'template') {
                const templateId = Number(document.getElementById('template-selector')?.value);
                const selectedTemplate = state.emailTemplates.find(t => t.id === templateId);
                if (selectedTemplate) {
                    email_subject = selectedTemplate.subject;
                    email_body = selectedTemplate.body;
                } else {
                    alert("Please select a valid template.");
                    return false;
                }
            } else {
                email_subject = document.getElementById('campaign-email-subject')?.value.trim();
                email_body = tinymce.get('campaign-email-body').getContent();
            }
        }

        const accountIdsByIndustry = industry ? new Set(state.accounts.filter(a => a.industry === industry).map(a => a.id)) : null;
        const matchingContacts = state.contacts.filter(contact => {
            if (!contact.account_id) return false;
            const account = state.accounts.find(a => a.id === contact.account_id);
            if (!account) return false;
            const industryMatch = !accountIdsByIndustry || accountIdsByIndustry.has(account.id);
            const statusMatch = !status || (status === 'customer' && account.is_customer) || (status === 'prospect' && !account.is_customer);
            return industryMatch && statusMatch;
        });

        if (matchingContacts.length === 0) {
            alert('No contacts match the selected filters. Please adjust filters or add contacts/accounts.');
            return false;
        }

        const confirmProceed = await new Promise(resolve => {
            showModal("Confirm Campaign Creation", `This campaign will include ${matchingContacts.length} contacts. Proceed?`, () => resolve(true), true, `<button id="modal-confirm-btn" class="btn-primary">Yes, Create</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`, () => resolve(false));
        });

        if (!confirmProceed) return false;

        const filter_criteria = { industry, status };
        const { data: newCampaign, error: campaignError } = await supabase.from('campaigns').insert({ name, type, filter_criteria, email_subject, email_body, user_id: state.currentUser.id }).select().single();
        
        if (campaignError) {
            alert('Error saving campaign: ' + campaignError.message);
            return false;
        }

        const membersToInsert = matchingContacts.map(c => ({ campaign_id: newCampaign.id, contact_id: c.id, user_id: state.currentUser.id, status: 'Pending' }));
        const { error: membersError } = await supabase.from('campaign_members').insert(membersToInsert);
        
        if (membersError) {
            alert('Error saving campaign members: ' + membersError.message);
            await supabase.from('campaigns').delete().eq('id', newCampaign.id);
            return false;
        }

        alert(`Campaign "${name}" created successfully with ${matchingContacts.length} members.`);
        state.selectedCampaignId = newCampaign.id;
        await loadAllData();
        return true;
    }

    function handleMergeFieldClick(e) {
        const field = e.target.dataset.field;
        const activeEditor = tinymce.activeEditor;

        if (activeEditor) {
            activeEditor.execCommand('mceInsertContent', false, field);
        } else {
            console.error("No active editor found for merge field insertion.");
        }
    }


    function handleExportCsv() {
        const campaign = state.campaigns.find(c => c.id === state.selectedCampaignId);
        if (!campaign) {
            alert('No campaign selected for CSV export.');
            return;
        }
        let csvContent = "data:text/csv;charset=utf-8,";
        const headers = ["FirstName", "LastName", "Email", "AccountName", "Title"];
        csvContent += headers.map(h => `"${h}"`).join(",") + "\r\n";

        const membersToExport = state.campaignMembers.map(member => {
            const contact = state.contacts.find(c => c.id === member.contact_id);
            const account = contact ? state.accounts.find(a => a.id === contact.account_id) : null;
            return {
                FirstName: contact?.first_name || '',
                LastName: contact?.last_name || '',
                Email: contact?.email || '',
                AccountName: account?.name || '',
                Title: contact?.title || ''
            };
        });

        membersToExport.forEach(row => {
            const csvRow = headers.map(header => `"${(row[header] || '').replace(/"/g, '""')}"`).join(",");
            csvContent += csvRow + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${campaign.name.replace(/[^a-z0-9]/gi, '_')}_contacts.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        logMailMergeActivity(campaign.name);
    }

    function handleExportTxt() {
        const campaign = state.campaigns.find(c => c.id === state.selectedCampaignId);
        if (!campaign || !campaign.email_body) {
            alert('No email body saved for this campaign to export as text.');
            return;
        }
        const readme = `--- MAIL MERGE INSTRUCTIONS ---\n\n1. Open Microsoft Word...\n\n--- YOUR EMAIL TEMPLATE ---\n\n`;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = campaign.email_body;
        const plainTextBody = tempDiv.textContent || tempDiv.innerText || '';

        const textContent = readme + plainTextBody;
        const blob = new Blob([textContent], { type: 'text/plain' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${campaign.name.replace(/[^a-z0-9]/gi, '_')}_template.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function logMailMergeActivity(campaignName) {
        const activitiesToLog = state.campaignMembers.map(member => {
            const contact = state.contacts.find(c => c.id === member.contact_id);
            return {
                contact_id: member.contact_id,
                account_id: contact?.account_id,
                type: 'Email',
                description: `Included in mail merge export for campaign: "${campaignName}".`,
                user_id: state.currentUser.id,
                date: new Date().toISOString()
            };
        });
        if (activitiesToLog.length > 0) {
            const { error } = await supabase.from('activities').insert(activitiesToLog);
            if (error) console.error("Error logging mail merge activity:", error);
        }
    }

    function handleManageTemplatesClick() {
        renderTemplateManager();
    }

    function renderTemplateManager() {
        const visibleTemplates = state.emailTemplates.filter(template =>
            !template.is_cloned || template.user_id === state.currentUser.id
        );

        let templateListHtml = visibleTemplates.map(template => {
            const isOwner = template.user_id === state.currentUser.id;
            const creator = isOwner ? null : state.user_quotas.find(p => p && p.user_id === template.user_id);
            const creatorName = creator ? creator.full_name : 'an unknown user';
            const attribution = isOwner ? '' : `<small class="template-attribution">Shared by ${creatorName}</small>`;
            const actions = isOwner ?
                `<button class="btn-secondary btn-edit-template" data-id="${template.id}">Edit</button><button class="btn-danger btn-delete-template" data-id="${template.id}">Delete</button>` : '';
            return `
            <div class="template-list-item">
                <div>
                    <span>${template.name || 'Unnamed Template'}</span>
                    ${attribution}
                </div>
                <div class="template-actions">
                    ${actions}
                    <button class="btn-secondary btn-clone-template" data-id="${template.id}">Clone</button>
                </div>
            </div>`;
        }).join('');

        if (visibleTemplates.length === 0) {
            templateListHtml = "<p>No templates available. Try creating one!</p>";
        }

        const managerBody = `<div id="template-manager">${templateListHtml}<hr><button id="create-new-template-btn" class="btn-primary full-width">Create New Template</button></div>`;
        const customFooter = `<button class="btn-secondary" id="modal-exit-btn">Exit</button>`;
        showModal("Email Template Manager", managerBody, null, true, customFooter);
        setupTemplateManagerListeners();
    }

    function setupTemplateManagerListeners() {
        document.getElementById('create-new-template-btn')?.addEventListener('click', () => openTemplateForm(null));
        document.querySelectorAll('#template-manager .btn-edit-template').forEach(button => button.addEventListener('click', handleEditTemplateClick));
        document.querySelectorAll('#template-manager .btn-delete-template').forEach(button => button.addEventListener('click', handleDeleteTemplateClick));
        document.querySelectorAll('#template-manager .btn-clone-template').forEach(button => button.addEventListener('click', handleCloneTemplateClick));
        document.getElementById('modal-exit-btn')?.addEventListener('click', hideModal);
    }
    
    // FIX: This function now updates the existing modal instead of opening a new one.
    function openTemplateForm(templateToEdit = null) {
        const isEditing = templateToEdit !== null;
        const modalTitle = isEditing ? "Edit Email Template" : "Create New Email Template";
        const currentTemplateName = templateToEdit?.name || '';
        const currentTemplateSubject = templateToEdit?.subject || '';
        const currentTemplateBody = templateToEdit?.body || '';
    
        const modalTitleEl = document.getElementById('modal-title');
        const modalBodyEl = document.getElementById('modal-body');
        const modalActionsEl = document.getElementById('modal-actions');
    
        if (!modalTitleEl || !modalBodyEl || !modalActionsEl) {
            console.error("Modal elements not found. Cannot open template form.");
            return;
        }
    
        const formBody = `
            <div id="template-form-container">
                <label for="template-name">Template Name:</label><input type="text" id="template-name" value="${currentTemplateName}" required>
                <label for="template-subject">Subject:</label><input type="text" id="template-subject" value="${currentTemplateSubject}">
                <label for="template-body">Email Body:</label>
                <div class="merge-fields-buttons">
                    <button type="button" class="btn-secondary" data-field="[FirstName]">First Name</button>
                    <button type="button" class="btn-secondary" data-field="[LastName]">Last Name</button>
                    <button type="button" class="btn-secondary" data-field="[AccountName]">Account Name</button>
                </div>
                <textarea id="template-body" rows="10">${currentTemplateBody}</textarea>
            </div>`;
    
        modalTitleEl.textContent = modalTitle;
        modalBodyEl.innerHTML = formBody;
        modalActionsEl.innerHTML = `
            <button id="save-template-btn" class="btn-primary">Save</button>
            <button id="cancel-template-edit-btn" class="btn-secondary">Back to List</button>`;
    
        tinymce.remove('#template-body');
        tinymce.init({
            selector: '#template-body',
            plugins: 'lists link image table code help wordcount',
            toolbar: 'undo redo | blocks | bold italic | alignleft aligncenter alignright | bullist numlist outdent indent | link image | code',
            height: 350,
            menubar: false
        });
    
        document.getElementById('save-template-btn').addEventListener('click', async () => {
            const name = document.getElementById('template-name')?.value.trim();
            if (!name) {
                alert('Template name is required.');
                return;
            }
    
            const templateData = {
                name,
                subject: document.getElementById('template-subject')?.value.trim(),
                body: tinymce.get('template-body').getContent(),
                user_id: state.currentUser.id
            };
    
            let error;
            if (isEditing) {
                const { error: updateError } = await supabase.from('email_templates').update(templateData).eq('id', templateToEdit.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase.from('email_templates').insert(templateData);
                error = insertError;
            }
    
            if (error) {
                alert("Error saving template: " + error.message);
                return;
            }
    
            alert(`Template "${name}" saved successfully!`);
            await loadAllData();
            renderTemplateManager();
        });
    
        document.getElementById('cancel-template-edit-btn').addEventListener('click', renderTemplateManager);
    }

    async function handleCloneTemplateClick(e) {
        const templateId = Number(e.target.dataset.id);
        const originalTemplate = state.emailTemplates.find(t => t.id === templateId);

        if (!originalTemplate) {
            alert("Could not find the original template to clone.");
            return;
        }

        const newName = prompt("Enter a name for your new cloned template:", `${originalTemplate.name} (Copy)`);
        if (!newName || newName.trim() === '') return;

        const { error } = await supabase.from('email_templates').insert({
            name: newName,
            subject: originalTemplate.subject,
            body: originalTemplate.body,
            user_id: state.currentUser.id,
            is_cloned: true
        });

        if (error) {
            alert("Error cloning template: " + error.message);
            return;
        }

        alert(`Template "${newName}" created successfully!`);
        await loadAllData();
        renderTemplateManager();
    }

    function handleEditTemplateClick(e) {
        const templateId = Number(e.target.closest('.btn-edit-template').dataset.id);
        const template = state.emailTemplates.find(t => t.id === templateId);
        if (template) openTemplateForm(template);
    }

    function handleDeleteTemplateClick(e) {
        const templateId = Number(e.target.closest('.btn-delete-template').dataset.id);
        handleDeleteTemplate(templateId);
    }

    async function handleDeleteTemplate(templateId) {
        showModal("Confirm Deletion", "Are you sure you want to delete this template? This cannot be undone.", async () => {
            const { error } = await supabase.from('email_templates').delete().eq('id', templateId);
            if (error) {
                alert("Error deleting template: " + error.message);
                return false;
            }
            alert("Template deleted successfully.");
            await loadAllData();
            renderTemplateManager();
            return true;
        });
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
            await loadAllData();
            return true;
        });
    }

    // --- Data Fetching ---
    async function loadAllData() {
        if (!state.currentUser) {
            console.warn("loadAllData called without a current user. Skipping data fetch.");
            return;
        }
        try {
            const [{ data: campaigns, error: e1 }, { data: contacts, error: e2 }, { data: accounts, error: e3 }, { data: emailTemplates, error: e4 }, { data: userQuotas, error: e5 }] = await Promise.all([
                supabase.from("campaigns").select("*").eq("user_id", state.currentUser.id),
                supabase.from("contacts").select("*").eq("user_id", state.currentUser.id),
                supabase.from("accounts").select("*").eq("user_id", state.currentUser.id),
                supabase.from("email_templates").select("*"),
                supabase.from("user_quotas").select("user_id, full_name")
            ]);

            if (e1 || e2 || e3 || e4 || e5) throw new Error(e1?.message || e2?.message || e3?.message || e4?.message || e5?.message);

            state.campaigns = campaigns || [];
            state.contacts = contacts || [];
            state.accounts = accounts || [];
            state.emailTemplates = emailTemplates || [];
            state.user_quotas = userQuotas || [];

            renderCampaignList();
            renderCampaignDetails();
        } catch (error) {
            console.error("Error loading data:", error.message);
            alert("Failed to load page data. Please try refreshing. Error: " + error.message);
        }
    }

    async function loadCampaignMembers(campaignId) {
        const { data, error } = await supabase.from('campaign_members').select('*').eq('campaign_id', campaignId);
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

        if (newCampaignBtn) newCampaignBtn.addEventListener('click', handleNewCampaignClick);
        if (manageTemplatesBtn) manageTemplatesBtn.addEventListener('click', handleManageTemplatesClick);
        if (deleteCampaignBtn) deleteCampaignBtn.addEventListener('click', handleDeleteSelectedCampaign);

        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.merge-fields-buttons button')) {
                handleMergeFieldClick(e);
            }

            const campaignListItem = e.target.closest('#campaign-list-active .list-item, #campaign-list-past .list-item');
            if (campaignListItem) {
                const newSelectedId = Number(campaignListItem.dataset.id);
                if (newSelectedId !== state.selectedCampaignId) {
                    state.selectedCampaignId = newSelectedId;
                    renderCampaignList();
                    renderCampaignDetails();
                }
            }
            if (e.target.id === 'modal-ok-btn') {
                hideModal();
            }
        });

        const campaignDetailsPanel = document.getElementById('campaign-details');
        if (campaignDetailsPanel) {
            campaignDetailsPanel.addEventListener('click', (e) => {
                const targetId = e.target.id;
                if (targetId === 'start-calling-btn') startCallBlitz();
                else if (targetId === 'log-call-btn') handleLogCall(e);
                else if (targetId === 'skip-call-btn') handleSkipCall(e);
                else if (targetId === 'export-csv-btn') handleExportCsv();
                else if (targetId === 'export-txt-btn') handleExportTxt();
                else if (targetId === 'start-guided-email-btn') startGuidedEmail();
                else if (targetId === 'open-email-client-btn') handleOpenEmailClient(e);
                else if (targetId === 'skip-email-btn') handleSkipEmail(e);
            });
        }
    }

    async function initializePage() {
        await loadSVGs();
        if (deleteCampaignBtn) {
            deleteCampaignBtn.disabled = true;
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            console.error("Error getting session:", sessionError);
            window.location.href = "index.html";
            return;
        }

        state.currentUser = session.user;
        await setupUserMenuAndAuth(supabase, state);
        setupPageEventListeners();
        await setupGlobalSearch(supabase, state.currentUser);
        await checkAndSetNotifications(supabase);
        await loadAllData();
    }

    initializePage();
});
