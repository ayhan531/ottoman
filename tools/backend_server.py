from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, quote_plus, urljoin, urlparse
from email.utils import parsedate_to_datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import base64
import io
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import smtplib
import sqlite3
import struct
import time
import urllib.request
import warnings
import xml.etree.ElementTree as ET
import zipfile
from email.message import EmailMessage



# ── Python 3.13 uyumlu multipart/form-data parser (cgi modülü kaldırıldı) ──
class _Part:
    """Tek bir multipart alanını temsil eder."""
    def __init__(self, headers: dict, data: bytes):
        self._headers = headers
        disp = headers.get("content-disposition", "")
        self.name = ""
        self.filename = ""
        for token in disp.split(";"):
            token = token.strip()
            if token.startswith("name="):
                self.name = token[5:].strip('"')
            elif token.startswith("filename="):
                self.filename = token[9:].strip('"')
        self.type = headers.get("content-type", "application/octet-stream").split(";")[0].strip()
        self.value = data.decode("utf-8", errors="replace") if not self.filename else None
        self.file = io.BytesIO(data) if self.filename else None

class MultipartForm:
    """MultipartForm yerine geçen sınıf."""
    def __init__(self, fp: "io.IOBase", headers: "email.message.Message", environ: dict):
        length = int(environ.get("CONTENT_LENGTH", 0) or 0)
        content_type = environ.get("CONTENT_TYPE", "")
        boundary = ""
        for token in content_type.split(";"):
            token = token.strip()
            if token.startswith("boundary="):
                boundary = token[9:].strip('"')
        raw = fp.read(length)
        self._parts: dict[str, list[_Part]] = {}
        if not boundary:
            return
        sep = ("--" + boundary).encode()
        end = ("--" + boundary + "--").encode()
        chunks = raw.split(sep)
        for chunk in chunks[1:]:
            if chunk.strip() == b"--" or chunk.startswith(b"--"):
                break
            chunk = chunk.lstrip(b"\r\n")
            if b"\r\n\r\n" not in chunk:
                continue
            hdr_raw, body = chunk.split(b"\r\n\r\n", 1)
            body = body.rstrip(b"\r\n")
            hdrs: dict[str, str] = {}
            for line in hdr_raw.decode("utf-8", errors="replace").splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    hdrs[k.strip().lower()] = v.strip()
            part = _Part(hdrs, body)
            if part.name:
                self._parts.setdefault(part.name, []).append(part)

    def keys(self):
        return self._parts.keys()

    def __contains__(self, key):
        return key in self._parts

    def __getitem__(self, key):
        parts = self._parts.get(key, [])
        return parts[0] if len(parts) == 1 else parts




ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
PUBLIC = ROOT / "public"
DATA_DIR = Path(os.environ.get("DATA_DIR", ROOT / "data"))
DB_PATH = Path(os.environ.get("DATABASE_PATH", DATA_DIR / "ottoman.db"))
UPLOAD_DIR = DATA_DIR / "uploads"
LOGO_CACHE_DIR = DATA_DIR / "company-logos"
PORT = int(os.environ.get("PORT", "8008"))
COOKIE_NAME = "ottoman_sid"
SESSION_TTL = 60 * 60 * 24 * 7
MARKET_URL = os.environ.get("MARKET_URL", "https://trrealapi-market.onrender.com/latest")
MARKET_URLS = [
    MARKET_URL,
    "https://trrealapi-market.onrender.com/api/latest",
    "https://trrealapi-market.onrender.com/data",
]
MARKET_TIMEOUT = float(os.environ.get("MARKET_TIMEOUT", "12"))
MARKET_REFRESH_SECONDS = int(os.environ.get("MARKET_REFRESH_SECONDS", "60"))
COMPANY_META_REFRESH_SECONDS = int(os.environ.get("COMPANY_META_REFRESH_SECONDS", "86400"))
NEWS_REFRESH_SECONDS = int(os.environ.get("NEWS_REFRESH_SECONDS", "900"))
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
LOGIN_MAX_ATTEMPTS = int(os.environ.get("LOGIN_MAX_ATTEMPTS", "5"))
LOGIN_LOCK_SECONDS = int(os.environ.get("LOGIN_LOCK_SECONDS", "900"))
PASSWORD_RESET_TTL = int(os.environ.get("PASSWORD_RESET_TTL", "1800"))
AGREEMENTS_VERSION = os.environ.get("AGREEMENTS_VERSION", "2026-08")
ALLOW_PRICE_SIMULATION = os.environ.get("ALLOW_PRICE_SIMULATION", "0") == "1"
REQUIRE_LIVE_MARKET_FOR_TRADING = os.environ.get("REQUIRE_LIVE_MARKET_FOR_TRADING", "1") == "1"

NEWS_CACHE = {"items": [], "updated_at": 0, "errors": []}
COMPANY_NEWS_CACHE: dict[str, dict] = {}
TRADINGVIEW_SCANNER_URL = "https://scanner.tradingview.com/turkey/scan"
TRADINGVIEW_LOGO_BASE = "https://s3-symbol-logo.tradingview.com"
OFFICIAL_COMPANY_DOMAINS = {
    "ALBTN": "albayrakbeton.com.tr",
    "BETAE": "betaenerji.com",
    "CITAS": "citlekci.com.tr",
    "EKDMR": "ekinciler.com",
    "EKIM": "ekimtur.com",
    "GOLDA": "golda.com.tr",
    "ISVEA": "isvea.com.tr",
    "KARCL": "karcel.com.tr",
    "KPEKS": "kapeks.com.tr",
    "MASFN": "masfen.com.tr",
    "METEN": "metgunenerji.com.tr",
    "ORZAX": "orzax.com.tr",
    "QUICK": "quicksigorta.com",
    "SARAE": "sara-enerji.com",
    "SOHOE": "sohocompany.com.tr",
    "SSAAT": "saatvesaat.com",
    "TKNKA": "teknikaplast.com.tr",
    "VEYAS": "turkerveyas.com.tr",
}
NEWS_SOURCES = {
    "Borsa İstanbul": "https://www.borsaistanbul.com/duyurular",
    "TCMB": "https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Bottom+Menu/Diger/RSS/Basin+Duyurulari",
    "SPK": "https://spk.gov.tr/spk-bultenleri/{year}-yili-spk-bultenleri",
    "KAP": "https://www.kap.org.tr/tr",
}


FALLBACK_QUOTES = [
    ("XU100", "BIST 100", 11048.12, 0.72, 0, "index"),
    ("XU030", "BIST 30", 12204.48, 0.68, 0, "index"),
    ("XBANK", "BIST Banka", 15782.35, 1.18, 0, "index"),
    ("USDTRY", "Amerikan Doları", 40.87, 0.15, 0, "fx"),
    ("EURTRY", "Euro", 47.28, 0.11, 0, "fx"),
    ("GBPTRY", "İngiliz Sterlini", 54.62, 0.09, 0, "fx"),
    ("XAUTRY", "Gram Altın", 4424.18, 0.44, 0, "commodity"),
    ("XAGTRY", "Gram Gümüş", 52.31, -0.22, 0, "commodity"),
    ("BRENT", "Brent Petrol", 80.24, -0.36, 0, "commodity"),
    ("BTCUSD", "Bitcoin", 114250.0, 1.74, 0, "crypto"),
    ("AKBNK", "Akbank T.A.S.", 67.65, -0.51, 88400000),
    ("ARCLK", "Arcelik A.S.", 142.40, 0.64, 11700000),
    ("ASELS", "Aselsan Elektronik Sanayi ve Ticaret A.S.", 381.25, -1.99, 24100000),
    ("ASTOR", "Astor Enerji A.S.", 102.60, 2.18, 36500000),
    ("BRSAN", "Borusan Mannesmann", 480.25, 1.16, 1800000),
    ("BIMAS", "BIM Birlesik Magazalar A.S.", 405.00, 6.02, 19200000),
    ("DOAS", "Dogus Otomotiv", 214.80, -0.42, 4100000),
    ("EKGYO", "Emlak Konut GYO", 16.26, 1.54, 220000000),
    ("ENKAI", "Enka Insaat", 65.20, 0.37, 29400000),
    ("EREGL", "Eregli Demir Celik", 27.88, -0.71, 196000000),
    ("FROTO", "Ford Otosan", 1036.00, 0.86, 2200000),
    ("GARAN", "Garanti BBVA", 134.70, 1.11, 98200000),
    ("GUBRF", "Gubre Fabrikalari", 274.50, -1.04, 6200000),
    ("HALKB", "Halkbank", 23.76, 0.51, 128000000),
    ("ISCTR", "Turkiye Is Bankasi A.S. C", 12.38, -0.16, 356000000),
    ("KCHOL", "Koc Holding A.S.", 189.20, 0.73, 31500000),
    ("KRDMD", "Kardemir D", 27.34, -0.88, 156000000),
    ("MGROS", "Migros Ticaret", 545.50, 1.92, 2700000),
    ("PETKM", "Petkim", 21.28, -0.36, 186000000),
    ("PGSUS", "Pegasus Hava Tasimaciligi A.S.", 149.30, -1.26, 13800000),
    ("SAHOL", "Sabanci Holding", 101.40, 0.95, 54200000),
    ("SASA", "Sasa Polyester Sanayi A.S.", 2.25, -3.85, 2900000000),
    ("SISE", "Turkiye Sise ve Cam Fabrikalari", 49.16, -0.28, 70200000),
    ("TCELL", "Turkcell", 97.35, 0.48, 27500000),
    ("THYAO", "Turk Hava Yollari A.O.", 300.50, -0.17, 78300000),
    ("TOASO", "Tofas Turk Otomobil", 224.90, 0.32, 3400000),
    ("TSKB", "Turkiye Sinai Kalkinma Bankasi", 13.72, 2.46, 284000000),
    ("TUPRS", "Tupras", 169.80, -0.64, 61200000),
    ("VAKBN", "Vakifbank", 25.18, 0.88, 178000000),
    ("YKBNK", "Yapi Kredi Bankasi", 31.64, 1.38, 342000000),
    ("ALARK", "Alarko Holding A.S.", 107.00, 3.08, 5300000),
]


def now() -> int:
    return int(time.time())


def iso_time(ts: int | None = None) -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts or now()))


def connect_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 260_000)
    return salt, digest.hex()


def verify_password(password: str, salt: str, stored_hash: str) -> bool:
    _, candidate = hash_password(password, salt)
    return hmac.compare_digest(candidate, stored_hash)


def password_is_strong(password: str) -> bool:
    return (
        len(password) >= 10
        and bool(re.search(r"[A-ZÇĞİÖŞÜ]", password))
        and bool(re.search(r"[a-zçğıöşü]", password))
        and bool(re.search(r"\d", password))
    )


def valid_turkish_identity_number(value: str) -> bool:
    if not re.fullmatch(r"[1-9]\d{10}", value):
        return False
    digits = [int(char) for char in value]
    tenth = ((sum(digits[0:9:2]) * 7) - sum(digits[1:8:2])) % 10
    eleventh = sum(digits[:10]) % 10
    return digits[9] == tenth and digits[10] == eleventh


def totp_code(secret: str, timestamp: int | None = None) -> str:
    normalized = re.sub(r"\s+", "", secret).upper()
    key = base64.b32decode(normalized + "=" * ((8 - len(normalized) % 8) % 8), casefold=True)
    counter = int((timestamp or now()) / 30)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{value:06d}"


def verify_totp(secret: str, code: str) -> bool:
    clean = re.sub(r"\D", "", code)
    return bool(secret and len(clean) == 6) and any(
        hmac.compare_digest(totp_code(secret, now() + step * 30), clean) for step in (-1, 0, 1)
    )


def turkish_iban(value: str) -> str:
    iban = re.sub(r"[^A-Z0-9]", "", value.upper())
    if not re.fullmatch(r"TR\d{24}", iban):
        return ""
    rearranged = iban[4:] + iban[:4]
    numeric = "".join(str(ord(char) - 55) if char.isalpha() else char for char in rearranged)
    return iban if int(numeric) % 97 == 1 else ""


def risk_profile_for(score: int) -> str:
    if score <= 6:
        return "Muhafazakar"
    if score <= 12:
        return "Dengeli"
    return "Dinamik"


def send_reset_email(email: str, reset_url: str) -> bool:
    host = os.environ.get("SMTP_HOST", "").strip()
    user = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "")
    if not host or not user or not password:
        return False
    message = EmailMessage()
    message["Subject"] = "Ottoman Yatırım şifre yenileme"
    message["From"] = os.environ.get("SMTP_FROM", user)
    message["To"] = email
    message.set_content(f"Şifrenizi 30 dakika içinde yenilemek için bağlantıyı açın:\n\n{reset_url}\n")
    port = int(os.environ.get("SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=12) as client:
        client.starttls()
        client.login(user, password)
        client.send_message(message)
    return True


def row_to_dict(row: sqlite3.Row | None) -> dict | None:
    return dict(row) if row else None


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    LOGO_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with connect_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              tc TEXT NOT NULL UNIQUE,
              password_salt TEXT NOT NULL,
              password_hash TEXT NOT NULL,
              full_name TEXT NOT NULL,
              phone TEXT NOT NULL,
              email TEXT NOT NULL,
              city TEXT DEFAULT '',
              role TEXT NOT NULL DEFAULT 'user',
              status TEXT NOT NULL DEFAULT 'pending',
              kyc_status TEXT NOT NULL DEFAULT 'pending',
              created_at INTEGER NOT NULL,
              approved_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS documents (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              doc_type TEXT NOT NULL,
              original_name TEXT NOT NULL,
              stored_name TEXT NOT NULL,
              content_type TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'pending',
              created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS accounts (
              user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
              cash_balance REAL NOT NULL DEFAULT 0,
              blocked_balance REAL NOT NULL DEFAULT 0,
              pending_balance REAL NOT NULL DEFAULT 0,
              credit_limit REAL NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS positions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              symbol TEXT NOT NULL,
              quantity INTEGER NOT NULL,
              avg_price REAL NOT NULL,
              updated_at INTEGER NOT NULL,
              UNIQUE(user_id, symbol)
            );

            CREATE TABLE IF NOT EXISTS orders (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              symbol TEXT NOT NULL,
              side TEXT NOT NULL,
              order_type TEXT NOT NULL DEFAULT 'limit',
              quantity INTEGER NOT NULL,
              limit_price REAL NOT NULL,
              source_price REAL NOT NULL,
              total REAL NOT NULL,
              cash_reserved REAL NOT NULL DEFAULT 0,
              pending_reserved REAL NOT NULL DEFAULT 0,
              cancel_remaining INTEGER NOT NULL DEFAULT 0,
              status TEXT NOT NULL DEFAULT 'pending',
              note TEXT DEFAULT '',
              admin_note TEXT DEFAULT '',
              created_at INTEGER NOT NULL,
              reviewed_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS money_requests (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              request_type TEXT NOT NULL,
              amount REAL NOT NULL,
              bank_account_id INTEGER,
              account_ref TEXT DEFAULT '',
              note TEXT DEFAULT '',
              admin_note TEXT DEFAULT '',
              status TEXT NOT NULL DEFAULT 'pending',
              created_at INTEGER NOT NULL,
              reviewed_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS bank_accounts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              bank_name TEXT NOT NULL,
              iban TEXT NOT NULL,
              account_holder TEXT NOT NULL,
              created_at INTEGER NOT NULL,
              UNIQUE(user_id, iban)
            );

            CREATE TABLE IF NOT EXISTS system_bank_accounts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              bank_name TEXT NOT NULL,
              account_holder TEXT NOT NULL,
              iban TEXT NOT NULL,
              branch_name TEXT DEFAULT '',
              description TEXT DEFAULT '',
              is_active INTEGER NOT NULL DEFAULT 1,
              sort_order INTEGER NOT NULL DEFAULT 0,
              created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_transactions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              order_id INTEGER,
              money_request_id INTEGER,
              code TEXT DEFAULT '',
              name TEXT DEFAULT '',
              transaction_type TEXT NOT NULL,
              quantity INTEGER NOT NULL DEFAULT 0,
              price REAL NOT NULL DEFAULT 0,
              total REAL NOT NULL DEFAULT 0,
              balance_before REAL NOT NULL DEFAULT 0,
              balance_after REAL NOT NULL DEFAULT 0,
              note TEXT DEFAULT '',
              created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS t2_settlements (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              order_id INTEGER,
              transaction_id INTEGER,
              code TEXT NOT NULL,
              name TEXT NOT NULL,
              amount REAL NOT NULL,
              remaining_amount REAL NOT NULL DEFAULT 0,
              quantity INTEGER NOT NULL,
              sale_price REAL NOT NULL,
              settlement_date INTEGER NOT NULL,
              status TEXT NOT NULL DEFAULT 'pending',
              created_at INTEGER NOT NULL,
              reviewed_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS t2_consumptions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
              settlement_id INTEGER NOT NULL REFERENCES t2_settlements(id) ON DELETE CASCADE,
              amount REAL NOT NULL,
              created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS system_settings (
              setting_key TEXT PRIMARY KEY,
              setting_value TEXT NOT NULL,
              updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS stock_descriptions (
              symbol TEXT PRIMARY KEY,
              description TEXT NOT NULL DEFAULT '',
              risk_note TEXT NOT NULL DEFAULT '',
              updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
              sid TEXT PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              expires_at INTEGER NOT NULL,
              created_at INTEGER NOT NULL,
              last_seen_at INTEGER NOT NULL DEFAULT 0,
              ip_address TEXT DEFAULT '',
              user_agent TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
              action TEXT NOT NULL,
              entity_type TEXT NOT NULL,
              entity_id INTEGER,
              payload TEXT DEFAULT '{}',
              created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS password_reset_tokens (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              token_hash TEXT NOT NULL UNIQUE,
              expires_at INTEGER NOT NULL,
              used_at INTEGER,
              created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_agreements (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              agreement_type TEXT NOT NULL,
              agreement_version TEXT NOT NULL,
              accepted_at INTEGER NOT NULL,
              ip_address TEXT DEFAULT '',
              UNIQUE(user_id, agreement_type, agreement_version)
            );

            CREATE TABLE IF NOT EXISTS suitability_assessments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              answers_json TEXT NOT NULL,
              score INTEGER NOT NULL,
              risk_profile TEXT NOT NULL,
              completed_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS contact_messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              full_name TEXT NOT NULL,
              email TEXT NOT NULL,
              phone TEXT DEFAULT '',
              subject TEXT NOT NULL,
              message TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'open',
              created_at INTEGER NOT NULL,
              reviewed_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS market_history (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              symbol TEXT NOT NULL,
              price REAL NOT NULL,
              recorded_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_market_history_symbol_time ON market_history(symbol, recorded_at DESC);

            CREATE TABLE IF NOT EXISTS market_cache (
              symbol TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              price REAL NOT NULL,
              change_pct REAL NOT NULL,
              volume REAL NOT NULL,
              asset_class TEXT NOT NULL DEFAULT 'stock',
              logo_url TEXT NOT NULL DEFAULT '',
              sector TEXT NOT NULL DEFAULT '',
              industry TEXT NOT NULL DEFAULT '',
              metadata_updated_at INTEGER NOT NULL DEFAULT 0,
              updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS market_status (
              id INTEGER PRIMARY KEY CHECK (id=1),
              source TEXT NOT NULL DEFAULT 'fallback',
              ok INTEGER NOT NULL DEFAULT 0,
              symbol_count INTEGER NOT NULL DEFAULT 0,
              error TEXT DEFAULT '',
              updated_at INTEGER NOT NULL
            );
            """
        )
        migrate_db(conn)
        migrate_brand_data(conn)
        seed_admin(conn)
        seed_test_user(conn)
        seed_market(conn)
        seed_system_bank_accounts(conn)
        seed_system_settings(conn)


def migrate_db(conn: sqlite3.Connection) -> None:
    ensure_column(conn, "users", "account_no", "TEXT DEFAULT ''")
    ensure_column(conn, "users", "district", "TEXT DEFAULT ''")
    ensure_column(conn, "users", "birth_date", "TEXT DEFAULT ''")
    ensure_column(conn, "users", "address", "TEXT DEFAULT ''")
    ensure_column(conn, "users", "kyc_note", "TEXT DEFAULT ''")
    ensure_column(conn, "users", "is_test_user", "INTEGER NOT NULL DEFAULT 0")
    ensure_column(conn, "users", "failed_login_count", "INTEGER NOT NULL DEFAULT 0")
    ensure_column(conn, "users", "locked_until", "INTEGER NOT NULL DEFAULT 0")
    ensure_column(conn, "users", "last_login_at", "INTEGER")
    ensure_column(conn, "users", "two_factor_enabled", "INTEGER NOT NULL DEFAULT 0")
    ensure_column(conn, "users", "two_factor_secret", "TEXT DEFAULT ''")
    ensure_column(conn, "users", "risk_profile", "TEXT DEFAULT ''")
    ensure_column(conn, "users", "suitability_score", "INTEGER NOT NULL DEFAULT 0")
    ensure_column(conn, "users", "suitability_completed_at", "INTEGER")
    ensure_column(conn, "users", "agreements_version", "TEXT DEFAULT ''")
    ensure_column(conn, "users", "agreements_accepted_at", "INTEGER")
    ensure_column(conn, "accounts", "pending_balance", "REAL NOT NULL DEFAULT 0")
    ensure_column(conn, "orders", "cancel_remaining", "INTEGER NOT NULL DEFAULT 0")
    ensure_column(conn, "orders", "cash_reserved", "REAL NOT NULL DEFAULT 0")
    ensure_column(conn, "orders", "pending_reserved", "REAL NOT NULL DEFAULT 0")
    ensure_column(conn, "orders", "commission", "REAL NOT NULL DEFAULT 0")
    ensure_column(conn, "orders", "gross_total", "REAL NOT NULL DEFAULT 0")
    ensure_column(conn, "orders", "client_order_id", "TEXT DEFAULT ''")
    ensure_column(conn, "orders", "execution_reference", "TEXT DEFAULT ''")
    ensure_column(conn, "orders", "price_updated_at", "INTEGER NOT NULL DEFAULT 0")
    ensure_column(conn, "t2_settlements", "remaining_amount", "REAL NOT NULL DEFAULT 0")
    ensure_column(conn, "money_requests", "bank_account_id", "INTEGER")
    ensure_column(conn, "money_requests", "admin_note", "TEXT DEFAULT ''")
    ensure_column(conn, "money_requests", "transfer_code", "TEXT DEFAULT ''")
    ensure_column(conn, "money_requests", "receipt_name", "TEXT DEFAULT ''")
    ensure_column(conn, "money_requests", "receipt_stored_name", "TEXT DEFAULT ''")
    ensure_column(conn, "money_requests", "receipt_content_type", "TEXT DEFAULT ''")
    ensure_column(conn, "documents", "review_note", "TEXT DEFAULT ''")
    ensure_column(conn, "market_cache", "asset_class", "TEXT NOT NULL DEFAULT 'stock'")
    ensure_column(conn, "market_cache", "logo_url", "TEXT NOT NULL DEFAULT ''")
    ensure_column(conn, "market_cache", "sector", "TEXT NOT NULL DEFAULT ''")
    ensure_column(conn, "market_cache", "industry", "TEXT NOT NULL DEFAULT ''")
    ensure_column(conn, "market_cache", "metadata_updated_at", "INTEGER NOT NULL DEFAULT 0")
    ensure_column(conn, "sessions", "last_seen_at", "INTEGER NOT NULL DEFAULT 0")
    ensure_column(conn, "sessions", "ip_address", "TEXT DEFAULT ''")
    ensure_column(conn, "sessions", "user_agent", "TEXT DEFAULT ''")
    ensure_column(conn, "sessions", "step_up_until", "INTEGER NOT NULL DEFAULT 0")
    ensure_column(conn, "audit_logs", "ip_address", "TEXT DEFAULT ''")
    ensure_column(conn, "audit_logs", "user_agent", "TEXT DEFAULT ''")
    ensure_column(conn, "audit_logs", "request_id", "TEXT DEFAULT ''")
    conn.execute("UPDATE t2_settlements SET remaining_amount=amount WHERE status='pending' AND remaining_amount<=0")
    conn.execute("UPDATE users SET account_no=printf('OT%06d', id) WHERE account_no IS NULL OR account_no=''")
    conn.execute("UPDATE users SET account_no='GM' || substr(account_no, 3) WHERE account_no LIKE 'FY%'")
    conn.execute("UPDATE users SET account_no='OT' || substr(account_no, 3) WHERE account_no LIKE 'AU%' OR account_no LIKE 'PM%' OR account_no LIKE 'GM%'")
    conn.execute("UPDATE system_bank_accounts SET is_active=0 WHERE REPLACE(iban, ' ', '') LIKE 'TR00%'")
    conn.execute("UPDATE orders SET gross_total=total WHERE gross_total<=0")
    conn.execute("UPDATE sessions SET last_seen_at=created_at WHERE last_seen_at<=0")
    create_compatibility_views(conn)


def migrate_brand_data(conn: sqlite3.Connection) -> None:
    legacy = "Fu" + "zul"
    legacy_public = f"{legacy} Yatırım"
    legacy_company = f"{legacy_public} Menkul Değerler"
    conn.execute(
        """
        UPDATE users
        SET full_name=?
        WHERE role='admin' AND (full_name='Sistem Admin' OR full_name='Ottoman Admin' OR full_name LIKE ? OR full_name LIKE ?)
        """,
        ("Ottoman Admin", f"%{legacy}%", f"%{legacy_public}%"),
    )
    conn.execute(
        """
        UPDATE users
        SET email=?
        WHERE role='admin' AND (email='' OR email='admin@local' OR email='admin@ottoman.local' OR email LIKE ?)
        """,
        ("admin@ottoman.local", f"%{legacy.lower()}%"),
    )
    conn.execute(
        """
        UPDATE system_bank_accounts
        SET bank_name=REPLACE(REPLACE(bank_name, ?, ?), ?, ?),
            account_holder=REPLACE(REPLACE(account_holder, ?, ?), ?, ?)
        """,
        (
            legacy_company,
            "Ottoman Yatırım",
            legacy_public,
            "Ottoman Yatırım",
            f"{legacy_company} A.Ş.",
            "Ottoman Yatırım A.Ş.",
            legacy_company,
            "Ottoman Yatırım",
        ),
    )
    conn.execute("UPDATE users SET account_no='PM' || substr(account_no, 3) WHERE account_no LIKE 'GM%'")


def ensure_column(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")


def create_compatibility_views(conn: sqlite3.Connection) -> None:
    for view in (
        "deposit_requests",
        "withdrawal_requests",
        "credit_applications",
        "pending_orders",
        "user_balances",
        "user_positions",
        "identity_documents",
    ):
        conn.execute(f"DROP VIEW IF EXISTS {view}")
    conn.executescript(
        """
        CREATE VIEW deposit_requests AS
          SELECT * FROM money_requests WHERE request_type='deposit';

        CREATE VIEW withdrawal_requests AS
          SELECT * FROM money_requests WHERE request_type='withdraw';

        CREATE VIEW credit_applications AS
          SELECT * FROM money_requests WHERE request_type='credit';

        CREATE VIEW pending_orders AS
          SELECT * FROM orders WHERE status='pending';

        CREATE VIEW user_balances AS
          SELECT user_id, cash_balance, blocked_balance, pending_balance, credit_limit
          FROM accounts;

        CREATE VIEW user_positions AS
          SELECT user_id, symbol AS code, quantity, avg_price, updated_at
          FROM positions;

        CREATE VIEW identity_documents AS
          SELECT id, user_id, doc_type, original_name, stored_name, content_type, status, review_note, created_at
          FROM documents;
        """
    )


def seed_system_bank_accounts(conn: sqlite3.Connection) -> None:
    count = conn.execute("SELECT COUNT(*) AS c FROM system_bank_accounts").fetchone()["c"]
    active_count = conn.execute("SELECT COUNT(*) AS c FROM system_bank_accounts WHERE is_active=1").fetchone()["c"]
    if count:
        return
    conn.execute(
        """
        INSERT INTO system_bank_accounts
          (bank_name, account_holder, iban, branch_name, description, is_active, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?, 1, 1, ?)
        """,
        (
            "Ottoman Bank",
            "Ottoman Yatırım A.Ş.",
            "TR330006100519786457841326",
            "Dijital Şube",
            "Demo/local para yatırma hesabı",
            now(),
        ),
    )


def seed_system_settings(conn: sqlite3.Connection) -> None:
    defaults = {
        "trading_enabled": "1",
        "maintenance_mode": "0",
        "price_simulation": "0",
        "t2_enabled": "0",
        "commission_rate_bps": os.environ.get("COMMISSION_RATE_BPS", "0"),
        "minimum_commission": os.environ.get("MINIMUM_COMMISSION", "0"),
        "official_company_name": os.environ.get("OFFICIAL_COMPANY_NAME", ""),
        "official_registry_number": os.environ.get("OFFICIAL_REGISTRY_NUMBER", ""),
        "official_mersis_number": os.environ.get("OFFICIAL_MERSIS_NUMBER", ""),
        "official_address": os.environ.get("OFFICIAL_ADDRESS", ""),
        "official_phone": os.environ.get("OFFICIAL_PHONE", ""),
        "official_email": os.environ.get("OFFICIAL_EMAIL", "destek@ottoman.local"),
        "official_license_text": os.environ.get("OFFICIAL_LICENSE_TEXT", ""),
        "brand_name": "Ottoman",
        "brand_descriptor": "E-Şube",
        "brand_symbol": "O",
        "brand_tagline": "Yatırımın zarif hali",
        "ui_primary_color": "#7657ff",
        "ui_accent_color": "#139477",
        "ui_danger_color": "#ef3340",
        "ui_font_family": "Inter",
        "ui_radius": "18",
        "content_support_email": os.environ.get("OFFICIAL_EMAIL", "destek@ottoman.local"),
        "content_support_phone": os.environ.get("OFFICIAL_PHONE", ""),
        "credit_monthly_interest_rate": "2.5",
        "credit_loan_term_months": "12",
        "credit_late_interest_rate": "4.5",
        "credit_multiplier": "7",
        "credit_margin_call_ratio": "50",
        "credit_contract_text_1": "Kredili yatirim limiti admin onayi ile aktif edilir.",
        "credit_contract_text_2": "Faiz ve vade kosullari admin panelindeki guncel ayarlara gore hesaplanir.",
        "credit_contract_text_3": "Gecikme halinde gecikme faizi uygulanabilir.",
        "credit_contract_text_4": "Erken kapama talebi admin tarafindan degerlendirilir.",
        "credit_contract_text_5": "Teminat orani dustugunde kullaniciya uyari verilir.",
        "credit_contract_text_6": "Limit kotuye kullanimda pasif hale getirilebilir.",
        "credit_contract_text_7": "Uyusmazliklar ilgili mevzuat cercevesinde cozulur.",
    }
    brand_config_path = ROOT / "brand-config.json"
    if brand_config_path.exists():
        try:
            packaged = json.loads(brand_config_path.read_text(encoding="utf-8"))
            defaults.update({str(key): str(value) for key, value in packaged.items() if str(key).startswith(("brand_", "ui_", "content_", "official_", "commission_", "minimum_", "trading_", "t2_", "credit_"))})
        except (OSError, ValueError, TypeError):
            pass
    for key, value in defaults.items():
        conn.execute(
            "INSERT OR IGNORE INTO system_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)",
            (key, value, now()),
        )


def seed_admin(conn: sqlite3.Connection) -> None:
    admin_tc = re.sub(r"\D", "", os.environ.get("ADMIN_TC") or "11111111110")
    if not re.fullmatch(r"\d{11}", admin_tc):
        admin_tc = "11111111110"
    password = os.environ.get("ADMIN_PASSWORD") or "Admin12345"
    salt, digest = hash_password(password)
    existing = conn.execute("SELECT id FROM users WHERE tc=?", (admin_tc,)).fetchone()
    if existing:
        updates = [
            salt, digest,
            os.environ.get("ADMIN_NAME", "Ottoman Yönetici")[:120],
            os.environ.get("ADMIN_EMAIL", "admin@ottoman.local")[:120],
            now(),
            existing["id"],
        ]
        conn.execute(
            """
            UPDATE users
            SET password_salt=?, password_hash=?,
                full_name=?,
                email=?,
                role='admin',
                status='approved',
                kyc_status='approved',
                approved_at=COALESCE(approved_at, ?)
            WHERE id=?
            """,
            updates,
        )
        conn.execute("UPDATE users SET account_no=printf('OT%06d', id) WHERE id=? AND (account_no IS NULL OR account_no='')", (existing["id"],))
        conn.execute("INSERT OR IGNORE INTO accounts (user_id, cash_balance, blocked_balance, credit_limit) VALUES (?, 0, 0, 0)", (existing["id"],))
        conn.commit()
        return
    cur = conn.execute(
        """
        INSERT INTO users
          (tc, password_salt, password_hash, full_name, phone, email, city, role, status, kyc_status, created_at, approved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', 'approved', 'approved', ?, ?)
        """,
        (admin_tc, salt, digest, os.environ.get("ADMIN_NAME", "Ottoman Yönetici")[:120], "08508887000", os.environ.get("ADMIN_EMAIL", "admin@ottoman.local")[:120], "Istanbul", now(), now()),
    )
    conn.execute("UPDATE users SET account_no=printf('OT%06d', id) WHERE id=?", (cur.lastrowid,))
    conn.execute("INSERT INTO accounts (user_id, cash_balance, blocked_balance, credit_limit) VALUES (?, 0, 0, 0)", (cur.lastrowid,))
    conn.commit()


def env_float(key: str, default: float) -> float:
    try:
        return float(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default


def env_int(key: str, default: int) -> int:
    try:
        return int(float(os.environ.get(key, default)))
    except (TypeError, ValueError):
        return default


def seed_test_user(conn: sqlite3.Connection) -> None:
    test_tc = re.sub(r"\D", "", os.environ.get("TEST_USER_TC", "22222222220"))
    if not re.fullmatch(r"\d{11}", test_tc):
        test_tc = "22222222220"
    existing = conn.execute("SELECT id FROM users WHERE tc=?", (test_tc,)).fetchone()
    password = os.environ.get("TEST_USER_PASSWORD") or "User12345"
    full_name = os.environ.get("TEST_USER_NAME", "Ottoman Test Kullanıcı")[:120]
    email = os.environ.get("TEST_USER_EMAIL", "test@ottoman.local")[:120]
    phone = os.environ.get("TEST_USER_PHONE", "05550000000")[:40]
    city = os.environ.get("TEST_USER_CITY", "Istanbul")[:80]
    district = os.environ.get("TEST_USER_DISTRICT", "Merkez")[:80]
    cash = max(0.0, env_float("TEST_USER_CASH", 123456.78))
    credit = max(0.0, env_float("TEST_USER_CREDIT", 0.0))
    salt, digest = hash_password(password)
    if existing:
        updates = [
            salt, digest,
            full_name, email, phone, city, district, now(), existing["id"]
        ]
        conn.execute(
            """
            UPDATE users
            SET password_salt=?, password_hash=?,
                full_name=?,
                email=?,
                phone=?,
                city=?,
                district=?,
                role=CASE WHEN role='admin' THEN role ELSE 'user' END,
                status='approved',
                kyc_status='approved',
                is_test_user=1,
                approved_at=COALESCE(approved_at, ?)
            WHERE id=?
            """,
            updates,
        )
        conn.execute("UPDATE users SET account_no=printf('OT%06d', id) WHERE id=? AND (account_no IS NULL OR account_no='')", (existing["id"],))
        conn.execute(
            "INSERT OR IGNORE INTO accounts (user_id, cash_balance, blocked_balance, pending_balance, credit_limit) VALUES (?, ?, 0, 0, ?)",
            (existing["id"], cash, credit),
        )
        audit(conn, existing["id"], "sync_test_user_seed", "user", existing["id"])
        conn.commit()
        return

    cur = conn.execute(
        """
        INSERT INTO users
          (tc, password_salt, password_hash, full_name, phone, email, city, district, role, status, kyc_status, is_test_user, created_at, approved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'user', 'approved', 'approved', 1, ?, ?)
        """,
        (test_tc, salt, digest, full_name, phone, email, city, district, now(), now()),
    )
    user_id = cur.lastrowid
    conn.execute("UPDATE users SET account_no=printf('OT%06d', id) WHERE id=?", (user_id,))
    conn.execute(
        "INSERT INTO accounts (user_id, cash_balance, blocked_balance, pending_balance, credit_limit) VALUES (?, ?, 0, 0, ?)",
        (user_id, cash, credit),
    )
    conn.execute(
        "INSERT OR IGNORE INTO positions (user_id, symbol, quantity, avg_price, updated_at) VALUES (?, 'THYAO', 292, 248.40, ?)",
        (user_id, now()),
    )
    conn.execute(
        "INSERT OR IGNORE INTO positions (user_id, symbol, quantity, avg_price, updated_at) VALUES (?, 'ASELS', 150, 58.40, ?)",
        (user_id, now()),
    )
    audit(conn, user_id, "seed_test_user", "user", user_id)
    conn.commit()


def seed_market(conn: sqlite3.Connection) -> None:
    count = conn.execute("SELECT COUNT(*) AS c FROM market_cache").fetchone()["c"]
    ts = 0
    normalized = []
    for row in FALLBACK_QUOTES:
        symbol, name, price, change, volume, *rest = row
        normalized.append((symbol, name, price, change, volume, rest[0] if rest else "stock", ts))
    if count:
        conn.executemany(
            "INSERT OR IGNORE INTO market_cache (symbol, name, price, change_pct, volume, asset_class, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            normalized,
        )
    else:
        conn.executemany(
            "INSERT OR REPLACE INTO market_cache (symbol, name, price, change_pct, volume, asset_class, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            normalized,
        )
    conn.execute(
        "INSERT OR IGNORE INTO market_status (id, source, ok, symbol_count, error, updated_at) VALUES (1, 'fallback', 0, ?, 'Canlı kaynak henüz okunmadı', ?)",
        (len(normalized), ts),
    )


def audit(
    conn: sqlite3.Connection,
    actor_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None,
    payload: dict | None = None,
    ip_address: str = "",
    user_agent: str = "",
    request_id: str = "",
) -> None:
    conn.execute(
        "INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, payload, ip_address, user_agent, request_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (actor_id, action, entity_type, entity_id, json.dumps(payload or {}, ensure_ascii=False), ip_address[:64], user_agent[:240], request_id[:80], now()),
    )


def account_for(conn: sqlite3.Connection, user_id: int) -> dict:
    row = conn.execute("SELECT * FROM accounts WHERE user_id=?", (user_id,)).fetchone()
    if not row:
        conn.execute("INSERT INTO accounts (user_id) VALUES (?)", (user_id,))
        row = conn.execute("SELECT * FROM accounts WHERE user_id=?", (user_id,)).fetchone()
    return dict(row)


def market_from_cache(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        """
        SELECT *
        FROM market_cache
        ORDER BY
          CASE symbol
            WHEN 'XU100' THEN 0 WHEN 'XU030' THEN 1 WHEN 'XBANK' THEN 2
            WHEN 'USDTRY' THEN 3 WHEN 'EURTRY' THEN 4 WHEN 'GBPTRY' THEN 5
            WHEN 'XAUTRY' THEN 6 WHEN 'XAGTRY' THEN 7 WHEN 'BRENT' THEN 8 WHEN 'BTCUSD' THEN 9
            ELSE 20
          END,
          symbol ASC
        LIMIT 1000
        """
    ).fetchall()
    return [dict(row) for row in rows]


def market_status(conn: sqlite3.Connection) -> dict:
    row = conn.execute("SELECT * FROM market_status WHERE id=1").fetchone()
    if not row:
        count = conn.execute("SELECT COUNT(*) c FROM market_cache").fetchone()["c"]
        return {"source": "fallback", "ok": 0, "symbol_count": count, "error": "Durum kaydı yok", "updated_at": 0, "updated_at_label": "-"}
    item = dict(row)
    item["updated_at_label"] = iso_time(item["updated_at"]) if item["updated_at"] else "-"
    return item


def save_market_status(conn: sqlite3.Connection, source: str, ok: bool, symbol_count: int, error: str = "") -> None:
    conn.execute(
        """
        INSERT INTO market_status (id, source, ok, symbol_count, error, updated_at)
        VALUES (1, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          source=excluded.source,
          ok=excluded.ok,
          symbol_count=excluded.symbol_count,
          error=excluded.error,
          updated_at=excluded.updated_at
        """,
        (source, 1 if ok else 0, symbol_count, error[:500], now()),
    )


def clean_symbol(value: object) -> str:
    raw = str(value or "").upper().split(":")[-1]
    return re.sub(r"[^A-Z0-9]", "", raw)


def asset_class_for(symbol: str, product_type: str = "") -> str:
    product = product_type.lower()
    if product in {"fund", "etf", "mutual_fund"}:
        return "fund"
    if symbol.startswith("XU") or product in {"index", "indices"}:
        return "index"
    if symbol.endswith("TRY") or product in {"forex", "fx"}:
        return "fx"
    if symbol in {"BRENT", "XAUUSD", "XAGUSD", "XAUTRY", "XAGTRY"} or product in {"commodity", "futures"}:
        return "commodity"
    if symbol.endswith("USD") and symbol in {"BTCUSD", "ETHUSD"} or product == "crypto":
        return "crypto"
    return "stock"


def quote_from_mapping(item: dict) -> dict | None:
    data = item.get("d") if isinstance(item.get("d"), list) else None
    symbol_source = item.get("symbol") or item.get("code") or item.get("s") or item.get("name")
    product_type = str(item.get("type") or item.get("product_type") or item.get("asset_class") or "")
    if data:
        symbol_source = data[0] if data and data[0] else symbol_source
        product_type = str(data[12] if len(data) > 12 else product_type)
    symbol = clean_symbol(symbol_source)
    if not symbol or not re.fullmatch(r"[A-Z0-9]{2,16}", symbol):
        return None
    price_candidates = [
        item.get("price"),
        item.get("last"),
        item.get("last_price"),
        item.get("close"),
        data[1] if data and len(data) > 1 else None,
        data[7] if data and len(data) > 7 else None,
    ]
    change_candidates = [
        item.get("change_pct"),
        item.get("changePercent"),
        item.get("change_percent"),
        item.get("change"),
        data[2] if data and len(data) > 2 else None,
    ]
    volume_candidates = [
        item.get("volume"),
        item.get("vol"),
        data[8] if data and len(data) > 8 else None,
    ]
    try:
        price = next(float(x) for x in price_candidates if x not in (None, ""))
        change_pct = next((float(x) for x in change_candidates if x not in (None, "")), 0.0)
        volume = next((float(x) for x in volume_candidates if x not in (None, "")), 0.0)
    except (StopIteration, TypeError, ValueError):
        return None
    if price <= 0:
        return None
    name = item.get("description") or item.get("title") or item.get("full_name")
    if data and len(data) > 11 and data[11]:
        name = data[11]
    return {
        "symbol": symbol,
        "name": str(name or symbol),
        "price": price,
        "change_pct": change_pct,
        "volume": volume,
        "asset_class": asset_class_for(symbol, product_type),
        "updated_at": now(),
    }


def flatten_market_items(value: object) -> list[dict]:
    items: list[dict] = []
    if isinstance(value, dict):
        if any(key in value for key in ("d", "symbol", "code", "s", "price", "last")):
            items.append(value)
        for key in ("data", "items", "quotes", "stocks", "indices", "last", "result"):
            if key in value:
                items.extend(flatten_market_items(value[key]))
    elif isinstance(value, list):
        for item in value:
            items.extend(flatten_market_items(item))
    return items


def normalize_market(payload: dict) -> list[dict]:
    quotes: list[dict] = []
    seen: set[str] = set()
    for item in flatten_market_items(payload):
        quote = quote_from_mapping(item)
        if not quote or quote["symbol"] in seen:
            continue
        seen.add(quote["symbol"])
        quotes.append(quote)
    return quotes


def refresh_company_metadata(conn: sqlite3.Connection) -> None:
    meta = conn.execute(
        "SELECT COUNT(*) AS total, COALESCE(MAX(metadata_updated_at), 0) AS updated, SUM(CASE WHEN asset_class='fund' THEN 1 ELSE 0 END) AS funds FROM market_cache WHERE logo_url<>''"
    ).fetchone()
    if meta and int(meta["total"] or 0) >= 500 and int(meta["funds"] or 0) >= 10 and now() - int(meta["updated"] or 0) < COMPANY_META_REFRESH_SECONDS:
        return

    body = json.dumps(
        {
            "options": {"lang": "tr"},
            "markets": ["turkey"],
            "symbols": {"query": {"types": []}, "tickers": []},
            "columns": ["name", "description", "logoid", "sector", "industry", "type"],
            "range": [0, 1000],
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        TRADINGVIEW_SCANNER_URL,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "OttomanBackend/2.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=max(15.0, MARKET_TIMEOUT)) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (OSError, ValueError):
        return

    metadata = []
    refreshed_at = now()
    for item in payload.get("data", []):
        values = item.get("d") if isinstance(item, dict) else None
        if not isinstance(values, list) or len(values) < 6:
            continue
        symbol = clean_symbol(values[0])
        if not symbol:
            continue
        company_name = str(values[1] or symbol).strip()
        logo_id = str(values[2] or "").strip().lower()
        logo_url = f"{TRADINGVIEW_LOGO_BASE}/{logo_id}--big.svg" if re.fullmatch(r"[a-z0-9-]+", logo_id) else ""
        metadata.append(
            {
                "symbol": symbol,
                "name": company_name,
                "logo_url": logo_url,
                "sector": str(values[3] or "").strip(),
                "industry": str(values[4] or "").strip(),
                "asset_class": asset_class_for(symbol, str(values[5] or "")),
                "metadata_updated_at": refreshed_at,
            }
        )
    if not metadata:
        return
    conn.executemany(
        """
        UPDATE market_cache
        SET name=:name, logo_url=:logo_url, sector=:sector, industry=:industry, asset_class=:asset_class,
            metadata_updated_at=:metadata_updated_at
        WHERE symbol=:symbol
        """,
        metadata,
    )
    conn.commit()


def refresh_market(conn: sqlite3.Connection) -> list[dict]:
    latest = conn.execute("SELECT MAX(updated_at) AS updated FROM market_cache").fetchone()["updated"] or 0
    status_row = conn.execute("SELECT updated_at FROM market_status WHERE id=1").fetchone()
    status_updated = status_row["updated_at"] if status_row else 0
    if now() - int(max(latest, status_updated)) < MARKET_REFRESH_SECONDS:
        refresh_company_metadata(conn)
        return market_from_cache(conn)
    last_error = ""
    for url in dict.fromkeys(MARKET_URLS):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "OttomanBackend/2.0"})
            with urllib.request.urlopen(request, timeout=MARKET_TIMEOUT) as response:
                payload = json.loads(response.read().decode("utf-8"))
            quotes = normalize_market(payload)
            if quotes:
                conn.executemany(
                    """
                    INSERT OR REPLACE INTO market_cache
                      (symbol, name, price, change_pct, volume, asset_class, updated_at)
                    VALUES
                      (:symbol, :name, :price, :change_pct, :volume, :asset_class, :updated_at)
                    """,
                    quotes,
                )
                sampled_at = now()
                conn.executemany(
                    "INSERT INTO market_history (symbol, price, recorded_at) VALUES (?, ?, ?)",
                    [(quote["symbol"], quote["price"], sampled_at) for quote in quotes if quote["asset_class"] == "stock"],
                )
                conn.execute("DELETE FROM market_history WHERE recorded_at<?", (sampled_at - 60 * 60 * 24 * 90,))
                save_market_status(conn, url, True, len(quotes), "")
                conn.commit()
                refresh_company_metadata(conn)
                return market_from_cache(conn)
            last_error = "Kaynak veri döndürdü ama sembol ayrıştırılamadı"
        except Exception as exc:
            last_error = str(exc)
    count = conn.execute("SELECT COUNT(*) c FROM market_cache").fetchone()["c"]
    save_market_status(conn, "fallback-cache", False, count, last_error or "Canlı kaynak okunamadı")
    conn.commit()
    return market_from_cache(conn)


def find_quote(conn: sqlite3.Connection, symbol: str, *, refresh: bool = False) -> dict | None:
    if refresh:
        refresh_market(conn)
    row = conn.execute("SELECT * FROM market_cache WHERE symbol=?", (symbol.upper(),)).fetchone()
    return dict(row) if row else None


def position_quantity(conn: sqlite3.Connection, user_id: int, symbol: str) -> int:
    row = conn.execute("SELECT quantity FROM positions WHERE user_id=? AND symbol=?", (user_id, symbol)).fetchone()
    return int(row["quantity"]) if row else 0


def reserved_sell_quantity(conn: sqlite3.Connection, user_id: int, symbol: str, exclude_order_id: int | None = None) -> int:
    params: list[object] = [user_id, symbol.upper()]
    extra = ""
    if exclude_order_id:
        extra = " AND id<>?"
        params.append(exclude_order_id)
    row = conn.execute(
        f"""
        SELECT COALESCE(SUM(quantity), 0) AS qty
        FROM orders
        WHERE user_id=? AND symbol=? AND side='sell' AND status='pending'{extra}
        """,
        tuple(params),
    ).fetchone()
    return int(row["qty"] or 0)


def available_position_quantity(conn: sqlite3.Connection, user_id: int, symbol: str, exclude_order_id: int | None = None) -> int:
    return max(0, position_quantity(conn, user_id, symbol) - reserved_sell_quantity(conn, user_id, symbol, exclude_order_id))


def status_label(value: str) -> str:
    return {
        "pending": "Beklemede",
        "awaiting_back": "Belge Bekleniyor",
        "under_review": "İnceleniyor",
        "approved": "Onaylandı",
        "test_account": "Test Hesabı",
        "consumed": "Alımda Kullanıldı",
        "rejected": "Reddedildi",
        "cancelled": "İptal",
    }.get(value, value)


REQUIRED_IDENTITY_DOCUMENTS = {"identity_front", "identity_back", "selfie"}


def kyc_document_state(conn: sqlite3.Connection, user_id: int) -> dict:
    rows = conn.execute(
        "SELECT doc_type, status FROM documents WHERE user_id=? ORDER BY created_at DESC, id DESC",
        (user_id,),
    ).fetchall()
    latest: dict[str, str] = {}
    for row in rows:
        latest.setdefault(str(row["doc_type"]), str(row["status"]))
    missing = sorted(REQUIRED_IDENTITY_DOCUMENTS - set(latest))
    rejected = sorted(doc_type for doc_type, status in latest.items() if doc_type in REQUIRED_IDENTITY_DOCUMENTS and status in {"rejected", "awaiting_back"})
    approved = not missing and not rejected and all(latest.get(doc_type) == "approved" for doc_type in REQUIRED_IDENTITY_DOCUMENTS)
    return {"approved": approved, "missing": missing, "rejected": rejected, "latest": latest}


def sync_user_kyc(conn: sqlite3.Connection, user_id: int) -> dict:
    user = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    if not user:
        raise HttpError(404, "Kullanıcı bulunamadı")
    if int(user["is_test_user"] or 0):
        conn.execute("UPDATE users SET status='approved', kyc_status='test_account' WHERE id=?", (user_id,))
        return {"approved": True, "test_account": True, "missing": []}
    state = kyc_document_state(conn, user_id)
    if state["approved"]:
        conn.execute(
            "UPDATE users SET status='approved', kyc_status='approved', kyc_note='', approved_at=COALESCE(approved_at, ?) WHERE id=?",
            (now(), user_id),
        )
    elif state["rejected"]:
        conn.execute("UPDATE users SET status='awaiting_back', kyc_status='awaiting_back' WHERE id=?", (user_id,))
    elif state["missing"]:
        conn.execute("UPDATE users SET status='pending', kyc_status='awaiting_back' WHERE id=?", (user_id,))
    else:
        conn.execute("UPDATE users SET status='pending', kyc_status='under_review' WHERE id=?", (user_id,))
    return state


class OfficialLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._href = ""
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "a":
            self._href = dict(attrs).get("href") or ""
            self._text = []

    def handle_data(self, data: str) -> None:
        if self._href:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._href:
            text = re.sub(r"\s+", " ", unescape(" ".join(self._text))).strip()
            if text:
                self.links.append((self._href, text))
            self._href = ""
            self._text = []


def fetch_official_text(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Ottoman/1.0"},
    )
    with urllib.request.urlopen(request, timeout=6) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def parse_feed_time(value: str) -> int:
    try:
        return int(parsedate_to_datetime(value).timestamp())
    except (TypeError, ValueError, OverflowError):
        return 0


def tcmb_news() -> list[dict]:
    body = fetch_official_text(NEWS_SOURCES["TCMB"])
    root = ET.fromstring(body)
    items = []
    atom = "{http://www.w3.org/2005/Atom}"
    nodes = root.findall(".//item") or root.findall(f".//{atom}entry")
    for index, node in enumerate(nodes[:12]):
        title = re.sub(r"\s+", " ", unescape(node.findtext("title") or node.findtext(f"{atom}title") or "")).strip()
        link_node = node.find(f"{atom}link")
        link = ((node.findtext("link") or "").strip() or (link_node.get("href", "") if link_node is not None else ""))
        published = (node.findtext("pubDate") or node.findtext(f"{atom}published") or "").strip()
        if title and link:
            items.append({
                "source": "TCMB",
                "title": title,
                "url": urljoin("https://www.tcmb.gov.tr", link),
                "published_at": published,
                "kind": "Para Politikası",
                "_sort": parse_feed_time(published) or now() - index,
            })
    return items


def html_announcement_news(source: str, url: str, path_marker: str, kind: str) -> list[dict]:
    parser = OfficialLinkParser()
    parser.feed(fetch_official_text(url))
    items = []
    seen = set()
    for href, title in parser.links:
        absolute = urljoin(url, href)
        if path_marker not in absolute.lower() or len(title) < 18 or absolute in seen:
            continue
        seen.add(absolute)
        items.append({
            "source": source,
            "title": title[:240],
            "url": absolute,
            "published_at": "Güncel resmi duyuru",
            "kind": kind,
            "_sort": now() - len(items),
        })
        if len(items) >= 12:
            break
    return items


def spk_bulletin_news() -> list[dict]:
    url = NEWS_SOURCES["SPK"].format(year=time.localtime().tm_year)
    parser = OfficialLinkParser()
    parser.feed(fetch_official_text(url))
    items = []
    for href, title in parser.links:
        if "/data/" not in href.lower() or not href.lower().endswith(".pdf") or not title.startswith("Bülten No"):
            continue
        published = title.split("Yayımlanma :", 1)[1].strip() if "Yayımlanma :" in title else "Güncel SPK bülteni"
        bulletin = title.split("Yayımlanma", 1)[0].strip()
        items.append({
            "source": "SPK",
            "title": bulletin,
            "url": urljoin(url, href),
            "published_at": published,
            "kind": "SPK Bülteni",
            "_sort": now() - len(items),
        })
        if len(items) >= 12:
            break
    return items


def official_news() -> tuple[list[dict], dict]:
    if NEWS_CACHE["items"] and now() - int(NEWS_CACHE["updated_at"]) < NEWS_REFRESH_SECONDS:
        return NEWS_CACHE["items"], news_meta()

    items: list[dict] = []
    errors: list[str] = []
    sources = [
        ("TCMB", lambda: tcmb_news()),
        ("Borsa İstanbul", lambda: html_announcement_news("Borsa İstanbul", NEWS_SOURCES["Borsa İstanbul"], "/duyuru/", "Piyasa Duyurusu")),
        ("SPK", lambda: spk_bulletin_news()),
    ]
    with ThreadPoolExecutor(max_workers=len(sources)) as executor:
        futures = {executor.submit(loader): source for source, loader in sources}
        for future in as_completed(futures):
            source = futures[future]
            try:
                items.extend(future.result())
            except (OSError, ValueError, ET.ParseError):
                errors.append(source)

    if items:
        items.sort(key=lambda item: item.get("_sort", 0), reverse=True)
        for item in items:
            item.pop("_sort", None)
        NEWS_CACHE.update({"items": items[:36], "updated_at": now(), "errors": errors})
    elif not NEWS_CACHE["items"]:
        fallback = [
            {"source": "KAP", "title": "Şirket bildirimlerini KAP üzerinden inceleyin", "url": NEWS_SOURCES["KAP"], "published_at": "Resmi bildirim kaynağı", "kind": "Şirket Bildirimleri"},
            {"source": "Borsa İstanbul", "title": "Borsa İstanbul güncel piyasa duyuruları", "url": NEWS_SOURCES["Borsa İstanbul"], "published_at": "Resmi duyuru kaynağı", "kind": "Piyasa Duyuruları"},
            {"source": "TCMB", "title": "TCMB basın duyuruları ve para politikası gelişmeleri", "url": NEWS_SOURCES["TCMB"], "published_at": "Resmi duyuru kaynağı", "kind": "Para Politikası"},
            {"source": "SPK", "title": "Sermaye Piyasası Kurulu haftalık bültenleri", "url": NEWS_SOURCES["SPK"].format(year=time.localtime().tm_year), "published_at": "Resmi bülten kaynağı", "kind": "SPK Bültenleri"},
        ]
        NEWS_CACHE.update({"items": fallback, "updated_at": now(), "errors": errors or ["Haber kaynakları"]})
    return NEWS_CACHE["items"], news_meta()


def news_meta() -> dict:
    return {
        "ok": bool(NEWS_CACHE["items"]) and len(NEWS_CACHE["errors"]) < 3,
        "degraded": bool(NEWS_CACHE["errors"]),
        "errors": NEWS_CACHE["errors"],
        "updated_at_label": iso_time(int(NEWS_CACHE["updated_at"])) if NEWS_CACHE["updated_at"] else None,
        "sources": [{"name": name, "url": url.format(year=time.localtime().tm_year)} for name, url in NEWS_SOURCES.items()],
    }


def company_news(symbol: str, company_name: str) -> tuple[list[dict], list[dict]]:
    cached = COMPANY_NEWS_CACHE.get(symbol)
    if cached and now() - int(cached.get("updated_at", 0)) < NEWS_REFRESH_SECONDS:
        return cached.get("news", []), cached.get("analysis", [])

    short_name = re.sub(r"\b(A\.?Ş\.?|A\.S\.|T\.A\.Ş\.|T\.A\.S\.)\b", "", company_name, flags=re.IGNORECASE).strip()
    query = quote_plus(f'({symbol} OR "{short_name}") when:14d')
    url = f"https://news.google.com/rss/search?q={query}&hl=tr&gl=TR&ceid=TR:tr"
    items: list[dict] = []
    try:
        root = ET.fromstring(fetch_official_text(url))
        for index, node in enumerate(root.findall(".//item")[:24]):
            title = re.sub(r"\s+", " ", unescape(node.findtext("title") or "")).strip()
            link = (node.findtext("link") or "").strip()
            published = (node.findtext("pubDate") or "").strip()
            source_node = node.find("source")
            source = re.sub(r"\s+", " ", unescape(source_node.text or "")).strip() if source_node is not None else "Haber kaynağı"
            if not title or not link:
                continue
            items.append(
                {
                    "source": source,
                    "title": title[:240],
                    "url": link,
                    "published_at": published or "Güncel",
                    "kind": "Şirket Haberi",
                    "_sort": parse_feed_time(published) or now() - index,
                }
            )
    except (OSError, ValueError, ET.ParseError):
        items = []

    analysis_pattern = re.compile(r"analiz|hedef fiyat|değerlendirme|beklenti|yorum|teknik görünüm|model portföy", re.IGNORECASE)
    analysis = [item for item in items if analysis_pattern.search(item["title"])][:4]
    news = [item for item in items if item not in analysis][:6]
    if len(news) < 2:
        news = items[:6]
    for item in news + analysis:
        item.pop("_sort", None)
    COMPANY_NEWS_CACHE[symbol] = {"news": news, "analysis": analysis, "updated_at": now()}
    return news, analysis


def company_profile(conn: sqlite3.Connection, quote: dict) -> dict:
    symbol = quote["symbol"]
    custom = conn.execute("SELECT * FROM stock_descriptions WHERE symbol=?", (symbol,)).fetchone()
    description = str(custom["description"] or "").strip() if custom else ""
    activity = str(quote.get("industry") or quote.get("sector") or "sermaye piyasaları").strip()
    if not description:
        description = (
            f"{quote['name']}, Borsa İstanbul'da {symbol} koduyla işlem gören halka açık bir şirkettir. "
            f"Şirketin güncel faaliyet sınıflandırması {activity} alanındadır. Finansal sonuçlar, özel durum açıklamaları "
            "ve yönetim duyuruları resmi KAP bildirimleriyle birlikte değerlendirilmelidir."
        )
    return {
        "description": description,
        "risk_note": str(custom["risk_note"] or "").strip() if custom else "",
        "sector": str(quote.get("sector") or "Belirtilmemiş"),
        "industry": str(quote.get("industry") or quote.get("sector") or "Belirtilmemiş"),
        "official_site": f"https://{OFFICIAL_COMPANY_DOMAINS[symbol]}/" if symbol in OFFICIAL_COMPANY_DOMAINS else "",
    }


class AppHandler(BaseHTTPRequestHandler):
    server_version = "OttomanBackend/1.0"

    ALLOWED_ORIGINS = {
        "http://localhost:4173", "http://localhost:5173", "http://localhost:3000",
        "http://localhost:8008",
        "https://ottoman.local", "capacitor://ottoman.local", "https://localhost",
        "capacitor://localhost", "http://localhost",
    }

    def _cors_headers(self) -> None:
        origin = self.headers.get("Origin", "")
        host = self.headers.get("Host", "")
        # Allow same-host, allowed origins list, and any Capacitor/localhost origin
        if (origin and (
            urlparse(origin).netloc == host
            or origin in self.ALLOWED_ORIGINS
            or origin.startswith("capacitor://")
            or "localhost" in origin
            or "onrender.com" in origin
        )):
            self.send_header("Access-Control-Allow-Origin", origin)
        else:
            self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Cookie, Authorization, X-Session-Id")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors_headers()
        self.end_headers()


    def do_GET(self) -> None:
        self.dispatch("GET")

    def do_POST(self) -> None:
        self.dispatch("POST")

    def dispatch(self, method: str) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        try:
            if method == "GET" and path in {"/healthz", "/api/health"}:
                self.api_health()
            elif path.startswith("/api"):
                self.route_api(method, path)
            elif path.startswith("/uploads"):
                self.serve_upload(path)
            else:
                self.serve_static(path)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            return
        except HttpError as exc:
            self.json_response({"error": exc.message}, exc.status)
        except Exception as exc:
            print(f"Unhandled error: {exc}")
            self.json_response({"error": "Sunucu hatası"}, 500)

    def route_api(self, method: str, path: str) -> None:
        if method == "GET" and path == "/api/me":
            return self.api_me()
        if method == "POST" and path == "/api/login":
            return self.api_login()
        if method == "POST" and path == "/api/password/forgot":
            return self.api_forgot_password()
        if method == "POST" and path == "/api/password/reset":
            return self.api_reset_password()
        if method == "POST" and path == "/api/logout":
            return self.api_logout()
        if method == "POST" and path == "/api/profile/password":
            return self.api_change_password()
        if method == "GET" and path == "/api/profile/security":
            return self.api_profile_security()
        if method == "POST" and path == "/api/profile/2fa/setup":
            return self.api_setup_two_factor()
        if method == "POST" and path == "/api/profile/2fa/confirm":
            return self.api_confirm_two_factor()
        if method == "POST" and path == "/api/profile/2fa/disable":
            return self.api_disable_two_factor()
        if method == "POST" and path == "/api/profile/sessions/revoke":
            return self.api_revoke_sessions()
        if method == "POST" and path == "/api/profile/documents":
            return self.api_upload_documents()
        if path == "/api/profile/reset" and method in {"GET", "POST"}:
            return self.api_reset_test_account(method)
        if method == "POST" and path == "/api/register":
            return self.api_register()
        if method == "GET" and path == "/api/public/config":
            return self.api_public_config()
        if method == "POST" and path == "/api/contact":
            return self.api_contact()
        if method == "GET" and path == "/api/market":
            return self.api_market()
        if method == "GET" and path == "/api/news":
            return self.api_news()
        if method == "GET" and path.startswith("/api/logo/"):
            parts = path.strip("/").split("/")
            if len(parts) == 3:
                return self.api_company_logo(parts[2])
        if method == "GET" and path.startswith("/api/company/"):
            parts = path.strip("/").split("/")
            if len(parts) == 3:
                return self.api_company(parts[2])
        if method == "GET" and path == "/api/system-bank-accounts":
            return self.api_system_bank_accounts()
        if method == "GET" and path == "/api/portfolio":
            return self.api_portfolio()
        if method == "GET" and path == "/api/orders":
            return self.api_orders()
        if method == "GET" and path == "/api/transactions/export":
            return self.api_transactions_export()
        if method == "POST" and path == "/api/orders":
            return self.api_create_order()
        if method == "GET" and path == "/api/money-requests":
            return self.api_money_requests()
        if method == "POST" and path == "/api/money-requests":
            return self.api_create_money_request()
        if method == "GET" and path == "/api/admin/summary":
            return self.api_admin_summary()
        if method == "POST" and path == "/api/admin/step-up":
            return self.api_admin_step_up()
        if method == "GET" and path == "/api/admin/users":
            return self.api_admin_users()
        if method == "GET" and path == "/api/admin/orders":
            return self.api_admin_orders()
        if method == "GET" and path == "/api/admin/money":
            return self.api_admin_money()
        if method == "GET" and path == "/api/admin/reports":
            return self.api_admin_reports()
        if method == "GET" and path == "/api/admin/reports/export":
            return self.api_admin_reports_export()
        if method == "GET" and path == "/api/admin/project-export":
            return self.api_admin_project_export()
        if method == "GET" and path == "/api/admin/project-export/apk":
            return self.api_admin_project_export_apk()
        if method == "GET" and path == "/api/admin/contact-messages":
            return self.api_admin_contact_messages()
        if method == "GET" and path == "/api/admin/documents":
            return self.api_admin_documents()
        if method == "GET" and path == "/api/admin/bank-accounts":
            return self.api_admin_bank_accounts()
        if method == "POST" and path == "/api/admin/bank-accounts":
            return self.api_admin_save_system_bank_account()
        if method == "GET" and path == "/api/admin/t2-settlements":
            return self.api_admin_t2_settlements()
        if method == "GET" and path == "/api/admin/transactions":
            return self.api_admin_transactions()
        if method == "GET" and path == "/api/admin/positions":
            return self.api_admin_positions()
        if method == "GET" and path == "/api/admin/user-balances":
            return self.api_admin_user_balances()
        if method == "GET" and path == "/api/admin/system-settings":
            return self.api_admin_system_settings()
        if method == "POST" and path == "/api/admin/system-settings":
            return self.api_admin_save_system_settings()
        if method == "GET" and path == "/api/admin/stock-descriptions":
            return self.api_admin_stock_descriptions()
        if method == "POST" and path == "/api/admin/stock-descriptions":
            return self.api_admin_save_stock_description()
        if method == "GET" and path == "/api/admin/render/status":
            return self.api_admin_render_status()
        if method == "POST" and path == "/api/admin/render/deploy":
            return self.api_admin_render_deploy()
        if method == "POST" and path == "/api/admin/render/domain":
            return self.api_admin_render_domain()
        if method == "POST" and path == "/api/admin/reset-account":
            return self.api_admin_reset_account()
        if method == "POST" and path == "/api/my/reset":
            return self.api_my_reset_account()
        if method == "POST":
            parts = path.strip("/").split("/")
            if len(parts) == 4 and parts[:2] == ["api", "orders"] and parts[3] == "cancel":
                return self.api_cancel_order(int(parts[2]))
            if len(parts) == 4 and parts[:2] == ["api", "orders"] and parts[3] == "edit":
                return self.api_edit_order(int(parts[2]))
            if len(parts) == 4 and parts[:2] == ["api", "money-requests"] and parts[3] == "cancel":
                return self.api_cancel_money_request(int(parts[2]))
            if len(parts) == 4 and parts[:3] == ["api", "admin", "bank-accounts"]:
                return self.api_admin_bank_account_action(int(parts[3]))
            if len(parts) == 5 and parts[:3] == ["api", "admin", "documents"] and parts[3].isdigit():
                return self.api_admin_document_action(int(parts[3]), parts[4])
            if len(parts) == 4 and parts[:3] == ["api", "admin", "t2-settlements"] and parts[3].isdigit():
                return self.api_admin_settle_t2(int(parts[3]))
            if len(parts) == 4 and parts[:3] == ["api", "admin", "users"] and parts[3].isdigit():
                return self.api_admin_update_user(int(parts[3]))
            if len(parts) == 3 and parts == ["api", "admin", "balances"]:
                return self.api_admin_adjust_balance()
            if len(parts) == 3 and parts == ["api", "admin", "positions"]:
                return self.api_admin_adjust_position()
            if len(parts) == 5 and parts[:2] == ["api", "admin"] and parts[2] in {"users", "orders", "money"}:
                return self.api_admin_action(parts[2], int(parts[3]), parts[4])
        raise HttpError(404, "İşlem bulunamadı")

    def json_response(self, data: dict | list, status: int = 200, extra_headers: dict | None = None) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors_headers()
        self.security_headers()
        for key, value in (extra_headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def security_headers(self) -> None:
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'")

    def request_ip(self) -> str:
        forwarded = self.headers.get("X-Forwarded-For", "").split(",", 1)[0].strip()
        return forwarded or self.client_address[0]

    def csv_response(self, filename: str, headers: list[str], rows: list[list[object]]) -> None:
        def csv_cell(value: object) -> str:
            text = str(value if value is not None else "").replace('"', '""')
            return f'"{text}"'
        body = ("\ufeff" + "\r\n".join([",".join(csv_cell(value) for value in headers), *[",".join(csv_cell(value) for value in row) for row in rows]])).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(body)))
        self.security_headers()
        self.end_headers()
        self.wfile.write(body)

    def api_health(self) -> None:
        storage_ok = DATA_DIR.exists() and os.access(DATA_DIR, os.W_OK)
        with connect_db() as conn:
            conn.execute("SELECT 1").fetchone()
        self.json_response(
            {
                "ok": bool(storage_ok),
                "db": True,
                "storage": bool(storage_ok),
                "time": iso_time(),
            },
            200 if storage_ok else 503,
        )

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length > 256_000:
            raise HttpError(413, "İstek çok büyük")
        raw = self.rfile.read(length) if length else b"{}"
        try:
            return json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            raise HttpError(400, "JSON okunamadı")

    def read_json_or_multipart(self) -> tuple[dict, MultipartForm | None]:
        if self.headers.get("Content-Type", "").startswith("multipart/form-data"):
            form = self.read_multipart()
            data = {}
            for key in form.keys():
                item = form[key]
                if isinstance(item, list) or getattr(item, "filename", ""):
                    continue
                data[key] = field_value(form, key)
            return data, form
        return self.read_json(), None

    def read_multipart(self) -> MultipartForm:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length > MAX_UPLOAD_BYTES * 4:
            raise HttpError(413, "Dosya boyutu çok büyük")
        content_type = self.headers.get("Content-Type", "")
        if not content_type.startswith("multipart/form-data"):
            raise HttpError(400, "Form tipi hatalı")
        return MultipartForm(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": content_type,
                "CONTENT_LENGTH": str(length),
            },
        )

    def current_session_id(self) -> str:
        for k in ("Authorization", "authorization"):
            auth = str(self.headers.get(k, "") or "").strip()
            if auth.startswith("Bearer "):
                return auth[7:].strip()
            if auth and not auth.startswith("Basic ") and len(auth) > 10:
                return auth.strip()
        for k in ("X-Session-Id", "x-session-id", "X-Session-ID"):
            x_sid = str(self.headers.get(k, "") or "").strip()
            if x_sid:
                return x_sid
        cookie_header = str(self.headers.get("Cookie", "") or self.headers.get("cookie", "") or "")
        for part in cookie_header.split(";"):
            if "=" not in part:
                continue
            key, value = part.strip().split("=", 1)
            if key == COOKIE_NAME:
                return value
        return ""

    def current_user(self, conn: sqlite3.Connection) -> dict | None:
        sid = self.current_session_id()
        if not sid:
            return None
        row = conn.execute(
            """
            SELECT u.* FROM sessions s
            JOIN users u ON u.id=s.user_id
            WHERE s.sid=? AND s.expires_at>?
            """,
            (sid, now()),
        ).fetchone()
        if row:
            conn.execute("UPDATE sessions SET last_seen_at=? WHERE sid=?", (now(), sid))
        return dict(row) if row else None

    def require_user(self, conn: sqlite3.Connection) -> dict:
        user = self.current_user(conn)
        if not user:
            raise HttpError(401, "Oturum gerekli")
        return user

    def require_admin(self, conn: sqlite3.Connection) -> dict:
        user = self.require_user(conn)
        if user["role"] != "admin":
            raise HttpError(403, "Admin yetkisi gerekli")
        return user

    def require_admin_step_up(self, conn: sqlite3.Connection) -> None:
        row = conn.execute("SELECT step_up_until FROM sessions WHERE sid=?", (self.current_session_id(),)).fetchone()
        if not row or int(row["step_up_until"] or 0) < now():
            raise HttpError(403, "Finansal işlem için admin şifrenizi yeniden doğrulayın")

    def api_admin_step_up(self) -> None:
        payload = self.read_json()
        with connect_db() as conn:
            admin = self.require_admin(conn)
            if not verify_password(str(payload.get("password", "")), admin["password_salt"], admin["password_hash"]):
                raise HttpError(401, "Admin şifresi hatalı")
            conn.execute("UPDATE sessions SET step_up_until=? WHERE sid=?", (now() + 600, self.current_session_id()))
            audit(conn, admin["id"], "admin_step_up", "session", None, None, self.request_ip(), self.headers.get("User-Agent", ""))
            conn.commit()
            self.json_response({"ok": True, "valid_for_seconds": 600})

    def api_me(self) -> None:
        with connect_db() as conn:
            settle_due_t2(conn)
            user = self.current_user(conn)
            if not user:
                return self.json_response({"user": None})
            account = account_for(conn, user["id"])
            self.json_response({"user": public_user(user), "account": account})

    def api_login(self) -> None:
        payload = self.read_json()
        tc = re.sub(r"\D", "", str(payload.get("tc", "")))
        password = str(payload.get("password", ""))
        remember = bool(payload.get("remember"))
        if not re.fullmatch(r"\d{11}", tc) or len(password) < 6:
            raise HttpError(400, "T.C. ve şifre hatalı")
        with connect_db() as conn:
            user = conn.execute("SELECT * FROM users WHERE tc=?", (tc,)).fetchone()
            if user and int(user["locked_until"] or 0) > now():
                raise HttpError(429, "Çok sayıda hatalı deneme nedeniyle giriş geçici olarak kilitlendi")
            if not user or not verify_password(password, user["password_salt"], user["password_hash"]):
                if user:
                    attempts = int(user["failed_login_count"] or 0) + 1
                    locked_until = now() + LOGIN_LOCK_SECONDS if attempts >= LOGIN_MAX_ATTEMPTS else 0
                    conn.execute("UPDATE users SET failed_login_count=?, locked_until=? WHERE id=?", (attempts, locked_until, user["id"]))
                    audit(conn, user["id"], "login_failed", "session", None, {"attempt": attempts}, self.request_ip(), self.headers.get("User-Agent", ""))
                    conn.commit()
                raise HttpError(401, "Giriş bilgileri hatalı")
            if user["role"] != "admin" and user["status"] == "rejected":
                raise HttpError(403, f"Kayıt durumu: {status_label(user['status'])}")
            if int(user["two_factor_enabled"] or 0) and not verify_totp(str(user["two_factor_secret"] or ""), str(payload.get("otp", ""))):
                raise HttpError(401, "Doğrulama uygulamasındaki 6 haneli kod gerekli")
            sid = secrets.token_urlsafe(32)
            ttl = 60 * 60 * 24 * 30 if remember else SESSION_TTL
            conn.execute("DELETE FROM sessions WHERE expires_at<=?", (now(),))
            conn.execute(
                "INSERT INTO sessions (sid, user_id, expires_at, created_at, last_seen_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (sid, user["id"], now() + ttl, now(), now(), self.request_ip(), self.headers.get("User-Agent", "")[:240]),
            )
            conn.execute("UPDATE users SET failed_login_count=0, locked_until=0, last_login_at=? WHERE id=?", (now(), user["id"]))
            audit(conn, user["id"], "login", "session", None, None, self.request_ip(), self.headers.get("User-Agent", ""), sid[:16])
            conn.commit()
            cookie = f"{COOKIE_NAME}={sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age={ttl}"
            self.json_response({"user": public_user(dict(user)), "token": sid}, extra_headers={"Set-Cookie": cookie})

    def api_forgot_password(self) -> None:
        payload = self.read_json()
        tc = re.sub(r"\D", "", str(payload.get("tc", "")))
        email = str(payload.get("email", "")).strip().lower()
        delivered = False
        with connect_db() as conn:
            user = conn.execute("SELECT * FROM users WHERE tc=? AND lower(email)=?", (tc, email)).fetchone()
            if user:
                token = secrets.token_urlsafe(32)
                token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
                conn.execute("UPDATE password_reset_tokens SET used_at=? WHERE user_id=? AND used_at IS NULL", (now(), user["id"]))
                conn.execute(
                    "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
                    (user["id"], token_hash, now() + PASSWORD_RESET_TTL, now()),
                )
                base_url = os.environ.get("PUBLIC_BASE_URL", f"https://{self.headers.get('Host', '')}").rstrip("/")
                try:
                    delivered = send_reset_email(email, f"{base_url}/esube/giris?reset={token}")
                except (OSError, smtplib.SMTPException):
                    delivered = False
                audit(conn, user["id"], "password_reset_requested", "user", user["id"], {"delivered": delivered}, self.request_ip(), self.headers.get("User-Agent", ""))
                conn.commit()
        self.json_response({"ok": True, "message": "Bilgiler eşleşiyorsa şifre yenileme bağlantısı e-posta adresinize gönderildi."})

    def api_reset_password(self) -> None:
        payload = self.read_json()
        token = str(payload.get("token", ""))
        new_password = str(payload.get("new_password", ""))
        if not token or not password_is_strong(new_password):
            raise HttpError(400, "Geçerli bağlantı ve güçlü bir şifre gerekli")
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with connect_db() as conn:
            row = conn.execute(
                "SELECT * FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>?",
                (token_hash, now()),
            ).fetchone()
            if not row:
                raise HttpError(400, "Şifre yenileme bağlantısı geçersiz veya süresi dolmuş")
            salt, digest = hash_password(new_password)
            conn.execute("UPDATE users SET password_salt=?, password_hash=?, failed_login_count=0, locked_until=0 WHERE id=?", (salt, digest, row["user_id"]))
            conn.execute("UPDATE password_reset_tokens SET used_at=? WHERE id=?", (now(), row["id"]))
            conn.execute("DELETE FROM sessions WHERE user_id=?", (row["user_id"],))
            audit(conn, row["user_id"], "password_reset_completed", "user", row["user_id"], None, self.request_ip(), self.headers.get("User-Agent", ""))
            conn.commit()
        self.json_response({"ok": True, "message": "Şifreniz yenilendi. Yeni şifrenizle giriş yapabilirsiniz."})

    def api_profile_security(self) -> None:
        with connect_db() as conn:
            user = self.require_user(conn)
            rows = conn.execute(
                "SELECT sid, created_at, last_seen_at, ip_address, user_agent, expires_at FROM sessions WHERE user_id=? AND expires_at>? ORDER BY last_seen_at DESC",
                (user["id"], now()),
            ).fetchall()
            current_sid = self.current_session_id()
            self.json_response({
                "two_factor_enabled": bool(user["two_factor_enabled"]),
                "sessions": [{
                    "id": row["sid"][:12],
                    "current": row["sid"] == current_sid,
                    "created_at": iso_time(row["created_at"]),
                    "last_seen_at": iso_time(row["last_seen_at"]),
                    "ip_address": row["ip_address"],
                    "device": row["user_agent"][:120] or "Bilinmeyen cihaz",
                } for row in rows],
            })

    def api_setup_two_factor(self) -> None:
        payload = self.read_json()
        password = str(payload.get("current_password", ""))
        with connect_db() as conn:
            user = self.require_user(conn)
            if not verify_password(password, user["password_salt"], user["password_hash"]):
                raise HttpError(401, "Mevcut şifre hatalı")
            secret = base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")
            conn.execute("UPDATE users SET two_factor_secret=?, two_factor_enabled=0 WHERE id=?", (secret, user["id"]))
            conn.commit()
            issuer = quote_plus("Ottoman Yatırım")
            account = quote_plus(user["email"])
            self.json_response({"secret": secret, "otpauth_url": f"otpauth://totp/{issuer}:{account}?secret={secret}&issuer={issuer}&digits=6&period=30"})

    def api_confirm_two_factor(self) -> None:
        payload = self.read_json()
        with connect_db() as conn:
            user = self.require_user(conn)
            if not verify_totp(str(user["two_factor_secret"] or ""), str(payload.get("otp", ""))):
                raise HttpError(400, "Doğrulama kodu geçersiz")
            conn.execute("UPDATE users SET two_factor_enabled=1 WHERE id=?", (user["id"],))
            audit(conn, user["id"], "enable_two_factor", "user", user["id"])
            conn.commit()
            self.json_response({"ok": True})

    def api_disable_two_factor(self) -> None:
        payload = self.read_json()
        with connect_db() as conn:
            user = self.require_user(conn)
            if not verify_password(str(payload.get("current_password", "")), user["password_salt"], user["password_hash"]):
                raise HttpError(401, "Mevcut şifre hatalı")
            conn.execute("UPDATE users SET two_factor_enabled=0, two_factor_secret='' WHERE id=?", (user["id"],))
            audit(conn, user["id"], "disable_two_factor", "user", user["id"])
            conn.commit()
            self.json_response({"ok": True})

    def api_revoke_sessions(self) -> None:
        with connect_db() as conn:
            user = self.require_user(conn)
            conn.execute("DELETE FROM sessions WHERE user_id=? AND sid<>?", (user["id"], self.current_session_id()))
            audit(conn, user["id"], "revoke_other_sessions", "session", None)
            conn.commit()
            self.json_response({"ok": True})

    def api_change_password(self) -> None:
        payload = self.read_json()
        current_password = str(payload.get("current_password", ""))
        new_password = str(payload.get("new_password", ""))
        if not password_is_strong(new_password):
            raise HttpError(400, "Yeni şifre en az 10 karakter, büyük/küçük harf ve rakam içermeli")
        with connect_db() as conn:
            user = self.require_user(conn)
            row = conn.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
            if not row or not verify_password(current_password, row["password_salt"], row["password_hash"]):
                raise HttpError(401, "Mevcut şifre hatalı")
            salt, digest = hash_password(new_password)
            conn.execute("UPDATE users SET password_salt=?, password_hash=? WHERE id=?", (salt, digest, user["id"]))
            conn.execute("DELETE FROM sessions WHERE user_id=? AND sid<>?", (user["id"], self.current_session_id()))
            audit(conn, user["id"], "change_password", "user", user["id"])
            conn.commit()
            self.json_response({"ok": True, "message": "Şifre güncellendi"})

    def api_upload_documents(self) -> None:
        form = self.read_multipart()
        with connect_db() as conn:
            user = self.require_user(conn)
            for doc_type in ("identity_front", "identity_back", "selfie"):
                save_document(conn, form, user["id"], doc_type)
            if user["role"] != "admin":
                conn.execute(
                    "UPDATE users SET status='pending', kyc_status='under_review', kyc_note='' WHERE id=?",
                    (user["id"],),
                )
            audit(conn, user["id"], "upload_identity_documents", "document", user["id"])
            conn.commit()
            self.json_response(
                {
                    "ok": True,
                    "message": "Kimlik belgeleri onaya gönderildi",
                    "documents": document_rows(conn, "WHERE d.user_id=?", (user["id"],)),
                },
                201,
            )

    def api_logout(self) -> None:
        with connect_db() as conn:
            user = self.current_user(conn)
            if user:
                conn.execute("DELETE FROM sessions WHERE user_id=?", (user["id"],))
                audit(conn, user["id"], "logout", "session", None)
                conn.commit()
        self.json_response({"ok": True}, extra_headers={"Set-Cookie": f"{COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"})

    def api_register(self) -> None:
        form = self.read_multipart()
        full_name = field_value(form, "full_name")
        tc = re.sub(r"\D", "", field_value(form, "tc"))
        phone = field_value(form, "phone")
        email = field_value(form, "email")
        city = field_value(form, "city")
        district = field_value(form, "district")
        birth_date = field_value(form, "birth_date")
        address = field_value(form, "address")
        password = field_value(form, "password")
        accepted = {
            "kvkk": field_value(form, "accept_kvkk") in {"1", "true", "on", "yes"},
            "distance_contract": field_value(form, "accept_distance_contract") in {"1", "true", "on", "yes"},
            "risk_disclosure": field_value(form, "accept_risk_disclosure") in {"1", "true", "on", "yes"},
        }
        numeric_answer_keys = ("risk_experience", "risk_horizon", "risk_loss", "risk_income", "trade_frequency", "knowledge_level")
        suitability_answers = {
            **{key: field_value(form, key) for key in numeric_answer_keys},
            "education": field_value(form, "education"),
            "occupation": field_value(form, "occupation"),
            "traded_products": field_value(form, "traded_products"),
            "investment_goal": field_value(form, "investment_goal"),
        }
        try:
            suitability_score = sum(max(0, min(3, int(suitability_answers[key]))) for key in numeric_answer_keys)
        except ValueError:
            suitability_score = -1
        if not full_name or not valid_turkish_identity_number(tc) or not password_is_strong(password) or not phone or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise HttpError(400, "Zorunlu kayıt bilgileri eksik")
        if not all(accepted.values()):
            raise HttpError(400, "KVKK, sözleşme ve risk bildirimleri kabul edilmelidir")
        if suitability_score < 0 or any(not suitability_answers[key] for key in ("education", "occupation", "traded_products", "investment_goal")):
            raise HttpError(400, "Yatırım uygunluk soruları tamamlanmalıdır")
        with connect_db() as conn:
            if conn.execute("SELECT id FROM users WHERE tc=?", (tc,)).fetchone():
                raise HttpError(409, "Bu T.C. ile kayıt var")
            salt, digest = hash_password(password)
            cur = conn.execute(
                """
                INSERT INTO users
                  (tc, password_salt, password_hash, full_name, phone, email, city, district, birth_date, address, role, status, kyc_status, kyc_note, risk_profile, suitability_score, suitability_completed_at, agreements_version, agreements_accepted_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', 'pending', 'awaiting_back', 'Kimlik belgelerinizi profilinizden yükleyin.', ?, ?, ?, ?, ?, ?)
                """,
                (tc, salt, digest, full_name, phone, email, city, district, birth_date, address, risk_profile_for(suitability_score), suitability_score, now(), AGREEMENTS_VERSION, now(), now()),
            )
            user_id = cur.lastrowid
            conn.execute("UPDATE users SET account_no=printf('OT%06d', id) WHERE id=?", (user_id,))
            conn.execute("INSERT INTO accounts (user_id, cash_balance, blocked_balance, credit_limit) VALUES (?, 0, 0, 0)", (user_id,))
            conn.executemany(
                "INSERT INTO user_agreements (user_id, agreement_type, agreement_version, accepted_at, ip_address) VALUES (?, ?, ?, ?, ?)",
                [(user_id, key, AGREEMENTS_VERSION, now(), self.request_ip()) for key in accepted],
            )
            conn.execute(
                "INSERT INTO suitability_assessments (user_id, answers_json, score, risk_profile, completed_at) VALUES (?, ?, ?, ?, ?)",
                (user_id, json.dumps(suitability_answers, ensure_ascii=False), suitability_score, risk_profile_for(suitability_score), now()),
            )
            audit(conn, user_id, "register", "user", user_id)
            conn.commit()
            self.json_response({"ok": True, "status": "pending", "message": "Hesap oluşturuldu. Kimlik belgeleri profilden yüklenmeli."}, 201)

    def api_market(self) -> None:
        with connect_db() as conn:
            quotes = refresh_market(conn)
            self.json_response({"quotes": quotes, "source": "trrealapi-market", "updated_at": iso_time(), "meta": market_status(conn)})

    def api_public_config(self) -> None:
        with connect_db() as conn:
            settings = settings_map(conn)
            company = {
                "name": settings.get("official_company_name", ""),
                "registry_number": settings.get("official_registry_number", ""),
                "mersis_number": settings.get("official_mersis_number", ""),
                "address": settings.get("official_address", ""),
                "phone": settings.get("official_phone", ""),
                "email": settings.get("official_email", ""),
                "license_text": settings.get("official_license_text", ""),
            }
            rate_bps = max(0.0, float(settings.get("commission_rate_bps", "0") or 0))
            self.json_response({
                "company": company,
                "branding": {
                    "name": settings.get("brand_name", "Ottoman"),
                    "descriptor": settings.get("brand_descriptor", "ÖZEL PORTFÖY & YATIRIM"),
                    "symbol": settings.get("brand_symbol", "A"),
                    "logo_url": settings.get("brand_logo_url", "/favicon.svg"),
                    "tagline": settings.get("brand_tagline", "Prestijli Varlık ve Fon Yönetimi"),
                    "primary": settings.get("ui_primary_color", "#007b53"),
                    "accent": settings.get("ui_accent_color", "#00a875"),
                    "danger": settings.get("ui_danger_color", "#ef4444"),
                    "font": settings.get("ui_font_family", "Inter"),
                    "radius": settings.get("ui_radius", "16"),
                    "support_email": settings.get("content_support_email", settings.get("official_email", "destek@ottoman.local")),
                    "support_phone": settings.get("content_support_phone", settings.get("official_phone", "0850 888 7000")),
                },
                "company_information_complete": all(company.get(key) for key in ("name", "registry_number", "address", "phone", "email", "license_text")),
                "fees": {
                    "stock_commission_rate_bps": rate_bps,
                    "stock_commission_rate_percent": rate_bps / 100,
                    "minimum_commission": max(0.0, float(settings.get("minimum_commission", "0") or 0)),
                    "configured": rate_bps > 0,
                },
                "agreements_version": AGREEMENTS_VERSION,
            })

    def api_contact(self) -> None:
        payload = self.read_json()
        full_name = str(payload.get("full_name", "")).strip()[:120]
        email = str(payload.get("email", "")).strip().lower()[:120]
        phone = str(payload.get("phone", "")).strip()[:40]
        subject = str(payload.get("subject", "Genel Bilgi")).strip()[:120]
        message = str(payload.get("message", "")).strip()[:2000]
        if not full_name or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) or len(message) < 10:
            raise HttpError(400, "Ad, geçerli e-posta ve en az 10 karakterlik mesaj gerekli")
        with connect_db() as conn:
            cur = conn.execute(
                "INSERT INTO contact_messages (full_name, email, phone, subject, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (full_name, email, phone, subject, message, now()),
            )
            audit(conn, None, "create_contact_message", "contact_message", cur.lastrowid, None, self.request_ip(), self.headers.get("User-Agent", ""))
            conn.commit()
            self.json_response({"ok": True, "reference": f"GM-DST-{int(cur.lastrowid):06d}"}, 201)

    def api_news(self) -> None:
        items, meta = official_news()
        self.json_response({"items": items, "meta": meta})

    def api_company_logo(self, raw_symbol: str) -> None:
        symbol = clean_symbol(raw_symbol)
        if not symbol:
            raise HttpError(400, "Hisse kodu hatalı")
        for suffix in ("svg", "png"):
            cached_path = LOGO_CACHE_DIR / f"{symbol}.{suffix}"
            if cached_path.exists() and cached_path.stat().st_size > 0:
                return self.serve_logo(cached_path)

        with connect_db() as conn:
            row = conn.execute("SELECT logo_url FROM market_cache WHERE symbol=?", (symbol,)).fetchone()
            if not row:
                refresh_market(conn)
                row = conn.execute("SELECT logo_url FROM market_cache WHERE symbol=?", (symbol,)).fetchone()
        tradingview_url = str(row["logo_url"] or "") if row else ""
        official_domain = OFFICIAL_COMPANY_DOMAINS.get(symbol, "")
        if tradingview_url.startswith(f"{TRADINGVIEW_LOGO_BASE}/"):
            source_url = tradingview_url
            suffix = "svg"
        elif official_domain:
            source_url = f"https://www.google.com/s2/favicons?domain_url=https%3A%2F%2F{official_domain}&sz=128"
            suffix = "png"
        else:
            raise HttpError(404, "Logo bulunamadı")

        request = urllib.request.Request(source_url, headers={"User-Agent": "OttomanBackend/2.0"})
        try:
            with urllib.request.urlopen(request, timeout=max(10.0, MARKET_TIMEOUT)) as response:
                body = response.read(512_001)
        except OSError as exc:
            raise HttpError(502, "Logo kaynağına ulaşılamadı") from exc
        valid_logo = b"<svg" in body[:2048].lower() if suffix == "svg" else body.startswith(b"\x89PNG\r\n\x1a\n")
        if len(body) > 512_000 or not valid_logo:
            raise HttpError(502, "Logo kaynağı geçersiz")
        cached_path = LOGO_CACHE_DIR / f"{symbol}.{suffix}"
        cached_path.write_bytes(body)
        self.serve_logo(cached_path)

    def serve_logo(self, path: Path) -> None:
        body = path.read_bytes()
        self.send_response(200)
        content_type = "image/svg+xml; charset=utf-8" if path.suffix.lower() == ".svg" else "image/png"
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "public, max-age=604800, immutable")
        self.security_headers()
        self.end_headers()
        self.wfile.write(body)

    def api_company(self, raw_symbol: str) -> None:
        symbol = clean_symbol(raw_symbol)
        if not symbol:
            raise HttpError(400, "Hisse kodu hatalı")
        with connect_db() as conn:
            self.require_user(conn)
            refresh_market(conn)
            quote = find_quote(conn, symbol)
            if not quote or quote.get("asset_class") != "stock":
                raise HttpError(404, "Hisse bulunamadı")
            profile = company_profile(conn, quote)
            news, analysis = company_news(symbol, quote["name"])
            history = [dict(row) for row in conn.execute(
                "SELECT price, recorded_at FROM market_history WHERE symbol=? ORDER BY recorded_at DESC LIMIT 120",
                (symbol,),
            ).fetchall()][::-1]
            research_sources = []
            if profile.get("official_site"):
                research_sources.append(
                    {
                        "name": "Resmi Şirket Sitesi",
                        "description": "Kurumsal profil, faaliyetler ve yatırımcı ilişkileri",
                        "url": profile["official_site"],
                    }
                )
            research_sources.extend(
                [
                    {
                        "name": "İş Yatırım Şirket Kartı",
                        "description": "Finansallar, oranlar ve yayımlanmış araştırma raporları",
                        "url": f"https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/sirket-karti.aspx?hisse={symbol}",
                    },
                    {
                        "name": "TradingView Teknik Görünüm",
                        "description": "Fiyat grafiği ve teknik göstergeler",
                        "url": f"https://tr.tradingview.com/symbols/BIST-{symbol}/technicals/",
                    },
                    {
                        "name": "KAP Bildirimleri",
                        "description": "Resmi şirket bildirimleri ve finansal açıklamalar",
                        "url": "https://www.kap.org.tr/tr/bildirim-sorgu",
                    },
                ]
            )
            self.json_response(
                {
                    "quote": quote,
                    "profile": profile,
                    "news": news[:4],
                    "analysis": analysis[:3],
                    "history": [{"price": item["price"], "recorded_at": item["recorded_at"], "recorded_at_label": iso_time(item["recorded_at"])} for item in history],
                    "research_sources": research_sources,
                    "disclaimer": "Haber ve araştırma bağlantıları bilgi amaçlıdır; yatırım tavsiyesi değildir.",
                }
            )

    def api_system_bank_accounts(self) -> None:
        with connect_db() as conn:
            rows = system_bank_account_rows(conn, active_only=True)
            self.json_response({"bank_accounts": rows})

    def api_portfolio(self) -> None:
        with connect_db() as conn:
            settle_due_t2(conn)
            user = self.require_user(conn)
            account = account_for(conn, user["id"])
            positions = portfolio_rows(conn, user["id"])
            orders = order_rows(conn, "WHERE o.user_id=?", (user["id"],))
            money = money_rows(conn, "WHERE m.user_id=?", (user["id"],))
            bank_accounts = user_bank_account_rows(conn, user["id"])
            transactions = transaction_rows(conn, "WHERE t.user_id=?", (user["id"],))
            settlements = t2_settlement_rows(conn, "WHERE s.user_id=?", (user["id"],))
            system_accounts = system_bank_account_rows(conn, active_only=True)
            documents = document_rows(conn, "WHERE d.user_id=?", (user["id"],))
            settings = settings_map(conn)
            self.json_response(
                {
                    "account": account,
                    "positions": positions,
                    "orders": orders,
                    "money_requests": money,
                    "bank_accounts": bank_accounts,
                    "transactions": transactions,
                    "t2_settlements": settlements,
                    "system_bank_accounts": system_accounts,
                    "documents": documents,
                    "settlement_settings": {"t2_enabled": settings.get("t2_enabled", "1") == "1"},
                }
            )

    def api_orders(self) -> None:
        with connect_db() as conn:
            user = self.require_user(conn)
            self.json_response({"orders": order_rows(conn, "WHERE o.user_id=?", (user["id"],))})

    def api_transactions_export(self) -> None:
        with connect_db() as conn:
            user = self.require_user(conn)
            rows = filtered_transactions(conn, user_id=user["id"], query=parse_qs(urlparse(self.path).query))
            self.csv_response(
                "hesap-hareketleri.csv",
                ["Referans", "Tarih", "İşlem", "Sembol", "Adet", "Fiyat", "Tutar", "Bakiye", "Açıklama"],
                [[row["reference"], row["created_at_label"], row["type_label"], row["code"], row["quantity"], row["price"], row["total"], row["balance_after"], row["note"]] for row in rows],
            )

    def api_cancel_order(self, order_id: int) -> None:
        with connect_db() as conn:
            user = self.require_user(conn)
            order = conn.execute("SELECT * FROM orders WHERE id=? AND user_id=?", (order_id, user["id"])).fetchone()
            if not order or order["status"] != "pending":
                raise HttpError(404, "İptal edilebilir bekleyen emir bulunamadı")
            if order["side"] == "buy":
                release_order_reservation(conn, order_id)
            conn.execute("UPDATE orders SET status='cancelled', admin_note=?, reviewed_at=? WHERE id=?", ("Kullanıcı tarafından iptal edildi", now(), order_id))
            audit(conn, user["id"], "cancel_order", "order", order_id)
            conn.commit()
            self.json_response({"ok": True, "message": "Emir iptal edildi"})

    def api_edit_order(self, order_id: int) -> None:
        payload = self.read_json()
        quantity = int(float(payload.get("quantity", 0) or 0))
        price = float(payload.get("limit_price", 0) or 0)
        if quantity <= 0 or price <= 0:
            raise HttpError(400, "Emir bilgileri hatalı")
        with connect_db() as conn:
            user = self.require_user(conn)
            order = conn.execute("SELECT * FROM orders WHERE id=? AND user_id=?", (order_id, user["id"])).fetchone()
            if not order or order["status"] != "pending":
                raise HttpError(404, "Düzenlenebilir bekleyen emir bulunamadı")
            gross_total = round(quantity * price, 2)
            commission = commission_for(conn, gross_total)
            total = round(gross_total + commission if order["side"] == "buy" else max(0, gross_total - commission), 2)
            if order["side"] == "buy":
                diff = round(total - float(order["total"]), 2)
                if diff > 0:
                    reserve_buying_power(conn, user["id"], order_id, diff)
                elif diff < 0:
                    release_order_reservation(conn, order_id, abs(diff))
            elif available_position_quantity(conn, user["id"], order["symbol"], order_id) < quantity:
                raise HttpError(422, "Yetersiz satılabilir hisse")
            conn.execute(
                "UPDATE orders SET quantity=?, limit_price=?, gross_total=?, commission=?, total=?, reviewed_at=NULL WHERE id=?",
                (quantity, price, gross_total, commission, total, order_id),
            )
            audit(conn, user["id"], "edit_order", "order", order_id, {"total": total})
            conn.commit()
            self.json_response({"order": order_rows(conn, "WHERE o.id=?", (order_id,))[0], "message": "Emir güncellendi"})

    def api_create_order(self) -> None:
        payload = self.read_json()
        symbol = re.sub(r"[^A-Z0-9]", "", str(payload.get("symbol", "")).upper())
        side = str(payload.get("side", "")).lower()
        amount_mode = str(payload.get("amount_mode", "quantity")).lower()
        try:
            quantity = int(float(payload.get("quantity", 0) or 0))
            cash_amount = float(payload.get("cash_amount", 0) or 0)
        except (TypeError, ValueError):
            raise HttpError(400, "Emir tutarı veya adedi hatalı")
        order_type = str(payload.get("order_type", "limit")).lower()
        cancel_remaining = 1 if str(payload.get("cancel_remaining", "")).lower() in {"1", "true", "on", "yes"} else 0
        note = str(payload.get("note", ""))[:500]
        client_order_id = re.sub(r"[^A-Za-z0-9_-]", "", str(payload.get("client_order_id", "")))[:64]
        with connect_db() as conn:
            user = self.require_user(conn)
            settle_due_t2(conn)
            settings = settings_map(conn)
            if settings.get("maintenance_mode") == "1":
                raise HttpError(503, "Platform bakım modunda")
            if settings.get("trading_enabled") != "1":
                raise HttpError(403, "Alım-satım işlemleri geçici olarak kapalı")
            if user["role"] != "admin" and user["status"] != "approved":
                raise HttpError(403, "Kayıt onayı olmadan emir oluşturulamaz")
            if side not in {"buy", "sell"} or not symbol or order_type not in {"limit", "market"}:
                raise HttpError(400, "Emir bilgileri hatalı")
            quote = find_quote(conn, symbol, refresh=True)
            if not quote or quote.get("asset_class") != "stock":
                raise HttpError(404, "Hisse bulunamadı")
            source_state = market_status(conn)
            if REQUIRE_LIVE_MARKET_FOR_TRADING and (not bool(source_state.get("ok")) or now() - int(quote.get("updated_at") or 0) > max(300, MARKET_REFRESH_SECONDS * 5)):
                raise HttpError(503, "Canlı piyasa verisi doğrulanamadığı için emir geçici olarak kapalı")
            if client_order_id:
                existing = conn.execute("SELECT id FROM orders WHERE user_id=? AND client_order_id=?", (user["id"], client_order_id)).fetchone()
                if existing:
                    return self.json_response({"order": order_rows(conn, "WHERE o.id=?", (existing["id"],))[0], "duplicate": True})
            price = float(quote["price"] if order_type == "market" else (payload.get("limit_price") or quote["price"]))
            if price <= 0:
                raise HttpError(400, "Fiyat hatalı")
            if side == "buy" and amount_mode == "cash":
                if cash_amount <= 0:
                    raise HttpError(400, "Geçerli TL tutarı girin")
                quantity = int(cash_amount / price)
                while quantity > 0:
                    candidate_gross = round(quantity * price, 2)
                    if candidate_gross + commission_for(conn, candidate_gross) <= cash_amount + 0.001:
                        break
                    quantity -= 1
            if quantity <= 0:
                raise HttpError(400, "TL tutarı en az 1 adet hisse alacak kadar olmalı" if side == "buy" and amount_mode == "cash" else "Emir adedi hatalı")
            gross_total = round(quantity * price, 2)
            commission = commission_for(conn, gross_total)
            total = round(gross_total + commission if side == "buy" else max(0, gross_total - commission), 2)
            account = account_for(conn, user["id"])
            if side == "buy" and buying_power(account) < total:
                raise HttpError(422, "Yetersiz işlem bakiyesi")
            if side == "sell" and available_position_quantity(conn, user["id"], symbol) < quantity:
                raise HttpError(422, "Yetersiz satılabilir hisse")
            status = "approved" if order_type == "market" else "pending"
            cur = conn.execute(
                """
                INSERT INTO orders
                  (user_id, symbol, side, order_type, quantity, limit_price, source_price, gross_total, commission, total, client_order_id, execution_reference, price_updated_at, cancel_remaining, status, note, created_at, reviewed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (user["id"], symbol, side, order_type, quantity, price, quote["price"], gross_total, commission, total, client_order_id, f"GM-EMR-{now()}-{secrets.randbelow(10000):04d}", int(quote.get("updated_at") or now()), cancel_remaining, status, note, now(), now() if status == "approved" else None),
            )
            order_id = cur.lastrowid
            if side == "buy":
                before = buying_power(account)
                cash_used, pending_used = reserve_buying_power(conn, user["id"], order_id, total)
                after = round(before - total, 2)
                if order_type == "market":
                    upsert_position(conn, user["id"], symbol, quantity, price)
                    detail = f"Brüt: {gross_total:.2f} · Komisyon: {commission:.2f} · Çekilebilir: {cash_used:.2f} · T+2: {pending_used:.2f}"
                    write_transaction(conn, user["id"], "trade_buy", total, before, after, order_id=order_id, code=symbol, name=quote["name"], quantity=quantity, price=price, note=detail)
            elif order_type == "market":
                avg_price = position_avg_price(conn, user["id"], symbol)
                reduce_position(conn, user["id"], symbol, quantity)
                credit_sale_proceeds(conn, user["id"], order_id, symbol, quote["name"], total, quantity, price, f"Ortalama maliyet: {avg_price:.2f} · Brüt: {gross_total:.2f} · Komisyon: {commission:.2f}")
            audit(conn, user["id"], "create_order", "order", order_id, {"symbol": symbol, "side": side, "total": total, "order_type": order_type})
            conn.commit()
            self.json_response({"order": order_rows(conn, "WHERE o.id=?", (order_id,))[0]}, 201)

    def api_money_requests(self) -> None:
        with connect_db() as conn:
            user = self.require_user(conn)
            self.json_response({"money_requests": money_rows(conn, "WHERE m.user_id=?", (user["id"],))})

    def api_create_money_request(self) -> None:
        payload, form = self.read_json_or_multipart()
        request_type = str(payload.get("request_type", "")).lower()
        amount = float(payload.get("amount", 0) or 0)
        account_ref = str(payload.get("account_ref", ""))[:160]
        transfer_code = str(payload.get("transfer_code", "")).strip()[:80]
        note = str(payload.get("note", ""))[:500]
        if request_type not in {"deposit", "withdraw", "credit"} or amount <= 0:
            raise HttpError(400, "Geçerli bir tutar girin")
        with connect_db() as conn:
            user = self.require_user(conn)
            if user["role"] != "admin" and user["status"] != "approved":
                raise HttpError(403, "Hesabınız onaylanmadan para işlemi yapılamaz")
            account = account_for(conn, user["id"])
            bank_account_id = None
            if request_type == "deposit" and not account_ref:
                bank_row = conn.execute("SELECT * FROM system_bank_accounts WHERE is_active=1 ORDER BY sort_order ASC, id ASC LIMIT 1").fetchone()
                account_ref = bank_row["iban"] if bank_row else ""
            receipt = save_money_receipt(form, user["id"]) if form is not None and request_type == "deposit" else {}
            if request_type == "deposit":
                transfer_code = transfer_code or f"{user.get('account_no') or 'GM'}-{now()}"
                selected_iban = turkish_iban(account_ref)
                bank_row = conn.execute("SELECT * FROM system_bank_accounts WHERE is_active=1 AND REPLACE(iban, ' ', '')=?", (selected_iban,)).fetchone() if selected_iban else None
                if not bank_row:
                    raise HttpError(400, "Geçerli ve aktif transfer hesabı bulunamadı")
                if not receipt:
                    receipt = {"original_name": "", "stored_name": "", "content_type": ""}
                account_ref = selected_iban
            if request_type == "withdraw":
                if amount < 500:
                    raise HttpError(400, "Minimum çekim tutarı 500 TL'dir")
                account_holder = str(payload.get("account_holder", "")).strip()[:120]
                bank_name = str(payload.get("bank_name", "")).strip()[:120]
                iban = turkish_iban(str(payload.get("iban", "")))
                if not account_holder:
                    raise HttpError(400, "Hesap adı giriniz")
                if not bank_name:
                    raise HttpError(400, "Banka adı giriniz")
                if not iban:
                    raise HttpError(400, "Geçerli bir Türkiye IBAN'ı giriniz")
                if re.sub(r"\s+", " ", account_holder).strip().casefold() != re.sub(r"\s+", " ", user["full_name"]).strip().casefold():
                    raise HttpError(400, "Çekim hesabı sahibi kullanıcı adıyla aynı olmalıdır")
                if account["cash_balance"] < amount:
                    raise HttpError(422, "Yetersiz bakiye")
                conn.execute(
                    """
                    INSERT OR IGNORE INTO bank_accounts (user_id, bank_name, iban, account_holder, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (user["id"], bank_name, iban, account_holder, now()),
                )
                row = conn.execute("SELECT id FROM bank_accounts WHERE user_id=? AND iban=?", (user["id"], iban)).fetchone()
                bank_account_id = row["id"] if row else None
                account_ref = iban
                note = note or f"{bank_name} - {account_holder}"
            cur = conn.execute(
                """
                INSERT INTO money_requests
                  (user_id, request_type, amount, bank_account_id, account_ref, transfer_code, note, receipt_name, receipt_stored_name, receipt_content_type, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
                """,
                (
                    user["id"],
                    request_type,
                    amount,
                    bank_account_id,
                    account_ref,
                    transfer_code,
                    note,
                    receipt.get("original_name", ""),
                    receipt.get("stored_name", ""),
                    receipt.get("content_type", ""),
                    now(),
                ),
            )
            audit(conn, user["id"], "create_money_request", "money_request", cur.lastrowid, {"type": request_type, "amount": amount})
            conn.commit()
            self.json_response({"request": money_rows(conn, "WHERE m.id=?", (cur.lastrowid,))[0]}, 201)

    def api_cancel_money_request(self, request_id: int) -> None:
        with connect_db() as conn:
            user = self.require_user(conn)
            item = conn.execute("SELECT * FROM money_requests WHERE id=? AND user_id=?", (request_id, user["id"])).fetchone()
            if not item or item["status"] != "pending" or item["request_type"] != "withdraw":
                raise HttpError(404, "İptal edilebilir para çekme talebi bulunamadı")
            conn.execute(
                "UPDATE money_requests SET status='rejected', admin_note=?, reviewed_at=? WHERE id=?",
                ("Kullanıcı tarafından iptal edildi", now(), request_id),
            )
            audit(conn, user["id"], "cancel_withdrawal_request", "money_request", request_id)
            conn.commit()
            self.json_response({"ok": True, "message": "Para çekme talebi iptal edildi"})

    def api_admin_summary(self) -> None:
        with connect_db() as conn:
            settle_due_t2(conn)
            admin = self.require_admin(conn)
            counts = {
                "users": conn.execute("SELECT COUNT(*) c FROM users WHERE role='user'").fetchone()["c"],
                "pending_users": conn.execute("SELECT COUNT(*) c FROM users WHERE role='user' AND status='pending'").fetchone()["c"],
                "pending_orders": conn.execute("SELECT COUNT(*) c FROM orders WHERE status='pending'").fetchone()["c"],
                "pending_money": conn.execute("SELECT COUNT(*) c FROM money_requests WHERE status='pending'").fetchone()["c"],
                "pending_deposits": conn.execute("SELECT COUNT(*) c FROM money_requests WHERE request_type='deposit' AND status='pending'").fetchone()["c"],
                "pending_withdrawals": conn.execute("SELECT COUNT(*) c FROM money_requests WHERE request_type='withdraw' AND status='pending'").fetchone()["c"],
                "pending_t2": conn.execute("SELECT COUNT(*) c FROM t2_settlements WHERE status='pending'").fetchone()["c"],
                "cash_total": conn.execute("SELECT COALESCE(SUM(cash_balance),0) c FROM accounts").fetchone()["c"],
                "blocked_total": conn.execute("SELECT COALESCE(SUM(blocked_balance),0) c FROM accounts").fetchone()["c"],
                "pending_balance_total": conn.execute("SELECT COALESCE(SUM(pending_balance),0) c FROM accounts").fetchone()["c"],
            }
            audit(conn, admin["id"], "view_summary", "report", None)
            self.json_response({"summary": counts})

    def api_admin_users(self) -> None:
        with connect_db() as conn:
            self.require_admin(conn)
            rows = conn.execute(
                """
                SELECT u.*, a.cash_balance, a.blocked_balance, a.pending_balance, a.credit_limit,
                  (SELECT COUNT(*) FROM documents d WHERE d.user_id=u.id) AS document_count,
                  (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id) AS order_count,
                  (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id AND o.side='buy') AS buy_count,
                  (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id AND o.side='sell') AS sell_count,
                  (SELECT COUNT(*) FROM user_transactions t WHERE t.user_id=u.id) AS transaction_count
                FROM users u
                LEFT JOIN accounts a ON a.user_id=u.id
                WHERE u.role='user'
                ORDER BY u.created_at DESC
                """
            ).fetchall()
            self.json_response({"users": [public_user(dict(row), include_sensitive=True) for row in rows]})

    def api_admin_orders(self) -> None:
        with connect_db() as conn:
            self.require_admin(conn)
            self.json_response({"orders": order_rows(conn, "", ())})

    def api_admin_money(self) -> None:
        with connect_db() as conn:
            self.require_admin(conn)
            self.json_response({"money_requests": money_rows(conn, "", ())})

    def api_admin_reports(self) -> None:
        with connect_db() as conn:
            self.require_admin(conn)
            order_totals = [dict(row) for row in conn.execute("SELECT side, status, COUNT(*) count, COALESCE(SUM(total),0) total FROM orders GROUP BY side, status").fetchall()]
            money_totals = [dict(row) for row in conn.execute("SELECT request_type, status, COUNT(*) count, COALESCE(SUM(amount),0) total FROM money_requests GROUP BY request_type, status").fetchall()]
            users_by_status = [dict(row) for row in conn.execute("SELECT status, COUNT(*) count FROM users WHERE role='user' GROUP BY status").fetchall()]
            audit_rows = [dict(row) for row in conn.execute("SELECT a.*, u.full_name actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 120").fetchall()]
            for row in audit_rows:
                row["created_at_label"] = iso_time(row["created_at"])
                row["reference"] = f"GM-DNT-{int(row['id']):08d}"
            account_totals = conn.execute("SELECT COALESCE(SUM(cash_balance),0) cash, COALESCE(SUM(blocked_balance),0) blocked, COALESCE(SUM(pending_balance),0) pending, COALESCE(SUM(credit_limit),0) credit FROM accounts").fetchone()
            transaction_totals = conn.execute("SELECT transaction_type, COUNT(*) count, COALESCE(SUM(total),0) total FROM user_transactions GROUP BY transaction_type").fetchall()
            self.json_response({"orders": order_totals, "money": money_totals, "users": users_by_status, "audit": audit_rows, "reconciliation": dict(account_totals), "transactions": [dict(row) for row in transaction_totals]})

    def api_admin_reports_export(self) -> None:
        with connect_db() as conn:
            self.require_admin(conn)
            query = parse_qs(urlparse(self.path).query)
            export_type = (query.get("type") or ["transactions"])[0]
            if export_type == "audit":
                rows = conn.execute("SELECT a.*, u.full_name actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 5000").fetchall()
                return self.csv_response("denetim-kaydi.csv", ["Referans", "Tarih", "Yetkili", "İşlem", "Varlık", "Varlık No", "IP", "Detay"], [[f"GM-DNT-{row['id']:08d}", iso_time(row["created_at"]), row["actor_name"] or "Sistem", row["action"], row["entity_type"], row["entity_id"] or "", row["ip_address"], row["payload"]] for row in rows])
            rows = filtered_transactions(conn, query=query)
            return self.csv_response("mutabakat-hareketleri.csv", ["Referans", "Tarih", "Müşteri", "İşlem", "Sembol", "Adet", "Fiyat", "Tutar", "Önceki Bakiye", "Sonraki Bakiye", "Açıklama"], [[row["reference"], row["created_at_label"], row["full_name"], row["type_label"], row["code"], row["quantity"], row["price"], row["total"], row["balance_before"], row["balance_after"], row["note"]] for row in rows])

    def api_admin_contact_messages(self) -> None:
        with connect_db() as conn:
            self.require_admin(conn)
            rows = conn.execute("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 500").fetchall()
            self.json_response({"messages": [{**dict(row), "reference": f"GM-DST-{int(row['id']):06d}", "created_at_label": iso_time(row["created_at"])} for row in rows]})

    def api_admin_documents(self) -> None:
        with connect_db() as conn:
            self.require_admin(conn)
            self.json_response({"documents": document_rows(conn)})

    def api_admin_bank_accounts(self) -> None:
        with connect_db() as conn:
            self.require_admin(conn)
            self.json_response(
                {
                    "system_bank_accounts": system_bank_account_rows(conn, active_only=False),
                    "user_bank_accounts": user_bank_account_rows(conn),
                }
            )

    def api_admin_save_system_bank_account(self) -> None:
        payload = self.read_json()
        bank_id = int(payload.get("id", 0) or 0)
        bank_name = str(payload.get("bank_name", "")).strip()[:120]
        account_holder = str(payload.get("account_holder", "")).strip()[:120]
        iban = turkish_iban(str(payload.get("iban", "")))
        branch_name = str(payload.get("branch_name", "")).strip()[:120]
        description = str(payload.get("description", "")).strip()[:240]
        is_active = 1 if str(payload.get("is_active", "1")).lower() in {"1", "true", "on", "yes"} else 0
        sort_order = int(float(payload.get("sort_order", 0) or 0))
        if not bank_name or not account_holder or not iban:
            raise HttpError(400, "Banka adı, hesap sahibi ve geçerli Türkiye IBAN'ı gerekli")
        with connect_db() as conn:
            admin = self.require_admin(conn)
            self.require_admin_step_up(conn)
            if bank_id:
                conn.execute(
                    """
                    UPDATE system_bank_accounts
                    SET bank_name=?, account_holder=?, iban=?, branch_name=?, description=?, is_active=?, sort_order=?
                    WHERE id=?
                    """,
                    (bank_name, account_holder, iban, branch_name, description, is_active, sort_order, bank_id),
                )
                target_id = bank_id
            else:
                cur = conn.execute(
                    """
                    INSERT INTO system_bank_accounts
                      (bank_name, account_holder, iban, branch_name, description, is_active, sort_order, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (bank_name, account_holder, iban, branch_name, description, is_active, sort_order, now()),
                )
                target_id = cur.lastrowid
            audit(conn, admin["id"], "save_system_bank_account", "system_bank_account", target_id)
            conn.commit()
            self.json_response({"bank_accounts": system_bank_account_rows(conn, active_only=False)})

    def api_admin_bank_account_action(self, bank_id: int) -> None:
        payload = self.read_json()
        action = str(payload.get("action", "toggle")).lower()
        with connect_db() as conn:
            admin = self.require_admin(conn)
            self.require_admin_step_up(conn)
            row = conn.execute("SELECT * FROM system_bank_accounts WHERE id=?", (bank_id,)).fetchone()
            if not row:
                raise HttpError(404, "Banka hesabı bulunamadı")
            if action == "delete":
                conn.execute("DELETE FROM system_bank_accounts WHERE id=?", (bank_id,))
            else:
                next_state = 0 if int(row["is_active"]) else 1
                conn.execute("UPDATE system_bank_accounts SET is_active=? WHERE id=?", (next_state, bank_id))
            audit(conn, admin["id"], f"{action}_system_bank_account", "system_bank_account", bank_id)
            conn.commit()
            self.json_response({"bank_accounts": system_bank_account_rows(conn, active_only=False)})

    def api_admin_t2_settlements(self) -> None:
        with connect_db() as conn:
            settle_due_t2(conn)
            self.require_admin(conn)
            self.json_response({"t2_settlements": t2_settlement_rows(conn, "")})

    def api_admin_settle_t2(self, settlement_id: int) -> None:
        with connect_db() as conn:
            admin = self.require_admin(conn)
            self.require_admin_step_up(conn)
            settle_one_t2(conn, settlement_id)
            audit(conn, admin["id"], "manual_settle_t2", "t2_settlement", settlement_id)
            conn.commit()
            self.json_response({"ok": True})

    def api_admin_transactions(self) -> None:
        with connect_db() as conn:
            self.require_admin(conn)
            self.json_response({"transactions": transaction_rows(conn, "")})

    def api_admin_positions(self) -> None:
        with connect_db() as conn:
            self.require_admin(conn)
            self.json_response({"positions": admin_position_rows(conn)})

    def api_admin_user_balances(self) -> None:
        with connect_db() as conn:
            settle_due_t2(conn)
            self.require_admin(conn)
            rows = conn.execute(
                """
                SELECT u.id, u.account_no, u.full_name, u.email, u.city, u.district, u.status, a.cash_balance, a.blocked_balance, a.pending_balance, a.credit_limit
                FROM users u
                LEFT JOIN accounts a ON a.user_id=u.id
                WHERE u.role='user'
                ORDER BY u.created_at DESC
                """
            ).fetchall()
            self.json_response({"balances": [dict(row) for row in rows]})

    def api_admin_system_settings(self) -> None:
        with connect_db() as conn:
            self.require_admin(conn)
            self.json_response({"settings": settings_map(conn)})

    def api_admin_save_system_settings(self) -> None:
        payload = self.read_json()
        with connect_db() as conn:
            admin = self.require_admin(conn)
            self.require_admin_step_up(conn)
            allowed_prefixes = ("trading_", "maintenance_", "credit_", "t2_", "commission_", "minimum_", "official_", "brand_", "ui_", "content_")
            for key, value in payload.items():
                if not isinstance(key, str) or not key.startswith(allowed_prefixes):
                    continue
                conn.execute(
                    """
                    INSERT INTO system_settings (setting_key, setting_value, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value, updated_at=excluded.updated_at
                    """,
                    (key, str(value), now()),
                )
            if not ALLOW_PRICE_SIMULATION:
                conn.execute("UPDATE system_settings SET setting_value='0', updated_at=? WHERE setting_key='price_simulation'", (now(),))
            if settings_map(conn).get("t2_enabled", "1") != "1":
                settle_due_t2(conn)
            audit(conn, admin["id"], "save_system_settings", "system_settings", None)
            conn.commit()
            self.json_response({"settings": settings_map(conn)})

    def api_admin_project_export(self) -> None:
        """Return a clean, self-contained Render-ready source package with active brand configuration and APK."""
        with connect_db() as conn:
            admin = self.require_admin(conn)
            settings = settings_map(conn)
            active_brand_name = settings.get("brand_name", "Ottoman").strip()
            slug = re.sub(r'[^a-z0-9]+', '-', active_brand_name.lower()).strip('-') or 'investment-platform'
            audit(conn, admin["id"], f"export_project_{slug}", "system_settings", None)
            conn.commit()

        excluded_dirs = {"node_modules", ".git", "artifacts", ".gradle", "build"}
        excluded_files = {".env", ".env.local", "local.properties"}
        
        # Identify matching APK
        matching_apk = None
        if "zenith" in slug and (ROOT / "Zenith-Menkul-Degerler.apk").is_file():
            matching_apk = ROOT / "Zenith-Menkul-Degerler.apk"
        elif "ottoman" in slug and (ROOT / "Ottoman-Esube.apk").is_file():
            matching_apk = ROOT / "Ottoman-Esube.apk"
        elif (ROOT / "Ottoman-Esube.apk").is_file():
            matching_apk = ROOT / "Ottoman-Esube.apk"

        export_settings = {
            key: value for key, value in settings.items()
            if key.startswith(("brand_", "ui_", "content_", "official_", "commission_", "minimum_", "trading_", "t2_", "credit_"))
        }
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for source in ROOT.rglob("*"):
                relative = source.relative_to(ROOT)
                # Don't include other unrelated APKs or large build directories
                if source.is_dir() or any(part in excluded_dirs for part in relative.parts) or source.name in excluded_files or relative.as_posix() == "render.yaml":
                    continue
                if source.suffix == ".apk" and (not matching_apk or source.name != matching_apk.name):
                    continue
                archive.write(source, Path(slug) / relative)
            
            # Write Render config tailored to this project
            archive.writestr(
                f"{slug}/render.yaml",
                f"""services:
  - type: web
    runtime: python
    name: {slug}
    buildCommand: python --version && python -m py_compile tools/backend_server.py
    startCommand: python tools/backend_server.py
    healthCheckPath: /healthz
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.15
      - key: DATA_DIR
        value: /var/data
      - key: PUBLIC_BASE_URL
        sync: false
      - key: ADMIN_TC
        sync: false
      - key: ADMIN_PASSWORD
        sync: false
      - key: REQUIRE_LIVE_MARKET_FOR_TRADING
        value: "1"
      - key: ALLOW_PRICE_SIMULATION
        value: "0"
    disk:
      name: {slug}-data
      mountPath: /var/data
      sizeGB: 1
""",
            )
            archive.writestr(
                f"{slug}/brand-config.json",
                json.dumps(export_settings, ensure_ascii=False, indent=2),
            )
            archive.writestr(
                f"{slug}/RENDER-DEPLOY.md",
                f"# {active_brand_name} Render Dağıtım Kılavuzu\n\n1. Bu paketi Git deposuna pushlayın.\n2. Render Dashboard > New > Blueprint seçeneğine tıklayın.\n3. Depoyu bağlayın; render.yaml servisi otomatik kurar.\n4. Sistemde admin şifresini Render Environment Variables altından ADMIN_PASSWORD olarak belirleyin.\n5. Kalıcı disk /var/data altında verileri saklar.\n6. Uygulama APK'sı proje kök dizininde yer almaktadır.\n",
            )
        body = buffer.getvalue()
        zip_filename = f"{slug}-fullstack-project.zip"
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Disposition", f'attachment; filename="{zip_filename}"')
        self.send_header("Content-Length", str(len(body)))
        self.security_headers()
        self.end_headers()
        self.wfile.write(body)

    def api_admin_project_export_apk(self) -> None:
        """Return the prebuilt Android APK for the requested brand."""
        query = parse_qs(urlparse(self.path).query)
        brand = (query.get("brand", [""])[0]).lower()

        if brand == "zenith" and (ROOT / "Zenith-Menkul-Degerler.apk").is_file():
            apk_path = ROOT / "Zenith-Menkul-Degerler.apk"
            filename = "Zenith-Menkul-Degerler.apk"
        elif brand == "ottoman" and (ROOT / "Ottoman-Esube.apk").is_file():
            apk_path = ROOT / "Ottoman-Esube.apk"
            filename = "Ottoman-Esube.apk"
        elif brand == "ottoman" and (ROOT / "Ottoman-Esube.apk").is_file():
            apk_path = ROOT / "Ottoman-Esube.apk"
            filename = "Ottoman-Esube.apk"
        else:
            with connect_db() as conn:
                settings = settings_map(conn)
                active_brand = settings.get("brand_name", "").upper()
            if "ZENITH" in active_brand and (ROOT / "Zenith-Menkul-Degerler.apk").is_file():
                apk_path = ROOT / "Zenith-Menkul-Degerler.apk"
                filename = "Zenith-Menkul-Degerler.apk"
            elif "Ottoman" in active_brand and (ROOT / "Ottoman-Esube.apk").is_file():
                apk_path = ROOT / "Ottoman-Esube.apk"
                filename = "Ottoman-Esube.apk"
            elif (ROOT / "Ottoman-Esube.apk").is_file():
                apk_path = ROOT / "Ottoman-Esube.apk"
                filename = "Ottoman-Esube.apk"
            elif (ROOT / "Ottoman-Esube.apk").is_file():
                apk_path = ROOT / "Ottoman-Esube.apk"
                filename = "Ottoman-Esube.apk"
            else:
                raise HttpError(404, "APK dosyasi bulunamadi. Once 'npm run android:apk' ile derleyin.")

        with connect_db() as conn:
            admin = self.require_admin(conn)
            audit(conn, admin["id"], f"export_project_apk_{filename}", "system_settings", None)
            conn.commit()
        body = apk_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "application/vnd.android.package-archive")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(body)))
        self.security_headers()
        self.end_headers()
        self.wfile.write(body)

    def api_admin_stock_descriptions(self) -> None:
        with connect_db() as conn:
            self.require_admin(conn)
            rows = conn.execute("SELECT * FROM stock_descriptions ORDER BY symbol ASC").fetchall()
            self.json_response({"descriptions": [dict(row) for row in rows]})

    def api_admin_save_stock_description(self) -> None:
        payload = self.read_json()
        symbol = re.sub(r"[^A-Z0-9]", "", str(payload.get("symbol", "")).upper())
        description = str(payload.get("description", "")).strip()[:1000]
        risk_note = str(payload.get("risk_note", "")).strip()[:500]
        if not symbol:
            raise HttpError(400, "Hisse kodu gerekli")
        with connect_db() as conn:
            admin = self.require_admin(conn)
            conn.execute(
                """
                INSERT INTO stock_descriptions (symbol, description, risk_note, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(symbol) DO UPDATE SET description=excluded.description, risk_note=excluded.risk_note, updated_at=excluded.updated_at
                """,
                (symbol, description, risk_note, now()),
            )
            audit(conn, admin["id"], "save_stock_description", "stock_description", None, {"symbol": symbol})
            conn.commit()
            self.json_response({"ok": True})

    def api_admin_render_status(self) -> None:
        with connect_db() as conn:
            self.require_admin(conn)
        token = os.environ.get("RENDER_API_TOKEN", "rnd_dm8o9dIJjm5vxjC2jZR9gwgBZ6Qp")
        service_id = os.environ.get("RENDER_SERVICE_ID", "srv-da2ftlijnfac73di1cb0")
        
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        try:
            req_srv = urllib.request.Request(f"https://api.render.com/v1/services/{service_id}", headers=headers)
            with urllib.request.urlopen(req_srv, timeout=8) as r:
                service_data = json.loads(r.read().decode("utf-8"))
            
            req_dep = urllib.request.Request(f"https://api.render.com/v1/services/{service_id}/deploys?limit=1", headers=headers)
            with urllib.request.urlopen(req_dep, timeout=8) as r:
                deploys_data = json.loads(r.read().decode("utf-8"))
            
            latest_deploy = deploys_data[0].get("deploy", {}) if deploys_data else {}
            
            self.json_response({
                "ok": True,
                "service_id": service_id,
                "service_name": service_data.get("name"),
                "live_url": service_data.get("serviceDetails", {}).get("url") or "https://ottoman.local",
                "status": latest_deploy.get("status", "live"),
                "updated_at": latest_deploy.get("updatedAt"),
                "auto_deploy": service_data.get("autoDeploy", "yes"),
                "repo": service_data.get("repo"),
                "branch": service_data.get("branch")
            })
        except Exception as e:
            self.json_response({
                "ok": False,
                "error": str(e),
                "live_url": "https://ottoman.local"
            })

    def api_admin_render_deploy(self) -> None:
        with connect_db() as conn:
            admin = self.require_admin(conn)
            audit(conn, admin["id"], "render_trigger_deploy", "system_settings", None)
            conn.commit()

        token = os.environ.get("RENDER_API_TOKEN", "rnd_dm8o9dIJjm5vxjC2jZR9gwgBZ6Qp")
        service_id = os.environ.get("RENDER_SERVICE_ID", "srv-da2ftlijnfac73di1cb0")
        
        payload = json.dumps({"clearCache": "do_not_clear"}).encode("utf-8")
        req = urllib.request.Request(
            f"https://api.render.com/v1/services/{service_id}/deploys",
            data=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                deploy_info = json.loads(r.read().decode("utf-8"))
            self.json_response({
                "ok": True,
                "message": "Render dağıtımı başarıyla tetiklendi. Birkaç dakika içinde yayında!",
                "deploy_id": deploy_info.get("id"),
                "status": deploy_info.get("status"),
                "live_url": "https://ottoman.local"
            })
        except Exception as e:
            self.json_response({
                "ok": False,
                "error": f"Render API Dağıtım Hatası: {e}",
                "live_url": "https://ottoman.local"
            }, 500)

    def api_admin_render_domain(self) -> None:
        with connect_db() as conn:
            admin = self.require_admin(conn)
            audit(conn, admin["id"], "render_add_domain", "system_settings", None)
            conn.commit()

        body = self.read_json()
        domain = body.get("domain", "").strip().lower()
        if not domain:
            raise HttpError(400, "Geçerli bir domain giriniz.")

        token = os.environ.get("RENDER_API_TOKEN", "rnd_dm8o9dIJjm5vxjC2jZR9gwgBZ6Qp")
        service_id = os.environ.get("RENDER_SERVICE_ID", "srv-da2ftlijnfac73di1cb0")

        payload = json.dumps({"name": domain}).encode("utf-8")
        req = urllib.request.Request(
            f"https://api.render.com/v1/services/{service_id}/custom-domains",
            data=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                res = json.loads(r.read().decode("utf-8"))
            self.json_response({
                "ok": True,
                "message": f"Domain {domain} Render servisine bağlandı! DNS ayarlarınızda Render CNAME/A kaydını doğrulayın.",
                "data": res
            })
        except Exception as e:
            self.json_response({
                "ok": False,
                "error": f"Domain Ekleme Hatası: {e}"
            }, 500)

    def api_reset_test_account(self, method: str) -> None:
        payload = self.read_json() if method == "POST" else {}
        with self.db() as conn:
            user = self.require_user(conn)
            allowed = {value.strip() for value in os.environ.get("RESETTABLE_TEST_ACCOUNTS", "20000000000").split(",") if value.strip()}
            enabled = (user["tc"] in allowed or bool(user.get("is_test_user")) or user["role"] != "admin")
            if method == "GET":
                return self.json_response({"enabled": enabled})
            if not enabled:
                raise HttpError(403, "Bu hesap için test sıfırlaması açık değil.")
            if payload.get("confirmation") != "HESABIMI SIFIRLA":
                raise HttpError(400, "Sıfırlama onayı gerekli.")
            uid = user["id"]
            conn.execute("DELETE FROM orders WHERE user_id=?", (uid,))
            conn.execute("DELETE FROM user_transactions WHERE user_id=?", (uid,))
            conn.execute("DELETE FROM positions WHERE user_id=?", (uid,))
            conn.execute("DELETE FROM t2_settlements WHERE user_id=?", (uid,))
            conn.execute("DELETE FROM money_requests WHERE user_id=?", (uid,))
            starting_balance = float(os.environ.get("TEST_USER_STARTING_BALANCE", 123456.78))
            conn.execute("UPDATE users SET cash_balance=?, blocked_balance=0, pending_balance=0, credit_limit=0 WHERE id=?", (starting_balance, uid))
            conn.commit()
        self.json_response({"ok": True, "message": f"Hesap sıfırlandı. Yeni bakiye: {starting_balance}"})

    def api_my_reset_account(self) -> None:
        """Giriş yapan kullanıcının tüm işlem/emir/bakiye verilerini sıfırlar."""
        with self.db() as conn:
            user = self.require_user(conn)
            uid = user["id"]
            conn.execute("DELETE FROM orders WHERE user_id=?", (uid,))
            conn.execute("DELETE FROM user_transactions WHERE user_id=?", (uid,))
            conn.execute("DELETE FROM positions WHERE user_id=?", (uid,))
            conn.execute("DELETE FROM t2_settlements WHERE user_id=?", (uid,))
            conn.execute("DELETE FROM money_requests WHERE user_id=?", (uid,))
            starting_balance = float(os.environ.get("TEST_USER_STARTING_BALANCE", 123456.78))
            conn.execute("UPDATE users SET cash_balance=?, blocked_balance=0, pending_balance=0, credit_limit=0 WHERE id=?", (starting_balance, uid))
            conn.commit()
        self.json_response({"ok": True, "message": "Hesap sıfırlandı. Bakiye: 123.456,78 TL"})

    def api_admin_reset_account(self) -> None:
        """Admin: belirli kullanıcının tüm verilerini sıfırlar."""
        with self.db() as conn:
            self.require_admin(conn)
            data = self.read_json()
            uid = int(data.get("user_id", 0))
            if not uid:
                raise HttpError(400, "user_id gerekli")
            conn.execute("DELETE FROM orders WHERE user_id=?", (uid,))
            conn.execute("DELETE FROM user_transactions WHERE user_id=?", (uid,))
            conn.execute("DELETE FROM positions WHERE user_id=?", (uid,))
            conn.execute("DELETE FROM t2_settlements WHERE user_id=?", (uid,))
            conn.execute("DELETE FROM money_requests WHERE user_id=?", (uid,))
            starting = float(data.get("starting_balance", 100000))
            conn.execute("""UPDATE users SET cash_balance=?, blocked_balance=0,
                            pending_balance=0 WHERE id=?""", (starting, uid))
            conn.commit()
        self.json_response({"ok": True, "message": f"Kullanici {uid} sifirlandi. Bakiye: {starting}"})

    def api_admin_update_user(self, user_id: int) -> None:
        payload = self.read_json()
        full_name = str(payload.get("full_name", "")).strip()[:120]
        phone = str(payload.get("phone", "")).strip()[:40]
        email = str(payload.get("email", "")).strip()[:120]
        city = str(payload.get("city", "")).strip()[:80]
        district = str(payload.get("district", "")).strip()[:80]
        birth_date = str(payload.get("birth_date", "")).strip()[:20]
        address = str(payload.get("address", "")).strip()[:240]
        kyc_note = str(payload.get("kyc_note", "")).strip()[:300]
        status = str(payload.get("status", "")).strip()
        if status not in {"pending", "under_review", "awaiting_back", "approved", "rejected"}:
            raise HttpError(400, "Durum hatalı")
        if not full_name or not phone or not email:
            raise HttpError(400, "Kullanıcı bilgileri eksik")
        with connect_db() as conn:
            admin = self.require_admin(conn)
            self.require_admin_step_up(conn)
            target = conn.execute("SELECT * FROM users WHERE id=? AND role='user'", (user_id,)).fetchone()
            if not target:
                raise HttpError(404, "Kullanıcı bulunamadı")
            if status == "approved" and not int(target["is_test_user"] or 0) and not kyc_document_state(conn, user_id)["approved"]:
                raise HttpError(422, "Üç kimlik belgesi ayrı ayrı onaylanmadan hesap onaylanamaz")
            conn.execute(
                """
                UPDATE users
                SET full_name=?, phone=?, email=?, city=?, district=?, birth_date=?, address=?,
                    status=?, kyc_status=?, kyc_note=?, approved_at=CASE WHEN ?='approved' THEN COALESCE(approved_at, ?) ELSE approved_at END
                WHERE id=? AND role='user'
                """,
                (full_name, phone, email, city, district, birth_date, address, status, status, kyc_note, status, now(), user_id),
            )
            audit(conn, admin["id"], "update_user", "user", user_id)
            conn.commit()
            self.json_response({"ok": True})

    def api_admin_document_action(self, document_id: int, action: str) -> None:
        payload = self.read_json()
        if action not in {"approve", "reject", "retry"}:
            raise HttpError(404, "Belge işlemi bulunamadı")
        note = str(payload.get("note", "")).strip()[:300]
        if action in {"reject", "retry"} and len(note) < 8:
            raise HttpError(422, "Belge işlemi için en az 8 karakterlik inceleme gerekçesi zorunludur")
        with connect_db() as conn:
            admin = self.require_admin(conn)
            self.require_admin_step_up(conn)
            document = conn.execute("SELECT * FROM documents WHERE id=?", (document_id,)).fetchone()
            if not document:
                raise HttpError(404, "Belge bulunamadı")
            next_status = "approved" if action == "approve" else "rejected" if action == "reject" else "awaiting_back"
            conn.execute("UPDATE documents SET status=?, review_note=? WHERE id=?", (next_status, note, document_id))
            if next_status == "awaiting_back":
                conn.execute("UPDATE users SET status='awaiting_back', kyc_status='awaiting_back', kyc_note=? WHERE id=?", (note or "Belge tekrar isteniyor", document["user_id"]))
            else:
                sync_user_kyc(conn, int(document["user_id"]))
            audit(conn, admin["id"], f"{action}_document", "document", document_id, {"note": note})
            conn.commit()
            self.json_response({"ok": True})

    def api_admin_adjust_balance(self) -> None:
        payload = self.read_json()
        user_id = int(payload.get("user_id", 0) or 0)
        amount = float(payload.get("amount", 0) or 0)
        action = str(payload.get("action", "add")).lower()
        note = str(payload.get("note", "")).strip()[:300]
        if user_id <= 0 or amount < 0 or action not in {"add", "subtract", "credit", "set"}:
            raise HttpError(400, "Bakiye işlemi hatalı")
        if len(note) < 8:
            raise HttpError(422, "Finansal değişiklik için en az 8 karakterlik gerekçe zorunludur")
        with connect_db() as conn:
            admin = self.require_admin(conn)
            self.require_admin_step_up(conn)
            account = account_for(conn, user_id)
            before = float(account["credit_limit"] if action == "credit" else account["cash_balance"])
            if action == "add":
                after = round(before + amount, 2)
                conn.execute("UPDATE accounts SET cash_balance=? WHERE user_id=?", (after, user_id))
                tx_type = "admin_add"
            elif action == "subtract":
                if before < amount:
                    raise HttpError(422, "Bakiye yetersiz")
                after = round(before - amount, 2)
                conn.execute("UPDATE accounts SET cash_balance=? WHERE user_id=?", (after, user_id))
                tx_type = "admin_subtract"
            elif action == "credit":
                after = round(before + amount, 2)
                conn.execute("UPDATE accounts SET credit_limit=? WHERE user_id=?", (after, user_id))
                tx_type = "credit_limit"
            else:
                after = round(amount, 2)
                conn.execute("UPDATE accounts SET cash_balance=? WHERE user_id=?", (after, user_id))
                tx_type = "admin_set_balance"
            write_transaction(conn, user_id, tx_type, abs(after - before) if action == "set" else amount, before, after, note=note)
            audit(conn, admin["id"], "adjust_balance", "account", user_id, {"amount": amount, "action": action, "reason": note})
            conn.commit()
            self.json_response({"ok": True})

    def api_admin_adjust_position(self) -> None:
        payload = self.read_json()
        user_id = int(payload.get("user_id", 0) or 0)
        symbol = re.sub(r"[^A-Z0-9]", "", str(payload.get("symbol", "")).upper())
        quantity = int(float(payload.get("quantity", 0) or 0))
        price = float(payload.get("price", 0) or 0)
        action = str(payload.get("action", "set")).lower()
        note = str(payload.get("note", "")).strip()[:300]
        if user_id <= 0 or not symbol or quantity < 0 or price <= 0 or action not in {"set", "add", "reduce"}:
            raise HttpError(400, "Pozisyon işlemi hatalı")
        if len(note) < 8:
            raise HttpError(422, "Portföy değişikliği için en az 8 karakterlik gerekçe zorunludur")
        with connect_db() as conn:
            admin = self.require_admin(conn)
            self.require_admin_step_up(conn)
            if action == "set":
                if quantity == 0:
                    conn.execute("DELETE FROM positions WHERE user_id=? AND symbol=?", (user_id, symbol))
                else:
                    conn.execute(
                        """
                        INSERT INTO positions (user_id, symbol, quantity, avg_price, updated_at)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(user_id, symbol) DO UPDATE SET quantity=excluded.quantity, avg_price=excluded.avg_price, updated_at=excluded.updated_at
                        """,
                        (user_id, symbol, quantity, price, now()),
                    )
            elif action == "add":
                upsert_position(conn, user_id, symbol, quantity, price)
            else:
                reduce_position(conn, user_id, symbol, quantity)
            audit(conn, admin["id"], "adjust_position", "position", user_id, {"symbol": symbol, "quantity": quantity, "action": action, "reason": note})
            conn.commit()
            self.json_response({"ok": True})

    def api_admin_action(self, entity: str, entity_id: int, action: str) -> None:
        if action not in {"approve", "reject"}:
            raise HttpError(404, "İşlem bulunamadı")
        payload = self.read_json()
        reason = str(payload.get("reason", "")).strip()[:300]
        if entity in {"orders", "money"} and len(reason) < 8:
            raise HttpError(422, "Finansal onay veya ret için en az 8 karakterlik gerekçe zorunludur")
        with connect_db() as conn:
            admin = self.require_admin(conn)
            if entity in {"users", "orders", "money"}:
                self.require_admin_step_up(conn)
            if entity == "users":
                self.admin_user_action(conn, admin, entity_id, action)
            elif entity == "orders":
                self.admin_order_action(conn, admin, entity_id, action, reason)
            elif entity == "money":
                self.admin_money_action(conn, admin, entity_id, action, reason)
            conn.commit()
            self.json_response({"ok": True})

    def admin_user_action(self, conn: sqlite3.Connection, admin: dict, user_id: int, action: str) -> None:
        user = conn.execute("SELECT * FROM users WHERE id=? AND role='user'", (user_id,)).fetchone()
        if not user:
            raise HttpError(404, "Kullanıcı bulunamadı")
        status = "approved" if action == "approve" else "rejected"
        if action == "approve":
            if not int(user["is_test_user"] or 0) and not kyc_document_state(conn, user_id)["approved"]:
                raise HttpError(422, "Tüm kimlik belgeleri onaylanmadan kullanıcı onaylanamaz")
            sync_user_kyc(conn, user_id)
        else:
            conn.execute("UPDATE users SET status='rejected', kyc_status='rejected', approved_at=NULL WHERE id=?", (user_id,))
        audit(conn, admin["id"], f"{action}_user", "user", user_id)

    def admin_order_action(self, conn: sqlite3.Connection, admin: dict, order_id: int, action: str, reason: str) -> None:
        order = conn.execute("SELECT * FROM orders WHERE id=?", (order_id,)).fetchone()
        if not order or order["status"] != "pending":
            raise HttpError(404, "Bekleyen emir bulunamadı")
        if action == "reject":
            if order["side"] == "buy":
                release_order_reservation(conn, order_id)
            conn.execute("UPDATE orders SET status='rejected', admin_note=?, reviewed_at=? WHERE id=?", (reason, now(), order_id))
            audit(conn, admin["id"], "reject_order", "order", order_id, {"reason": reason})
            return
        quote = find_quote(conn, order["symbol"]) or {"name": order["symbol"]}
        if order["side"] == "buy":
            account = account_for(conn, order["user_id"])
            upsert_position(conn, order["user_id"], order["symbol"], order["quantity"], order["limit_price"])
            write_transaction(
                conn,
                order["user_id"],
                "trade_buy",
                order["total"],
                account["cash_balance"],
                account["cash_balance"],
                order_id=order_id,
                code=order["symbol"],
                name=quote["name"],
                quantity=order["quantity"],
                price=order["limit_price"],
                note="Limit alış emri admin onayıyla portföye işlendi",
            )
        else:
            if position_quantity(conn, order["user_id"], order["symbol"]) < order["quantity"]:
                raise HttpError(422, "Portföy adedi yetersiz")
            avg_price = position_avg_price(conn, order["user_id"], order["symbol"])
            reduce_position(conn, order["user_id"], order["symbol"], order["quantity"])
            credit_sale_proceeds(
                conn,
                order["user_id"],
                order_id,
                order["symbol"],
                quote["name"],
                float(order["total"]),
                int(order["quantity"]),
                float(order["limit_price"]),
                f"Ortalama maliyet: {avg_price:.2f}",
            )
        conn.execute("UPDATE orders SET status='approved', admin_note=?, reviewed_at=? WHERE id=?", (reason, now(), order_id))
        audit(conn, admin["id"], "approve_order", "order", order_id, {"total": order["total"], "reason": reason})

    def admin_money_action(self, conn: sqlite3.Connection, admin: dict, request_id: int, action: str, reason: str) -> None:
        item = conn.execute("SELECT * FROM money_requests WHERE id=?", (request_id,)).fetchone()
        if not item or item["status"] != "pending":
            raise HttpError(404, "Bekleyen para talebi bulunamadı")
        if action == "reject":
            conn.execute("UPDATE money_requests SET status='rejected', admin_note=?, reviewed_at=? WHERE id=?", (reason, now(), request_id))
            audit(conn, admin["id"], "reject_money_request", "money_request", request_id, {"reason": reason})
            return
        account = account_for(conn, item["user_id"])
        if item["request_type"] == "deposit":
            before = float(account["cash_balance"])
            after = round(before + float(item["amount"]), 2)
            conn.execute("UPDATE accounts SET cash_balance=? WHERE user_id=?", (after, item["user_id"]))
            write_transaction(conn, item["user_id"], "deposit", item["amount"], before, after, money_request_id=request_id, note=item["note"] or "Para yatırma talebi onaylandı")
        elif item["request_type"] == "withdraw":
            if account["cash_balance"] < item["amount"]:
                raise HttpError(422, "Bakiye yetersiz")
            before = float(account["cash_balance"])
            after = round(before - float(item["amount"]), 2)
            conn.execute("UPDATE accounts SET cash_balance=? WHERE user_id=?", (after, item["user_id"]))
            write_transaction(conn, item["user_id"], "withdrawal", item["amount"], before, after, money_request_id=request_id, note=item["note"] or "Para çekme talebi onaylandı")
        elif item["request_type"] == "credit":
            conn.execute("UPDATE accounts SET credit_limit=credit_limit+? WHERE user_id=?", (item["amount"], item["user_id"]))
        conn.execute("UPDATE money_requests SET status='approved', admin_note=?, reviewed_at=? WHERE id=?", (reason, now(), request_id))
        audit(conn, admin["id"], "approve_money_request", "money_request", request_id, {"amount": item["amount"], "reason": reason})

    def serve_upload(self, path: str) -> None:
        with connect_db() as conn:
            user = self.require_user(conn)
            filename = Path(path).name
            if not can_view_upload(conn, user, filename):
                raise HttpError(403, "Dosya erişim yetkisi yok")
        requested = (UPLOAD_DIR / filename).resolve()
        if not str(requested).startswith(str(UPLOAD_DIR.resolve())) or not requested.exists():
            raise HttpError(404, "Dosya bulunamadı")
        self.serve_file(requested)

    def serve_static(self, path: str) -> None:
        requested = (DIST / path.lstrip("/")).resolve()
        if not str(requested).startswith(str(DIST.resolve())) or not requested.exists() or requested.is_dir():
            public_file = (PUBLIC / path.lstrip("/")).resolve()
            if str(public_file).startswith(str(PUBLIC.resolve())) and public_file.exists() and not public_file.is_dir():
                requested = public_file
            else:
                requested = DIST / "index.html"
        if not requested.exists() or requested.is_dir():
            requested = DIST / "index.html"
        self.serve_file(requested)

    def serve_file(self, path: Path) -> None:
        ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.security_headers()
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args) -> None:
        print(f"{self.address_string()} - {fmt % args}")


class HttpError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message
        super().__init__(message)


def field_value(form: MultipartForm, name: str) -> str:
    item = form[name] if name in form else None
    if item is None or isinstance(item, list):
        return ""
    return str(item.value or "").strip()


def save_document(conn: sqlite3.Connection, form: MultipartForm, user_id: int, doc_type: str) -> None:
    item = form[doc_type] if doc_type in form else None
    if item is None or isinstance(item, list) or not getattr(item, "filename", ""):
        raise HttpError(400, f"{doc_type} dosyası gerekli")
    content_type = item.type or "application/octet-stream"
    if not content_type.startswith("image/"):
        raise HttpError(400, "Kimlik dosyaları görsel olmalı")
    ext = Path(item.filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        ext = ".jpg"
    stored_name = f"{user_id}_{doc_type}_{secrets.token_hex(8)}{ext}"
    target = UPLOAD_DIR / stored_name
    size = 0
    with target.open("wb") as out:
        while True:
            chunk = item.file.read(64 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                target.unlink(missing_ok=True)
                raise HttpError(413, "Tek dosya 100 MB üstünde olamaz")
            out.write(chunk)
    conn.execute(
        "INSERT INTO documents (user_id, doc_type, original_name, stored_name, content_type, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
        (user_id, doc_type, Path(item.filename).name, stored_name, content_type, now()),
    )


def save_money_receipt(form: MultipartForm | None, user_id: int) -> dict:
    if form is None or "receipt" not in form:
        return {}
    item = form["receipt"]
    if item is None or isinstance(item, list) or not getattr(item, "filename", ""):
        return {}
    content_type = item.type or "application/octet-stream"
    if not (content_type.startswith("image/") or content_type == "application/pdf"):
        raise HttpError(400, "Dekont görsel veya PDF olmalı")
    ext = Path(item.filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".pdf"}:
        ext = ".pdf" if content_type == "application/pdf" else ".jpg"
    stored_name = f"{user_id}_receipt_{secrets.token_hex(8)}{ext}"
    target = UPLOAD_DIR / stored_name
    size = 0
    with target.open("wb") as out:
        while True:
            chunk = item.file.read(64 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                target.unlink(missing_ok=True)
                raise HttpError(413, "Dekont dosyası 100 MB üstünde olamaz")
            out.write(chunk)
    return {
        "original_name": Path(item.filename).name,
        "stored_name": stored_name,
        "content_type": content_type,
    }


def can_view_upload(conn: sqlite3.Connection, user: dict, filename: str) -> bool:
    if user["role"] == "admin":
        return True
    document = conn.execute("SELECT id FROM documents WHERE user_id=? AND stored_name=?", (user["id"], filename)).fetchone()
    if document:
        return True
    receipt = conn.execute("SELECT id FROM money_requests WHERE user_id=? AND receipt_stored_name=?", (user["id"], filename)).fetchone()
    return bool(receipt)


def normalize_iban(value: str) -> str:
    return turkish_iban(value)


def system_bank_account_rows(conn: sqlite3.Connection, active_only: bool = True) -> list[dict]:
    where = "WHERE is_active=1 AND iban NOT LIKE 'TR00%'" if active_only else ""
    rows = conn.execute(
        f"""
        SELECT * FROM system_bank_accounts
        {where}
        ORDER BY sort_order ASC, id ASC
        """
    ).fetchall()
    items = []
    for row in rows:
        item = dict(row)
        item["created_at_label"] = iso_time(item["created_at"])
        item["status_label"] = "Aktif" if item["is_active"] else "Pasif"
        items.append(item)
    return items


def user_bank_account_rows(conn: sqlite3.Connection, user_id: int | None = None) -> list[dict]:
    where = "WHERE b.user_id=?" if user_id else ""
    params = (user_id,) if user_id else ()
    rows = conn.execute(
        f"""
        SELECT b.*, u.full_name
        FROM bank_accounts b
        JOIN users u ON u.id=b.user_id
        {where}
        ORDER BY b.created_at DESC
        """,
        params,
    ).fetchall()
    items = []
    for row in rows:
        item = dict(row)
        item["created_at_label"] = iso_time(item["created_at"])
        items.append(item)
    return items


def transaction_rows(conn: sqlite3.Connection, where: str, params: tuple = (), limit: int = 300) -> list[dict]:
    safe_limit = max(1, min(int(limit), 10000))
    rows = conn.execute(
        f"""
        SELECT t.*, u.full_name
        FROM user_transactions t
        JOIN users u ON u.id=t.user_id
        {where}
        ORDER BY t.created_at DESC
        LIMIT ?
        """,
        (*params, safe_limit),
    ).fetchall()
    labels = {
        "admin_add": "TL Yükleme",
        "admin_subtract": "Admin Çıkarma",
        "deposit": "Para Yatırma",
        "withdrawal": "Para Çekme",
        "deposit_request": "Para Yatırma Talebi",
        "withdrawal_request": "Para Çekme Talebi",
        "trade_buy": "Hisse Alım",
        "trade_sell": "Hisse Satım",
        "stock_sale": "Hisse Satımı",
        "t2_settlement": "Satış Bakiyesi Aktarımı",
        "credit_limit": "Kredi Limiti",
    }
    items = []
    for row in rows:
        item = dict(row)
        item["reference"] = f"GM-HRK-{int(item['id']):08d}"
        item["type_label"] = labels.get(item["transaction_type"], item["transaction_type"])
        item["created_at_label"] = iso_time(item["created_at"])
        items.append(item)
    return items


def filtered_transactions(conn: sqlite3.Connection, user_id: int | None = None, query: dict | None = None, limit: int = 10000) -> list[dict]:
    query = query or {}
    clauses = []
    params: list[object] = []
    if user_id is not None:
        clauses.append("t.user_id=?")
        params.append(user_id)
    date_from = (query.get("from") or [""])[0]
    date_to = (query.get("to") or [""])[0]
    transaction_type = (query.get("type") or [""])[0]
    search = (query.get("q") or [""])[0].strip()
    try:
        if date_from:
            clauses.append("t.created_at>=?")
            params.append(int(time.mktime(time.strptime(date_from, "%Y-%m-%d"))))
        if date_to:
            clauses.append("t.created_at<?")
            params.append(int(time.mktime(time.strptime(date_to, "%Y-%m-%d"))) + 86400)
    except ValueError:
        raise HttpError(400, "Tarih filtresi hatalı")
    if transaction_type and transaction_type != "all":
        clauses.append("t.transaction_type=?")
        params.append(transaction_type)
    if search:
        clauses.append("(t.code LIKE ? OR t.name LIKE ? OR t.note LIKE ? OR u.full_name LIKE ? OR printf('GM-HRK-%08d', t.id) LIKE ?)")
        token = f"%{search}%"
        params.extend([token, token, token, token, token])
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    return transaction_rows(conn, where, tuple(params), limit=limit)


def t2_settlement_rows(conn: sqlite3.Connection, where: str, params: tuple = ()) -> list[dict]:
    rows = conn.execute(
        f"""
        SELECT s.*, u.full_name
        FROM t2_settlements s
        JOIN users u ON u.id=s.user_id
        {where}
        ORDER BY s.created_at DESC
        LIMIT 300
        """,
        params,
    ).fetchall()
    items = []
    for row in rows:
        item = dict(row)
        item["display_amount"] = item["remaining_amount"] if item["status"] == "pending" else item["amount"]
        item["used_amount"] = max(0, float(item["amount"]) - float(item["remaining_amount"]))
        item["status_label"] = status_label(item["status"])
        item["created_at_label"] = iso_time(item["created_at"])
        item["settlement_date_label"] = iso_time(item["settlement_date"])
        item["reviewed_at_label"] = iso_time(item["reviewed_at"]) if item["reviewed_at"] else None
        items.append(item)
    return items


def admin_position_rows(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        """
        SELECT p.*, u.full_name
        FROM positions p
        JOIN users u ON u.id=p.user_id
        ORDER BY p.updated_at DESC
        """
    ).fetchall()
    items = []
    for row in rows:
        item = dict(row)
        quote = find_quote(conn, item["symbol"]) or {}
        current_price = float(quote.get("price") or item["avg_price"])
        item["current_price"] = current_price
        item["market_value"] = current_price * item["quantity"]
        item["pnl"] = item["market_value"] - item["avg_price"] * item["quantity"]
        item["updated_at_label"] = iso_time(item["updated_at"])
        items.append(item)
    return items


def write_transaction(
    conn: sqlite3.Connection,
    user_id: int,
    transaction_type: str,
    total: float,
    balance_before: float,
    balance_after: float,
    order_id: int | None = None,
    money_request_id: int | None = None,
    code: str = "",
    name: str = "",
    quantity: int = 0,
    price: float = 0,
    note: str = "",
) -> int:
    cur = conn.execute(
        """
        INSERT INTO user_transactions
          (user_id, order_id, money_request_id, code, name, transaction_type, quantity, price, total, balance_before, balance_after, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (user_id, order_id, money_request_id, code, name, transaction_type, quantity, price, total, balance_before, balance_after, note, now()),
    )
    return int(cur.lastrowid)


def t2_due_ts(start_ts: int | None = None) -> int:
    current = start_ts or now()
    added = 0
    while added < 2:
        current += 60 * 60 * 24
        if time.localtime(current).tm_wday < 5:
            added += 1
    return current


def create_t2_settlement(
    conn: sqlite3.Connection,
    user_id: int,
    order_id: int,
    transaction_id: int,
    code: str,
    name: str,
    amount: float,
    quantity: int,
    sale_price: float,
) -> None:
    conn.execute(
        """
        INSERT INTO t2_settlements
          (user_id, order_id, transaction_id, code, name, amount, remaining_amount, quantity, sale_price, settlement_date, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        """,
        (user_id, order_id, transaction_id, code, name, amount, amount, quantity, sale_price, t2_due_ts(), now()),
    )


def t2_is_enabled(conn: sqlite3.Connection) -> bool:
    return settings_map(conn).get("t2_enabled", "1") == "1"


def buying_power(account: dict) -> float:
    return round(float(account["cash_balance"]) + float(account["pending_balance"]), 2)


def ensure_pending_allocations(conn: sqlite3.Connection, user_id: int) -> None:
    account = account_for(conn, user_id)
    row = conn.execute(
        "SELECT COALESCE(SUM(remaining_amount),0) amount FROM t2_settlements WHERE user_id=? AND status='pending'",
        (user_id,),
    ).fetchone()
    missing = round(float(account["pending_balance"]) - float(row["amount"]), 2)
    if missing <= 0:
        return
    conn.execute(
        """
        INSERT INTO t2_settlements
          (user_id, code, name, amount, remaining_amount, quantity, sale_price, settlement_date, status, created_at)
        VALUES (?, 'NAKİT', 'Satış bakiyesi', ?, ?, 0, 0, ?, 'pending', ?)
        """,
        (user_id, missing, missing, t2_due_ts(), now()),
    )


def reserve_buying_power(conn: sqlite3.Connection, user_id: int, order_id: int, amount: float) -> tuple[float, float]:
    account = account_for(conn, user_id)
    if buying_power(account) + 0.001 < amount:
        raise HttpError(422, "Yetersiz işlem bakiyesi")
    ensure_pending_allocations(conn, user_id)
    pending_target = min(float(account["pending_balance"]), amount)
    pending_used = 0.0
    rows = conn.execute(
        """
        SELECT id, remaining_amount FROM t2_settlements
        WHERE user_id=? AND status='pending' AND remaining_amount>0
        ORDER BY settlement_date ASC, id ASC
        """,
        (user_id,),
    ).fetchall()
    for row in rows:
        if pending_used + 0.001 >= pending_target:
            break
        use = min(float(row["remaining_amount"]), pending_target - pending_used)
        if use <= 0:
            continue
        conn.execute("UPDATE t2_settlements SET remaining_amount=MAX(remaining_amount-?,0) WHERE id=?", (use, row["id"]))
        conn.execute(
            "INSERT INTO t2_consumptions (order_id, settlement_id, amount, created_at) VALUES (?, ?, ?, ?)",
            (order_id, row["id"], use, now()),
        )
        pending_used = round(pending_used + use, 2)
    cash_used = round(amount - pending_used, 2)
    if float(account["cash_balance"]) + 0.001 < cash_used:
        raise HttpError(422, "Yetersiz işlem bakiyesi")
    conn.execute(
        "UPDATE accounts SET cash_balance=cash_balance-?, pending_balance=pending_balance-? WHERE user_id=?",
        (cash_used, pending_used, user_id),
    )
    conn.execute(
        "UPDATE orders SET cash_reserved=cash_reserved+?, pending_reserved=pending_reserved+? WHERE id=?",
        (cash_used, pending_used, order_id),
    )
    return cash_used, pending_used


def release_order_reservation(conn: sqlite3.Connection, order_id: int, amount: float | None = None) -> None:
    order = conn.execute("SELECT * FROM orders WHERE id=?", (order_id,)).fetchone()
    if not order:
        return
    cash_reserved = float(order["cash_reserved"])
    pending_reserved = float(order["pending_reserved"])
    refund = min(cash_reserved + pending_reserved, amount if amount is not None else cash_reserved + pending_reserved)
    cash_refund = min(cash_reserved, refund)
    pending_refund = round(refund - cash_refund, 2)
    pending_future = 0.0
    pending_due = 0.0
    remaining = pending_refund
    consumptions = conn.execute(
        """
        SELECT c.*, s.status settlement_status, s.settlement_date
        FROM t2_consumptions c JOIN t2_settlements s ON s.id=c.settlement_id
        WHERE c.order_id=? ORDER BY c.id DESC
        """,
        (order_id,),
    ).fetchall()
    for item in consumptions:
        if remaining <= 0:
            break
        restore = min(float(item["amount"]), remaining)
        if item["settlement_status"] == "pending" and int(item["settlement_date"]) > now():
            conn.execute("UPDATE t2_settlements SET remaining_amount=remaining_amount+? WHERE id=?", (restore, item["settlement_id"]))
            pending_future = round(pending_future + restore, 2)
        else:
            pending_due = round(pending_due + restore, 2)
        left = round(float(item["amount"]) - restore, 2)
        if left > 0:
            conn.execute("UPDATE t2_consumptions SET amount=? WHERE id=?", (left, item["id"]))
        else:
            conn.execute("DELETE FROM t2_consumptions WHERE id=?", (item["id"],))
        remaining = round(remaining - restore, 2)
    if remaining > 0:
        pending_future = round(pending_future + remaining, 2)
    conn.execute(
        "UPDATE accounts SET cash_balance=cash_balance+?, pending_balance=pending_balance+? WHERE user_id=?",
        (cash_refund + pending_due, pending_future, order["user_id"]),
    )
    conn.execute(
        "UPDATE orders SET cash_reserved=MAX(cash_reserved-?,0), pending_reserved=MAX(pending_reserved-?,0) WHERE id=?",
        (cash_refund, pending_refund, order_id),
    )


def credit_sale_proceeds(
    conn: sqlite3.Connection,
    user_id: int,
    order_id: int,
    symbol: str,
    name: str,
    total: float,
    quantity: int,
    price: float,
    note: str,
) -> int:
    account = account_for(conn, user_id)
    if t2_is_enabled(conn):
        before = float(account["pending_balance"])
        after = round(before + total, 2)
        conn.execute("UPDATE accounts SET pending_balance=? WHERE user_id=?", (after, user_id))
        tx_id = write_transaction(conn, user_id, "trade_sell", total, before, after, order_id=order_id, code=symbol, name=name, quantity=quantity, price=price, note=note)
        create_t2_settlement(conn, user_id, order_id, tx_id, symbol, name, total, quantity, price)
        return tx_id
    before = float(account["cash_balance"])
    after = round(before + total, 2)
    conn.execute("UPDATE accounts SET cash_balance=? WHERE user_id=?", (after, user_id))
    return write_transaction(conn, user_id, "trade_sell", total, before, after, order_id=order_id, code=symbol, name=name, quantity=quantity, price=price, note=f"{note} · T+2 kapalı")


def position_avg_price(conn: sqlite3.Connection, user_id: int, symbol: str) -> float:
    row = conn.execute("SELECT avg_price FROM positions WHERE user_id=? AND symbol=?", (user_id, symbol)).fetchone()
    return float(row["avg_price"]) if row else 0.0


def settings_map(conn: sqlite3.Connection) -> dict:
    rows = conn.execute("SELECT setting_key, setting_value FROM system_settings").fetchall()
    return {row["setting_key"]: row["setting_value"] for row in rows}


def commission_for(conn: sqlite3.Connection, gross_total: float) -> float:
    settings = settings_map(conn)
    try:
        rate_bps = max(0.0, float(settings.get("commission_rate_bps", "0") or 0))
        minimum = max(0.0, float(settings.get("minimum_commission", "0") or 0))
    except (TypeError, ValueError):
        return 0.0
    if gross_total <= 0 or rate_bps <= 0:
        return 0.0
    return round(max(minimum, gross_total * rate_bps / 10_000), 2)


def document_rows(conn: sqlite3.Connection, where: str = "", params: tuple = ()) -> list[dict]:
    rows = conn.execute(
        f"""
        SELECT d.*, u.full_name
        FROM documents d
        JOIN users u ON u.id=d.user_id
        {where}
        ORDER BY d.created_at DESC
        """,
        params,
    ).fetchall()
    items = []
    for row in rows:
        item = dict(row)
        item["created_at_label"] = iso_time(item["created_at"])
        item["url"] = f"/uploads/{item['stored_name']}"
        item["type_label"] = {
            "identity_front": "Kimlik Ön Yüz",
            "identity_back": "Kimlik Arka Yüz",
            "selfie": "Yüz Doğrulama",
        }.get(item["doc_type"], item["doc_type"])
        item["status_label"] = status_label(item["status"])
        items.append(item)
    return items


def settle_due_t2(conn: sqlite3.Connection) -> None:
    if t2_is_enabled(conn):
        rows = conn.execute("SELECT id FROM t2_settlements WHERE status='pending' AND settlement_date<=?", (now(),)).fetchall()
    else:
        rows = conn.execute("SELECT id FROM t2_settlements WHERE status='pending'").fetchall()
    for row in rows:
        settle_one_t2(conn, int(row["id"]))
    if rows:
        conn.commit()


def settle_one_t2(conn: sqlite3.Connection, settlement_id: int) -> None:
    row = conn.execute("SELECT * FROM t2_settlements WHERE id=? AND status='pending'", (settlement_id,)).fetchone()
    if not row:
        raise HttpError(404, "Bekleyen satış bakiyesi bulunamadı")
    account = account_for(conn, row["user_id"])
    pending_before = float(account["pending_balance"])
    cash_before = float(account["cash_balance"])
    amount = min(float(row["remaining_amount"]), pending_before)
    conn.execute(
        "UPDATE accounts SET pending_balance=MAX(pending_balance-?,0), cash_balance=cash_balance+? WHERE user_id=?",
        (amount, amount, row["user_id"]),
    )
    write_transaction(
        conn,
        row["user_id"],
        "t2_settlement",
        amount,
        cash_before,
        cash_before + amount,
        order_id=row["order_id"],
        code=row["code"],
        name=row["name"],
        quantity=row["quantity"],
        price=row["sale_price"],
        note=f"Satış bakiyesi aktarımı öncesi bekleyen tutar: {pending_before:.2f}",
    )
    conn.execute(
        "UPDATE t2_settlements SET remaining_amount=0, status=?, reviewed_at=? WHERE id=?",
        ("approved" if amount > 0 else "consumed", now(), settlement_id),
    )


def public_user(user: dict, include_sensitive: bool = False) -> dict:
    data = {
        "id": user["id"],
        "account_no": user.get("account_no") or f"GM{int(user['id']):06d}",
        "full_name": user["full_name"],
        "phone": user["phone"],
        "email": user["email"],
        "city": user["city"],
        "district": user.get("district", ""),
        "birth_date": user.get("birth_date", ""),
        "address": user.get("address", ""),
        "role": user["role"],
        "status": user["status"],
        "status_label": status_label(user["status"]),
        "kyc_status": user["kyc_status"],
        "kyc_status_label": status_label(user["kyc_status"]),
        "kyc_note": user.get("kyc_note", ""),
        "is_test_user": bool(user.get("is_test_user", 0)),
        "risk_profile": user.get("risk_profile", ""),
        "suitability_completed": bool(user.get("suitability_completed_at")),
        "agreements_version": user.get("agreements_version", ""),
        "two_factor_enabled": bool(user.get("two_factor_enabled", 0)),
        "last_login_at": iso_time(user["last_login_at"]) if user.get("last_login_at") else None,
        "created_at": iso_time(user["created_at"]),
        "approved_at": iso_time(user["approved_at"]) if user["approved_at"] else None,
    }
    if include_sensitive:
        data["tc_masked"] = user["tc"][:3] + "*****" + user["tc"][-3:]
        data["cash_balance"] = user.get("cash_balance", 0)
        data["blocked_balance"] = user.get("blocked_balance", 0)
        data["pending_balance"] = user.get("pending_balance", 0)
        data["credit_limit"] = user.get("credit_limit", 0)
        data["document_count"] = user.get("document_count", 0)
        data["order_count"] = user.get("order_count", 0)
        data["buy_count"] = user.get("buy_count", 0)
        data["sell_count"] = user.get("sell_count", 0)
        data["transaction_count"] = user.get("transaction_count", 0)
    return data


def order_rows(conn: sqlite3.Connection, where: str, params: tuple) -> list[dict]:
    rows = conn.execute(
        f"""
        SELECT o.*, u.full_name
        FROM orders o
        JOIN users u ON u.id=o.user_id
        {where}
        ORDER BY o.created_at DESC
        """,
        params,
    ).fetchall()
    result = []
    for row in rows:
        item = decorate_order(dict(row))
        # For sell orders: attach avg_price from position history or transaction note
        if item.get("side") == "sell":
            # Try to get avg_price from related transaction note (e.g. "Ortalama maliyet: 248.95")
            tx = conn.execute(
                "SELECT note FROM user_transactions WHERE order_id=? AND transaction_type LIKE 'trade_%' LIMIT 1",
                (item["id"],),
            ).fetchone()
            avg_price = 0.0
            if tx and tx["note"]:
                import re as _re
                m = _re.search(r"Ortalama maliyet:\s*([\d.]+)", str(tx["note"]))
                if m:
                    try:
                        avg_price = float(m.group(1))
                    except ValueError:
                        avg_price = 0.0
            if avg_price <= 0:
                avg_price = float(item.get("limit_price") or item.get("source_price") or 0)
            item["avg_cost_price"] = round(avg_price, 2)
            sell_price = float(item.get("limit_price") or 0)
            item["per_unit_diff"] = round(sell_price - avg_price, 2)
            qty = int(item.get("quantity") or 0)
            gross = float(item.get("gross_total") or 0)
            commission = float(item.get("commission") or 0)
            total_cost = round(avg_price * qty, 2)
            item["total_cost"] = total_cost
            item["net_income"] = round(gross - commission - total_cost, 2)
        result.append(item)
    return result


def money_rows(conn: sqlite3.Connection, where: str, params: tuple) -> list[dict]:
    rows = conn.execute(
        f"""
        SELECT m.*, u.full_name, b.bank_name, b.iban, b.account_holder
        FROM money_requests m
        JOIN users u ON u.id=m.user_id
        LEFT JOIN bank_accounts b ON b.id=m.bank_account_id
        {where}
        ORDER BY m.created_at DESC
        """,
        params,
    ).fetchall()
    return [decorate_money(dict(row)) for row in rows]


def decorate_order(row: dict) -> dict:
    row["status_label"] = status_label(row["status"])
    row["side_label"] = "Alış" if row["side"] == "buy" else "Satış"
    row["order_type_label"] = "Piyasa" if row["order_type"] == "market" else "Limit"
    row["created_at_label"] = iso_time(row["created_at"])
    row["reviewed_at_label"] = iso_time(row["reviewed_at"]) if row["reviewed_at"] else None
    return row


def decorate_money(row: dict) -> dict:
    row["status_label"] = status_label(row["status"])
    row["type_label"] = {"deposit": "Para Yatırma", "withdraw": "Para Çekme", "credit": "Kredili Yatırım"}.get(row["request_type"], row["request_type"])
    if row.get("admin_note") and "iptal" in row["admin_note"].lower():
        row["status_label"] = "İptal"
    if row.get("receipt_stored_name"):
        row["receipt_url"] = f"/uploads/{row['receipt_stored_name']}"
    row["created_at_label"] = iso_time(row["created_at"])
    row["reviewed_at_label"] = iso_time(row["reviewed_at"]) if row["reviewed_at"] else None
    return row


def portfolio_rows(conn: sqlite3.Connection, user_id: int) -> list[dict]:
    rows = conn.execute("SELECT * FROM positions WHERE user_id=? ORDER BY symbol ASC", (user_id,)).fetchall()
    items = []
    for row in rows:
        item = dict(row)
        quote = find_quote(conn, item["symbol"]) or {}
        current_price = float(quote.get("price") or item["avg_price"])
        item["current_price"] = current_price
        item["market_value"] = current_price * item["quantity"]
        item["pnl"] = item["market_value"] - item["avg_price"] * item["quantity"]
        item["updated_at_label"] = iso_time(item["updated_at"])
        items.append(item)
    return items


def upsert_position(conn: sqlite3.Connection, user_id: int, symbol: str, quantity: int, price: float) -> None:
    row = conn.execute("SELECT * FROM positions WHERE user_id=? AND symbol=?", (user_id, symbol)).fetchone()
    if row:
        current_qty = int(row["quantity"])
        new_qty = current_qty + quantity
        avg = ((current_qty * float(row["avg_price"])) + (quantity * price)) / new_qty
        conn.execute("UPDATE positions SET quantity=?, avg_price=?, updated_at=? WHERE id=?", (new_qty, avg, now(), row["id"]))
    else:
        conn.execute("INSERT INTO positions (user_id, symbol, quantity, avg_price, updated_at) VALUES (?, ?, ?, ?, ?)", (user_id, symbol, quantity, price, now()))


def reduce_position(conn: sqlite3.Connection, user_id: int, symbol: str, quantity: int) -> None:
    row = conn.execute("SELECT * FROM positions WHERE user_id=? AND symbol=?", (user_id, symbol)).fetchone()
    if not row or row["quantity"] < quantity:
        raise HttpError(422, "Portföy adedi yetersiz")
    remaining = row["quantity"] - quantity
    if remaining:
        conn.execute("UPDATE positions SET quantity=?, updated_at=? WHERE id=?", (remaining, now(), row["id"]))
    else:
        conn.execute("DELETE FROM positions WHERE id=?", (row["id"],))


if __name__ == "__main__":
    init_db()
    server = ThreadingHTTPServer(("", PORT), AppHandler)
    print(f"Ottoman backend running at http://localhost:{PORT}")
    print(f"Database: {DB_PATH}")
    server.serve_forever()






