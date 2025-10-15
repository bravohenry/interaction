from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from persistence import get_db_session
from persistence.models import MessageReaction
from logging_config import logger

router = APIRouter(prefix="/messages", tags=["messages"])


class AddReactionRequest(BaseModel):
    """Request payload for adding a reaction to a message."""

    emoji: str
    user_id: str


class ReactionResponse(BaseModel):
    """Response model for a single reaction."""

    id: str
    message_id: str
    user_id: str
    emoji: str
    created_at: datetime


class ReactionsListResponse(BaseModel):
    """Response model for list of reactions."""

    reactions: list[ReactionResponse]


@router.post(
    "/{message_id}/reactions",
    response_model=ReactionResponse,
    summary="Add a reaction to a message",
)
def add_reaction(
    message_id: str,
    payload: AddReactionRequest,
    db: Session = Depends(get_db_session),
) -> ReactionResponse:
    """Add a reaction to a message (for execution agents)."""
    logger.info(f"Adding reaction: message_id={message_id}, user_id={payload.user_id}, emoji={payload.emoji}")

    try:
        # Check if reaction already exists
        existing = (
            db.query(MessageReaction)
            .filter_by(
                message_id=message_id,
                user_id=payload.user_id,
                emoji=payload.emoji,
            )
            .first()
        )

        if existing:
            # Return existing reaction
            return ReactionResponse(
                id=existing.id,
                message_id=existing.message_id,
                user_id=existing.user_id,
                emoji=existing.emoji,
                created_at=existing.created_at,
            )

        # Create new reaction
        now = datetime.now(timezone.utc)
        reaction = MessageReaction(
            id=str(uuid4()),
            message_id=message_id,
            user_id=payload.user_id,
            emoji=payload.emoji,
            created_at=now,
        )

        db.add(reaction)
        db.commit()
        db.refresh(reaction)

        logger.info(f"Created reaction {reaction.id}")

        return ReactionResponse(
            id=reaction.id,
            message_id=reaction.message_id,
            user_id=reaction.user_id,
            emoji=reaction.emoji,
            created_at=reaction.created_at,
        )

    except IntegrityError as exc:
        db.rollback()
        logger.error(f"Integrity error adding reaction: {exc}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Reaction already exists",
        )
    except Exception as exc:
        db.rollback()
        logger.error(f"Error adding reaction: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.get(
    "/{message_id}/reactions",
    response_model=ReactionsListResponse,
    summary="Get all reactions for a message",
)
def get_reactions(
    message_id: str,
    db: Session = Depends(get_db_session),
) -> ReactionsListResponse:
    """Get all reactions for a specific message."""
    reactions = db.query(MessageReaction).filter_by(message_id=message_id).order_by(MessageReaction.created_at).all()

    return ReactionsListResponse(
        reactions=[
            ReactionResponse(
                id=r.id,
                message_id=r.message_id,
                user_id=r.user_id,
                emoji=r.emoji,
                created_at=r.created_at,
            )
            for r in reactions
        ]
    )


@router.delete(
    "/{message_id}/reactions/{emoji}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a reaction from a message",
)
def remove_reaction(
    message_id: str,
    emoji: str,
    user_id: str,
    db: Session = Depends(get_db_session),
) -> None:
    """Remove a reaction from a message."""
    logger.info(f"Removing reaction: message_id={message_id}, user_id={user_id}, emoji={emoji}")

    reaction = db.query(MessageReaction).filter_by(message_id=message_id, user_id=user_id, emoji=emoji).first()

    if not reaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reaction not found",
        )

    db.delete(reaction)
    db.commit()

    logger.info(f"Deleted reaction {reaction.id}")


__all__ = ["router"]
