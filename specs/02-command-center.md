# Spec: Command Center dashboard

**Intent:** `refresh_ai_briefing`, `expand_my_tasks_quick_add`, `toggle_sequence_view`, `view_recent_activities`  
**Route:** `command-center.html`

## Preconditions

- Authenticated session (after seed).

## Flows

### A. AI briefing refresh

1. Wait until `#global-loader-overlay` is not `.active` (app ready).
2. Click `#ai-briefing-refresh-btn` (rotate icon, "Refresh Briefing").

**Success:** Briefing area updates (placeholder may show loading then content); button remains interactive.

### B. My Tasks quick-add

1. If `#quick-add-task-form` is not visible, click `#my-tasks-hamburger` (Add task) to expand.
2. Assert `#quick-add-task-form` is visible.

**Success:** Form with `#quick-add-description` is usable.

### C. Sequence toggles

1. Click `#sequence-toggle-due` then `#sequence-toggle-upcoming`.
2. Observe `#sequence-steps-list` content reflects mode (may be empty message).

**Success:** Toggles switch active styling; list region updates without console errors.

### D. Recent activities

1. Assert `#recent-activities-list` is attached (may show empty state).

**Success:** Section renders after loader clears.

## Primary selectors

`#dashboard-sections-grid`, `#ai-briefing-refresh-btn`, `#my-tasks-hamburger`, `#quick-add-task-form`, `#sequence-toggle-due`, `#sequence-toggle-upcoming`, `#recent-activities-list`
