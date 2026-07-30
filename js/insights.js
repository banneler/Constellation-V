import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    formatCurrencyK,
    formatDate,
    loadSVGs,
    initializeAppState,
    getState,
    hideGlobalLoader,
    injectGlobalNavigation,
    setupUserMenuAndAuth,
    setupGlobalSearch,
    checkAndSetNotifications,
    updateActiveNavLink,
    showToast,
} from './shared_constants.js';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PERIOD_LABELS = {
    this_month: 'This Month',
    last_month: 'Last Month',
    last_2_months: 'Previous 2 Months',
    this_fiscal_year: 'This Fiscal Year',
    last_365_days: 'Last 365 Days',
};

const LETTER_WIDTH_PT = 612;
const LETTER_HEIGHT_PT = 792;
const PDF_MARGIN_PT = 36;

const state = {
    currentUser: null,
    allUsers: [],
    charts: {},
    snapshot: null,
    exporting: false,
    filters: {
        userId: 'all',
        dateRange: 'this_month',
        chartView: 'combined',
    },
    data: {
        activities: [],
        tasks: [],
        deals: [],
        contact_sequences: [],
        sequences: [],
        campaigns: [],
        campaign_members: [],
        cognito_alerts: [],
        accounts: [],
        contacts: [],
        account_plans: [],
    },
};

let repTomSelect = null;
let dateTomSelect = null;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isUserDeactivated(user) {
    return Boolean(user?.deactivated_at);
}

function getReportableUsers() {
    return state.allUsers.filter((u) => !u.exclude_from_reporting && !isUserDeactivated(u));
}

function getDateRange(rangeKey) {
    const now = new Date();
    let startDate = new Date();
    const endDate = new Date(now);
    switch (rangeKey) {
        case 'this_month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'last_month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate.setDate(0);
            break;
        case 'last_2_months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            break;
        case 'this_fiscal_year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        case 'last_365_days':
            startDate.setDate(now.getDate() - 365);
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return { startDate, endDate };
}

function userMatchesFilter(userId) {
    return state.filters.userId === 'all' || userId === state.filters.userId;
}

function isUserIncluded(userId) {
    return getReportableUsers().some((u) => u.user_id === userId);
}

function inDateRange(value, startDate, endDate) {
    if (!value) return false;
    const itemDate = new Date(value);
    return itemDate >= startDate && itemDate <= endDate;
}

function filterByUserAndDate(rows, dateField) {
    const { startDate, endDate } = getDateRange(state.filters.dateRange);
    return (rows || []).filter((item) => {
        if (!isUserIncluded(item.user_id) || !userMatchesFilter(item.user_id)) return false;
        return inDateRange(item[dateField], startDate, endDate);
    });
}

function groupByUser(data, valueField = null) {
    return getReportableUsers()
        .map((user) => {
            const userItems = data.filter((item) => item.user_id === user.user_id);
            const value = valueField
                ? userItems.reduce((sum, item) => sum + (item[valueField] || 0), 0)
                : userItems.length;
            return { label: user.full_name || user.email || 'Unknown', value, userId: user.user_id };
        })
        .sort((a, b) => b.value - a.value);
}

function kpiHtml(items) {
    return items
        .map(
            (item) => `
        <div class="insights-kpi">
            <p class="insights-kpi-label">${escapeHtml(item.label)}</p>
            <p class="insights-kpi-value">${escapeHtml(String(item.value))}</p>
        </div>`
        )
        .join('');
}

function emptyRow(colspan, message) {
    return `<tr><td colspan="${colspan}" class="insights-empty">${escapeHtml(message)}</td></tr>`;
}

function isCoachingMode() {
    return state.filters.userId !== 'all' || state.filters.chartView === 'individual';
}

function getSelectedRepName() {
    if (state.filters.userId === 'all') return 'All Reps';
    return getReportableUsers().find((u) => u.user_id === state.filters.userId)?.full_name || 'Selected Rep';
}

function computeSnapshot() {
    const { userId, dateRange, chartView } = state.filters;
    const { startDate, endDate } = getDateRange(dateRange);
    const reportable = getReportableUsers();
    const now = new Date();

    const activities = filterByUserAndDate(state.data.activities, 'date');
    const tasks = (state.data.tasks || []).filter((t) => {
        if (!isUserIncluded(t.user_id) || !userMatchesFilter(t.user_id)) return false;
        return t.status === 'Pending' && t.due_date && new Date(t.due_date) < now;
    });
    const newDeals = filterByUserAndDate(state.data.deals, 'created_at');
    const closedWonDeals = (state.data.deals || []).filter((d) => {
        if (!isUserIncluded(d.user_id) || !userMatchesFilter(d.user_id)) return false;
        if (!d.close_month || d.stage !== 'Closed Won') return false;
        const closedDate = new Date(`${d.close_month}-02`);
        return closedDate >= startDate && closedDate <= endDate;
    });
    const closedWonValue = closedWonDeals.reduce((s, d) => s + (d.mrc || 0), 0);
    const newDealsValue = newDeals.reduce((s, d) => s + (d.mrc || 0), 0);
    const quotaBaseUsers =
        userId === 'all' ? reportable : reportable.filter((u) => u.user_id === userId);
    const totalQuota = quotaBaseUsers.reduce((s, u) => s + (Number(u.monthly_quota) || 0), 0);
    const quotaPct = totalQuota > 0 ? Math.round((closedWonValue / totalQuota) * 100) : 0;

    const seqMap = new Map((state.data.sequences || []).map((s) => [s.id, s.name || `Sequence #${s.id}`]));
    const seqRows = (state.data.contact_sequences || []).filter((cs) => {
        if (!isUserIncluded(cs.user_id) || !userMatchesFilter(cs.user_id)) return false;
        const stamp = cs.last_completed_date || cs.created_at || cs.next_step_due_date;
        if (!stamp) return cs.status === 'Active';
        return inDateRange(stamp, startDate, endDate) || cs.status === 'Active';
    });
    const seqActive = seqRows.filter((r) => r.status === 'Active');
    const seqCompleted = seqRows.filter((r) => r.status === 'Completed');
    const seqRemoved = seqRows.filter((r) => r.status === 'Removed');
    const seqOverdue = seqActive.filter((r) => r.next_step_due_date && new Date(r.next_step_due_date) < now);

    const bySeq = new Map();
    seqRows.forEach((cs) => {
        const key = cs.sequence_id || 'unknown';
        if (!bySeq.has(key)) {
            bySeq.set(key, {
                name: seqMap.get(key) || `Sequence #${key}`,
                active: 0,
                completed: 0,
                removed: 0,
                overdue: 0,
            });
        }
        const bucket = bySeq.get(key);
        if (cs.status === 'Active') {
            bucket.active += 1;
            if (cs.next_step_due_date && new Date(cs.next_step_due_date) < now) bucket.overdue += 1;
        } else if (cs.status === 'Completed') bucket.completed += 1;
        else if (cs.status === 'Removed') bucket.removed += 1;
    });
    const sequenceTable = [...bySeq.values()]
        .sort((a, b) => b.active + b.completed + b.removed - (a.active + a.completed + a.removed))
        .slice(0, 12);

    const campaigns = filterByUserAndDate(state.data.campaigns, 'created_at');
    const campaignIds = new Set(campaigns.map((c) => c.id));
    const members = (state.data.campaign_members || []).filter((m) => {
        if (!campaignIds.has(m.campaign_id)) return false;
        return isUserIncluded(m.user_id) && userMatchesFilter(m.user_id);
    });
    const completedMembers = members.filter((m) => m.status === 'Completed');
    const campaignRate = members.length ? Math.round((completedMembers.length / members.length) * 100) : 0;
    const campaignTable = campaigns
        .map((campaign) => {
            const cm = members.filter((m) => m.campaign_id === campaign.id);
            const done = cm.filter((m) => m.status === 'Completed').length;
            return {
                name: campaign.name || `Campaign #${campaign.id}`,
                members: cm.length,
                completed: done,
                rate: cm.length ? Math.round((done / cm.length) * 100) : 0,
            };
        })
        .sort((a, b) => b.members - a.members)
        .slice(0, 12);

    const alerts = (state.data.cognito_alerts || []).filter((alert) => {
        if (!isUserIncluded(alert.user_id) || !userMatchesFilter(alert.user_id)) return false;
        return inDateRange(alert.created_at, startDate, endDate);
    });
    const outreachActivities = (state.data.activities || []).filter(
        (a) => isUserIncluded(a.user_id) && userMatchesFilter(a.user_id)
    );
    let cognitoConverted = 0;
    const cognitoByStatus = new Map();
    alerts.forEach((alert) => {
        const status = alert.status || 'Unknown';
        if (!cognitoByStatus.has(status)) cognitoByStatus.set(status, { status, triggers: 0, converted: 0 });
        const bucket = cognitoByStatus.get(status);
        bucket.triggers += 1;
        const alertTime = new Date(alert.created_at).getTime();
        const matched = outreachActivities.some((activity) => {
            if (activity.account_id !== alert.account_id || !activity.date) return false;
            return new Date(activity.date).getTime() >= alertTime;
        });
        if (matched) {
            bucket.converted += 1;
            cognitoConverted += 1;
        }
    });
    const cognitoRate = alerts.length ? Math.round((cognitoConverted / alerts.length) * 100) : 0;
    const cognitoTable = [...cognitoByStatus.values()].sort((a, b) => b.triggers - a.triggers);

    const accounts = (state.data.accounts || []).filter(
        (a) => isUserIncluded(a.user_id) && userMatchesFilter(a.user_id)
    );
    const accountIds = new Set(accounts.map((a) => a.id));
    const plans = (state.data.account_plans || []).filter((p) => accountIds.has(p.account_id));
    const coveredIds = new Set(plans.map((p) => p.account_id));
    const saosCoverage = accounts.length ? Math.round((coveredIds.size / accounts.length) * 100) : 0;
    const staleCutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const saosStale = plans.filter((p) => p.updated_at && new Date(p.updated_at).getTime() < staleCutoff).length;

    const contactsByAccount = new Map();
    (state.data.contacts || []).forEach((c) => {
        contactsByAccount.set(c.account_id, (contactsByAccount.get(c.account_id) || 0) + 1);
    });
    const activityByAccount = new Map();
    (state.data.activities || []).forEach((activity) => {
        if (!activity.account_id || !activity.date) return;
        if (!isUserIncluded(activity.user_id)) return;
        const stamp = new Date(activity.date);
        if (stamp < startDate || stamp > endDate) return;
        const prev = activityByAccount.get(activity.account_id);
        if (!prev || stamp > prev) activityByAccount.set(activity.account_id, stamp);
    });
    const ownerName = (uid) => state.allUsers.find((u) => u.user_id === uid)?.full_name || 'Unknown';
    const penetration = accounts
        .filter((account) => !activityByAccount.has(account.id))
        .map((account) => {
            const allActs = (state.data.activities || [])
                .filter((a) => a.account_id === account.id && a.date)
                .map((a) => new Date(a.date))
                .sort((a, b) => b - a);
            return {
                name: account.name || `Account #${account.id}`,
                owner: ownerName(account.user_id),
                ownerId: account.user_id,
                contacts: contactsByAccount.get(account.id) || 0,
                lastActivity: allActs[0] || null,
            };
        })
        .sort((a, b) => b.contacts - a.contacts)
        .slice(0, 25);

    const usersForBreakdown =
        userId === 'all' ? reportable : reportable.filter((u) => u.user_id === userId);

    const byRep = usersForBreakdown
        .map((user) => {
            const uid = user.user_id;
            const repActivities = activities.filter((a) => a.user_id === uid);
            const repTasks = tasks.filter((t) => t.user_id === uid);
            const repNewDeals = newDeals.filter((d) => d.user_id === uid);
            const repWon = closedWonDeals.filter((d) => d.user_id === uid);
            const wonValue = repWon.reduce((s, d) => s + (d.mrc || 0), 0);
            const quota = Number(user.monthly_quota) || 0;
            const repSeqActive = seqActive.filter((r) => r.user_id === uid);
            const repSeqOverdue = seqOverdue.filter((r) => r.user_id === uid);
            const repAlerts = alerts.filter((a) => a.user_id === uid);
            let repConverted = 0;
            repAlerts.forEach((alert) => {
                const alertTime = new Date(alert.created_at).getTime();
                if (
                    outreachActivities.some(
                        (activity) =>
                            activity.user_id === uid &&
                            activity.account_id === alert.account_id &&
                            activity.date &&
                            new Date(activity.date).getTime() >= alertTime
                    )
                ) {
                    repConverted += 1;
                }
            });
            const staleAccounts = penetration.filter((p) => p.ownerId === uid).length;
            const coachingPrompts = [];
            if (repTasks.length > 0) coachingPrompts.push(`Clear ${repTasks.length} past-due task${repTasks.length === 1 ? '' : 's'} this week.`);
            if (repSeqOverdue.length > 0) coachingPrompts.push(`Recover ${repSeqOverdue.length} overdue sequence step${repSeqOverdue.length === 1 ? '' : 's'}.`);
            if (quota > 0 && wonValue < quota) {
                coachingPrompts.push(
                    `Quota gap: ${formatCurrencyK(Math.max(quota - wonValue, 0))} remaining vs ${formatCurrencyK(quota)} target.`
                );
            }
            if (repAlerts.length > 0 && repConverted / repAlerts.length < 0.5) {
                coachingPrompts.push('Cognito follow-through is light — convert more triggers into logged outreach.');
            }
            if (staleAccounts > 0) coachingPrompts.push(`Re-engage ${staleAccounts} low-activity account${staleAccounts === 1 ? '' : 's'}.`);
            if (repActivities.length === 0) coachingPrompts.push('No activities logged in this period — reset daily activity cadence.');
            if (!coachingPrompts.length) coachingPrompts.push('Strong period — reinforce what’s working and set one stretch goal.');

            return {
                userId: uid,
                name: user.full_name || 'Unknown',
                activities: repActivities.length,
                pastDueTasks: repTasks.length,
                newDeals: repNewDeals.length,
                newDealsValue: repNewDeals.reduce((s, d) => s + (d.mrc || 0), 0),
                closedWonValue: wonValue,
                quota,
                quotaPct: quota > 0 ? Math.round((wonValue / quota) * 100) : 0,
                seqActive: repSeqActive.length,
                seqOverdue: repSeqOverdue.length,
                cognitoTriggers: repAlerts.length,
                cognitoConverted: repConverted,
                staleAccounts,
                coachingPrompts,
            };
        })
        .sort((a, b) => b.closedWonValue - a.closedWonValue || b.activities - a.activities);

    const talkingPoints = [];
    talkingPoints.push(
        totalQuota > 0
            ? `Team is at ${quotaPct}% of monthly quota (${formatCurrencyK(closedWonValue)} closed won vs ${formatCurrencyK(totalQuota)}).`
            : `Closed won this period: ${formatCurrencyK(closedWonValue)} (no team quota configured).`
    );
    talkingPoints.push(
        `${activities.length} activities logged, ${newDeals.length} deals added (${formatCurrencyK(newDealsValue)}), and ${tasks.length} past-due tasks outstanding.`
    );
    talkingPoints.push(
        `Motion: ${seqActive.length} active sequences (${seqOverdue.length} overdue), campaign completion ${campaignRate}%, Cognito conversion ${cognitoRate}%.`
    );
    talkingPoints.push(
        `SAOS coverage is ${saosCoverage}% (${coveredIds.size}/${accounts.length} accounts); ${saosStale} plans stale 14+ days.`
    );
    if (penetration.length) {
        talkingPoints.push(
            `${penetration.length} accounts show no activity in-period — top focus: ${penetration
                .slice(0, 3)
                .map((p) => p.name)
                .join(', ')}.`
        );
    }

    return {
        periodLabel: PERIOD_LABELS[dateRange] || 'Selected Period',
        startDate,
        endDate,
        chartView,
        userId,
        coachingMode: isCoachingMode(),
        selectedRepName: getSelectedRepName(),
        core: {
            activities: activities.length,
            tasks: tasks.length,
            newDeals: newDeals.length,
            newDealsValue,
            closedWonValue,
            totalQuota,
            quotaPct,
            activitiesByUser: groupByUser(activities),
            tasksByUser: groupByUser(tasks),
            newDealsByUser: groupByUser(newDeals),
            newDealsValueByUser: groupByUser(newDeals, 'mrc'),
            closedWonByUser: groupByUser(closedWonDeals, 'mrc'),
            quotaByUser: reportable
                .map((user) => {
                    const won = closedWonDeals
                        .filter((d) => d.user_id === user.user_id)
                        .reduce((s, d) => s + (d.mrc || 0), 0);
                    const quota = Number(user.monthly_quota) || 0;
                    return {
                        label: user.full_name || 'Unknown',
                        value: quota > 0 ? Math.round((won / quota) * 100) : 0,
                        userId: user.user_id,
                    };
                })
                .sort((a, b) => b.value - a.value),
        },
        sequences: {
            active: seqActive.length,
            completed: seqCompleted.length,
            removed: seqRemoved.length,
            overdue: seqOverdue.length,
            table: sequenceTable,
        },
        campaigns: {
            count: campaigns.length,
            members: members.length,
            completed: completedMembers.length,
            rate: campaignRate,
            table: campaignTable,
        },
        cognito: {
            triggers: alerts.length,
            converted: cognitoConverted,
            rate: cognitoRate,
            table: cognitoTable,
        },
        saos: {
            accounts: accounts.length,
            plans: coveredIds.size,
            coverage: saosCoverage,
            stale: saosStale,
        },
        penetration,
        byRep,
        talkingPoints,
    };
}

async function loadUsers() {
    const { data: rpcUsers, error: rpcError } = await supabase.rpc('get_admin_users');
    if (!rpcError && Array.isArray(rpcUsers) && rpcUsers.length) {
        state.allUsers = rpcUsers;
        return;
    }

    const { data, error } = await supabase
        .from('user_quotas')
        .select('user_id, full_name, monthly_quota, is_manager, exclude_from_reporting, deactivated_at');
    if (error) {
        console.error('[insights] user load failed:', error);
        state.allUsers = [];
        return;
    }
    state.allUsers = (data || []).map((u) => ({ ...u, email: null }));
}

async function loadInsightsData() {
    document.body.classList.add('loading');
    try {
        await loadUsers();

        const fetches = [
            ['activities', supabase.from('activities').select('*')],
            ['tasks', supabase.from('tasks').select('*')],
            ['deals', supabase.from('deals').select('*')],
            ['contact_sequences', supabase.from('contact_sequences').select('*')],
            ['sequences', supabase.from('sequences').select('id, name, user_id')],
            ['campaigns', supabase.from('campaigns').select('*')],
            ['campaign_members', supabase.from('campaign_members').select('*')],
            ['cognito_alerts', supabase.from('cognito_alerts').select('*')],
            ['accounts', supabase.from('accounts').select('id, user_id, name')],
            ['contacts', supabase.from('contacts').select('id, user_id, account_id')],
            ['account_plans', supabase.from('account_plans').select('id, account_id, updated_at, created_by, plan')],
        ];

        const results = await Promise.all(fetches.map(([, query]) => query));
        results.forEach((result, index) => {
            const key = fetches[index][0];
            if (result.error) {
                console.error(`[insights] failed to load ${key}:`, result.error);
                state.data[key] = [];
            } else {
                state.data[key] = result.data || [];
            }
        });

        populateFilters();
        renderAll();
    } catch (error) {
        console.error('[insights] load failed:', error);
        showToast(`Unable to load Insights: ${error.message || 'Unknown error'}`, 'error');
    } finally {
        document.body.classList.remove('loading');
    }
}

function destroyTomSelect(instance) {
    if (instance && typeof instance.destroy === 'function') {
        try {
            instance.destroy();
        } catch (_) {
            /* noop */
        }
    }
    return null;
}

function initFilterTomSelect(selectEl, existingInstance, placeholder, onChange) {
    if (!(selectEl instanceof HTMLSelectElement) || typeof window.TomSelect !== 'function') {
        return null;
    }
    destroyTomSelect(existingInstance);
    try {
        return new window.TomSelect(selectEl, {
            create: false,
            maxItems: 1,
            placeholder,
            controlInput: null,
            searchField: [],
            dropdownParent: 'body',
            onDropdownOpen() {
                const dropdown = this.dropdown;
                if (dropdown) dropdown.className = 'ts-dropdown tom-select-no-search';
            },
            onChange: (value) => onChange(value || ''),
            render: {
                dropdown: () => {
                    const dropdown = document.createElement('div');
                    dropdown.className = 'ts-dropdown tom-select-no-search';
                    return dropdown;
                },
            },
        });
    } catch (_) {
        return null;
    }
}

function syncReportViewToggleVisibility() {
    const toggle = document.getElementById('insights-chart-view-toggle');
    const field = toggle?.closest('.insights-filter-field--view');
    const show = state.filters.userId === 'all';
    if (toggle) toggle.style.display = show ? 'inline-flex' : 'none';
    if (field) field.style.display = show ? 'flex' : 'none';
    if (!show) {
        state.filters.chartView = 'combined';
        document.getElementById('insights-view-combined-btn')?.classList.add('active');
        document.getElementById('insights-view-individual-btn')?.classList.remove('active');
    }
}

function populateFilters() {
    const repFilter = document.getElementById('insights-rep-filter');
    const dateFilter = document.getElementById('insights-date-filter');
    if (!repFilter || !dateFilter) return;

    const currentRep = state.filters.userId;
    const currentPeriod = state.filters.dateRange;

    repFilter.innerHTML = '<option value="all">All Reps</option>';
    getReportableUsers()
        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
        .forEach((user) => {
            repFilter.innerHTML += `<option value="${user.user_id}">${escapeHtml(user.full_name || 'Unnamed')}</option>`;
        });
    repFilter.value = [...repFilter.options].some((option) => option.value === currentRep)
        ? currentRep
        : 'all';
    state.filters.userId = repFilter.value;

    if (![...dateFilter.options].some((option) => option.value === currentPeriod)) {
        dateFilter.value = 'this_month';
        state.filters.dateRange = 'this_month';
    } else {
        dateFilter.value = currentPeriod;
    }

    repTomSelect = initFilterTomSelect(repFilter, repTomSelect, 'Rep', (value) => {
        state.filters.userId = value || 'all';
        syncReportViewToggleVisibility();
        renderAll();
    });
    dateTomSelect = initFilterTomSelect(dateFilter, dateTomSelect, 'Period', (value) => {
        state.filters.dateRange = value || 'this_month';
        renderAll();
    });

    if (repTomSelect) repTomSelect.setValue(state.filters.userId, true);
    if (dateTomSelect) dateTomSelect.setValue(state.filters.dateRange, true);

    syncReportViewToggleVisibility();
}

function renderChart(canvasId, data, isCurrency = false) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || typeof Chart === 'undefined') return;
    if (state.charts[canvasId]) state.charts[canvasId].destroy();

    const chartData = Array.isArray(data) ? data : [data];
    state.charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.map((d) => d.label),
            datasets: [
                {
                    label: 'Total',
                    data: chartData.map((d) => d.value),
                    backgroundColor: 'rgba(74, 144, 226, 0.6)',
                    borderColor: 'rgba(74, 144, 226, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                },
            ],
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const value = context.parsed.x;
                            return `${context.label || ''}: ${isCurrency ? formatCurrencyK(value) : value}`;
                        },
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: { color: 'var(--text-medium)' },
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: 'var(--text-medium)',
                        callback(value) {
                            return isCurrency ? formatCurrencyK(value) : value;
                        },
                    },
                },
            },
        },
    });
}

function renderTableForChart(containerId, data, isCurrency = false) {
    const container = document.getElementById(containerId);
    const tableView = container?.querySelector('.chart-table-view');
    if (!tableView) return;
    tableView.innerHTML = `
        <table>
            <thead><tr><th>User</th><th>Value</th></tr></thead>
            <tbody>
                ${data
                    .map(
                        (item) =>
                            `<tr><td>${escapeHtml(item.label)}</td><td>${
                                isCurrency ? formatCurrencyK(item.value) : item.value
                            }</td></tr>`
                    )
                    .join('')}
            </tbody>
        </table>`;
}

function updateModeChrome(snapshot) {
    const hint = document.getElementById('insights-mode-hint');
    const exportBtn = document.getElementById('insights-export-btn');
    const exportLabel = document.getElementById('insights-export-label');
    if (hint) {
        hint.textContent = snapshot.coachingMode
            ? 'Individual view — export builds a coaching guideline for 1:1s.'
            : 'Combined view — export builds a leadership brief for business reviews.';
    }
    if (exportLabel) {
        exportLabel.textContent = snapshot.coachingMode ? 'Export Coaching Guide' : 'Export Leadership Brief';
    }
    if (exportBtn) {
        exportBtn.title = snapshot.coachingMode
            ? 'Print or save a coaching guideline for the current view'
            : 'Print or save a leadership brief for the current team rollup';
    }
}

function renderCoreKpis(snapshot) {
    const { userId, chartView, core } = snapshot;
    const isIndividualView = userId === 'all' && chartView === 'individual';
    document.querySelectorAll('#insights-core-charts .chart-container').forEach((container) => {
        const metricCard = container.querySelector('.analytics-metric-card');
        const chartWrapper = container.querySelector('.chart-wrapper');
        const toggleBtn = container.querySelector('.chart-toggle-btn');
        if (isIndividualView) {
            metricCard?.classList.add('hidden');
            chartWrapper?.classList.remove('hidden');
            toggleBtn?.classList.remove('hidden');
        } else {
            metricCard?.classList.remove('hidden');
            chartWrapper?.classList.add('hidden');
            toggleBtn?.classList.add('hidden');
        }
    });

    document.getElementById('insights-activities-metric').textContent = String(core.activities);
    document.getElementById('insights-tasks-metric').textContent = String(core.tasks);
    document.getElementById('insights-new-deals-metric').textContent = String(core.newDeals);
    document.getElementById('insights-new-deals-value-metric').textContent = formatCurrencyK(core.newDealsValue);
    document.getElementById('insights-closed-won-metric').textContent = formatCurrencyK(core.closedWonValue);
    document.getElementById('insights-quota-metric').textContent = `${core.quotaPct}%`;
    document.getElementById('insights-quota-caption').textContent =
        core.totalQuota > 0
            ? `${formatCurrencyK(core.closedWonValue)} closed won vs ${formatCurrencyK(core.totalQuota)} monthly quota`
            : 'No monthly quota configured for selected reps';

    renderChart('insights-activities-chart', core.activitiesByUser, false);
    renderChart('insights-tasks-chart', core.tasksByUser, false);
    renderChart('insights-new-deals-chart', core.newDealsByUser, false);
    renderChart('insights-new-deals-value-chart', core.newDealsValueByUser, true);
    renderChart('insights-closed-won-chart', core.closedWonByUser, true);
    renderChart('insights-quota-chart', core.quotaByUser, false);
}

function renderSequenceHealth(snapshot) {
    const { sequences } = snapshot;
    document.getElementById('insights-sequence-kpis').innerHTML = kpiHtml([
        { label: 'Active', value: sequences.active },
        { label: 'Completed', value: sequences.completed },
        { label: 'Removed', value: sequences.removed },
        { label: 'Overdue', value: sequences.overdue },
    ]);
    const tbody = document.querySelector('#insights-sequence-table tbody');
    if (!tbody) return;
    if (!sequences.table.length) {
        tbody.innerHTML = emptyRow(5, 'No sequence enrollments in this period.');
        return;
    }
    tbody.innerHTML = sequences.table
        .map(
            (row) => `
        <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${row.active}</td>
            <td>${row.completed}</td>
            <td>${row.removed}</td>
            <td>${row.overdue}</td>
        </tr>`
        )
        .join('');
}

function renderCampaigns(snapshot) {
    const { campaigns } = snapshot;
    document.getElementById('insights-campaign-kpis').innerHTML = kpiHtml([
        { label: 'Campaigns', value: campaigns.count },
        { label: 'Members', value: campaigns.members },
        { label: 'Completed', value: campaigns.completed },
        { label: 'Completion', value: `${campaigns.rate}%` },
    ]);
    const tbody = document.querySelector('#insights-campaign-table tbody');
    if (!tbody) return;
    if (!campaigns.table.length) {
        tbody.innerHTML = emptyRow(4, 'No campaigns in this period.');
        return;
    }
    tbody.innerHTML = campaigns.table
        .map(
            (row) => `
        <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${row.members}</td>
            <td>${row.completed}</td>
            <td>${row.rate}%</td>
        </tr>`
        )
        .join('');
}

function renderCognitoOutreach(snapshot) {
    const { cognito } = snapshot;
    document.getElementById('insights-cognito-kpis').innerHTML = kpiHtml([
        { label: 'Triggers', value: cognito.triggers },
        { label: 'Converted', value: cognito.converted },
        { label: 'Conversion', value: `${cognito.rate}%` },
    ]);
    const tbody = document.querySelector('#insights-cognito-table tbody');
    if (!tbody) return;
    if (!cognito.table.length) {
        tbody.innerHTML = emptyRow(3, 'No Cognito triggers in this period.');
        return;
    }
    tbody.innerHTML = cognito.table
        .map(
            (row) => `
        <tr>
            <td>${escapeHtml(row.status)}</td>
            <td>${row.triggers}</td>
            <td>${row.converted}</td>
        </tr>`
        )
        .join('');
}

function renderSaosSnapshot(snapshot) {
    const { saos } = snapshot;
    document.getElementById('insights-saos-kpis').innerHTML = kpiHtml([
        { label: 'Team Accounts', value: saos.accounts },
        { label: 'Active Plans', value: saos.plans },
        { label: 'Coverage', value: `${saos.coverage}%` },
        { label: 'Stale 14+ Days', value: saos.stale },
    ]);
}

function renderPenetration(snapshot) {
    const tbody = document.querySelector('#insights-penetration-table tbody');
    if (!tbody) return;
    if (!snapshot.penetration.length) {
        tbody.innerHTML = emptyRow(4, 'Every reportable account has activity in this period.');
        return;
    }
    tbody.innerHTML = snapshot.penetration
        .map(
            (row) => `
        <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.owner)}</td>
            <td>${row.contacts}</td>
            <td>${row.lastActivity ? escapeHtml(formatDate(row.lastActivity.toISOString())) : 'Never'}</td>
        </tr>`
        )
        .join('');
}

function renderAll() {
    const snapshot = computeSnapshot();
    state.snapshot = snapshot;
    renderCoreKpis(snapshot);
    renderSequenceHealth(snapshot);
    renderCampaigns(snapshot);
    renderCognitoOutreach(snapshot);
    renderSaosSnapshot(snapshot);
    renderPenetration(snapshot);
    updateModeChrome(snapshot);
}

function buildLeadershipExportHtml(snapshot, managerName) {
    const { core, sequences, campaigns, cognito, saos, penetration, talkingPoints } = snapshot;
    return `
      <header class="report-hero">
        <p class="kicker">Constellation Insights</p>
        <h1>Leadership Business Brief</h1>
        <p class="meta">${escapeHtml(snapshot.periodLabel)} · ${escapeHtml(snapshot.selectedRepName)} · Prepared by ${escapeHtml(managerName)} · ${escapeHtml(formatDate(new Date().toISOString()))}</p>
        <p class="purpose">Use this brief to speak about the business: utilization, pipeline creation, attainment, and where leadership attention is needed.</p>
      </header>

      <section>
        <h2>Executive Scorecard</h2>
        <div class="score-grid">
          <div class="score"><span>Quota Attainment</span><strong>${core.quotaPct}%</strong></div>
          <div class="score"><span>Closed Won</span><strong>${escapeHtml(formatCurrencyK(core.closedWonValue))}</strong></div>
          <div class="score"><span>New Funnel Value</span><strong>${escapeHtml(formatCurrencyK(core.newDealsValue))}</strong></div>
          <div class="score"><span>Activities</span><strong>${core.activities}</strong></div>
          <div class="score"><span>Deals Added</span><strong>${core.newDeals}</strong></div>
          <div class="score"><span>Past Due Tasks</span><strong>${core.tasks}</strong></div>
        </div>
      </section>

      <section>
        <h2>Talking Points</h2>
        <ol class="talking-points">
          ${talkingPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}
        </ol>
      </section>

      <section>
        <h2>Go-to-Market Motion</h2>
        <table>
          <thead><tr><th>Motion</th><th>Signal</th><th>Detail</th></tr></thead>
          <tbody>
            <tr><td>Sequences</td><td>${sequences.active} active / ${sequences.overdue} overdue</td><td>${sequences.completed} completed, ${sequences.removed} removed</td></tr>
            <tr><td>Campaigns</td><td>${campaigns.rate}% completion</td><td>${campaigns.count} campaigns · ${campaigns.completed}/${campaigns.members} members done</td></tr>
            <tr><td>Cognito → Outreach</td><td>${cognito.rate}% converted</td><td>${cognito.converted}/${cognito.triggers} triggers followed with activity</td></tr>
            <tr><td>SAOS</td><td>${saos.coverage}% coverage</td><td>${saos.plans}/${saos.accounts} accounts planned · ${saos.stale} stale 14+ days</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Low-Activity Accounts (Leadership Focus)</h2>
        ${
            penetration.length
                ? `<table>
            <thead><tr><th>Account</th><th>Owner</th><th>Contacts</th><th>Last Activity</th></tr></thead>
            <tbody>
              ${penetration
                  .slice(0, 12)
                  .map(
                      (row) => `<tr>
                <td>${escapeHtml(row.name)}</td>
                <td>${escapeHtml(row.owner)}</td>
                <td>${row.contacts}</td>
                <td>${row.lastActivity ? escapeHtml(formatDate(row.lastActivity.toISOString())) : 'Never'}</td>
              </tr>`
                  )
                  .join('')}
            </tbody>
          </table>`
                : '<p class="muted">No low-activity accounts in this period.</p>'
        }
      </section>
    `;
}

function buildCoachingExportHtml(snapshot, managerName) {
    const reps = snapshot.byRep;
    const single = snapshot.userId !== 'all';
    return `
      <header class="report-hero coaching">
        <p class="kicker">Constellation Insights</p>
        <h1>Coaching Guideline</h1>
        <p class="meta">${escapeHtml(snapshot.periodLabel)} · ${escapeHtml(snapshot.selectedRepName)} · Prepared by ${escapeHtml(managerName)} · ${escapeHtml(formatDate(new Date().toISOString()))}</p>
        <p class="purpose">${
            single
                ? 'Use this guide in a 1:1 to reinforce wins, clear blockers, and set one concrete next commitment.'
                : 'Use this guide to prioritize coaching across the team — start with the largest gaps, then reinforce high performers.'
        }</p>
      </header>

      <section>
        <h2>${single ? 'Rep Snapshot' : 'Team Coaching Rank'}</h2>
        <table>
          <thead>
            <tr>
              <th>Rep</th><th>Activities</th><th>Past Due</th><th>New Deals</th>
              <th>Closed Won</th><th>Quota</th><th>Seq Overdue</th><th>Cognito</th>
            </tr>
          </thead>
          <tbody>
            ${reps
                .map(
                    (rep) => `<tr>
              <td>${escapeHtml(rep.name)}</td>
              <td>${rep.activities}</td>
              <td>${rep.pastDueTasks}</td>
              <td>${rep.newDeals} (${escapeHtml(formatCurrencyK(rep.newDealsValue))})</td>
              <td>${escapeHtml(formatCurrencyK(rep.closedWonValue))}</td>
              <td>${rep.quotaPct}%</td>
              <td>${rep.seqOverdue}</td>
              <td>${rep.cognitoConverted}/${rep.cognitoTriggers}</td>
            </tr>`
                )
                .join('')}
          </tbody>
        </table>
      </section>

      ${reps
          .map(
              (rep) => `
        <section class="rep-card">
          <h2>${escapeHtml(rep.name)}</h2>
          <p class="muted">Activities ${rep.activities} · Past due ${rep.pastDueTasks} · Quota ${rep.quotaPct}% · Overdue sequences ${rep.seqOverdue} · Stale accounts ${rep.staleAccounts}</p>
          <h3>Coaching prompts</h3>
          <ul>
            ${rep.coachingPrompts.map((prompt) => `<li>${escapeHtml(prompt)}</li>`).join('')}
          </ul>
        </section>`
          )
          .join('')}
    `;
}

function getInsightsExportStyles() {
    return `
      .insights-pdf-doc {
        width: 744px;
        margin: 0;
        padding: 28px 32px 36px;
        box-sizing: border-box;
        font-family: Inter, "Segoe UI", Helvetica, Arial, sans-serif;
        color: #0f172a;
        background: #ffffff;
        line-height: 1.45;
      }
      .report-hero {
        border-bottom: 3px solid #1d4ed8;
        padding-bottom: 16px;
        margin-bottom: 22px;
      }
      .report-hero.coaching { border-bottom-color: #0f766e; }
      .kicker {
        margin: 0 0 6px;
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #64748b;
        font-weight: 800;
      }
      h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.15; }
      h2 { margin: 0 0 10px; font-size: 18px; }
      h3 { margin: 14px 0 6px; font-size: 14px; }
      .meta, .muted, .purpose { color: #475569; }
      .meta { margin: 0 0 10px; font-size: 12px; }
      .purpose { margin: 0; font-size: 13px; }
      section { margin: 0 0 22px; }
      .score-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
      }
      .score {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 12px;
        background: #f8fafc;
      }
      .score span {
        display: block;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #64748b;
        font-weight: 700;
      }
      .score strong {
        display: block;
        margin-top: 6px;
        font-size: 22px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      th, td {
        border-bottom: 1px solid #e2e8f0;
        text-align: left;
        padding: 8px 6px;
        vertical-align: top;
      }
      th {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748b;
      }
      .talking-points, .rep-card ul {
        margin: 0;
        padding-left: 18px;
      }
      .talking-points li, .rep-card li { margin: 0 0 8px; }
      .rep-card {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 14px 16px;
        margin-bottom: 14px;
      }
    `;
}

function waitForDomSettle() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });
    });
}

async function tallCanvasToPdfBytes(canvas) {
    const { PDFDocument } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();
    const usableWidth = LETTER_WIDTH_PT - PDF_MARGIN_PT * 2;
    const usableHeight = LETTER_HEIGHT_PT - PDF_MARGIN_PT * 2;
    const scale = usableWidth / canvas.width;
    const pageHeightPx = Math.max(1, Math.floor(usableHeight / scale));

    let offsetY = 0;
    while (offsetY < canvas.height) {
        const sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = sliceHeight;
        const ctx = slice.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

        const png = await pdfDoc.embedPng(slice.toDataURL('image/png'));
        const page = pdfDoc.addPage([LETTER_WIDTH_PT, LETTER_HEIGHT_PT]);
        const drawHeight = sliceHeight * scale;
        page.drawImage(png, {
            x: PDF_MARGIN_PT,
            y: LETTER_HEIGHT_PT - PDF_MARGIN_PT - drawHeight,
            width: usableWidth,
            height: drawHeight,
        });
        offsetY += sliceHeight;
    }

    return pdfDoc.save();
}

function downloadPdfBytes(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function buildExportFilename(snapshot) {
    const kind = snapshot.coachingMode ? 'Coaching_Guideline' : 'Leadership_Brief';
    const period = String(snapshot.periodLabel || 'Period').replace(/\s+/g, '_');
    const scope = String(snapshot.selectedRepName || 'Team').replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
    return `Insights_${kind}_${scope}_${period}.pdf`;
}

async function exportInsightsReport() {
    if (state.exporting) return;

    const exportBtn = document.getElementById('insights-export-btn');
    const exportLabel = document.getElementById('insights-export-label');
    const previousLabel = exportLabel?.textContent || 'Export';

    const snapdomFn = globalThis.snapdom;
    if (typeof snapdomFn !== 'function') {
        showToast('PDF export library (Snapdom) is not loaded. Refresh and try again.', 'error');
        return;
    }
    if (!window.PDFLib) {
        showToast('PDF library is not loaded. Refresh and try again.', 'error');
        return;
    }

    const exportRoot = document.getElementById('insights-export-root');
    if (!exportRoot) {
        showToast('Export root is missing.', 'error');
        return;
    }

    const snapshot = state.snapshot || computeSnapshot();
    const managerName =
        getState()?.effectiveUserFullName ||
        state.currentUser?.user_metadata?.full_name ||
        'Manager';
    const bodyHtml = snapshot.coachingMode
        ? buildCoachingExportHtml(snapshot, managerName)
        : buildLeadershipExportHtml(snapshot, managerName);

    state.exporting = true;
    if (exportBtn) exportBtn.disabled = true;
    if (exportLabel) exportLabel.textContent = 'Compiling PDF…';

    try {
        exportRoot.innerHTML = `
          <style>${getInsightsExportStyles()}</style>
          <div class="insights-pdf-doc">${bodyHtml}</div>
        `;
        const captureRoot = exportRoot.querySelector('.insights-pdf-doc');
        if (!captureRoot) throw new Error('Export capture root missing.');

        try {
            if (document.fonts?.ready) await document.fonts.ready;
        } catch (_) {
            /* ignore */
        }
        await waitForDomSettle();

        const capture = await snapdomFn(captureRoot, {
            scale: 2,
            backgroundColor: '#ffffff',
            outerShadows: false,
            outerTransforms: false,
        });
        const canvas = await capture.toCanvas();
        const bytes = await tallCanvasToPdfBytes(canvas);
        downloadPdfBytes(bytes, buildExportFilename(snapshot));
        showToast('Insights PDF exported.', 'success');
    } catch (error) {
        console.error('[insights] PDF export failed:', error);
        showToast(error?.message || 'Could not generate Insights PDF.', 'error');
    } finally {
        exportRoot.innerHTML = '';
        state.exporting = false;
        if (exportBtn) exportBtn.disabled = false;
        if (exportLabel) {
            exportLabel.textContent = previousLabel;
            updateModeChrome(state.snapshot || snapshot);
        }
    }
}

function setupEventListeners() {
    document.getElementById('insights-refresh-btn')?.addEventListener('click', () => {
        loadInsightsData();
    });

    document.getElementById('insights-export-btn')?.addEventListener('click', () => {
        exportInsightsReport();
    });

    document.getElementById('insights-rep-filter')?.addEventListener('change', (e) => {
        if (repTomSelect) return;
        state.filters.userId = e.target.value;
        syncReportViewToggleVisibility();
        renderAll();
    });

    document.getElementById('insights-date-filter')?.addEventListener('change', (e) => {
        if (dateTomSelect) return;
        state.filters.dateRange = e.target.value;
        renderAll();
    });

    document.getElementById('insights-chart-view-toggle')?.addEventListener('click', (e) => {
        if (!e.target.matches('button')) return;
        document.querySelectorAll('#insights-chart-view-toggle button').forEach((b) => b.classList.remove('active'));
        e.target.classList.add('active');
        state.filters.chartView =
            e.target.id === 'insights-view-individual-btn' ? 'individual' : 'combined';
        renderAll();
    });

    document.getElementById('insights-core-charts')?.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.chart-toggle-btn');
        if (!toggleBtn) return;
        const container = toggleBtn.closest('.chart-container');
        const canvas = container?.querySelector('canvas');
        const tableView = container?.querySelector('.chart-table-view');
        if (!canvas || !tableView) return;

        if (toggleBtn.dataset.view === 'chart') {
            const chartInstance = state.charts[canvas.id];
            if (chartInstance) {
                const chartData = chartInstance.data.labels.map((label, index) => ({
                    label,
                    value: chartInstance.data.datasets[0].data[index],
                }));
                const isCurrency = canvas.id.includes('value') || canvas.id.includes('won');
                renderTableForChart(container.id, chartData, isCurrency);
            }
            canvas.classList.add('hidden');
            tableView.classList.remove('hidden');
            toggleBtn.dataset.view = 'table';
            toggleBtn.innerHTML = '<i class="fas fa-chart-bar"></i>';
        } else {
            canvas.classList.remove('hidden');
            tableView.classList.add('hidden');
            toggleBtn.dataset.view = 'chart';
            toggleBtn.innerHTML = '<i class="fas fa-table"></i>';
        }
    });
}

async function initializePage() {
    injectGlobalNavigation();
    await loadSVGs();
    const appState = await initializeAppState(supabase);
    if (!appState.currentUser) {
        hideGlobalLoader();
        window.location.href = 'index.html';
        return;
    }

    state.currentUser = appState.currentUser;
    const isAdmin = state.currentUser.user_metadata?.is_admin === true;
    const canAccess = appState.isManager === true || isAdmin;

    await setupUserMenuAndAuth(supabase, appState);
    await setupGlobalSearch(supabase, state.currentUser);
    await checkAndSetNotifications(supabase);
    updateActiveNavLink();
    setupEventListeners();

    const denied = document.getElementById('insights-access-denied');
    const content = document.getElementById('insights-content');

    if (!canAccess) {
        denied?.classList.remove('hidden');
        content?.classList.add('hidden');
        hideGlobalLoader();
        window.location.href = 'command-center.html';
        return;
    }

    denied?.classList.add('hidden');
    content?.classList.remove('hidden');
    await loadInsightsData();
    hideGlobalLoader();
}

initializePage();
