"""Web Push (VAPID) - yalnızca standart kütüphane.

Bildirim gövdesi şifrelenmez; içerik taşımayan bir "uyandırma" push'u gönderilir.
Servis çalışanı push'u alınca son bildirimi /api/notifications üzerinden okuyup
gösterir. Böylece AES/ECDH şifrelemesine gerek kalmaz, yalnızca VAPID için
P-256 ECDSA imzası gerekir.
"""

from __future__ import annotations

import base64
import hashlib
import json
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request

# --- P-256 (secp256r1) ---
P = 0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF
A = P - 3
B = 0x5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B
GX = 0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296
GY = 0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5
N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551

Point = tuple[int, int] | None


def _inv(value: int, mod: int = P) -> int:
    return pow(value, mod - 2, mod)


def _add(p1: Point, p2: Point) -> Point:
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    x1, y1 = p1
    x2, y2 = p2
    if x1 == x2 and (y1 + y2) % P == 0:
        return None
    if p1 == p2:
        lam = (3 * x1 * x1 + A) * _inv(2 * y1) % P
    else:
        lam = (y2 - y1) * _inv(x2 - x1) % P
    x3 = (lam * lam - x1 - x2) % P
    y3 = (lam * (x1 - x3) - y1) % P
    return (x3, y3)


def _mul(k: int, point: Point) -> Point:
    result: Point = None
    addend = point
    while k:
        if k & 1:
            result = _add(result, addend)
        addend = _add(addend, addend)
        k >>= 1
    return result


def on_curve(point: Point) -> bool:
    if point is None:
        return False
    x, y = point
    return (y * y - (x * x * x + A * x + B)) % P == 0


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def unb64(text: str) -> bytes:
    pad = "=" * ((4 - len(text) % 4) % 4)
    return base64.urlsafe_b64decode(text + pad)


def generate_keys() -> tuple[str, str]:
    """Yeni VAPID anahtar çifti: (özel, açık) - ikisi de base64url."""
    private = secrets.randbelow(N - 1) + 1
    public = _mul(private, (GX, GY))
    raw = b"\x04" + public[0].to_bytes(32, "big") + public[1].to_bytes(32, "big")
    return b64(private.to_bytes(32, "big")), b64(raw)


def sign(digest: bytes, private_b64: str) -> bytes:
    """ES256 imzası: r || s (64 bayt)."""
    d = int.from_bytes(unb64(private_b64), "big")
    z = int.from_bytes(digest, "big")
    while True:
        k = secrets.randbelow(N - 1) + 1
        point = _mul(k, (GX, GY))
        r = point[0] % N
        if r == 0:
            continue
        s = (pow(k, -1, N) * (z + r * d)) % N
        if s == 0:
            continue
        return r.to_bytes(32, "big") + s.to_bytes(32, "big")


def verify(digest: bytes, signature: bytes, public_b64: str) -> bool:
    """Kendi imzamızı doğrulamak için (testte kullanılır)."""
    raw = unb64(public_b64)
    if len(raw) != 65 or raw[0] != 4:
        return False
    q = (int.from_bytes(raw[1:33], "big"), int.from_bytes(raw[33:], "big"))
    r = int.from_bytes(signature[:32], "big")
    s = int.from_bytes(signature[32:], "big")
    if not (1 <= r < N and 1 <= s < N):
        return False
    z = int.from_bytes(digest, "big")
    w = pow(s, -1, N)
    point = _add(_mul(z * w % N, (GX, GY)), _mul(r * w % N, q))
    return point is not None and point[0] % N == r


_jwt_cache: dict[str, tuple[float, str]] = {}


def vapid_header(endpoint: str, subject: str, private_b64: str, public_b64: str) -> str:
    """RFC 8292 Authorization başlığı; her hedef için 11 saat önbelleklenir."""
    parts = urllib.parse.urlsplit(endpoint)
    audience = f"{parts.scheme}://{parts.netloc}"
    cached = _jwt_cache.get(audience)
    if cached and cached[0] > time.time():
        token = cached[1]
    else:
        expires = int(time.time()) + 12 * 60 * 60
        header = b64(json.dumps({"typ": "JWT", "alg": "ES256"}, separators=(",", ":")).encode())
        payload = b64(json.dumps({"aud": audience, "exp": expires, "sub": subject}, separators=(",", ":")).encode())
        signing_input = f"{header}.{payload}".encode("ascii")
        signature = sign(hashlib.sha256(signing_input).digest(), private_b64)
        token = f"{header}.{payload}.{b64(signature)}"
        _jwt_cache[audience] = (time.time() + 11 * 60 * 60, token)
    return f"vapid t={token}, k={public_b64}"


def send(endpoint: str, subject: str, private_b64: str, public_b64: str, ttl: int = 86400, timeout: float = 10.0) -> int:
    """İçeriksiz push gönderir. 201/200 başarılı; 404/410 abonelik ölmüş demektir."""
    request = urllib.request.Request(endpoint, data=b"", method="POST")
    request.add_header("TTL", str(ttl))
    request.add_header("Content-Length", "0")
    request.add_header("Urgency", "normal")
    request.add_header("Authorization", vapid_header(endpoint, subject, private_b64, public_b64))
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code
    except Exception:
        return 0
