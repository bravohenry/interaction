from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models import ChatHistoryClearResponse
from persistence import AgentRun, Message, get_db_session
from services import get_conversation_log, get_trigger_service
from agents.interaction_agent.runtime import InteractionAgentRuntime
from logging_config import logger

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatSendRequest(BaseModel):
    """Request payload for /chat/send endpoint."""

    user_id: str
    thread_id: str
    message: str
    run_id: str
    message_id: str


@router.post("/send", summary="Submit a chat message and receive a completion")
async def chat_send(
    payload: ChatSendRequest,
    db: Session = Depends(get_db_session),
) -> PlainTextResponse:
    """Handle incoming chat messages and route them to the interaction agent."""
    logger.info(
        f"Received chat request: user_id={payload.user_id}, thread_id={payload.thread_id}, message_len={len(payload.message)}"
    )

    if not payload.message.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message is empty")

    # Set active Gmail connection for this user (uses default if none explicitly set)
    try:
        from services.gmail import set_active_for_user
        from persistence import ConnectionRepository

        repo = ConnectionRepository(db)
        connections = repo.fetch_by_user(payload.user_id, "gmail")
        default_conn = next((c for c in connections if c.is_default and c.status == "connected"), None)
        if default_conn:
            set_active_for_user(payload.user_id, getattr(default_conn, "composio_user_id", None))
    except Exception as exc:
        logger.warning("Failed to set active Gmail connection", extra={"error": str(exc)})

    # Store agent run and user message in database
    from sqlalchemy.exc import SQLAlchemyError

    try:
        now = datetime.now(timezone.utc)

        # Create agent run
        agent_run = AgentRun(
            id=payload.run_id,
            thread_id=payload.thread_id,
            user_id=payload.user_id,
            agent_type="interaction",
            state="queued",
            created_at=now,
            updated_at=now,
        )
        db.add(agent_run)

        # Create user message
        message = Message(
            id=payload.message_id,
            user_id=payload.user_id,
            thread_id=payload.thread_id,
            role="user",
            content=payload.message,
            run_id=payload.run_id,
            status="final",
            created_at=now,
            updated_at=now,
        )
        db.add(message)

        # Commit both together
        db.commit()

        logger.info(f"Stored message {payload.message_id} and run {payload.run_id}")
    except SQLAlchemyError as exc:
        logger.error(f"Database error: {exc}")
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(exc)}")

    # Process message asynchronously
    import asyncio

    async def _run_interaction() -> None:
        try:
            runtime = InteractionAgentRuntime(user_id=payload.user_id, thread_id=payload.thread_id)
            await runtime.execute(user_message=payload.message)
        except Exception as exc:
            logger.error("chat task failed", extra={"error": str(exc)})

    asyncio.create_task(_run_interaction())

    return PlainTextResponse("", status_code=status.HTTP_202_ACCEPTED)


class ChatHistoryClearRequest(BaseModel):
    """Request payload for /chat/history endpoint."""

    user_id: str


def clear_user_history(user_id: str) -> None:
    """Shared cleanup logic for clearing all user data (conversation, agents, triggers, working memory)."""
    from services import get_execution_agent_logs, get_agent_roster
    from services.conversation.log import set_conversation_log_user
    from services.conversation.summarization.working_memory_log import (
        get_working_memory_log,
        set_working_memory_user,
    )

    # Set user context for working memory FIRST (conversation log depends on it)
    set_working_memory_user(user_id, None)
    set_conversation_log_user(user_id, None)

    # Clear conversation log
    log = get_conversation_log()
    log.clear()

    # Clear execution agent logs
    execution_logs = get_execution_agent_logs()
    execution_logs.clear_all()

    # Clear agent roster
    roster = get_agent_roster(user_id=user_id)
    roster.clear()

    # Clear stored triggers
    trigger_service = get_trigger_service()
    trigger_service.clear_all()

    # Clear working memory
    working_memory = get_working_memory_log()
    working_memory.clear()


@router.delete("/history", response_model=ChatHistoryClearResponse)
def clear_history(payload: ChatHistoryClearRequest) -> ChatHistoryClearResponse:
    clear_user_history(payload.user_id)
    return ChatHistoryClearResponse()


__all__ = ["router"]
