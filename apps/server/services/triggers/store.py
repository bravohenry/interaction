from __future__ import annotations

import threading
from typing import Any

from sqlalchemy.orm import Session

from persistence import TriggerRepository, get_engine
from persistence.models import Trigger
from .models import TriggerRecord


class TriggerStore:
    """Low-level persistence for triggers backed by Postgres."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._engine = get_engine()

    def _get_session(self) -> Session:
        """Get a new database session."""
        from sqlalchemy.orm import sessionmaker

        SessionLocal = sessionmaker(bind=self._engine, autoflush=False, autocommit=False)
        return SessionLocal()

    def insert(self, payload: dict[str, Any]) -> int:
        with self._lock:
            session = self._get_session()
            try:
                repo = TriggerRepository(session)
                return repo.insert(payload)
            finally:
                session.close()

    def fetch_one(self, trigger_id: int, agent_name: str) -> TriggerRecord | None:
        with self._lock:
            session = self._get_session()
            try:
                repo = TriggerRepository(session)
                trigger = repo.fetch_one(trigger_id, agent_name)
                return self._model_to_record(trigger) if trigger else None
            finally:
                session.close()

    def update(self, trigger_id: int, agent_name: str, fields: dict[str, Any]) -> bool:
        if not fields:
            return False
        with self._lock:
            session = self._get_session()
            try:
                repo = TriggerRepository(session)
                return repo.update(trigger_id, agent_name, fields)
            finally:
                session.close()

    def list_for_agent(self, agent_name: str) -> list[TriggerRecord]:
        with self._lock:
            session = self._get_session()
            try:
                repo = TriggerRepository(session)
                triggers = repo.list_for_agent(agent_name)
                return [self._model_to_record(t) for t in triggers]
            finally:
                session.close()

    def fetch_due(self, agent_name: str | None, before_iso: str) -> list[TriggerRecord]:
        with self._lock:
            session = self._get_session()
            try:
                repo = TriggerRepository(session)
                triggers = repo.fetch_due(agent_name, before_iso)
                return [self._model_to_record(t) for t in triggers]
            finally:
                session.close()

    def clear_all(self) -> None:
        with self._lock:
            session = self._get_session()
            try:
                repo = TriggerRepository(session)
                repo.clear_all()
            finally:
                session.close()

    def _model_to_record(self, trigger: Trigger) -> TriggerRecord:
        """Convert SQLAlchemy model to TriggerRecord."""
        return TriggerRecord(
            id=trigger.id,
            agent_name=trigger.agent_name,
            payload=trigger.payload,
            start_time=trigger.start_time.isoformat() if trigger.start_time else None,
            next_trigger=trigger.next_trigger.isoformat() if trigger.next_trigger else None,
            recurrence_rule=trigger.recurrence_rule,
            timezone=trigger.timezone,
            status=trigger.status,
            last_error=trigger.last_error,
            created_at=trigger.created_at.isoformat(),
            updated_at=trigger.updated_at.isoformat(),
        )


__all__ = ["TriggerStore"]
