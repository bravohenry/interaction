"""Agent roster management using database persistence."""

import threading
from typing import Optional

from logging_config import logger
from persistence import AgentRosterRepository, get_db_session


class AgentRoster:
    """Database-backed roster that stores agent names per user."""

    def __init__(self, user_id: str):
        self._user_id = user_id
        self._agents: list[str] = []
        self._lock = threading.Lock()
        self.load()

    def load(self) -> None:
        """Load agent names from database."""
        with self._lock:
            try:
                db = next(get_db_session())
                repo = AgentRosterRepository(db)
                self._agents = repo.get_agents(user_id=self._user_id)
            except Exception as exc:
                logger.warning(f"Failed to load roster: {exc}")
                self._agents = []

    def save(self) -> None:
        """Save is no-op since database is updated on each add."""
        pass

    def add_agent(self, agent_name: str) -> None:
        """Add an agent to the roster if not already present."""
        with self._lock:
            if agent_name not in self._agents:
                try:
                    db = next(get_db_session())
                    repo = AgentRosterRepository(db)
                    repo.add_agent(user_id=self._user_id, agent_name=agent_name)
                    self._agents.append(agent_name)
                except Exception as exc:
                    logger.warning(f"Failed to add agent to roster: {exc}")

    def get_agents(self) -> list[str]:
        """Get list of all agent names."""
        with self._lock:
            return list(self._agents)

    def clear(self) -> None:
        """Clear the agent roster."""
        with self._lock:
            try:
                db = next(get_db_session())
                repo = AgentRosterRepository(db)
                repo.clear(user_id=self._user_id)
                self._agents = []
                logger.info("Cleared agent roster")
            except Exception as exc:
                logger.warning(f"Failed to clear roster: {exc}")


# Per-user roster instances
_agent_roster: dict[str, AgentRoster] = {}
_current_user_id: Optional[str] = None
_global_lock = threading.Lock()


def set_roster_user(user_id: str) -> None:
    """Set the current user for the roster."""
    global _current_user_id
    with _global_lock:
        _current_user_id = user_id
        # Create instance if it doesn't exist
        if user_id not in _agent_roster:
            _agent_roster[user_id] = AgentRoster(user_id)


def get_agent_roster(user_id: Optional[str] = None) -> AgentRoster:
    """Get the roster instance for the specified or current user."""
    global _current_user_id

    # Use provided user_id or fall back to current context
    target_user_id = user_id or _current_user_id

    with _global_lock:
        if target_user_id is None:
            # Fallback: create a default instance (should not happen in production)
            logger.warning("Roster accessed without user context")
            target_user_id = "system"

        # Create instance if it doesn't exist
        if target_user_id not in _agent_roster:
            _agent_roster[target_user_id] = AgentRoster(target_user_id)

        return _agent_roster[target_user_id]
