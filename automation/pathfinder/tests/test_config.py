from __future__ import annotations

import os
import unittest

from pathfinder.config import Config, gemini_model_from_env


REQUIRED_ENV = {
    "SUPABASE_URL": "https://example.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "service",
    "GOOGLE_CSE_API_KEY": "cse",
    "GOOGLE_CSE_ID": "cx",
    "GEMINI_API_KEY": "gemini",
}


class GeminiModelTests(unittest.TestCase):
    def setUp(self):
        self._saved = os.environ.copy()
        os.environ.update(REQUIRED_ENV)
        os.environ.pop("GEMINI_MODEL", None)

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self._saved)

    def test_default_model_matches_shared_stock_model(self):
        self.assertEqual(gemini_model_from_env(), "gemini-3.7-flash")
        self.assertEqual(Config.from_env().gemini_model, "gemini-3.7-flash")

    def test_retired_model_override_uses_stock_model(self):
        os.environ["GEMINI_MODEL"] = ".".join(["gemini-2", "5-flash"])
        self.assertEqual(Config.from_env().gemini_model, "gemini-3.7-flash")

    def test_current_model_override_is_preserved(self):
        os.environ["GEMINI_MODEL"] = "gemini-3.7-flash"
        self.assertEqual(Config.from_env().gemini_model, "gemini-3.7-flash")


if __name__ == "__main__":
    unittest.main()
