"""Minimal DNS sanity checks; never probes individual mailboxes."""

from __future__ import annotations

import random
import socket
import struct


def _encode_name(name: str) -> bytes:
    return b"".join(bytes([len(part)]) + part.encode("idna") for part in name.split(".")) + b"\0"


def _skip_name(packet: bytes, offset: int) -> int:
    while offset < len(packet):
        length = packet[offset]
        if length & 0xC0 == 0xC0:
            return offset + 2
        offset += 1
        if length == 0:
            return offset
        offset += length
    raise ValueError("Malformed DNS name")


def has_mail_dns(domain: str, timeout: float = 2.0) -> bool:
    """Return true for an MX record, with A/AAAA as RFC-compatible fallback."""
    domain = domain.strip().lower().rstrip(".")
    if not domain or "." not in domain:
        return False
    transaction_id = random.SystemRandom().randrange(0, 65536)
    packet = struct.pack("!HHHHHH", transaction_id, 0x0100, 1, 0, 0, 0)
    packet += _encode_name(domain) + struct.pack("!HH", 15, 1)
    resolver = "8.8.8.8"
    try:
        with open("/etc/resolv.conf", encoding="utf-8") as resolv:
            for line in resolv:
                if line.startswith("nameserver "):
                    resolver = line.split()[1]
                    break
    except OSError:
        pass
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.settimeout(timeout)
            sock.sendto(packet, (resolver, 53))
            response, _ = sock.recvfrom(4096)
        if len(response) < 12:
            return False
        response_id, flags, qdcount, ancount, _, _ = struct.unpack("!HHHHHH", response[:12])
        if response_id != transaction_id or flags & 0x000F:
            return False
        offset = 12
        for _ in range(qdcount):
            offset = _skip_name(response, offset) + 4
        for _ in range(ancount):
            offset = _skip_name(response, offset)
            record_type, _, _, data_length = struct.unpack("!HHIH", response[offset:offset + 10])
            offset += 10
            if record_type == 15 and data_length > 2:
                return True
            offset += data_length
    except (OSError, ValueError, struct.error):
        pass
    try:
        return bool(socket.getaddrinfo(domain, 25, type=socket.SOCK_STREAM))
    except OSError:
        return False
