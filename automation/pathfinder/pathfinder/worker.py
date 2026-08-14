"""Pathfinder account-selection and discovery worker."""

from __future__ import annotations

import argparse
import logging
import re
from collections import defaultdict
from datetime import datetime, timezone

from .config import Config
from .discovery import GeminiExtractor, GoogleSearch, PublicPageFetcher, SearchResult
from .dns import has_mail_dns
from .logic import (
    calculate_confidence,
    classify_role,
    company_match_score,
    hostname,
    identity_fingerprint,
    infer_email_pattern,
    recency_score,
    role_match_score,
    source_authority,
)
from .supabase import SupabaseRepository

LOGGER = logging.getLogger("pathfinder")
EMAIL_RE = re.compile(r"^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$", re.I)


def select_work(
    repo: SupabaseRepository,
    account_ids: list[int],
    limit: int | None,
) -> list[tuple[dict, dict | None]]:
    owners = repo.active_owner_ids()
    accounts = repo.accounts_for_owners(owners, account_ids or None)
    by_id = {int(account["id"]): account for account in accounts}
    jobs = repo.queued_manual_jobs(account_ids or None)
    selected: list[tuple[dict, dict | None]] = []
    seen: set[int] = set()
    for job in jobs:
        account_id = int(job["account_id"])
        if account_id in by_id and account_id not in seen:
            selected.append((by_id[account_id], job))
            seen.add(account_id)
    recent = set() if account_ids else repo.recently_completed_account_ids(7)
    for account in accounts:
        account_id = int(account["id"])
        if account_id not in seen and account_id not in recent:
            selected.append((account, None))
            seen.add(account_id)
    return selected[:limit] if limit is not None else selected


class PathfinderWorker:
    def __init__(
        self,
        config: Config,
        repo: SupabaseRepository,
        search: GoogleSearch,
        fetcher: PublicPageFetcher,
        extractor: GeminiExtractor,
        *,
        dry_run: bool = False,
    ):
        self.config = config
        self.repo = repo
        self.search = search
        self.fetcher = fetcher
        self.extractor = extractor
        self.dry_run = dry_run

    def run_account(self, account: dict, queued_job: dict | None) -> int:
        job = queued_job
        if not self.dry_run:
            if job is None:
                job = self.repo.create_scheduled_job(account)
            self.repo.update_job(
                job["id"],
                {"status": "running", "started_at": datetime.now(timezone.utc).isoformat(),
                 "error_message": None},
            )
        try:
            found = self._discover(account, job)
            if not self.dry_run and job:
                self.repo.update_job(
                    job["id"],
                    {
                        "status": "completed",
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                        "candidates_found": found,
                        "error_message": None,
                    },
                )
            return found
        except Exception as exc:
            LOGGER.exception("Account scan failed account_id=%s", account["id"])
            if not self.dry_run and job:
                self.repo.update_job(
                    job["id"],
                    {"status": "failed", "completed_at": datetime.now(timezone.utc).isoformat(),
                     "error_message": str(exc)[:2000]},
                )
            return 0

    def _discover(self, account: dict, job: dict | None) -> int:
        contacts = self.repo.contacts_for_account(int(account["id"]))
        known_email_domains = sorted({
            email.rsplit("@", 1)[1].lower()
            for contact in contacts
            if "@" in (email := str(contact.get("email") or "").strip())
        })
        account_context = {
            **account,
            "known_email_domains": known_email_domains,
        }
        results = self.search.search_account(account_context)
        grouped: dict[str, list[tuple[dict, SearchResult, str]]] = defaultdict(list)
        for result in results:
            page_text = self.fetcher.fetch_text(result.url)
            if not page_text:
                LOGGER.info("Skipped unavailable/disallowed page url=%s", result.url)
                continue
            for person in self.extractor.extract(account_context, result, page_text):
                role_family = classify_role(person["title"])
                company_score = company_match_score(
                    account["name"],
                    person["company_name"],
                    result.url,
                    account=account_context,
                    evidence_text=" ".join(
                        (result.title, result.snippet, person["evidence_excerpt"], page_text)
                    ),
                )
                if role_family is None or company_score < 0.6:
                    continue
                fingerprint = identity_fingerprint(
                    account["id"], person["first_name"], person["last_name"],
                )
                grouped[fingerprint].append((person, result, page_text))

        count = 0
        now = datetime.now(timezone.utc).isoformat()
        for fingerprint, observations in grouped.items():
            person, _, _ = observations[0]
            sources_by_url = {
                result.url: (item, result, page_text)
                for item, result, page_text in observations
            }
            email, email_status, pattern, samples, email_confidence = self._email(
                person, contacts, account,
            )
            authority = max(
                source_authority(result.url, account.get("website"))
                for _, result, _ in observations
            )
            company_score = max(
                company_match_score(
                    account["name"],
                    item["company_name"],
                    result.url,
                    account=account_context,
                    evidence_text=" ".join(
                        (result.title, result.snippet, item["evidence_excerpt"], page_text)
                    ),
                )
                for item, result, page_text in observations
            )
            recency = max(
                recency_score(item.get("source_date"))
                for item, _, _ in observations
            )
            confidence, reasons = calculate_confidence(
                authority, company_score, role_match_score(person["title"]),
                recency, len(sources_by_url),
            )
            profile_url = person.get("profile_url")
            if profile_url and "linkedin.com" in profile_url.lower():
                profile_url = None
            candidate = {
                "user_id": account["user_id"],
                "account_id": account["id"],
                "scan_job_id": job["id"] if job else None,
                "identity_fingerprint": fingerprint,
                "first_name": person["first_name"].strip(),
                "last_name": person["last_name"].strip(),
                "title": person["title"].strip(),
                "role_family": classify_role(person["title"]),
                "location": person.get("location") or None,
                "phone": person.get("phone") or None,
                "profile_url": profile_url,
                "email_address": email,
                "email_status": email_status,
                "email_pattern": pattern,
                "email_pattern_samples": samples,
                "email_confidence": email_confidence,
                "confidence": confidence,
                "confidence_reasons": reasons,
                "last_observed_at": now,
            }
            sources = [
                {
                    "source_url": result.url,
                    "source_title": result.title or None,
                    "source_type": "web",
                    "evidence_excerpt": item["evidence_excerpt"][:4000],
                    "observed_at": item["observed_at"],
                }
                for item, result, _ in sources_by_url.values()
            ]
            if self.dry_run:
                LOGGER.info(
                    "Dry-run candidate account_id=%s name=%s %s confidence=%.4f sources=%d",
                    account["id"], person["first_name"], person["last_name"],
                    confidence, len(sources),
                )
            else:
                _, suppressed = self.repo.save_candidate(candidate, sources)
                if suppressed:
                    LOGGER.info("Preserved rejected candidate fingerprint=%s", fingerprint)
                else:
                    count += 1
        return len(grouped) if self.dry_run else count

    @staticmethod
    def _email(person: dict, contacts: list[dict], account: dict) -> tuple:
        public_email = str(person.get("public_email") or "").strip().lower()
        if public_email and EMAIL_RE.fullmatch(public_email):
            domain = public_email.rsplit("@", 1)[1]
            if has_mail_dns(domain):
                return public_email, "public", None, 0, 1.0
        website_host = hostname(account.get("website"))
        inference = infer_email_pattern(
            person["first_name"], person["last_name"], contacts,
            website_host or None,
        )
        if inference.email and has_mail_dns(inference.email.rsplit("@", 1)[1]):
            return (
                inference.email, "inferred", inference.pattern,
                inference.sample_count, inference.confidence,
            )
        return None, "unavailable", inference.pattern, inference.sample_count, inference.confidence


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run Constellation-V Pathfinder discovery")
    parser.add_argument("--dry-run", action="store_true", help="Discover without database writes")
    parser.add_argument("--limit", type=int, help="Maximum accounts to scan")
    parser.add_argument(
        "--account-id", action="append", type=int, default=[],
        help="Scan a specific account; may be repeated",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.limit is not None and args.limit <= 0:
        raise SystemExit("--limit must be positive")
    config = Config.from_env()
    logging.basicConfig(
        level=getattr(logging, config.log_level, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    repo = SupabaseRepository(
        config.supabase_url, config.supabase_service_role_key, config.request_timeout,
    )
    if not repo.pathfinder_enabled() and not args.account_id:
        LOGGER.info("Pathfinder is disabled in org_settings")
        return 0
    work = select_work(repo, args.account_id, args.limit)
    LOGGER.info("Selected %d account(s) dry_run=%s", len(work), args.dry_run)
    worker = PathfinderWorker(
        config,
        repo,
        GoogleSearch(config.google_cse_api_key, config.google_cse_id, config.request_timeout),
        PublicPageFetcher(config.user_agent, config.request_timeout, config.max_page_bytes),
        GeminiExtractor(config.gemini_api_key, config.gemini_model, config.request_timeout),
        dry_run=args.dry_run,
    )
    total = 0
    for account, job in work:
        LOGGER.info("Scanning account_id=%s name=%s", account["id"], account["name"])
        total += worker.run_account(account, job)
    LOGGER.info("Pathfinder finished accounts=%d candidates=%d", len(work), total)
    return 0
