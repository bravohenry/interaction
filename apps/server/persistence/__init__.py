"""Persistence layer - database models and repositories."""

from .database import get_db_session, get_engine, init_db
from .models import (
    AgentRosterEntry,
    AgentRun,
    Base,
    ChatThread,
    ComposioConnection,
    ConversationLogEntry,
    ConversationSummary,
    ExecutionAgentLog,
    Message,
    ProcessedEmail,
    RunStep,
    Trigger,
    User,
    WorkingMemoryEntry,
)
from .repositories import (
    AgentRosterRepository,
    ConnectionRepository,
    ConversationLogRepository,
    ConversationSummaryRepository,
    ExecutionAgentLogRepository,
    MessageRepository,
    ProcessedEmailRepository,
    TriggerRepository,
    UserRepository,
    WorkingMemoryRepository,
)

__all__ = [
    # Database
    "get_db_session",
    "get_engine",
    "init_db",
    # Models
    "Base",
    "User",
    "ChatThread",
    "Message",
    "AgentRun",
    "RunStep",
    "Trigger",
    "ComposioConnection",
    "ProcessedEmail",
    "ConversationSummary",
    "ExecutionAgentLog",
    "ConversationLogEntry",
    "WorkingMemoryEntry",
    "AgentRosterEntry",
    # Repositories
    "MessageRepository",
    "TriggerRepository",
    "ConnectionRepository",
    "UserRepository",
    "ProcessedEmailRepository",
    "ConversationSummaryRepository",
    "ExecutionAgentLogRepository",
    "ConversationLogRepository",
    "WorkingMemoryRepository",
    "AgentRosterRepository",
]
