"""Environment configuration with validation and no third-party dependency."""

from __future__ import annotations

import os
from dataclasses import dataclass


def _positive_int(name: str, default: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value <= 0:
        raise ValueError(f"{name} must be positive")
    return value


@dataclass(frozen=True)
class Config:
    supabase_url: str
    supabase_service_role_key: str
    google_cse_api_key: str
    google_cse_id: str
    gemini_api_key: str
    gemini_model: str
    request_timeout: int
    max_page_bytes: int
    user_agent: str
    log_level: str

    @classmethod
    def from_env(cls) -> "Config":
        required = {
            "SUPABASE_URL": os.getenv("SUPABASE_URL", "").rstrip("/"),
            "SUPABASE_SERVICE_ROLE_KEY": os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
            "GOOGLE_CSE_API_KEY": os.getenv("GOOGLE_CSE_API_KEY", ""),
            "GOOGLE_CSE_ID": os.getenv("GOOGLE_CSE_ID", ""),
            "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY", ""),
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise ValueError("Missing required environment variables: " + ", ".join(missing))
        return cls(
            supabase_url=required["SUPABASE_URL"],
            supabase_service_role_key=required["SUPABASE_SERVICE_ROLE_KEY"],
            google_cse_api_key=required["GOOGLE_CSE_API_KEY"],
            google_cse_id=required["GOOGLE_CSE_ID"],
            gemini_api_key=required["GEMINI_API_KEY"],
            gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            request_timeout=_positive_int("PATHFINDER_REQUEST_TIMEOUT", 15),
            max_page_bytes=_positive_int("PATHFINDER_MAX_PAGE_BYTES", 1_500_000),
            user_agent=os.getenv(
                "PATHFINDER_USER_AGENT",
                "ConstellationV-Pathfinder/1.0 (+mailto:admin@example.com)",
            ),
            log_level=os.getenv("PATHFINDER_LOG_LEVEL", "INFO").upper(),
        )
