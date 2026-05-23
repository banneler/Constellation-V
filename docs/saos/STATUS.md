# SAOS Multi-Agent Status

Last updated: 2026-05-23

| Agent | Branch | Commit | Status | Notes |
|-------|--------|--------|--------|-------|
| A0 Export Parity | `saos/a0-export-parity` | `4feaaaf` | **complete** | Contacts in influence export, entry-point v2 fields, measured pagination, section PDF headers, signals-only timeline comment, contacts in `handleExportPdf` |
| A1 Schema v2 | `saos/a1-schema-v2` | `5ffe675` | **complete** | `PLAN_SCHEMA_VERSION = 2`, normalizers, section registry, `account-plan-contacts.js` |
| Integration | `saos/integration` | — | **ready** | A0 + A1 + A2 + A4 merged |
| A2 Canvas P1 | `saos/a2-canvas-p1` | `fbe2504` | **merged** | Canvas renderers for snapshot, thesis hints, unknowns, entrenchment, pain signals; rail completeness widget |
| A3 Canvas P2 | — | — | **in progress** | Influence v2, white space editor, psychology gravity, strategic tensions |
| A4 Export Deck | `saos/a4-export-deck` | `67e2ccf` | **merged** | Dossier PDF blocks for all v2 sections; PPTX/AI fallbacks; signals-only timeline |
| A5 Interaction Log | — | — | blocked | Start after A3 merged |
| A6 AI Presentation | — | — | **ready after A4+A5** | Edge function prompt; consume new section keys |
| A7 QA & Docs | — | — | blocked | Start after A6 merged |

## Git notes

- Base branch: **`deploy`** (`24f8dd0`), not `main`.
- Integration branch: `saos/integration` — agents branch from here and merge back.
- A2 branch: `saos/a2-canvas-p1` at `fbe2504` — merged into integration.

## A2 deliverables (`fbe2504`)

- **`account_snapshot` renderer** — CRM firmographics read-only + plan JSONB fields with `data-field` autosave (selects for tier/levels, textareas for providers/expansion)
- **`pursuit_thesis` extensions** — `why_account_matters` + `executive_narrative` via composite_textarea; optional executive language hint pills (append-only, not persisted separately)
- **`pain_signals`**, **`critical_unknowns`**, **`entrenchment`** — pill + narrative canvas sections reusing v2 registry keys
- **Rail completeness widget** — % of filled sections (16 registry sections), live-updates on edit/pill toggle

## A4 deliverables (`saos/a4-export-deck`)

- **Dossier PDF** (`account-plan-export-templates.js`): export blocks for all `exportDossier: true` v2 sections
  - `account_snapshot` — CRM firmographics table + plan strategic judgments table
  - `pursuit_thesis` — full 5-field editorial grid (incl. `why_account_matters`, `executive_narrative`)
  - `pain_signals`, `critical_unknowns`, `entrenchment` — pills + narrative prose blocks
  - `white_space_matrix` — compact table with `value_notes` as text
  - `influence_mapping` v2 — structured contact cards via `account-plan-contacts.js`; technical tier; political dynamics; access path grid
  - `psychology` — sliders + enterprise gravity fields below
  - `interaction_log` — stub empty state until A5
- **Signals-only timeline**: `getExportMomentumNotes()` merges `momentum_notes` + `interaction_log`, excludes `source: activity|crm`
- **Presentation fallbacks** (`account-plan-presentation-ai.js`): pursuit thesis v2 fields, psychology gravity callouts, competitive/entrenchment bullets, influence hooks, corrected entry-point hook fields, signals-only `getExportSignals()`
- **Exec HTML deck** (`account-plan-export-templates.js`): pursuit thesis + psychology gravity in non-AI fallback path
- **PPTX** (`account-plan-presentation-pptx.js`): consumes updated `normalizePresentationHighlight()` fallbacks

## Handoff: blockers for A6

- **Interaction log export body** — A4 ships stub only; A5 must implement full structured PDF block and wire canvas quick-log UX.
- **AI edge function** (`generate-presentation-highlight`) — A6 must extend prompt/schema for white space, account snapshot tier, pain signals, and interaction log once A5 lands.
- **Canvas parity** — A3 still owns remaining `account-plan-ui.js` renderers; export assumes normalized plan data from A1.

## Downstream reminders

**A3:** `white_space_matrix`, influence board v2, psychology gravity fields, all 9 strategic tension groups.

**A5 (interaction log):** Replace export stub with structured interaction rows; promote-from-CRM writes `source: 'activity'` (excluded from export); stop writing `momentum_notes`.

**A6 (AI brief):** Rebase on `saos/integration` after A4 + A5; extend highlight synthesis for new section keys.

**A7 (QA):** Export parity E2E — dossier PDF contains all v2 section titles; timeline excludes CRM activities.
