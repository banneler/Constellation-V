# Guardian E2E (Playwright)

## Quick start

1. Copy `.env.example` → `.env` and set `E2E_EMAIL`, `E2E_PASSWORD` (Supabase user).
2. `npm run test:e2e` — starts static server on `:4173`, runs `tests/seed.spec.ts`, then `tests/e2e/*.spec.ts` with saved session.

Scripts: `test` / `test:e2e`, `test:e2e:ui`, `test:e2e:headed`.

**Smoke:** `tests/smoke/public.spec.ts` (login + reset-password, no auth) and `tests/smoke/crm-pages.spec.ts` (all other root `.html` pages, requires seed). Projects: `smoke-public`, `smoke-crm`.

**Mocked mutation (no seed, intercepts `/rest/v1/`, does not hit live Supabase):**

```
npx playwright test tests/e2e/deals-mutation.spec.ts --project=mocked
```

| Spec | Titles |
| --- | --- |
| `tests/e2e/deals-mutation.spec.ts` | `composer creates once, then a stage change patches once`; `create errors stay friendly and do not persist` |
| `tests/e2e/accounts-mutation.spec.ts` | Account create/update hardening (chromium project; mocked REST, still uses seed session) |

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
