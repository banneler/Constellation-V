from __future__ import annotations

import unittest
from datetime import datetime, timezone

from pathfinder.logic import (
    calculate_confidence,
    classify_role,
    company_match_score,
    evidence_fingerprint,
    identity_fingerprint,
    infer_email_pattern,
    source_authority,
)


class AccountDisambiguationTests(unittest.TestCase):
    def test_exact_company_ignores_legal_suffix(self):
        self.assertEqual(company_match_score("Acme Corporation", "ACME, Inc."), 1.0)

    def test_unrelated_company_is_rejected(self):
        self.assertEqual(company_match_score("Acme Networks", "Globex Systems"), 0.0)

    def test_company_domain_can_disambiguate(self):
        self.assertGreaterEqual(
            company_match_score("Acme Networks", "Acme", "https://acme-networks.com/team"),
            0.5,
        )


class RoleClassificationTests(unittest.TestCase):
    def test_technology_role(self):
        self.assertEqual(classify_role("VP, Information Technology"), "technology")

    def test_network_role_takes_specific_precedence(self):
        self.assertEqual(classify_role("Director of IT Network Infrastructure"), "network")

    def test_non_target_role(self):
        self.assertIsNone(classify_role("Chief Financial Officer"))

    def test_network_abbreviation_does_not_match_inside_word(self):
        self.assertIsNone(classify_role("Director of Strategic Planning"))


class ConfidenceTests(unittest.TestCase):
    def test_confidence_is_deterministic_weighted_score(self):
        score, reasons = calculate_confidence(1.0, 1.0, 1.0, 1.0, 3)
        self.assertEqual(score, 1.0)
        self.assertEqual(len(reasons), 5)

    def test_more_corroboration_increases_score(self):
        one, _ = calculate_confidence(0.5, 0.8, 1.0, 0.5, 1)
        three, _ = calculate_confidence(0.5, 0.8, 1.0, 0.5, 3)
        self.assertGreater(three, one)

    def test_company_site_authority_accepts_bare_domain(self):
        self.assertEqual(source_authority("https://www.acme.com/team", "acme.com"), 1.0)


class EmailPatternTests(unittest.TestCase):
    CONTACTS = [
        {"first_name": "Jane", "last_name": "Doe", "email": "jane.doe@acme.com"},
        {"first_name": "Sam", "last_name": "Hill", "email": "sam.hill@acme.com"},
        {"first_name": "Out", "last_name": "Side", "email": "outside@other.com"},
    ]

    def test_infers_dominant_pattern_from_same_domain(self):
        result = infer_email_pattern("Pat", "Lee", self.CONTACTS, "acme.com")
        self.assertEqual(result.email, "pat.lee@acme.com")
        self.assertEqual(result.pattern, "{first}.{last}")
        self.assertEqual(result.sample_count, 2)
        self.assertEqual(result.confidence, 1.0)

    def test_requires_two_supporting_samples(self):
        result = infer_email_pattern("Pat", "Lee", self.CONTACTS[:1], "acme.com")
        self.assertIsNone(result.email)
        self.assertEqual(result.sample_count, 1)


class FingerprintTests(unittest.TestCase):
    def test_identity_is_stable_across_case_and_accents(self):
        first = identity_fingerprint(42, "José", "O'Neil")
        second = identity_fingerprint("42", "jose", "o neil")
        self.assertEqual(first, second)

    def test_fingerprint_changes_by_account(self):
        self.assertNotEqual(
            identity_fingerprint(1, "Jane", "Doe"),
            identity_fingerprint(2, "Jane", "Doe"),
        )

    def test_evidence_url_normalization_is_stable(self):
        candidate = identity_fingerprint(1, "Jane", "Doe")
        self.assertEqual(
            evidence_fingerprint(candidate, "HTTPS://EXAMPLE.COM/Page/"),
            evidence_fingerprint(candidate, "https://example.com/page"),
        )


if __name__ == "__main__":
    unittest.main()
