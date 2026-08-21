from __future__ import annotations

import unittest

from pathfinder.supabase import SupabaseRepository


class FakeRepository(SupabaseRepository):
    def __init__(self, existing=None):
        self.existing = existing
        self.calls = []

    def candidate_by_fingerprint(self, account_id, fingerprint):
        return self.existing

    def _request(self, table, **kwargs):
        self.calls.append((table, kwargs))
        if table == "pathfinder_candidates":
            if kwargs["method"] == "PATCH":
                return [{**self.existing, **kwargs["body"]}]
            return [{"id": "new-id", **kwargs["body"]}]
        return None


def candidate():
    return {
        "account_id": 10,
        "identity_fingerprint": "stable",
        "first_name": "Jane",
        "last_name": "Doe",
        "title": "IT Director",
        "status": "pending",
    }


class CandidatePersistenceTests(unittest.TestCase):
    def test_rejected_candidate_is_suppressed_without_writes(self):
        existing = {"id": "old-id", "account_id": 10, "status": "rejected"}
        repo = FakeRepository(existing)
        saved, suppressed = repo.save_candidate(candidate(), [{"source_url": "https://x.test"}])
        self.assertTrue(suppressed)
        self.assertEqual(saved, existing)
        self.assertEqual(repo.calls, [])

    def test_upsert_does_not_overwrite_existing_review_status(self):
        existing = {"id": "old-id", "account_id": 10, "status": "approved"}
        repo = FakeRepository(existing)
        saved, suppressed = repo.save_candidate(
            candidate(),
            [{"source_url": "https://example.com/team", "evidence_excerpt": "Jane is IT Director"}],
        )
        self.assertFalse(suppressed)
        candidate_call = repo.calls[0]
        self.assertEqual(candidate_call[1]["method"], "PATCH")
        self.assertNotIn("status", candidate_call[1]["body"])
        self.assertEqual(saved["status"], "approved")
        self.assertEqual(repo.calls[1][0], "pathfinder_candidate_sources")

    def test_new_candidate_and_evidence_are_inserted(self):
        repo = FakeRepository()
        saved, suppressed = repo.save_candidate(
            candidate(),
            [{"source_url": "https://example.com/team", "evidence_excerpt": "Evidence"}],
        )
        self.assertFalse(suppressed)
        self.assertEqual(saved["id"], "new-id")
        self.assertEqual(repo.calls[0][1]["method"], "POST")
        self.assertEqual(repo.calls[1][1]["body"]["candidate_id"], "new-id")


if __name__ == "__main__":
    unittest.main()
