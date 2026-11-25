"""System-wide thread-safe TTL + LRU cache for BurstWatch backend."""
from __future__ import annotations

import json
import logging
import threading
import time
from collections import OrderedDict
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Tuple, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class SystemCache:
    """Thread-safe, namespaced in-memory LRU+TTL cache with optional disk persistence."""

    def __init__(self, max_entries: int = 1024, default_ttl_seconds: float = 1800.0) -> None:
        self._max_entries = max(1, int(max_entries))
        self._default_ttl = float(default_ttl_seconds)
        self._lock = threading.RLock()
        # key: (namespace, key_str) -> (value, expires_at_monotonic)
        self._store: OrderedDict[Tuple[str, str], Tuple[Any, Optional[float]]] = OrderedDict()
        # namespace -> (path, ttl_seconds)
        self._disk_namespaces: Dict[str, Tuple[Path, Optional[float]]] = {}
        self._hits = 0
        self._misses = 0

    def register_disk_namespace(
        self, namespace: str, file_path: Path, ttl_seconds: Optional[float] = None
    ) -> None:
        """Bind a namespace to a JSON file on disk and preload existing entries."""
        with self._lock:
            self._disk_namespaces[namespace] = (Path(file_path), ttl_seconds)
            if Path(file_path).exists():
                try:
                    raw = json.loads(Path(file_path).read_text(encoding="utf-8"))
                    if isinstance(raw, dict):
                        expires_at = (
                            (time.monotonic() + ttl_seconds) if ttl_seconds is not None else None
                        )
                        for k, v in raw.items():
                            self._store[(namespace, str(k))] = (v, expires_at)
                except Exception as exc:
                    logger.warning("Failed to preload disk cache for %s: %s", namespace, exc)

    def _flush_disk_namespace(self, namespace: str) -> None:
        if namespace not in self._disk_namespaces:
            return
        file_path, _ = self._disk_namespaces[namespace]
        now = time.monotonic()
        payload = {
            k: val
            for (ns, k), (val, exp) in self._store.items()
            if ns == namespace and (exp is None or exp > now)
        }
        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        except Exception as exc:
            logger.warning("Failed to persist disk cache for %s: %s", namespace, exc)

    def get(self, namespace: str, key: str) -> Optional[Any]:
        """Return cached value if present and unexpired, else None."""
        composite = (namespace, str(key))
        with self._lock:
            entry = self._store.get(composite)
            if entry is None:
                self._misses += 1
                return None
            value, expires_at = entry
            if expires_at is not None and time.monotonic() >= expires_at:
                del self._store[composite]
                self._misses += 1
                return None
            self._store.move_to_end(composite)
            self._hits += 1
            return value

    def set(
        self, namespace: str, key: str, value: Any, ttl_seconds: Optional[float] = None
    ) -> Any:
        """Store value under (namespace, key) with LRU eviction and optional TTL."""
        ttl = self._default_ttl if ttl_seconds is None else ttl_seconds
        expires_at = (time.monotonic() + float(ttl)) if ttl is not None else None
        composite = (namespace, str(key))
        with self._lock:
            if composite in self._store:
                self._store.move_to_end(composite)
            self._store[composite] = (value, expires_at)
            while len(self._store) > self._max_entries:
                self._store.popitem(last=False)
            self._flush_disk_namespace(namespace)
        return value

    def get_or_set(
        self,
        namespace: str,
        key: str,
        factory: Callable[[], T],
        ttl_seconds: Optional[float] = None,
    ) -> T:
        """Return cached value or compute via factory and store it."""
        cached = self.get(namespace, key)
        if cached is not None:
            return cached
        value = factory()
        self.set(namespace, key, value, ttl_seconds=ttl_seconds)
        return value

    def invalidate(self, namespace: str, key: Optional[str] = None) -> int:
        """Remove a specific key or all keys in a namespace. Returns count removed."""
        with self._lock:
            if key is not None:
                composite = (namespace, str(key))
                if composite in self._store:
                    del self._store[composite]
                    self._flush_disk_namespace(namespace)
                    return 1
                return 0
            keys_to_remove = [comp for comp in self._store if comp[0] == namespace]
            for comp in keys_to_remove:
                del self._store[comp]
            if keys_to_remove:
                self._flush_disk_namespace(namespace)
            return len(keys_to_remove)

    def clear(self) -> None:
        """Clear all in-memory entries and reset counters."""
        with self._lock:
            self._store.clear()
            self._hits = 0
            self._misses = 0

    def stats(self) -> Dict[str, Any]:
        """Return cache hit/miss and per-namespace entry statistics."""
        with self._lock:
            now = time.monotonic()
            expired = [
                comp for comp, (_, exp) in self._store.items() if exp is not None and now >= exp
            ]
            for comp in expired:
                del self._store[comp]

            namespaces: Dict[str, int] = {}
            for ns, _ in self._store:
                namespaces[ns] = namespaces.get(ns, 0) + 1

            total = self._hits + self._misses
            return {
                "entries": len(self._store),
                "max_entries": self._max_entries,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": round(self._hits / total, 4) if total > 0 else 0.0,
                "namespaces": namespaces,
            }


# Shared backend cache instance
system_cache = SystemCache(max_entries=1024, default_ttl_seconds=1800.0)

