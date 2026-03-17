# Guardian E2E (Playwright)

## Quick start

1. Copy `.env.example` → `.env` and set `E2E_EMAIL`, `E2E_PASSWORD` (Supabase user).
2. `npm run test:e2e` — starts static server on `:4173`, runs `tests/seed.spec.ts`, then `tests/e2e/*.spec.ts` with saved session.

Scripts: `test:e2e`, `test:e2e:ui`, `test:e2e:headed`.

## Artifacts

| Path | Purpose |
|------|---------|
| `testing_manifest.json` | Intent → selectors for Guardian |
| `specs/*.md` | Agent-readable flows |
| `tests/pages/*.page.ts` | Page objects |
| `tests/helpers/guardian-log.ts` | `[Guardian E2E]` logs + `guardianRun` failure screenshots |
| `tests/.auth/user.json` | Session (gitignored) |

## Playwright MCP agents

`npx playwright init-agents --loop=cursor` is **not supported**. Use `--loop=vscode` (or `claude`, `copilot`, `opencode`). If `.vscode` creation fails in a sandbox, run the command locally outside the sandbox.

## Self-healing

On assertion/timeout failure inside `guardianRun`, logs include step name, error message, a short stack, and an extra screenshot under `test-results/guardian-fail-*.png`.
