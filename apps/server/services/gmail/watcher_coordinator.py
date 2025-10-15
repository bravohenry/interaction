"""Multi-tenant email watcher coordinator for proactive Gmail monitoring."""

from __future__ import annotations

import asyncio
from contextlib import suppress
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Tuple, Set, TYPE_CHECKING

from .client import execute_gmail_tool, set_current_app_user
from .processing import EmailTextCleaner, ProcessedEmail, parse_gmail_fetch_response
from .importance_classifier import classify_email_importance
from logging_config import logger
from utils.timezones import convert_to_user_timezone

if TYPE_CHECKING:
    from agents.interaction_agent.runtime import InteractionAgentRuntime


def _resolve_interaction_runtime() -> "InteractionAgentRuntime":
    from agents.interaction_agent.runtime import InteractionAgentRuntime

    return InteractionAgentRuntime()


DEFAULT_POLL_INTERVAL_SECONDS = 60.0
DEFAULT_LOOKBACK_MINUTES = 10
DEFAULT_MAX_RESULTS = 50
DEFAULT_CONCURRENCY_LIMIT = 10


def _list_active_gmail_users() -> List[Tuple[str, Optional[str], str]]:
    """
    Query database for all users with connected Gmail accounts.
    Returns list of (user_id, timezone, composio_user_id).
    """
    from persistence import get_db_session

    db = next(get_db_session())
    try:
        from persistence.models import User, ComposioConnection
        from sqlalchemy import select, and_

        stmt = (
            select(
                User.id.label("user_id"),
                User.timezone.label("timezone"),
                ComposioConnection.composio_user_id.label("composio_user_id"),
            )
            .select_from(User)
            .join(
                ComposioConnection,
                and_(
                    ComposioConnection.user_id == User.id,
                    ComposioConnection.provider_id == "gmail",
                    ComposioConnection.status == "connected",
                    ComposioConnection.is_default.is_(True),
                ),
            )
            .where(ComposioConnection.composio_user_id.isnot(None))
        )

        rows = db.execute(stmt).mappings().all()
        return [(r["user_id"], r["timezone"], r["composio_user_id"]) for r in rows]
    finally:
        db.close()


class EmailWatchCoordinator:
    """Poll Gmail for all active users and surface important emails."""

    def __init__(
        self,
        poll_interval_seconds: float = DEFAULT_POLL_INTERVAL_SECONDS,
        lookback_minutes: int = DEFAULT_LOOKBACK_MINUTES,
        concurrency_limit: int = DEFAULT_CONCURRENCY_LIMIT,
    ) -> None:
        self._poll_interval = poll_interval_seconds
        self._lookback_minutes = lookback_minutes
        self._concurrency_limit = concurrency_limit
        self._lock = asyncio.Lock()
        self._task: Optional[asyncio.Task[None]] = None
        self._running = False

        self._last_poll_by_user: Dict[str, datetime] = {}
        self._seeded_users: Set[str] = set()
        self._cleaner = EmailTextCleaner(max_url_length=60)

    async def start(self) -> None:
        """Start the background email polling coordinator."""
        async with self._lock:
            if self._task and not self._task.done():
                return
            loop = asyncio.get_running_loop()
            self._running = True
            self._task = loop.create_task(self._run(), name="email-watch-coordinator")
            logger.info(
                "Email watch coordinator started",
                extra={
                    "interval_seconds": self._poll_interval,
                    "lookback_minutes": self._lookback_minutes,
                },
            )

    async def stop(self) -> None:
        """Stop the background email polling coordinator gracefully."""
        async with self._lock:
            self._running = False
            if self._task:
                self._task.cancel()
                with suppress(asyncio.CancelledError):
                    await self._task
                self._task = None
                logger.info("Email watch coordinator stopped")

    async def _run(self) -> None:
        """Main coordinator loop."""
        try:
            while self._running:
                try:
                    await self._poll_all_users()
                except Exception:
                    logger.exception("Email watch coordinator tick failed")
                await asyncio.sleep(self._poll_interval)
        except asyncio.CancelledError:
            raise

    async def _poll_all_users(self) -> None:
        """Poll Gmail for all active users with bounded concurrency."""
        users = _list_active_gmail_users()
        if not users:
            logger.info("Email watch: no active Gmail users to poll")
            return

        logger.info(
            "Email watch coordinator scan started",
            extra={"active_users": len(users), "concurrency_limit": self._concurrency_limit},
        )

        now_utc = datetime.now(timezone.utc)
        sem = asyncio.Semaphore(self._concurrency_limit)

        async def _poll_one(user_tuple: Tuple[str, Optional[str], str]) -> None:
            async with sem:
                try:
                    await self._poll_user(user_tuple, now_utc)
                except Exception:
                    logger.exception("Email watch: user poll failed", extra={"user_id": user_tuple[0]})
                    raise

        results = await asyncio.gather(*[_poll_one(u) for u in users], return_exceptions=True)
        for r in results:
            if isinstance(r, Exception):
                logger.error("Email watch: a user poll task failed", exc_info=r)

        logger.info(
            "Email watch coordinator scan completed",
            extra={"active_users": len(users)},
        )

    async def _poll_user(
        self,
        user_tuple: Tuple[str, Optional[str], str],
        now_utc: datetime,
    ) -> None:
        """Poll Gmail for a single user."""
        user_id, user_tz, composio_user_id = user_tuple

        if not composio_user_id:
            logger.debug("Skipping user with no composio_user_id", extra={"user_id": user_id})
            return

        logger.debug(
            "Polling Gmail for user",
            extra={"user_id": user_id, "timezone": user_tz or "UTC"},
        )

        user_now = convert_to_user_timezone(now_utc, user_tz) if user_tz else now_utc.astimezone()

        from persistence import get_db_session, ProcessedEmailRepository

        db = next(get_db_session())
        try:
            repo = ProcessedEmailRepository(db)

            last_poll = self._last_poll_by_user.get(user_id)
            first_poll = user_id not in self._seeded_users

            interval_cutoff = user_now - timedelta(seconds=self._poll_interval)
            cutoff_time = max(last_poll or interval_cutoff, interval_cutoff)

            set_current_app_user(user_id)

            query = f"label:INBOX newer_than:{self._lookback_minutes}m"
            arguments = {
                "query": query,
                "include_payload": True,
                "max_results": DEFAULT_MAX_RESULTS,
            }

            try:
                raw_result = execute_gmail_tool("GMAIL_FETCH_EMAILS", composio_user_id, arguments=arguments)
            except Exception as exc:
                logger.warning(
                    "Failed to fetch Gmail for user",
                    extra={"user_id": user_id, "error": str(exc)},
                )
                return

            processed_emails, _ = parse_gmail_fetch_response(
                raw_result,
                query=query,
                cleaner=self._cleaner,
            )

            if not processed_emails:
                self._mark_poll_complete(user_id, user_now)
                return

            if first_poll:
                for email in processed_emails:
                    repo.mark_processed(user_id, email.id)
                self._seeded_users.add(user_id)
                logger.info(
                    "Email watcher warmup complete",
                    extra={"user_id": user_id, "skipped_ids": len(processed_emails)},
                )
                self._mark_poll_complete(user_id, user_now)
                return

            unseen_emails: List[ProcessedEmail] = [
                email for email in processed_emails if not repo.is_processed(user_id, email.id)
            ]

            if not unseen_emails:
                self._mark_poll_complete(user_id, user_now)
                return

            unseen_emails.sort(key=lambda email: email.timestamp or now_utc)

            eligible_emails: List[ProcessedEmail] = []
            aged_emails: List[ProcessedEmail] = []

            for email in unseen_emails:
                email_timestamp = email.timestamp
                if email_timestamp.tzinfo is not None:
                    email_timestamp = email_timestamp.astimezone(user_now.tzinfo)
                else:
                    email_timestamp = email_timestamp.replace(tzinfo=user_now.tzinfo)

                if email_timestamp < cutoff_time:
                    aged_emails.append(email)
                else:
                    eligible_emails.append(email)

            summaries_sent = 0

            for email in aged_emails:
                repo.mark_processed(user_id, email.id)

            for email in eligible_emails:
                summary = await classify_email_importance(email)
                importance = "important" if summary else "not important"
                logger.info(
                    f"Scanned email - Subject: {email.subject} | From: {email.sender} | Rating: {importance}",
                    extra={"user_id": user_id},
                )
                repo.mark_processed(user_id, email.id)
                if summary:
                    await self._dispatch_summary(user_id, summary)
                    summaries_sent += 1

            logger.info(
                "Email watcher check complete",
                extra={
                    "user_id": user_id,
                    "emails_reviewed": len(unseen_emails),
                    "surfaced": summaries_sent,
                    "suppressed_for_age": len(aged_emails),
                },
            )
            self._mark_poll_complete(user_id, user_now)
        finally:
            db.close()

    def _mark_poll_complete(self, user_id: str, user_now: datetime) -> None:
        """Mark poll as complete for a user."""
        self._last_poll_by_user[user_id] = user_now

    async def _dispatch_summary(self, user_id: str, summary: str) -> None:
        """Dispatch important email summary to InteractionAgent for a specific user."""
        from agents.interaction_agent.runtime import InteractionAgentRuntime

        logger.info(
            "Dispatching important email alert to user",
            extra={"user_id": user_id, "summary_preview": summary[:100]},
        )

        try:
            contextualized = f"Important email watcher notification:\n{summary}"
            runtime = InteractionAgentRuntime(user_id=user_id)
            await runtime.handle_agent_message(contextualized)
            logger.info(
                "Important email alert dispatched successfully",
                extra={"user_id": user_id},
            )
        except Exception:
            logger.exception(
                "Failed to dispatch important email summary",
                extra={"user_id": user_id},
            )


_coordinator_instance: Optional[EmailWatchCoordinator] = None


def get_email_watch_coordinator() -> EmailWatchCoordinator:
    """Get or create the singleton email watch coordinator."""
    global _coordinator_instance
    if _coordinator_instance is None:
        _coordinator_instance = EmailWatchCoordinator()
    return _coordinator_instance


__all__ = ["EmailWatchCoordinator", "get_email_watch_coordinator"]
