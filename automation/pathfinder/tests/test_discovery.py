from __future__ import annotations

import unittest

from pathfinder.discovery import account_identity_lines, build_search_query


class AccountContextTests(unittest.TestCase):
    ACCOUNT = {
        "name": "AGP",
        "website": "www.agp.com",
        "industry": "Automotive glass manufacturing",
        "address": "2200 Glades Road, Boca Raton, Florida",
        "phone": "555-010-2000",
        "known_email_domains": ["agp.com"],
    }

    def test_search_query_uses_available_identity_context(self):
        query = build_search_query(self.ACCOUNT)
        for expected in (
            '"AGP"',
            '"agp.com"',
            '"Automotive glass manufacturing"',
            '"2200 Glades Road, Boca Raton, Florida"',
            '"555-010-2000"',
        ):
            self.assertIn(expected, query)

    def test_extraction_identity_includes_known_crm_context(self):
        identity = "\n".join(account_identity_lines(self.ACCOUNT))
        self.assertIn("Website: www.agp.com", identity)
        self.assertIn("Industry: Automotive glass manufacturing", identity)
        self.assertIn("Address: 2200 Glades Road, Boca Raton, Florida", identity)
        self.assertIn("Phone: 555-010-2000", identity)
        self.assertIn("Known email domains: agp.com", identity)


if __name__ == "__main__":
    unittest.main()
