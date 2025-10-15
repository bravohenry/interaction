"""SQLAlchemy models matching Drizzle schema (MySQL without FKs)."""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Index,
    Integer,
    PrimaryKeyConstraint,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all models."""

    pass


class User(Base):
    """Minimal user table stub to satisfy foreign keys (managed by Drizzle)."""

    __tablename__ = "user"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    timezone: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class ChatThread(Base):
    """Chat threads table - single thread per user."""

    __tablename__ = "chat_threads"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(255))
    title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column()
    updated_at: Mapped[datetime] = mapped_column()

    __table_args__ = (
        UniqueConstraint("user_id", name="chat_threads_user_unique"),
        Index("chat_threads_user_idx", "user_id"),
        {"extend_existing": True},
    )


class Message(Base):
    """Messages for conversation history."""

    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(255))
    thread_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(50))
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    client_message_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reply_to: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="final")
    run_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    step_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column()
    updated_at: Mapped[datetime] = mapped_column()

    __table_args__ = (
        Index("messages_user_idx", "user_id", "created_at"),
        Index("messages_user_updated_idx", "user_id", "updated_at"),
        Index("messages_thread_idx", "thread_id", "created_at"),
        {"extend_existing": True},
    )


class AgentRun(Base):
    """Agent runs - main orchestration entity."""

    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    thread_id: Mapped[str] = mapped_column(String(255))
    user_id: Mapped[str] = mapped_column(String(255))
    agent_type: Mapped[str] = mapped_column(String(50))
    state: Mapped[str] = mapped_column(String(50))
    graph_version: Mapped[str] = mapped_column(String(50), default="v1")
    current_node: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)
    config: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    canceled_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column()
    updated_at: Mapped[datetime] = mapped_column()

    __table_args__ = (
        Index("runs_state_idx", "state"),
        Index("runs_user_idx", "user_id"),
        Index("runs_thread_idx", "thread_id"),
        Index("runs_created_idx", "created_at"),
        {"extend_existing": True},
    )


class RunStep(Base):
    """Steps within a run."""

    __tablename__ = "run_steps"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    run_id: Mapped[str] = mapped_column(String(255))
    idx: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String(50))
    state: Mapped[str] = mapped_column(String(50))
    payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column()
    updated_at: Mapped[datetime] = mapped_column()

    __table_args__ = (Index("steps_run_idx", "run_id", "idx"), {"extend_existing": True})


class Trigger(Base):
    """Triggers for scheduled agent execution."""

    __tablename__ = "triggers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agent_name: Mapped[str] = mapped_column(String(255))
    payload: Mapped[str] = mapped_column(Text)
    start_time: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    next_trigger: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    recurrence_rule: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    timezone: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active")
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column()
    updated_at: Mapped[datetime] = mapped_column()

    __table_args__ = (Index("idx_triggers_agent_next", "agent_name", "next_trigger"), {"extend_existing": True})


class ComposioConnection(Base):
    """Composio connections for external service integrations."""

    __tablename__ = "composio_connections"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(255))
    provider_id: Mapped[str] = mapped_column(String(100))
    auth_config_id: Mapped[str] = mapped_column(String(255))
    connection_request_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # new fields for multi-account + ownership
    composio_user_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    created_at: Mapped[datetime] = mapped_column()
    updated_at: Mapped[datetime] = mapped_column()

    __table_args__ = (
        UniqueConstraint("composio_user_id", name="composio_connections_composio_user_unique"),
        UniqueConstraint("user_id", "provider_id", "email", name="composio_connections_user_provider_email_unique"),
        Index("composio_connections_user_idx", "user_id"),
        Index("composio_connections_provider_idx", "provider_id"),
        {"extend_existing": True},
    )


class ProcessedEmail(Base):
    """Track processed Gmail messages to avoid duplicates."""

    __tablename__ = "processed_emails"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(255))
    message_id: Mapped[str] = mapped_column(String(255))
    processed_at: Mapped[datetime] = mapped_column()

    __table_args__ = (
        UniqueConstraint("user_id", "message_id", name="processed_emails_user_message_unique"),
        Index("processed_emails_user_idx", "user_id"),
        {"extend_existing": True},
    )


class ConversationSummary(Base):
    """Store conversation summaries for context compression."""

    __tablename__ = "conversation_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(255))
    thread_id: Mapped[str] = mapped_column(String(255))
    summary: Mapped[str] = mapped_column(Text)
    message_count: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column()

    __table_args__ = (
        Index("conversation_summaries_user_thread_idx", "user_id", "thread_id"),
        {"extend_existing": True},
    )


class ExecutionAgentLog(Base):
    """Execution agent logs - store all execution agent activity."""

    __tablename__ = "execution_agent_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(255))
    agent_name: Mapped[str] = mapped_column(String(255))
    tag: Mapped[str] = mapped_column(String(100))
    payload: Mapped[str] = mapped_column(Text)
    timestamp: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column()

    __table_args__ = (
        Index("execution_logs_user_agent_idx", "user_id", "agent_name", "created_at"),
        Index("execution_logs_created_idx", "created_at"),
        {"extend_existing": True},
    )


class ConversationLogEntry(Base):
    """Conversation log entries - store interaction agent conversation history."""

    __tablename__ = "conversation_log_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(255))
    thread_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    tag: Mapped[str] = mapped_column(String(100))
    payload: Mapped[str] = mapped_column(Text)
    timestamp: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column()

    __table_args__ = (
        Index("conversation_log_user_thread_idx", "user_id", "thread_id", "created_at"),
        Index("conversation_log_created_idx", "created_at"),
        {"extend_existing": True},
    )


class WorkingMemoryEntry(Base):
    """Working memory entries - store working memory log entries for summarization."""

    __tablename__ = "working_memory_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(255))
    thread_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    tag: Mapped[str] = mapped_column(String(100))
    payload: Mapped[str] = mapped_column(Text)
    timestamp: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    idx: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column()

    __table_args__ = (
        Index("working_memory_user_thread_idx", "user_id", "thread_id", "idx"),
        {"extend_existing": True},
    )


class AgentRosterEntry(Base):
    """Agent roster - track active execution agents per user."""

    __tablename__ = "agent_roster"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(255))
    agent_name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column()
    updated_at: Mapped[datetime] = mapped_column()

    __table_args__ = (
        UniqueConstraint("user_id", "agent_name", name="agent_roster_user_agent_unique"),
        Index("agent_roster_user_idx", "user_id"),
        {"extend_existing": True},
    )


class MessageReaction(Base):
    """Message reactions - both user and assistant can react."""

    __tablename__ = "message_reactions"

    message_id: Mapped[str] = mapped_column(String(255))
    user_id: Mapped[str] = mapped_column(String(255))  # tenant partition
    reactor_role: Mapped[str] = mapped_column(String(20))  # 'user' | 'assistant' - who reacted
    type: Mapped[str] = mapped_column(String(20))  # reaction type (heart, like, etc)
    created_at: Mapped[datetime] = mapped_column()
    updated_at: Mapped[datetime] = mapped_column()

    __table_args__ = (
        PrimaryKeyConstraint("message_id", "reactor_role", name="pk_message_reactions"),
        Index("message_reactions_message_idx", "message_id"),
        Index("message_reactions_user_message_idx", "user_id", "message_id"),
        {"extend_existing": True},
    )
