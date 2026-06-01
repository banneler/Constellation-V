# ABM Campaign Refactor — Execution Plan

Pivot from spray-and-pray mail merge to account-based spear-fishing.

## Order of operations

| Step | Phase | Files | Action |
|------|-------|-------|--------|
| 1 | 1 | `sql/add_tier_to_accounts.sql`, `supabase/migrations/20260601120000_add_accounts_tier.sql` | Add `accounts.tier`, backfill from SAOS JSON |
| 2 | 1 | `js/accounts.js` | Tier badge in account list; sync SAOS → `accounts.tier` on plan save |
| 3 | 1 | `input.css` | `.account-tier-badge` styles |
| 4 | 2 | `campaigns.html` | Remove flip-card template manager; simplify create card |
| 5 | 2 | `js/campaigns.js` | Delete Email Merge type, export handlers, template manager |
| 6 | 3 | `js/campaigns.js` | ABM split-pane cart (native HTML5 DnD) |
| 7 | 3 | `input.css` | `.abm-*` cart / explorer styles |
| 8 | — | `sw.js`, cache-bust if needed | Bump after CSS compile |

## Phase 1 — Tier as first-class data

- **Column:** `accounts.tier` — `'Tier 1' | 'Tier 2' | 'Tier 3' | 'Unassigned'`
- **SAOS sync:** `onPlanUpdated` maps `account_snapshot.tier` → `accounts.tier` after autosave
- **UI:** Tier pill badge on each account list row

## Phase 2 — Purge mail merge

- Remove `Email` campaign type from create selector
- Delete `handleExportCsv`, `handleExportTxt`, `logMailMergeActivity`, `renderEmailMergeUI`
- Remove `campaign-tools-flippable` and all template manager CRUD from campaigns page

## Phase 3 — ABM Cart

- **Left:** Filterable account accordion (Tier + Industry); contacts draggable; MEDDPICC badges from `account_plans.plan`
- **Right:** Drop cart; account header drag adds all contacts
- **Header:** Name, Type (Call Blitz | Guided Email), Launch Campaign
- **Persistence:** `campaign_members` rows from explicit cart selection; `filter_criteria` stores `{ tier, industry, contact_ids }`

## Drag-and-drop

Native HTML5 DnD (same pattern as SAOS influence board / sequences). No external library.
