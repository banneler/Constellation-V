# SAOS Multi-Agent Status

Last updated: 2026-05-23

| Agent | Branch | Commit | Status | Notes |
|-------|--------|--------|--------|-------|
| A0 Export Parity | `saos/a0-export-parity` | `4feaaaf` | **complete** | Contacts in influence export, entry-point v2 fields, measured pagination, section PDF headers, signals-only timeline comment, contacts in `handleExportPdf` |
| A1 Schema v2 | `saos/a1-schema-v2` | `5ffe675` | **complete** | `PLAN_SCHEMA_VERSION = 2`, normalizers, section registry, `account-plan-contacts.js` |
| Integration | `saos/integration` | `b4b7313` | **ready** | A0–A6 merged (status doc at `8838d17`) |
| A2 Canvas P1 | `saos/a2-canvas-p1` | `fbe2504` | **merged** | Canvas renderers for snapshot, thesis hints, unknowns, entrenchment, pain signals; rail completeness widget |
| A3 Canvas P2 | `saos/a3-canvas-p2` | `c6031a3` | **merged** | Influence v2 board, white space row editor, psychology gravity pills, 9 strategic tension groups |
| A4 Export Deck | `saos/a4-export-deck` | `67e2ccf` | **merged** | Dossier PDF blocks for all v2 sections; PPTX/AI fallbacks; signals-only timeline |
| A5 Interaction Log | `saos/a5-interaction-log` | `3672dfc` | **merged** | `interaction_log` quick-log + full form; promote-from-CRM; timeline overlay; signals-only PDF export; no new `momentum_notes` writes |
| A6 AI Presentation | `saos/a6-ai-presentation` | `b4b7313` | **merged** | Edge function v2 prompt; `PresentationHighlight` schema extensions; normalize fallbacks; PPTX renders snapshot tier/priority, executive narrative, pain/unknowns, white space, access path, entrenchment moat, signal-only timeline |
| A7 QA & Docs | — | — | **ready to start** | Start after A6 merged to integration |

## Git notes

- Base branch: **`deploy`** (`24f8dd0`), not `main`.
- Integration branch: `saos/integration` — A6 feature commit **`b4b7313`**, HEAD **`8838d17`**.
- Merge commits: A2 → integration **`d7a688e`**; A3 fast-forward **`c6031a3`**; A5 fast-forward **`3672dfc`**.

## A6 deliverables

- **`generate-presentation-highlight`** — schema v2 `SYSTEM_PROMPT` maps account snapshot, pursuit thesis extensions, pain signals, critical unknowns, white space, access path, entrenchment moat, and interaction_log signals; strips `source: activity` rows before AI synthesis
- **`PresentationHighlight` types** — `account_context`, `executive_narrative`, `pain_signals`, `critical_unknowns`, `white_space`, `access_path_hook`, `entrenchment_moat`
- **`normalizePresentationHighlight()`** — v2 fallbacks from plan sections; signals via `getExportSignals()` (excludes CRM activities)
- **PPTX builders** — situation slide shows tier/priority, executive narrative, pain/unknown strips; battlefield shows white space + access path hook; execution shows entrenchment moat + strategic signals

## Handoff: launch A7

**A7 (QA):** Export parity E2E — dossier PDF contains all v2 section titles; timeline PDF/PPTX excludes CRM activities; exec PPT with AI references snapshot, unknowns, white space on populated v2 plan.

**Deploy:** Redeploy Supabase edge function after merge — `supabase functions deploy generate-presentation-highlight`
