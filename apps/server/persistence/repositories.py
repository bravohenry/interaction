"""Repository layer for database operations."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from .models import (
    AgentRosterEntry,
    ComposioConnection,
    ConversationLogEntry,
    ConversationSummary,
    ExecutionAgentLog,
    Message,
    ProcessedEmail,
    Trigger,
    User,
    WorkingMemoryEntry,
)


class MessageRepository:
    """Repository for message operations."""

    def __init__(self, session: Session):
        self.session = session

    def insert(
        self,
        *,
        id: str,
        user_id: str,
        thread_id: str,
        role: str,
        content: str,
        run_id: Optional[str] = None,
        status: str = "final",
    ) -> Message:
        """Insert a new message."""
        now = datetime.now(timezone.utc)
        message = Message(
            id=id,
            user_id=user_id,
            thread_id=thread_id,
            role=role,
            content=content,
            run_id=run_id,
            status=status,
            created_at=now,
            updated_at=now,
        )
        self.session.add(message)
        self.session.commit()
        self.session.refresh(message)
        return message

    def fetch_by_thread(self, thread_id: str) -> List[Message]:
        """Fetch all messages for a thread."""
        stmt = select(Message).where(Message.thread_id == thread_id).order_by(Message.created_at.asc())
        return list(self.session.execute(stmt).scalars().all())

    def fetch_by_user(self, user_id: str, limit: int = 100) -> List[Message]:
        """Fetch recent messages for a user."""
        stmt = select(Message).where(Message.user_id == user_id).order_by(Message.created_at.desc()).limit(limit)
        return list(self.session.execute(stmt).scalars().all())


class TriggerRepository:
    """Repository for trigger operations."""

    def __init__(self, session: Session):
        self.session = session

    def insert(self, payload: Dict[str, Any]) -> int:
        """Insert a new trigger."""
        trigger = Trigger(**payload)
        self.session.add(trigger)
        self.session.commit()
        self.session.refresh(trigger)
        return trigger.id

    def fetch_one(self, trigger_id: int, agent_name: str) -> Optional[Trigger]:
        """Fetch a single trigger by ID and agent name."""
        stmt = select(Trigger).where(and_(Trigger.id == trigger_id, Trigger.agent_name == agent_name))
        return self.session.execute(stmt).scalar_one_or_none()

    def update(self, trigger_id: int, agent_name: str, fields: Dict[str, Any]) -> bool:
        """Update a trigger."""
        if not fields:
            return False
        fields["updated_at"] = datetime.now(timezone.utc)
        stmt = select(Trigger).where(and_(Trigger.id == trigger_id, Trigger.agent_name == agent_name))
        trigger = self.session.execute(stmt).scalar_one_or_none()
        if not trigger:
            return False
        for key, value in fields.items():
            setattr(trigger, key, value)
        self.session.commit()
        return True

    def list_for_agent(self, agent_name: str) -> List[Trigger]:
        """List all triggers for an agent."""
        stmt = (
            select(Trigger)
            .where(Trigger.agent_name == agent_name)
            .order_by(Trigger.next_trigger.is_(None), Trigger.next_trigger)
        )
        return list(self.session.execute(stmt).scalars().all())

    def fetch_due(self, agent_name: Optional[str], before_iso: str) -> List[Trigger]:
        """Fetch triggers that are due before a given timestamp."""
        before_dt = datetime.fromisoformat(before_iso.replace("Z", "+00:00"))
        conditions = [
            Trigger.status == "active",
            Trigger.next_trigger.isnot(None),
            Trigger.next_trigger <= before_dt,
        ]
        if agent_name:
            conditions.append(Trigger.agent_name == agent_name)
        stmt = select(Trigger).where(and_(*conditions)).order_by(Trigger.next_trigger, Trigger.id)
        return list(self.session.execute(stmt).scalars().all())

    def clear_all(self) -> None:
        """Clear all triggers."""
        self.session.query(Trigger).delete()
        self.session.commit()


class ConnectionRepository:
    """Repository for Composio connection operations."""

    def __init__(self, session: Session):
        self.session = session

    def insert(
        self,
        *,
        id: str,
        user_id: str,
        provider_id: str,
        auth_config_id: str,
        connection_request_id: Optional[str] = None,
        status: str = "pending",
        composio_user_id: Optional[str] = None,
        email: Optional[str] = None,
        is_default: Optional[bool] = None,
    ) -> ComposioConnection:
        """Insert a new connection."""
        now = datetime.now(timezone.utc)
        connection = ComposioConnection(
            id=id,
            user_id=user_id,
            provider_id=provider_id,
            auth_config_id=auth_config_id,
            connection_request_id=connection_request_id,
            composio_user_id=composio_user_id,
            email=email,
            is_default=bool(is_default) if is_default is not None else False,
            status=status,
            created_at=now,
            updated_at=now,
        )
        self.session.add(connection)
        self.session.commit()
        self.session.refresh(connection)
        return connection

    def update(self, connection_id: str, fields: Dict[str, Any]) -> bool:
        """Update a connection."""
        if not fields:
            return False
        fields["updated_at"] = datetime.now(timezone.utc)
        stmt = select(ComposioConnection).where(ComposioConnection.id == connection_id)
        connection = self.session.execute(stmt).scalar_one_or_none()
        if not connection:
            return False
        for key, value in fields.items():
            setattr(connection, key, value)
        self.session.commit()
        return True

    def fetch_by_user(self, user_id: str, provider_id: str = "gmail") -> List[ComposioConnection]:
        """Fetch connections for a user."""
        stmt = (
            select(ComposioConnection)
            .where(
                and_(
                    ComposioConnection.user_id == user_id,
                    ComposioConnection.provider_id == provider_id,
                )
            )
            .order_by(ComposioConnection.created_at.desc())
        )
        return list(self.session.execute(stmt).scalars().all())

    def fetch_by_id(self, connection_id: str) -> Optional[ComposioConnection]:
        """Fetch a single connection by ID."""
        stmt = select(ComposioConnection).where(ComposioConnection.id == connection_id)
        return self.session.execute(stmt).scalar_one_or_none()

    def fetch_by_composio_user(self, user_id: str, composio_user_id: str) -> Optional[ComposioConnection]:
        """Fetch a specific connection by app user and composio user id."""
        stmt = select(ComposioConnection).where(
            and_(
                ComposioConnection.user_id == user_id,
                ComposioConnection.composio_user_id == composio_user_id,
            )
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def set_default(self, user_id: str, connection_id: str, provider_id: str = "gmail") -> bool:
        """Set the default connection for a user (clear others for the same provider)."""
        stmt_all = select(ComposioConnection).where(
            and_(
                ComposioConnection.user_id == user_id,
                ComposioConnection.provider_id == provider_id,
            )
        )
        rows = list(self.session.execute(stmt_all).scalars().all())
        if not rows:
            return False
        for row in rows:
            row.is_default = row.id == connection_id
            row.updated_at = datetime.now(timezone.utc)
        self.session.commit()
        return True

    def fetch_by_email(self, user_id: str, email: str, provider_id: str = "gmail") -> Optional[ComposioConnection]:
        """Fetch a connection by user ID and email address."""
        stmt = select(ComposioConnection).where(
            and_(
                ComposioConnection.user_id == user_id,
                ComposioConnection.provider_id == provider_id,
                ComposioConnection.email == email,
                ComposioConnection.status == "connected",
            )
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def fetch_default(self, user_id: str, provider_id: str = "gmail") -> Optional[ComposioConnection]:
        """Fetch the default connection for a user."""
        stmt = select(ComposioConnection).where(
            and_(
                ComposioConnection.user_id == user_id,
                ComposioConnection.provider_id == provider_id,
                ComposioConnection.is_default.is_(True),
                ComposioConnection.status == "connected",
            )
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def delete(self, connection_id: str) -> bool:
        """Delete a connection."""
        stmt = select(ComposioConnection).where(ComposioConnection.id == connection_id)
        connection = self.session.execute(stmt).scalar_one_or_none()
        if not connection:
            return False
        self.session.delete(connection)
        self.session.commit()
        return True


class UserRepository:
    """Repository for user operations."""

    def __init__(self, session: Session):
        self.session = session

    def get_timezone(self, user_id: str) -> Optional[str]:
        """Get user timezone."""
        stmt = select(User.timezone).where(User.id == user_id)
        return self.session.execute(stmt).scalar_one_or_none()

    def set_timezone(self, user_id: str, timezone: str) -> bool:
        """Set user timezone."""
        stmt = select(User).where(User.id == user_id)
        user = self.session.execute(stmt).scalar_one_or_none()
        if not user:
            return False
        user.timezone = timezone
        self.session.commit()
        return True


class ProcessedEmailRepository:
    """Repository for processed email tracking."""

    def __init__(self, session: Session):
        self.session = session

    def mark_processed(self, user_id: str, message_id: str) -> bool:
        """Mark an email as processed."""
        try:
            processed = ProcessedEmail(user_id=user_id, message_id=message_id, processed_at=datetime.now(timezone.utc))
            self.session.add(processed)
            self.session.commit()
            return True
        except Exception:
            self.session.rollback()
            return False

    def is_processed(self, user_id: str, message_id: str) -> bool:
        """Check if email was processed."""
        stmt = select(ProcessedEmail).where(
            and_(ProcessedEmail.user_id == user_id, ProcessedEmail.message_id == message_id)
        )
        return self.session.execute(stmt).scalar_one_or_none() is not None

    def get_processed_ids(self, user_id: str, limit: int = 300) -> List[str]:
        """Get recently processed message IDs."""
        stmt = (
            select(ProcessedEmail.message_id)
            .where(ProcessedEmail.user_id == user_id)
            .order_by(ProcessedEmail.processed_at.desc())
            .limit(limit)
        )
        return list(self.session.execute(stmt).scalars().all())


class ConversationSummaryRepository:
    """Repository for conversation summaries."""

    def __init__(self, session: Session):
        self.session = session

    def insert(self, user_id: str, thread_id: str, summary: str, message_count: int) -> int:
        """Insert a new conversation summary."""
        summary_obj = ConversationSummary(
            user_id=user_id,
            thread_id=thread_id,
            summary=summary,
            message_count=message_count,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(summary_obj)
        self.session.commit()
        self.session.refresh(summary_obj)
        return summary_obj.id

    def get_latest(self, user_id: str, thread_id: str) -> Optional[ConversationSummary]:
        """Get latest summary for a thread."""
        stmt = (
            select(ConversationSummary)
            .where(and_(ConversationSummary.user_id == user_id, ConversationSummary.thread_id == thread_id))
            .order_by(ConversationSummary.created_at.desc())
            .limit(1)
        )
        return self.session.execute(stmt).scalar_one_or_none()


class ExecutionAgentLogRepository:
    """Repository for execution agent log operations."""

    def __init__(self, session: Session):
        self.session = session

    def append(self, user_id: str, agent_name: str, tag: str, payload: str, timestamp: str) -> None:
        """Append a log entry."""
        log_entry = ExecutionAgentLog(
            user_id=user_id,
            agent_name=agent_name,
            tag=tag,
            payload=payload,
            timestamp=timestamp,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(log_entry)
        self.session.commit()

    def fetch_entries(self, user_id: str, agent_name: str) -> List[ExecutionAgentLog]:
        """Fetch all log entries for an agent."""
        stmt = (
            select(ExecutionAgentLog)
            .where(and_(ExecutionAgentLog.user_id == user_id, ExecutionAgentLog.agent_name == agent_name))
            .order_by(ExecutionAgentLog.created_at.asc())
        )
        return list(self.session.execute(stmt).scalars().all())

    def fetch_recent(self, user_id: str, agent_name: str, limit: int = 10) -> List[ExecutionAgentLog]:
        """Fetch recent log entries for an agent."""
        stmt = (
            select(ExecutionAgentLog)
            .where(and_(ExecutionAgentLog.user_id == user_id, ExecutionAgentLog.agent_name == agent_name))
            .order_by(ExecutionAgentLog.created_at.desc())
            .limit(limit)
        )
        results = list(self.session.execute(stmt).scalars().all())
        return list(reversed(results))

    def list_agents(self, user_id: str) -> List[str]:
        """List all agents with logs for a user."""
        stmt = (
            select(ExecutionAgentLog.agent_name)
            .where(ExecutionAgentLog.user_id == user_id)
            .distinct()
            .order_by(ExecutionAgentLog.agent_name)
        )
        return list(self.session.execute(stmt).scalars().all())

    def clear_all(self, user_id: str) -> None:
        """Clear all execution agent logs for a user."""
        self.session.query(ExecutionAgentLog).where(ExecutionAgentLog.user_id == user_id).delete()
        self.session.commit()


class ConversationLogRepository:
    """Repository for conversation log operations."""

    def __init__(self, session: Session):
        self.session = session

    def append(self, user_id: str, thread_id: Optional[str], tag: str, payload: str, timestamp: str) -> None:
        """Append a conversation log entry."""
        log_entry = ConversationLogEntry(
            user_id=user_id,
            thread_id=thread_id,
            tag=tag,
            payload=payload,
            timestamp=timestamp,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(log_entry)
        self.session.commit()

    def fetch_entries(self, user_id: str, thread_id: Optional[str] = None) -> List[ConversationLogEntry]:
        """Fetch all conversation log entries."""
        conditions = [ConversationLogEntry.user_id == user_id]
        if thread_id is not None:
            conditions.append(ConversationLogEntry.thread_id == thread_id)
        stmt = select(ConversationLogEntry).where(and_(*conditions)).order_by(ConversationLogEntry.created_at.asc())
        return list(self.session.execute(stmt).scalars().all())

    def clear(self, user_id: str, thread_id: Optional[str] = None) -> None:
        """Clear conversation log entries."""
        conditions = [ConversationLogEntry.user_id == user_id]
        if thread_id is not None:
            conditions.append(ConversationLogEntry.thread_id == thread_id)
        self.session.query(ConversationLogEntry).where(and_(*conditions)).delete()
        self.session.commit()


class WorkingMemoryRepository:
    """Repository for working memory operations."""

    def __init__(self, session: Session):
        self.session = session

    def append(
        self, user_id: str, thread_id: Optional[str], tag: str, payload: str, idx: int, timestamp: Optional[str] = None
    ) -> None:
        """Append a working memory entry."""
        entry = WorkingMemoryEntry(
            user_id=user_id,
            thread_id=thread_id,
            tag=tag,
            payload=payload,
            timestamp=timestamp,
            idx=idx,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(entry)
        self.session.commit()

    def fetch_entries(self, user_id: str, thread_id: Optional[str] = None) -> List[WorkingMemoryEntry]:
        """Fetch all working memory entries ordered by idx."""
        conditions = [WorkingMemoryEntry.user_id == user_id]
        if thread_id is not None:
            conditions.append(WorkingMemoryEntry.thread_id == thread_id)
        stmt = select(WorkingMemoryEntry).where(and_(*conditions)).order_by(WorkingMemoryEntry.idx.asc())
        return list(self.session.execute(stmt).scalars().all())

    def clear(self, user_id: str, thread_id: Optional[str] = None) -> None:
        """Clear all working memory entries."""
        conditions = [WorkingMemoryEntry.user_id == user_id]
        if thread_id is not None:
            conditions.append(WorkingMemoryEntry.thread_id == thread_id)
        self.session.query(WorkingMemoryEntry).where(and_(*conditions)).delete()
        self.session.commit()

    def clear_entries_only(self, user_id: str, thread_id: Optional[str] = None) -> None:
        """Clear only log entries (keep summary metadata)."""
        conditions = [WorkingMemoryEntry.user_id == user_id]
        if thread_id is not None:
            conditions.append(WorkingMemoryEntry.thread_id == thread_id)
        conditions.append(WorkingMemoryEntry.tag.notin_(["summary_info", "conversation_summary"]))
        self.session.query(WorkingMemoryEntry).where(and_(*conditions)).delete()
        self.session.commit()


class AgentRosterRepository:
    """Repository for agent roster operations."""

    def __init__(self, session: Session):
        self.session = session

    def add_agent(self, user_id: str, agent_name: str) -> bool:
        """Add an agent to the roster if not already present."""
        # Check if already exists
        stmt = select(AgentRosterEntry).where(
            and_(AgentRosterEntry.user_id == user_id, AgentRosterEntry.agent_name == agent_name)
        )
        existing = self.session.execute(stmt).scalar_one_or_none()
        if existing:
            return False

        now = datetime.now(timezone.utc)
        entry = AgentRosterEntry(user_id=user_id, agent_name=agent_name, created_at=now, updated_at=now)
        self.session.add(entry)
        self.session.commit()
        return True

    def get_agents(self, user_id: str) -> List[str]:
        """Get list of all agent names for a user."""
        stmt = (
            select(AgentRosterEntry.agent_name)
            .where(AgentRosterEntry.user_id == user_id)
            .order_by(AgentRosterEntry.agent_name)
        )
        return list(self.session.execute(stmt).scalars().all())

    def clear(self, user_id: str) -> None:
        """Clear the agent roster for a user."""
        self.session.query(AgentRosterEntry).where(AgentRosterEntry.user_id == user_id).delete()
        self.session.commit()
