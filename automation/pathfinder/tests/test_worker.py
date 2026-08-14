from __future__ import annotations

import unittest

from pathfinder.worker import select_work


class SelectionRepository:
    def active_owner_ids(self):
        return ["active-owner"]

    def accounts_for_owners(self, owner_ids, account_ids=None):
        accounts = [
            {"id": 1, "user_id": "active-owner", "name": "Alpha"},
            {"id": 2, "user_id": "active-owner", "name": "Beta"},
            {"id": 3, "user_id": "active-owner", "name": "Gamma"},
        ]
        return [row for row in accounts if not account_ids or row["id"] in account_ids]

    def queued_manual_jobs(self, account_ids=None):
        jobs = [{"id": "manual-3", "account_id": 3, "status": "queued"}]
        return [row for row in jobs if not account_ids or row["account_id"] in account_ids]

    def recently_completed_account_ids(self, days=7):
        return {2}


class WorkSelectionTests(unittest.TestCase):
    def test_manual_jobs_are_first_and_recent_accounts_are_skipped(self):
        selected = select_work(SelectionRepository(), [], None)
        self.assertEqual([account["id"] for account, _ in selected], [3, 1])
        self.assertEqual(selected[0][1]["id"], "manual-3")

    def test_explicit_accounts_override_recent_gate_and_respect_limit(self):
        selected = select_work(SelectionRepository(), [2, 1], 1)
        self.assertEqual([account["id"] for account, _ in selected], [1])


if __name__ == "__main__":
    unittest.main()
