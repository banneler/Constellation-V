"""Google discovery, safe public-page fetching, and Gemini extraction."""

from __future__ import annotations

import gzip
import html
import json
import re
import socket
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from dataclasses import dataclass
from datetime import datetime, timezone
from ipaddress import ip_address

from .http import request_json


BLOCKED_HOST_MARKERS = ("linkedin.com", "facebook.com", "instagram.com")
BLOCKED_PATH_MARKERS = ("login", "signin", "captcha", "auth", "subscribe")


@dataclass(frozen=True)
class SearchResult:
    url: str
    title: str
    snippet: str


def is_public_fetch_candidate(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    host = (parsed.hostname or "").lower()
    path = parsed.path.lower()
    if parsed.scheme not in ("http", "https") or not host:
        return False
    if any(marker in host for marker in BLOCKED_HOST_MARKERS):
        return False
    if any(f"/{marker}" in path for marker in BLOCKED_PATH_MARKERS):
        return False
    try:
        address = ip_address(socket.gethostbyname(host))
        if address.is_private or address.is_loopback or address.is_link_local:
            return False
    except (OSError, ValueError):
        return False
    return True


class GoogleSearch:
    def __init__(self, api_key: str, cse_id: str, timeout: int):
        self.api_key = api_key
        self.cse_id = cse_id
        self.timeout = timeout

    def search_account(self, account: dict, max_results: int = 10) -> list[SearchResult]:
        roles = (
            '("CIO" OR "CTO" OR "IT Director" OR "Technology Director" OR '
            '"Network Director" OR "Network Manager" OR "Infrastructure Director")'
        )
        query = f'"{account["name"]}" {roles} -site:linkedin.com'
        params = urllib.parse.urlencode({
            "key": self.api_key, "cx": self.cse_id, "q": query,
            "num": min(10, max_results),
        })
        data, _ = request_json(
            f"https://www.googleapis.com/customsearch/v1?{params}",
            timeout=self.timeout,
        )
        return [
            SearchResult(item["link"], item.get("title", ""), item.get("snippet", ""))
            for item in data.get("items", [])
            if is_public_fetch_candidate(item.get("link", ""))
        ]


class PublicPageFetcher:
    def __init__(self, user_agent: str, timeout: int, max_bytes: int):
        self.user_agent = user_agent
        self.timeout = timeout
        self.max_bytes = max_bytes
        self._robots: dict[str, urllib.robotparser.RobotFileParser] = {}

    def _allowed(self, url: str) -> bool:
        parsed = urllib.parse.urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if origin not in self._robots:
            parser = urllib.robotparser.RobotFileParser(f"{origin}/robots.txt")
            try:
                request = urllib.request.Request(
                    f"{origin}/robots.txt", headers={"User-Agent": self.user_agent},
                )
                with urllib.request.urlopen(request, timeout=self.timeout) as response:
                    if not is_public_fetch_candidate(response.geturl()):
                        return False
                    raw = response.read(256_001)
                    if len(raw) > 256_000:
                        return False
                    charset = response.headers.get_content_charset() or "utf-8"
                    parser.parse(raw.decode(charset, "replace").splitlines())
            except (OSError, urllib.error.URLError):
                return False  # Fail closed when robots policy cannot be obtained.
            self._robots[origin] = parser
        return self._robots[origin].can_fetch(self.user_agent, url)

    def fetch_text(self, url: str) -> str | None:
        if not is_public_fetch_candidate(url) or not self._allowed(url):
            return None
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": self.user_agent,
                "Accept": "text/html,application/xhtml+xml,text/plain",
                "Accept-Encoding": "gzip",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                if not is_public_fetch_candidate(response.geturl()):
                    return None
                content_type = response.headers.get_content_type()
                if content_type not in ("text/html", "application/xhtml+xml", "text/plain"):
                    return None
                raw = response.read(self.max_bytes + 1)
                if len(raw) > self.max_bytes:
                    return None
                if response.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
                    if len(raw) > self.max_bytes:
                        return None
                charset = response.headers.get_content_charset() or "utf-8"
                text = raw.decode(charset, "replace")
        except (OSError, urllib.error.URLError, gzip.BadGzipFile):
            return None
        lowered = text.lower()
        if "captcha" in lowered or "access denied" in lowered:
            return None
        text = re.sub(r"(?is)<(script|style|noscript).*?>.*?</\1>", " ", text)
        text = re.sub(r"(?s)<[^>]+>", " ", text)
        return re.sub(r"\s+", " ", html.unescape(text)).strip()[:100_000]


EXTRACTION_SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "first_name": {"type": "STRING"},
            "last_name": {"type": "STRING"},
            "title": {"type": "STRING"},
            "company_name": {"type": "STRING"},
            "location": {"type": ["STRING", "NULL"]},
            "phone": {"type": ["STRING", "NULL"]},
            "profile_url": {"type": ["STRING", "NULL"]},
            "public_email": {"type": ["STRING", "NULL"]},
            "evidence_excerpt": {"type": "STRING"},
            "source_date": {"type": ["STRING", "NULL"]},
        },
        "required": [
            "first_name", "last_name", "title", "company_name", "location",
            "phone", "profile_url", "public_email", "evidence_excerpt", "source_date",
        ],
    },
}


class GeminiExtractor:
    def __init__(self, api_key: str, model: str, timeout: int):
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def extract(self, account_name: str, source: SearchResult, page_text: str) -> list[dict]:
        prompt = (
            "Extract only people explicitly shown as current employees of the target "
            "company in technology, IT, infrastructure, telecom, or network roles. "
            "Do not guess facts. Return [] if company identity or current role is ambiguous.\n"
            f"TARGET COMPANY: {account_name}\nSOURCE URL: {source.url}\n"
            f"SOURCE TITLE: {source.title}\nSEARCH SNIPPET: {source.snippet}\n"
            f"PAGE TEXT:\n{page_text}"
        )
        endpoint = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{urllib.parse.quote(self.model, safe='')}:generateContent?"
            + urllib.parse.urlencode({"key": self.api_key})
        )
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0,
                "responseMimeType": "application/json",
                "responseJsonSchema": EXTRACTION_SCHEMA,
            },
        }
        data, _ = request_json(endpoint, method="POST", body=body, timeout=self.timeout)
        candidates = data.get("candidates") or []
        if not candidates:
            return []
        text = candidates[0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
        if not isinstance(parsed, list):
            raise ValueError("Gemini extraction was not a JSON array")
        required = set(EXTRACTION_SCHEMA["items"]["required"])
        clean = []
        for item in parsed:
            if not isinstance(item, dict) or set(item) != required:
                raise ValueError("Gemini extraction did not match strict schema")
            if not all(isinstance(item[key], str) and item[key].strip() for key in (
                "first_name", "last_name", "title", "company_name", "evidence_excerpt",
            )):
                continue
            item["observed_at"] = datetime.now(timezone.utc).isoformat()
            clean.append(item)
        return clean
