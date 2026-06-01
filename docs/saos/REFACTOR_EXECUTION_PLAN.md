# SAOS 12-Section Refactor — Execution Plan

**Branch:** `deploy`  
**Objective:** Reduce framework fatigue (15→12 sections), add in-strategic account switching, enforce MEDDPICC + Challenger forcing functions.

## Order of Operations

| Step | Phase | Files | Action |
|------|-------|-------|--------|
| 1 | Plan | `docs/saos/REFACTOR_EXECUTION_PLAN.md` | This document |
| 2 | Schema | `js/account-plan-sections.js` | Prune registry; new types/labels; update `SAOS_CORE_HIDDEN_SECTION_IDS`; retarget tension ghost |
| 3 | Data | `js/account-plan-data.js` | Merge normalizers; legacy stitch; `white_space` object shape; interaction `momentum_score`; influence MEDDPICC flags; psychology bypass field |
| 4 | UI core | `js/account-plan-ui.js` | Canvas builders, completeness, timeline+momentum, psychology trap, influence badges, path rows |
| 5 | Switcher | `accounts.html`, `css/saos-strategic.css`, `js/account-plan-ui.js`, `js/accounts.js` | Header chevron dropdown; stay in Strategic on swap |
| 6 | Export | `js/account-plan-export-templates.js`, `js/account-plan-export.js`, `js/account-plan-presentation-ai.js`, `js/account-plan-presentation-pptx.js` | Read merged shapes; update dossier groups |
| 7 | Cache | `sw.js`, `accounts.html` CSS query | Bump deploy cache |
| 8 | Brief | `docs/saos/SAOS_REVIEW_BRIEF.md` | Align section count (optional follow-up) |

## Final Section Registry (12)

| # | id | Title | Core? |
|---|-----|-------|-------|
| 1 | `account_snapshot` | Account Snapshot | ✅ |
| 2 | `pursuit_thesis` | The Big Play (+ operational pain pills) | ✅ |
| 3 | `strategic_tensions` | Competing Priorities | Deep only |
| 4 | `critical_unknowns` | The Blindspots | Deep only |
| 5 | `influence_mapping` | Influence Mapping | ✅ |
| 6 | `white_space` | Account Expansion (wedge + matrix) | ✅ |
| 7 | `competitive_landscape` | The Battlefield (+ incumbent moat) | ✅ |
| 8 | `entry_points` | Strategic Entry Points | ✅ |
| 9 | `psychology` | How They Buy (+ bureaucracy bypass trap) | Deep only |
| 10 | `plan_30_60_90` | 30 / 60 / 90 Plan | ✅ |
| 11 | `momentum_timeline` | Relationship Timeline (+ momentum trendline) | ✅ |

**Removed from registry:** `pain_signals`, `entrenchment`, `land_and_expand`, `relationship_momentum` (data migrated on read).

**Core visible count:** 9 sections (3 Deep-only hidden: psychology, strategic_tensions, critical_unknowns).

## Data Migration Summary

| Legacy key | Merged into |
|------------|-------------|
| `pain_signals.selected/notes` | `pursuit_thesis.operational_pain_selected/notes` |
| `entrenchment.*` | `competitive_landscape.moat_*` fields |
| `land_and_expand.*` | `white_space.initial_entry/trust_creation/expansion_path` |
| `relationship_momentum.score` | Seed `interaction_log[].momentum_score` if no milestones yet |
| `white_space[]` (array) | `white_space.rows[]` (object wrapper) |

## Phase 3 Forcing Functions

1. **Bureaucracy Bypass Trap** — Show required `bureaucracy_bypass_strategy` when risk≤2 AND bureaucracy≥4.
2. **MEDDPICC** — `is_champion`, `is_economic_buyer` on influence contacts; completeness capped without Economic Buyer.
3. **Momentum trendline** — Log Strategic Milestone requires 1–5 score; trendline from `interaction_log.momentum_score`.
