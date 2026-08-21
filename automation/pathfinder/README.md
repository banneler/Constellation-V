# Pathfinder Mac mini worker

Pathfinder is a Python 3.10+ background worker that discovers evidence-backed
technology and network contacts for Constellation-V accounts. It uses Google
Custom Search for discovery, fetches permitted public pages, asks Gemini for
strict structured extraction, and writes candidates and evidence through
Supabase PostgREST with a service-role key.

## Safety and behavior

- Checks the organization Pathfinder toggle for scheduled runs.
- Scans accounts owned by active (`deactivated_at is null`) GPC users.
- Processes queued manual jobs first, then accounts without a completed scan in
  the previous seven days. Repeated `--account-id` values override the age gate.
- Never fetches LinkedIn, common gated/authentication URLs, CAPTCHA pages,
  private/loopback hosts, non-HTML content, oversized pages, or pages disallowed
  by `robots.txt`. A missing/unreachable robots policy fails closed.
- Uses account name, website/domain, industry, address, phone, and known contact
  email domains as company-identity context in discovery and extraction.
- Rejects short acronym-only company matches unless the account domain or
  multiple independent CRM identity details corroborate the source.
- Applies deterministic company, role, source, recency, and corroboration
  scoring after model extraction.
- Infers email addresses only when at least two same-account contacts establish
  a pattern with at least 60% agreement. It performs domain MX/A/AAAA sanity
  checks only and never probes an individual mailbox.
- Keeps stable account/name fingerprints and preserves rejected candidates.
- Isolates failures by account and records failed job details.

## Install

No third-party packages are required.

```sh
cd /Users/projectgalaxy/Projects/Constellation-V/automation/pathfinder
cp .env.example .env
chmod 600 .env
chmod +x run_pathfinder.sh
```

Fill in `.env`. The Supabase credential must be the service-role key and must
remain only on the Mac mini. Set a truthful monitored contact in
`PATHFINDER_USER_AGENT`.

The required database contract is migration
`20260814183000_add_pathfinder_contact_discovery.sql`; apply it before running
the worker. Enable `org_settings.pathfinder_enabled` for scheduled operation.

## Run

```sh
./run_pathfinder.sh --dry-run --limit 2
./run_pathfinder.sh --account-id 123 --account-id 456
./run_pathfinder.sh --limit 20
```

Dry-run performs live search, page fetch, extraction, and read-only database
queries, but creates or updates no jobs, candidates, or evidence.

## launchd

1. Copy `com.constellationv.pathfinder.plist.example` to
   `~/Library/LaunchAgents/com.constellationv.pathfinder.plist`.
2. Replace every `REPLACE_ME` path component.
3. Validate and load:

```sh
plutil -lint ~/Library/LaunchAgents/com.constellationv.pathfinder.plist
launchctl bootstrap "gui/$(id -u)" \
  ~/Library/LaunchAgents/com.constellationv.pathfinder.plist
launchctl kickstart -k "gui/$(id -u)/com.constellationv.pathfinder"
```

The template runs daily at 02:15 local time. Secrets stay in the mode-600
`.env`, not in the plist.

## Tests

```sh
python3 -m unittest discover -s tests -v
```

Tests cover account disambiguation, role classification, deterministic
confidence, email pattern inference, stable fingerprints, rejected suppression,
and candidate/evidence upsert behavior. Tests do not require network access.

## Operations

Logs include selected account count, account identifiers, skipped pages,
candidate confidence, rejection suppression, and isolated failures. Standard
output and error locations are configured in the plist template. Rotate those
files with the Mac's normal log-management policy.

Google and Gemini quotas should be sized for the account volume. One Google
query is issued per scanned account; Gemini calls occur only for fetched,
robots-permitted results.
