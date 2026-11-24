"""SQLite persistence (predictions, observed outcomes, alerts, job runs).

SQLite is plenty for one location. To move to PostgreSQL later, keep this
class's public methods and swap the implementation.
"""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

SCHEMA = """
CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    location TEXT NOT NULL,
    feature_date TEXT NOT NULL,
    target_date TEXT NOT NULL,
    probability REAL NOT NULL,
    threshold REAL NOT NULL,
    prediction INTEGER NOT NULL,
    risk_label TEXT NOT NULL,
    data_source TEXT,
    trigger TEXT,
    missing_features TEXT,
    top_factors TEXT,
    warnings TEXT,
    features TEXT
);
CREATE INDEX IF NOT EXISTS idx_predictions_target ON predictions(target_date);
CREATE TABLE IF NOT EXISTS outcomes (
    target_date TEXT PRIMARY KEY,
    observed_max_rainfall_mm REAL NOT NULL,
    extreme INTEGER NOT NULL,
    source TEXT,
    recorded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
    target_date TEXT PRIMARY KEY,
    sent_at TEXT NOT NULL,
    probability REAL NOT NULL,
    detail TEXT
);
CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    ok INTEGER,
    trigger TEXT,
    feature_date TEXT,
    error TEXT
);
CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    verification_code TEXT,
    token_expires_at TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    unsubscribe_token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    verified_at TEXT,
    last_login_at TEXT,
    last_alert_sent_at TEXT,
    location_pref TEXT DEFAULT 'ALL',
    auth_provider TEXT DEFAULT 'email',
    name TEXT DEFAULT '',
    picture TEXT DEFAULT '',
    min_threshold_mm REAL DEFAULT 50.0
);
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
"""

_JSON_COLUMNS = ("missing_features", "top_factors", "warnings", "features")


def utcnow() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


class Store:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._conn() as c:
            c.execute("PRAGMA journal_mode=WAL")
            c.executescript(SCHEMA)
            # Safe non-destructive column migration for existing tables
            cols = {row["name"] for row in c.execute("PRAGMA table_info(subscribers)").fetchall()}
            if "auth_provider" not in cols:
                c.execute("ALTER TABLE subscribers ADD COLUMN auth_provider TEXT DEFAULT 'email'")
            if "name" not in cols:
                c.execute("ALTER TABLE subscribers ADD COLUMN name TEXT DEFAULT ''")
            if "picture" not in cols:
                c.execute("ALTER TABLE subscribers ADD COLUMN picture TEXT DEFAULT ''")
            if "failed_attempts" not in cols:
                c.execute("ALTER TABLE subscribers ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0")
            if "last_login_at" not in cols:
                c.execute("ALTER TABLE subscribers ADD COLUMN last_login_at TEXT")
            if "min_threshold_mm" not in cols:
                c.execute("ALTER TABLE subscribers ADD COLUMN min_threshold_mm REAL DEFAULT 50.0")

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path, timeout=30)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def ping(self) -> bool:
        try:
            with self._conn() as c:
                c.execute("SELECT 1").fetchone()
            return True
        except sqlite3.Error:
            return False

    # ------------------------------------------------------------ predictions
    def save_prediction(self, rec: Dict[str, Any]) -> int:
        with self._conn() as c:
            cur = c.execute(
                """INSERT INTO predictions
                (created_at, location, feature_date, target_date, probability, threshold, prediction,
                 risk_label, data_source, trigger, missing_features, top_factors, warnings, features)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    rec["created_at"], rec["location"], rec["feature_date"], rec["target_date"],
                    rec["predicted_probability"], rec["threshold"], rec["prediction"], rec["risk_label"],
                    rec.get("data_source"), rec.get("trigger"),
                    json.dumps(rec.get("missing_features", [])),
                    json.dumps(rec.get("top_factors", [])),
                    json.dumps(rec.get("warnings", [])),
                    json.dumps(rec.get("features", {})),
                ),
            )
            return int(cur.lastrowid)

    @staticmethod
    def _row(row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        for col in _JSON_COLUMNS:
            if d.get(col) is not None:
                d[col] = json.loads(d[col])
        d["predicted_probability"] = d.pop("probability")
        return d

    def latest_prediction(self) -> Optional[Dict[str, Any]]:
        with self._conn() as c:
            row = c.execute("SELECT * FROM predictions ORDER BY id DESC LIMIT 1").fetchone()
        return self._row(row) if row else None

    def list_predictions(self, limit: int = 30, start: Optional[str] = None,
                         end: Optional[str] = None, latest_per_day: bool = True) -> List[Dict[str, Any]]:
        sql = "SELECT * FROM predictions p WHERE 1=1"
        args: List[Any] = []
        if start:
            sql += " AND p.target_date >= ?"
            args.append(start)
        if end:
            sql += " AND p.target_date <= ?"
            args.append(end)
        if latest_per_day:
            sql += " AND p.id = (SELECT MAX(id) FROM predictions WHERE target_date = p.target_date)"
        sql += " ORDER BY p.target_date DESC, p.id DESC LIMIT ?"
        args.append(limit)
        with self._conn() as c:
            rows = c.execute(sql, args).fetchall()
        out = []
        for r in rows:
            d = self._row(r)
            d.pop("features", None)   # keep list responses small
            out.append(d)
        return out

    # --------------------------------------------------------------- outcomes
    def record_outcome(self, target_date: str, observed_mm: float, extreme_threshold_mm: float,
                       source: str = "manual") -> Dict[str, Any]:
        extreme = int(observed_mm >= extreme_threshold_mm)
        with self._conn() as c:
            c.execute(
                """INSERT INTO outcomes (target_date, observed_max_rainfall_mm, extreme, source, recorded_at)
                   VALUES (?,?,?,?,?)
                   ON CONFLICT(target_date) DO UPDATE SET
                     observed_max_rainfall_mm=excluded.observed_max_rainfall_mm,
                     extreme=excluded.extreme, source=excluded.source, recorded_at=excluded.recorded_at""",
                (target_date, observed_mm, extreme, source, utcnow()),
            )
        return {"target_date": target_date, "observed_max_rainfall_mm": observed_mm,
                "extreme": bool(extreme), "source": source}

    def live_metrics(self) -> Dict[str, Any]:
        """Confusion matrix of the latest prediction per target date vs recorded outcomes."""
        with self._conn() as c:
            rows = c.execute(
                """SELECT p.prediction AS pred, o.extreme AS actual
                   FROM predictions p JOIN outcomes o ON o.target_date = p.target_date
                   WHERE p.id = (SELECT MAX(id) FROM predictions WHERE target_date = p.target_date)"""
            ).fetchall()
        tp = sum(1 for r in rows if r["pred"] == 1 and r["actual"] == 1)
        fp = sum(1 for r in rows if r["pred"] == 1 and r["actual"] == 0)
        fn = sum(1 for r in rows if r["pred"] == 0 and r["actual"] == 1)
        tn = sum(1 for r in rows if r["pred"] == 0 and r["actual"] == 0)
        precision = tp / (tp + fp) if (tp + fp) else None
        recall = tp / (tp + fn) if (tp + fn) else None
        f1 = (2 * precision * recall / (precision + recall)
              if precision is not None and recall is not None and (precision + recall) else None)
        return {
            "evaluated_days": len(rows), "true_positives": tp, "false_positives": fp,
            "false_negatives": fn, "true_negatives": tn,
            "precision": precision, "recall": recall, "f1": f1,
            "note": "Extreme days are rare; treat these numbers as unreliable until many events are recorded.",
        }

    # ----------------------------------------------------------------- alerts
    def alert_sent(self, target_date: str) -> bool:
        with self._conn() as c:
            return c.execute("SELECT 1 FROM alerts WHERE target_date = ?", (target_date,)).fetchone() is not None

    def mark_alert(self, target_date: str, probability: float, detail: str = "") -> None:
        with self._conn() as c:
            c.execute("INSERT OR IGNORE INTO alerts (target_date, sent_at, probability, detail) VALUES (?,?,?,?)",
                      (target_date, utcnow(), probability, detail))

    # ------------------------------------------------------------------- runs
    def start_run(self, trigger: str) -> int:
        with self._conn() as c:
            return int(c.execute("INSERT INTO runs (started_at, trigger) VALUES (?,?)",
                                 (utcnow(), trigger)).lastrowid)

    def finish_run(self, run_id: int, ok: bool, feature_date: Optional[str] = None,
                   error: Optional[str] = None) -> None:
        with self._conn() as c:
            c.execute("UPDATE runs SET finished_at=?, ok=?, feature_date=?, error=? WHERE id=?",
                      (utcnow(), int(ok), feature_date, error, run_id))

    def last_run(self) -> Optional[Dict[str, Any]]:
        with self._conn() as c:
            row = c.execute("SELECT * FROM runs ORDER BY id DESC LIMIT 1").fetchone()
        return dict(row) if row else None

    # ------------------------------------------------------------ subscribers
    def upsert_subscriber(self, email: str, code: str, expires_at: str,
                          unsubscribe_token: str, location_pref: str = "ALL") -> Dict[str, Any]:
        """Register or re-register an email subscriber with a fresh verification code."""
        norm_email = email.strip().lower()
        now = utcnow()
        with self._conn() as c:
            existing = c.execute("SELECT * FROM subscribers WHERE email = ?", (norm_email,)).fetchone()
            if existing:
                row_dict = dict(existing)
                # If already verified, update location pref and return without resetting verification
                if row_dict["status"] == "verified":
                    c.execute("UPDATE subscribers SET location_pref = ? WHERE id = ?",
                              (location_pref, row_dict["id"]))
                    row_dict["location_pref"] = location_pref
                    return row_dict
                # If pending or unsubscribed, update code and reactivate to pending
                c.execute(
                    """UPDATE subscribers 
                    SET status = 'pending', verification_code = ?, token_expires_at = ?,
                        attempts = 0, location_pref = ?
                    WHERE id = ?""",
                    (code, expires_at, location_pref, row_dict["id"])
                )
                updated = c.execute("SELECT * FROM subscribers WHERE id = ?", (row_dict["id"],)).fetchone()
                return dict(updated)
            else:
                cur = c.execute(
                    """INSERT INTO subscribers 
                    (email, status, verification_code, token_expires_at, attempts,
                     unsubscribe_token, created_at, location_pref)
                    VALUES (?, 'pending', ?, ?, 0, ?, ?, ?)""",
                    (norm_email, code, expires_at, unsubscribe_token, now, location_pref)
                )
                inserted = c.execute("SELECT * FROM subscribers WHERE id = ?", (cur.lastrowid,)).fetchone()
                return dict(inserted)

    def upsert_verified_google_subscriber(self, email: str, location_pref: str = "ALL") -> Dict[str, Any]:
        """Register or update an email subscriber as pre-verified via Google OAuth."""
        import secrets
        norm_email = email.strip().lower()
        now = utcnow()
        with self._conn() as c:
            existing = c.execute("SELECT * FROM subscribers WHERE email = ?", (norm_email,)).fetchone()
            if existing:
                row_dict = dict(existing)
                c.execute(
                    """UPDATE subscribers 
                    SET status = 'verified', verified_at = ?, verification_code = NULL,
                        attempts = 0, location_pref = ?
                    WHERE id = ?""",
                    (now, location_pref, row_dict["id"])
                )
                updated = c.execute("SELECT * FROM subscribers WHERE id = ?", (row_dict["id"],)).fetchone()
                return dict(updated)
            else:
                unsub_token = secrets.token_hex(16)
                cur = c.execute(
                    """INSERT INTO subscribers 
                    (email, status, verification_code, token_expires_at, attempts,
                     unsubscribe_token, created_at, verified_at, location_pref)
                    VALUES (?, 'verified', NULL, NULL, 0, ?, ?, ?, ?)""",
                    (norm_email, unsub_token, now, now, location_pref)
                )
                inserted = c.execute("SELECT * FROM subscribers WHERE id = ?", (cur.lastrowid,)).fetchone()
                return dict(inserted)

    def verify_subscriber(self, email: str, code: str) -> tuple[bool, str]:
        """Validate 6-digit OTP code and transition subscriber to 'verified' status."""
        norm_email = email.strip().lower()
        now = utcnow()
        with self._conn() as c:
            row = c.execute("SELECT * FROM subscribers WHERE email = ?", (norm_email,)).fetchone()
            if not row:
                return False, "Email address not found. Please register first."
            sub = dict(row)
            if sub["status"] == "verified":
                return True, "Email is already verified."
            if sub["status"] == "unsubscribed":
                return False, "This email was unsubscribed. Please register again to re-activate."
            if sub["attempts"] >= 5:
                return False, "Too many failed attempts. Please request a new verification code."
            if sub["token_expires_at"] and sub["token_expires_at"] < now:
                return False, "Verification code has expired. Please request a new one."
            
            clean_code = str(code).strip()
            if clean_code != str(sub["verification_code"]).strip():
                new_attempts = sub["attempts"] + 1
                c.execute("UPDATE subscribers SET attempts = ? WHERE id = ?", (new_attempts, sub["id"]))
                remaining = max(0, 5 - new_attempts)
                return False, f"Invalid verification code. {remaining} attempt(s) remaining."

            # Code matches! Mark as verified
            c.execute(
                """UPDATE subscribers 
                SET status = 'verified', verified_at = ?, verification_code = NULL, attempts = 0 
                WHERE id = ?""",
                (now, sub["id"])
            )
            return True, "Email verified successfully."

    def get_subscriber(self, email: str) -> Optional[Dict[str, Any]]:
        norm_email = email.strip().lower()
        with self._conn() as c:
            row = c.execute("SELECT * FROM subscribers WHERE email = ?", (norm_email,)).fetchone()
        return dict(row) if row else None

    def get_subscriber_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        with self._conn() as c:
            row = c.execute("SELECT * FROM subscribers WHERE unsubscribe_token = ?", (token.strip(),)).fetchone()
        return dict(row) if row else None

    def resend_verification_code(self, email: str, new_code: str, new_expires_at: str) -> tuple[bool, str]:
        norm_email = email.strip().lower()
        with self._conn() as c:
            row = c.execute("SELECT * FROM subscribers WHERE email = ?", (norm_email,)).fetchone()
            if not row:
                return False, "Email not found. Please register first."
            sub = dict(row)
            if sub["status"] == "verified":
                return False, "Email is already verified."
            c.execute(
                """UPDATE subscribers 
                SET verification_code = ?, token_expires_at = ?, attempts = 0, status = 'pending'
                WHERE id = ?""",
                (new_code, new_expires_at, sub["id"])
            )
            return True, "Verification code refreshed."

    def unsubscribe(self, email_or_token: str) -> bool:
        identifier = email_or_token.strip().lower()
        with self._conn() as c:
            row = c.execute(
                "SELECT id FROM subscribers WHERE email = ? OR unsubscribe_token = ?",
                (identifier, email_or_token.strip())
            ).fetchone()
            if row:
                c.execute("UPDATE subscribers SET status = 'unsubscribed', verification_code = NULL WHERE id = ?",
                          (row["id"],))
                return True
        return False

    def get_verified_subscribers(self, location: Optional[str] = None) -> List[Dict[str, Any]]:
        """Return all active verified subscribers, optionally matching location preference."""
        with self._conn() as c:
            rows = c.execute(
                """SELECT id, email, unsubscribe_token, location_pref, created_at, last_alert_sent_at 
                FROM subscribers 
                WHERE status = 'verified'"""
            ).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            if not location or d["location_pref"] == "ALL" or d["location_pref"] == location:
                result.append(d)
        return result

    def record_alert_sent_to_subscribers(self, subscriber_ids: List[int]) -> None:
        if not subscriber_ids:
            return
        now = utcnow()
        placeholders = ",".join("?" for _ in subscriber_ids)
        with self._conn() as c:
            c.execute(f"UPDATE subscribers SET last_alert_sent_at = ? WHERE id IN ({placeholders})",
                      [now] + subscriber_ids)

    def list_subscribers_summary(self) -> Dict[str, Any]:
        with self._conn() as c:
            rows = c.execute("SELECT status, count(*) as cnt FROM subscribers GROUP BY status").fetchall()
        summary = {"total": 0, "verified": 0, "pending": 0, "unsubscribed": 0}
        for r in rows:
            summary[r["status"]] = r["cnt"]
            summary["total"] += r["cnt"]
        return summary

