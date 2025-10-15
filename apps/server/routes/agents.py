from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import Settings, get_settings
from models import CleanupAgentsResponse
from persistence import get_db_session
from persistence.models import AgentRosterEntry

router = APIRouter(prefix="/api/agents", tags=["agents"])
security = HTTPBearer()


def verify_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security), settings: Settings = Depends(get_settings)
) -> None:
    """Verify the authorization token matches BETTER_AUTH_SECRET."""
    if credentials.credentials != settings.better_auth_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization token")


@router.post("/cleanup", response_model=CleanupAgentsResponse)
def cleanup_agents(session: Session = Depends(get_db_session), _: None = Depends(verify_auth)) -> CleanupAgentsResponse:
    """Clean up execution agents and working memory for all users to prevent agent overload."""
    from routes.chat import clear_user_history

    # Get all unique user IDs from agent roster
    stmt = select(AgentRosterEntry.user_id).distinct()
    user_ids = [row[0] for row in session.execute(stmt).all()]

    users_processed = 0

    for user_id in user_ids:
        clear_user_history(user_id)
        users_processed += 1

    return CleanupAgentsResponse(
        success=True,
        message="Agent cleanup completed successfully",
        users_processed=users_processed,
        agents_cleared=users_processed,
        logs_cleared=users_processed,
        memory_cleared=users_processed,
    )
