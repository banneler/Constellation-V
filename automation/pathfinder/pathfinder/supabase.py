"""Supabase PostgREST repository for Pathfinder."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote, urlencode

from .http import request_json


class SupabaseRepository:
    def __init__(self, url: str, service_key: str, timeout: int = 15):
        self.base_url = f"{url.rstrip('/')}/rest/v1"
        self.timeout = timeout
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
        }

    def _request(
        self,
        table: str,
        *,
        method: str = "GET",
        params: list[tuple[str, str]] | None = None,
        body: Any = None,
        prefer: str | None = None,
    ) -> Any:
        url = f"{self.base_url}/{quote(table, safe='')}"
        if params:
            url += "?" + urlencode(params, safe="(),.*:")
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        result, _ = request_json(
            url, method=method, headers=headers, body=body, timeout=self.timeout,
        )
        return result

    def pathfinder_enabled(self) -> bool:
        rows = self._request(
            "org_settings",
            params=[("select", "pathfinder_enabled"), ("id", "eq.1"), ("limit", "1")],
        )
        return bool(rows and rows[0].get("pathfinder_enabled"))

    def active_owner_ids(self) -> list[str]:
        rows = self._request(
            "user_quotas",
            params=[("select", "user_id"), ("deactivated_at", "is.null")],
        )
        return sorted({row["user_id"] for row in rows if row.get("user_id")})

    def accounts_for_owners(
        self, owner_ids: list[str], account_ids: list[int] | None = None,
    ) -> list[dict]:
        if not owner_ids:
            return []
        params = [
            (
                "select",
                "id,user_id,name,website,industry,phone,address,"
                "quantity_of_sites,employee_count",
            ),
            ("user_id", f"in.({','.join(owner_ids)})"),
            ("order", "name.asc"),
        ]
        if account_ids:
            params.append(("id", f"in.({','.join(map(str, account_ids))})"))
        return self._request("accounts", params=params)

    def queued_manual_jobs(self, account_ids: list[int] | None = None) -> list[dict]:
        params = [
            ("select", "*"), ("status", "eq.queued"), ("trigger", "eq.manual"),
            ("order", "created_at.asc"),
        ]
        if account_ids:
            params.append(("account_id", f"in.({','.join(map(str, account_ids))})"))
        return self._request("pathfinder_scan_jobs", params=params)

    def recently_completed_account_ids(self, days: int = 7) -> set[int]:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        rows = self._request(
            "pathfinder_scan_jobs",
            params=[
                ("select", "account_id"), ("status", "eq.completed"),
                ("completed_at", f"gte.{cutoff}"),
            ],
        )
        return {int(row["account_id"]) for row in rows}

    def create_scheduled_job(self, account: dict) -> dict:
        rows = self._request(
            "pathfinder_scan_jobs",
            method="POST",
            body={
                "user_id": account["user_id"], "account_id": account["id"],
                "trigger": "scheduled", "status": "queued",
            },
            prefer="return=representation",
        )
        return rows[0]

    def update_job(self, job_id: str, values: dict) -> None:
        self._request(
            "pathfinder_scan_jobs", method="PATCH", body=values,
            params=[("id", f"eq.{job_id}")], prefer="return=minimal",
        )

    def contacts_for_account(self, account_id: int) -> list[dict]:
        return self._request(
            "contacts",
            params=[
                ("select", "first_name,last_name,email"),
                ("account_id", f"eq.{account_id}"),
            ],
        )

    def candidate_by_fingerprint(self, account_id: int, fingerprint: str) -> dict | None:
        rows = self._request(
            "pathfinder_candidates",
            params=[
                ("select", "*"), ("account_id", f"eq.{account_id}"),
                ("identity_fingerprint", f"eq.{fingerprint}"), ("limit", "1"),
            ],
        )
        return rows[0] if rows else None

    def save_candidate(self, candidate: dict, sources: list[dict]) -> tuple[dict, bool]:
        """Upsert mutable discoveries while preserving explicit rejection decisions."""
        existing = self.candidate_by_fingerprint(
            int(candidate["account_id"]), candidate["identity_fingerprint"],
        )
        if existing and existing.get("status") == "rejected":
            return existing, True
        if existing:
            mutable = dict(candidate)
            mutable.pop("id", None)
            mutable.pop("status", None)
            rows = self._request(
                "pathfinder_candidates", method="PATCH", body=mutable,
                params=[("id", f"eq.{existing['id']}")],
                prefer="return=representation",
            )
            saved = rows[0]
        else:
            rows = self._request(
                "pathfinder_candidates", method="POST", body=candidate,
                prefer="return=representation",
            )
            saved = rows[0]
        for source in sources:
            payload = {**source, "candidate_id": saved["id"]}
            self._request(
                "pathfinder_candidate_sources", method="POST", body=payload,
                params=[("on_conflict", "candidate_id,source_url")],
                prefer="resolution=merge-duplicates,return=minimal",
            )
        return saved, False
