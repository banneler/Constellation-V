"""Small JSON HTTP client built on urllib."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any


class HttpError(RuntimeError):
    def __init__(self, status: int, message: str, body: str = ""):
        super().__init__(f"HTTP {status}: {message}")
        self.status = status
        self.body = body


def request_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: Any = None,
    timeout: int = 15,
) -> tuple[Any, dict[str, str]]:
    payload = None if body is None else json.dumps(body, separators=(",", ":")).encode()
    request_headers = {"Accept": "application/json", **(headers or {})}
    if payload is not None:
        request_headers.setdefault("Content-Type", "application/json")
    request = urllib.request.Request(
        url, data=payload, headers=request_headers, method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
            parsed = json.loads(raw) if raw else None
            return parsed, dict(response.headers.items())
    except urllib.error.HTTPError as exc:
        body_text = exc.read(16_384).decode("utf-8", "replace")
        raise HttpError(exc.code, exc.reason, body_text) from exc
