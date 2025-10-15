"""Execution agent log management using database persistence."""

from __future__ import annotations

import threading
from html import escape, unescape
from typing import Iterator, List, Optional, Tuple

from logging_config import logger
from persistence import ExecutionAgentLogRepository, get_db_session
from utils.timezones import now_in_user_timezone


def _slugify(name: str) -> str:
    """Convert agent name to filesystem-safe slug."""
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in name.strip()).strip("-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug or "agent"


def _encode_payload(payload: str) -> str:
    """Encode payload for storage."""
    normalized = payload.replace("\r\n", "\n").replace("\r", "\n")
    collapsed = normalized.replace("\n", "\\n")
    return escape(collapsed, quote=False)


def _decode_payload(payload: str) -> str:
    return unescape(payload).replace("\\n", "\n")


class ExecutionAgentLogStore:
    """Database-backed journal for execution agents."""

    def __init__(self, user_id: str):
        self._user_id = user_id
        self._lock = threading.Lock()

    def _append(self, agent_name: str, tag: str, payload: str) -> None:
        """Append an entry with the given tag."""
        encoded = _encode_payload(str(payload))
        timestamp = now_in_user_timezone("%Y-%m-%d %H:%M:%S")

        with self._lock:
            try:
                db = next(get_db_session())
                repo = ExecutionAgentLogRepository(db)
                repo.append(
                    user_id=self._user_id,
                    agent_name=agent_name,
                    tag=tag,
                    payload=encoded,
                    timestamp=timestamp,
                )
            except Exception as exc:
                logger.error(f"Failed to append to log: {exc}")

    def record_request(self, agent_name: str, instructions: str) -> None:
        """Record an incoming request from the interaction agent."""
        self._append(agent_name, "agent_request", instructions)

    def record_action(self, agent_name: str, description: str) -> None:
        """Record an agent action (tool call)."""
        self._append(agent_name, "agent_action", description)

    def record_tool_response(self, agent_name: str, tool_name: str, response: str) -> None:
        """Record the response from a tool."""
        self._append(agent_name, "tool_response", f"{tool_name}: {response}")

    def record_agent_response(self, agent_name: str, response: str) -> None:
        """Record the agent's final response."""
        self._append(agent_name, "agent_response", response)

    def iter_entries(self, agent_name: str) -> Iterator[Tuple[str, str, str]]:
        """Iterate over all log entries for an agent."""
        with self._lock:
            try:
                db = next(get_db_session())
                repo = ExecutionAgentLogRepository(db)
                entries = repo.fetch_entries(user_id=self._user_id, agent_name=agent_name)
            except Exception as exc:
                logger.error(f"Failed to read log: {exc}")
                entries = []

        for entry in entries:
            tag = entry.tag
            timestamp = entry.timestamp
            payload = _decode_payload(entry.payload)
            yield (tag, timestamp, payload)

    def load_transcript(self, agent_name: str) -> str:
        """Load the full transcript for inclusion in system prompt."""
        parts: List[str] = []
        for tag, timestamp, payload in self.iter_entries(agent_name):
            escaped = escape(payload, quote=False)
            if timestamp:
                parts.append(f'<{tag} timestamp="{timestamp}">{escaped}</{tag}>')
            else:
                parts.append(f"<{tag}>{escaped}</{tag}>")
        return "\n".join(parts)

    def load_recent(self, agent_name: str, limit: int = 10) -> list[tuple[str, str, str]]:
        """Load recent log entries."""
        entries = list(self.iter_entries(agent_name))
        return entries[-limit:] if entries else []

    def list_agents(self) -> list[str]:
        """List all agents with logs."""
        try:
            db = next(get_db_session())
            repo = ExecutionAgentLogRepository(db)
            return repo.list_agents(user_id=self._user_id)
        except Exception as exc:
            logger.error(f"Failed to list agents: {exc}")
            return []

    def clear_all(self) -> None:
        """Clear all execution agent logs."""
        try:
            db = next(get_db_session())
            repo = ExecutionAgentLogRepository(db)
            repo.clear_all(user_id=self._user_id)
            logger.info("Cleared all execution agent logs")
        except Exception as exc:
            logger.error(f"Failed to clear execution logs: {exc}")


# Per-user log store instances
_execution_agent_logs: dict[str, ExecutionAgentLogStore] = {}
_current_user_id: Optional[str] = None
_global_lock = threading.Lock()


def set_execution_log_user(user_id: str) -> None:
    """Set the current user for execution logs."""
    global _current_user_id
    with _global_lock:
        _current_user_id = user_id
        # Create instance if it doesn't exist
        if user_id not in _execution_agent_logs:
            _execution_agent_logs[user_id] = ExecutionAgentLogStore(user_id)


def get_execution_agent_logs(user_id: Optional[str] = None) -> ExecutionAgentLogStore:
    """Get the execution log store instance for the specified or current user."""
    global _current_user_id

    # Use provided user_id or fall back to current context
    target_user_id = user_id or _current_user_id

    with _global_lock:
        if target_user_id is None:
            # Fallback: create a default instance (should not happen in production)
            logger.warning("Execution log accessed without user context")
            target_user_id = "system"

        # Create instance if it doesn't exist
        if target_user_id not in _execution_agent_logs:
            _execution_agent_logs[target_user_id] = ExecutionAgentLogStore(target_user_id)

        return _execution_agent_logs[target_user_id]
