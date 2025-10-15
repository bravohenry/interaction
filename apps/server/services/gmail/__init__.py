"""Gmail-related service helpers."""

from .client import (
    disconnect_account,
    execute_gmail_tool,
    get_active_gmail_user_id,
    initiate_connect,
    set_active_for_user,
    _extract_email,
)
from .importance_classifier import classify_email_importance
from .watcher_coordinator import EmailWatchCoordinator, get_email_watch_coordinator
from .processing import EmailTextCleaner, ProcessedEmail, parse_gmail_fetch_response
from .seen_store import GmailSeenStore

__all__ = [
    "execute_gmail_tool",
    "initiate_connect",
    "disconnect_account",
    "get_active_gmail_user_id",
    "set_active_for_user",
    "_extract_email",
    "classify_email_importance",
    "EmailWatchCoordinator",
    "get_email_watch_coordinator",
    "EmailTextCleaner",
    "ProcessedEmail",
    "parse_gmail_fetch_response",
    "GmailSeenStore",
]
