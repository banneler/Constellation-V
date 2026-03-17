# Spec: Deals pipeline

**Intent:** `view_deals_list`, `view_deals_board`, `open_new_deal`, `toggle_my_team_deals`, `reset_deals_filters`  
**Route:** `deals.html`

## Preconditions

- Authenticated session.

## Flows

1. **App ready:** wait for `#global-loader-overlay` inactive.
2. **List view:** click `#list-view-btn`; expect `#deals-table` visible.
3. **Board view:** click `#board-view-btn`; expect `#kanban-board-view` visible.
4. **New deal:** click `#add-deal-btn`; expect `#new-deal-inline-container` to lose class `hidden` (inline composer opens).
5. **Metrics:** `#metric-current-commit` (or related metric chips) present when data loads.
6. **My vs all:** click `#view-my-deals-btn` and `#view-all-deals-btn` (UI reflects filter).
7. **Reset filters:** if `#deals-filters-reset` exists and is enabled, click to clear filters.

## Success criteria

- View toggles work without JS errors.
- New deal UI appears after plus button.
- Loader clears before assertions.

## Primary selectors

`#add-deal-btn`, `#list-view-btn`, `#board-view-btn`, `#deals-table`, `#kanban-board-view`, `#new-deal-inline-container`, `#view-my-deals-btn`, `#view-all-deals-btn`, `#deals-filters-reset`
