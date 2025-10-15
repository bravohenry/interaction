from __future__ import annotations

import json
import threading
from datetime import datetime
from html import escape, unescape
from typing import List, Optional

from logging_config import logger
from persistence import WorkingMemoryRepository, get_db_session
from utils.timezones import now_in_user_timezone

from .state import LogEntry, SummaryState


def _encode_payload(payload: str) -> str:
    normalized = payload.replace("\r\n", "\n").replace("\r", "\n")
    collapsed = normalized.replace("\n", "\\n")
    return escape(collapsed, quote=False)


def _decode_payload(payload: str) -> str:
    return unescape(payload).replace("\\n", "\n")


def _format_line(tag: str, payload: str, timestamp: Optional[str] = None) -> str:
    encoded = _encode_payload(payload)
    if timestamp:
        return f'<{tag} timestamp="{timestamp}">{encoded}</{tag}>\n'
    return f"<{tag}>{encoded}</{tag}>\n"


def _current_timestamp() -> str:
    result = now_in_user_timezone("%Y-%m-%d %H:%M:%S")
    return str(result) if not isinstance(result, str) else result


class WorkingMemoryLog:
    """Database-backed working-memory storing conversation summary and recent entries."""

    def __init__(self, user_id: str, thread_id: Optional[str] = None) -> None:
        self._user_id = user_id
        self._thread_id = thread_id
        self._lock = threading.Lock()
        self._next_idx = 0
        self._initialize()

    def _initialize(self) -> None:
        with self._lock:
            self._initialize_locked()

    def _initialize_locked(self) -> None:
        # Check if database has any entries
        try:
            db = next(get_db_session())
            repo = WorkingMemoryRepository(db)
            entries = repo.fetch_entries(user_id=self._user_id, thread_id=self._thread_id)

            if not entries:
                # Initialize with empty summary state
                initial_state = SummaryState.empty()
                repo.append(
                    user_id=self._user_id,
                    thread_id=self._thread_id,
                    tag="summary_info",
                    payload=json.dumps({"last_index": initial_state.last_index, "updated_at": None}),
                    idx=0,
                    timestamp=None,
                )
                repo.append(
                    user_id=self._user_id,
                    thread_id=self._thread_id,
                    tag="conversation_summary",
                    payload="",
                    idx=1,
                    timestamp=None,
                )
                self._next_idx = 2
            else:
                # Find max idx
                self._next_idx = max(entry.idx for entry in entries) + 1
        except Exception as exc:  # pragma: no cover - defensive
            logger.error(
                "working memory initialization failed",
                extra={"error": str(exc)},
            )
            raise

    def append_entry(self, tag: str, payload: str, timestamp: Optional[str] = None) -> None:
        sanitized_timestamp = timestamp or _current_timestamp()
        with self._lock:
            try:
                db = next(get_db_session())
                repo = WorkingMemoryRepository(db)
                repo.append(
                    user_id=self._user_id,
                    thread_id=self._thread_id,
                    tag=tag,
                    payload=str(payload),
                    idx=self._next_idx,
                    timestamp=sanitized_timestamp,
                )
                self._next_idx += 1
            except Exception as exc:  # pragma: no cover - defensive
                logger.error(
                    "working memory append failed",
                    extra={"error": str(exc), "tag": tag},
                )
                raise

    def load_summary_state(self) -> SummaryState:
        with self._lock:
            try:
                db = next(get_db_session())
                repo = WorkingMemoryRepository(db)
                entries = repo.fetch_entries(user_id=self._user_id, thread_id=self._thread_id)
            except Exception as exc:  # pragma: no cover - defensive
                logger.error(
                    "working memory read failed",
                    extra={"error": str(exc)},
                )
                return SummaryState.empty()

        summary_text = ""
        last_index = -1
        updated_at: Optional[datetime] = None
        log_entries: List[LogEntry] = []

        for entry in entries:
            tag = entry.tag
            payload = entry.payload
            timestamp = entry.timestamp

            if tag == "summary_info":
                try:
                    data = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                last_index_val = data.get("last_index")
                if isinstance(last_index_val, int):
                    last_index = last_index_val
                updated_raw = data.get("updated_at")
                if isinstance(updated_raw, str) and updated_raw:
                    try:
                        updated_at = datetime.fromisoformat(updated_raw)
                    except ValueError:
                        updated_at = None
            elif tag == "conversation_summary":
                summary_text = payload
            else:
                log_entries.append(LogEntry(tag=tag, payload=payload, timestamp=timestamp or None))

        state = SummaryState(
            summary_text=summary_text,
            last_index=last_index,
            updated_at=updated_at,
            unsummarized_entries=log_entries,
        )
        return state

    def write_summary_state(self, state: SummaryState) -> None:
        meta_payload = json.dumps(
            {
                "last_index": state.last_index,
                "updated_at": state.updated_at.isoformat() if state.updated_at else None,
            }
        )

        with self._lock:
            try:
                db = next(get_db_session())
                repo = WorkingMemoryRepository(db)

                # Clear existing entries
                repo.clear(user_id=self._user_id, thread_id=self._thread_id)

                # Write new state
                idx = 0
                repo.append(
                    user_id=self._user_id,
                    thread_id=self._thread_id,
                    tag="summary_info",
                    payload=meta_payload,
                    idx=idx,
                    timestamp=None,
                )
                idx += 1

                repo.append(
                    user_id=self._user_id,
                    thread_id=self._thread_id,
                    tag="conversation_summary",
                    payload=state.summary_text or "",
                    idx=idx,
                    timestamp=None,
                )
                idx += 1

                for entry in state.unsummarized_entries:
                    repo.append(
                        user_id=self._user_id,
                        thread_id=self._thread_id,
                        tag=entry.tag,
                        payload=entry.payload,
                        idx=idx,
                        timestamp=entry.timestamp,
                    )
                    idx += 1

                self._next_idx = idx
            except Exception as exc:  # pragma: no cover - defensive
                logger.error(
                    "working memory write failed",
                    extra={"error": str(exc)},
                )
                raise

    def render_transcript(self, state: Optional[SummaryState] = None) -> str:
        snapshot = state or self.load_summary_state()
        parts: List[str] = []

        summary_text = (snapshot.summary_text or "").strip()
        if summary_text:
            safe_summary = escape(summary_text, quote=False)
            parts.append(f"<conversation_summary>{safe_summary}</conversation_summary>")

        for entry in snapshot.unsummarized_entries:
            safe_payload = escape(entry.payload, quote=False)
            if entry.timestamp:
                parts.append(f'<{entry.tag} timestamp="{entry.timestamp}">{safe_payload}</{entry.tag}>')
            else:
                parts.append(f"<{entry.tag}>{safe_payload}</{entry.tag}>")

        return "\n".join(parts)

    def clear(self) -> None:
        with self._lock:
            try:
                db = next(get_db_session())
                repo = WorkingMemoryRepository(db)
                repo.clear(user_id=self._user_id, thread_id=self._thread_id)
                self._initialize_locked()
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning(
                    "working memory clear failed",
                    extra={"error": str(exc)},
                )


# Global singleton - will be replaced with user-scoped instances
_working_memory_log: Optional[WorkingMemoryLog] = None
_current_user_id: Optional[str] = None
_current_thread_id: Optional[str] = None
_factory_lock = threading.Lock()


def set_working_memory_user(user_id: str, thread_id: Optional[str] = None) -> None:
    """Set the current user for working memory."""
    global _working_memory_log, _current_user_id, _current_thread_id
    with _factory_lock:
        _current_user_id = user_id
        _current_thread_id = thread_id
        _working_memory_log = WorkingMemoryLog(user_id=user_id, thread_id=thread_id)


def get_working_memory_log() -> WorkingMemoryLog:
    """Get the working memory log for the current user."""
    global _working_memory_log, _current_user_id, _current_thread_id
    with _factory_lock:
        if _working_memory_log is None:
            # Fallback: create a default instance (should not happen in production)
            logger.warning("Working memory accessed without user context")
            _working_memory_log = WorkingMemoryLog(user_id="system", thread_id=None)
        return _working_memory_log


__all__ = ["WorkingMemoryLog", "get_working_memory_log", "set_working_memory_user"]
