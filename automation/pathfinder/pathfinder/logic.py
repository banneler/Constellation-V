"""Deterministic, side-effect-free Pathfinder decision logic."""

from __future__ import annotations

import hashlib
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlparse


TECHNOLOGY_TERMS = {
    "cio", "cto", "chief information officer", "chief technology officer",
    "information technology", "it director", "it manager", "technology director",
    "technology manager", "head of technology", "head of it", "systems director",
    "infrastructure director", "digital transformation",
}
NETWORK_TERMS = {
    "network", "networking", "telecom", "telecommunications", "connectivity",
    "wan", "lan", "sd-wan", "voice", "unified communications",
}
ROLE_LEVEL_TERMS = {
    "chief", "cio", "cto", "vp", "vice president", "director", "head",
    "manager", "architect", "lead",
}
GENERIC_COMPANY_SUFFIXES = {
    "inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation",
    "company", "co", "group", "holdings", "plc",
}
GENERIC_ADDRESS_TERMS = {
    "street", "st", "road", "rd", "avenue", "ave", "drive", "dr", "lane",
    "ln", "boulevard", "blvd", "suite", "floor", "north", "south", "east",
    "west", "united", "states", "usa",
}


def normalize_text(value: str | None) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return " ".join(re.findall(r"[a-z0-9]+", value.lower()))


def company_tokens(value: str | None) -> set[str]:
    return {
        token for token in normalize_text(value).split()
        if len(token) > 1 and token not in GENERIC_COMPANY_SUFFIXES
    }


def hostname(value: str | None) -> str:
    raw = (value or "").strip()
    if raw and "://" not in raw:
        raw = "https://" + raw
    return (urlparse(raw).hostname or "").lower().removeprefix("www.")


def is_ambiguous_company_name(value: str | None) -> bool:
    """Return true for short, single-token names that commonly collide."""
    original_tokens = [
        token for token in re.findall(r"[A-Za-z0-9]+", value or "")
        if token.lower() not in GENERIC_COMPANY_SUFFIXES
    ]
    return (
        len(original_tokens) == 1
        and len(original_tokens[0]) <= 5
        and (
            original_tokens[0].isupper()
            or original_tokens[0].isdigit()
        )
    )


def _identity_anchors(
    account: dict,
    source_url: str,
    evidence_text: str,
) -> tuple[bool, int]:
    raw_evidence = (evidence_text or "").lower()
    normalized_evidence = normalize_text(evidence_text)
    source_host = hostname(source_url)
    company_host = hostname(account.get("website"))
    domain_match = bool(
        company_host
        and (
            source_host == company_host
            or source_host.endswith("." + company_host)
            or company_host in raw_evidence
        )
    )

    secondary_anchors = 0
    phone_digits = re.sub(r"\D", "", account.get("phone") or "")
    if len(phone_digits) >= 7 and phone_digits in re.sub(r"\D", "", evidence_text or ""):
        secondary_anchors += 1

    address_tokens = {
        token for token in company_tokens(account.get("address"))
        if len(token) >= 3 and token not in GENERIC_ADDRESS_TERMS
    }
    if address_tokens:
        matched_address = sum(
            1 for token in address_tokens
            if _contains_term(normalized_evidence, token)
        )
        if matched_address >= min(2, len(address_tokens)):
            secondary_anchors += 1

    industry_tokens = company_tokens(account.get("industry"))
    if industry_tokens:
        matched_industry = sum(
            1 for token in industry_tokens
            if _contains_term(normalized_evidence, token)
        )
        if matched_industry / len(industry_tokens) >= 0.6:
            secondary_anchors += 1

    return domain_match, secondary_anchors


def company_match_score(
    expected: str,
    observed: str,
    source_url: str = "",
    *,
    account: dict | None = None,
    evidence_text: str = "",
) -> float:
    """Score company identity using the CRM account and public-source context."""
    expected_tokens = company_tokens(expected)
    if not expected_tokens:
        return 0.0
    observed_tokens = company_tokens(observed)
    host_tokens = company_tokens(urlparse(source_url).hostname or "")
    overlap = len(expected_tokens & (observed_tokens | host_tokens)) / len(expected_tokens)
    exact = normalize_text(expected) == normalize_text(observed)

    if is_ambiguous_company_name(expected):
        if not expected_tokens.issubset(observed_tokens | host_tokens):
            return 0.0
        domain_match, secondary_anchors = _identity_anchors(
            account or {}, source_url, evidence_text,
        )
        if domain_match:
            return 1.0
        if secondary_anchors >= 2:
            return 0.8
        return 0.0

    return round(min(1.0, max(overlap, 1.0 if exact else 0.0)), 4)


def _contains_term(text: str, term: str) -> bool:
    return re.search(rf"(?:^|\s){re.escape(term)}(?:$|\s)", text) is not None


def classify_role(title: str) -> str | None:
    normalized = normalize_text(title)
    if not normalized:
        return None
    if any(_contains_term(normalized, normalize_text(term)) for term in NETWORK_TERMS):
        return "network"
    if any(_contains_term(normalized, normalize_text(term)) for term in TECHNOLOGY_TERMS):
        return "technology"
    return None


def role_match_score(title: str) -> float:
    normalized = normalize_text(title)
    if classify_role(title) is None:
        return 0.0
    return 1.0 if any(_contains_term(normalized, term) for term in ROLE_LEVEL_TERMS) else 0.65


def source_authority(url: str, company_website: str | None = None) -> float:
    host = hostname(url)
    company_host = hostname(company_website)
    if company_host and (host == company_host or host.endswith("." + company_host)):
        return 1.0
    if host.endswith(".gov") or host.endswith(".edu"):
        return 0.9
    if any(part in host for part in ("businesswire.com", "prnewswire.com", "reuters.com")):
        return 0.8
    return 0.55


def recency_score(observed_at: str | datetime | None, now: datetime | None = None) -> float:
    if not observed_at:
        return 0.35
    if isinstance(observed_at, str):
        try:
            observed_at = datetime.fromisoformat(observed_at.replace("Z", "+00:00"))
        except ValueError:
            return 0.35
    now = now or datetime.now(timezone.utc)
    if observed_at.tzinfo is None:
        observed_at = observed_at.replace(tzinfo=timezone.utc)
    days = max(0, (now - observed_at).days)
    if days <= 180:
        return 1.0
    if days <= 365:
        return 0.8
    if days <= 730:
        return 0.55
    return 0.3


def calculate_confidence(
    authority: float,
    company_match: float,
    role_match: float,
    recency: float,
    corroborating_sources: int,
) -> tuple[float, list[dict[str, float | int | str]]]:
    corroboration = min(1.0, max(0, corroborating_sources - 1) / 2)
    components = {
        "source_authority": max(0.0, min(1.0, authority)),
        "company_match": max(0.0, min(1.0, company_match)),
        "role_match": max(0.0, min(1.0, role_match)),
        "recency": max(0.0, min(1.0, recency)),
        "corroboration": corroboration,
    }
    weights = {
        "source_authority": 0.25, "company_match": 0.30, "role_match": 0.25,
        "recency": 0.10, "corroboration": 0.10,
    }
    score = round(sum(components[key] * weights[key] for key in components), 4)
    reasons = [
        {"factor": key, "score": round(value, 4), "weight": weights[key]}
        for key, value in components.items()
    ]
    return score, reasons


def _name_parts(first: str, last: str) -> dict[str, str]:
    first = re.sub(r"[^a-z0-9]", "", normalize_text(first).replace(" ", ""))
    last = re.sub(r"[^a-z0-9]", "", normalize_text(last).replace(" ", ""))
    return {
        "first": first, "last": last, "f": first[:1], "l": last[:1],
    }


EMAIL_PATTERNS = {
    "{first}.{last}": lambda p: f"{p['first']}.{p['last']}",
    "{first}{last}": lambda p: f"{p['first']}{p['last']}",
    "{f}{last}": lambda p: f"{p['f']}{p['last']}",
    "{first}{l}": lambda p: f"{p['first']}{p['l']}",
    "{first}_{last}": lambda p: f"{p['first']}_{p['last']}",
    "{last}.{first}": lambda p: f"{p['last']}.{p['first']}",
}


@dataclass(frozen=True)
class EmailInference:
    email: str | None
    pattern: str | None
    sample_count: int
    confidence: float | None


def infer_email_pattern(
    first_name: str,
    last_name: str,
    contacts: list[dict],
    allowed_domain: str | None = None,
) -> EmailInference:
    """Infer only from same-account name/email samples; no mailbox verification."""
    matches: Counter[tuple[str, str]] = Counter()
    samples = 0
    for contact in contacts:
        email = str(contact.get("email") or "").strip().lower()
        if "@" not in email:
            continue
        local, domain = email.rsplit("@", 1)
        if allowed_domain and domain != allowed_domain.lower():
            continue
        parts = _name_parts(str(contact.get("first_name") or ""), str(contact.get("last_name") or ""))
        if not parts["first"] or not parts["last"]:
            continue
        samples += 1
        for pattern, formatter in EMAIL_PATTERNS.items():
            if local == formatter(parts):
                matches[(pattern, domain)] += 1
                break
    if not matches:
        return EmailInference(None, None, samples, None)
    (pattern, domain), count = matches.most_common(1)[0]
    confidence = round(count / samples, 4) if samples else None
    if count < 2 or confidence is None or confidence < 0.6:
        return EmailInference(None, pattern, samples, confidence)
    target = EMAIL_PATTERNS[pattern](_name_parts(first_name, last_name))
    return EmailInference(f"{target}@{domain}", pattern, samples, confidence)


def identity_fingerprint(account_id: int | str, first_name: str, last_name: str) -> str:
    canonical = "|".join((str(account_id), normalize_text(first_name), normalize_text(last_name)))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def evidence_fingerprint(candidate_fingerprint: str, source_url: str) -> str:
    normalized_url = source_url.strip().lower().rstrip("/")
    return hashlib.sha256(f"{candidate_fingerprint}|{normalized_url}".encode("utf-8")).hexdigest()
