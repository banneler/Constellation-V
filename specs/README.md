# Guardian / Playwright specs

Markdown flows mirror **`testing_manifest.json`** (repo root). Executable tests live in **`tests/e2e/`** with page objects in **`tests/pages/`**.

| Spec | Flow |
|------|------|
| [01-login.md](./01-login.md) | Email/password → command center |
| [02-command-center.md](./02-command-center.md) | Briefing, tasks, sequences, activities |
| [03-deals.md](./03-deals.md) | List/board, new deal, filters |
| [04-contacts.md](./04-contacts.md) | Search, sort, add contact |
| [05-social-hub.md](./05-social-hub.md) | Feeds, post modal |

**Playwright agents:** `npx playwright init-agents` supports `--loop=vscode` (not `cursor`). Use the VS Code loop or copy agent definitions into Cursor.
