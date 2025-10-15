from __future__ import annotations

import hashlib
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import Settings, get_settings
from models import GmailConnectPayload, GmailDisconnectPayload
from persistence import ConnectionRepository, get_db_session
from services import disconnect_account, initiate_connect
from services.gmail.client import set_active_for_user
from logging_config import logger

router = APIRouter(prefix="/gmail", tags=["gmail"])


def _gravatar_url(email: str | None, size: int = 64) -> str | None:
    """Generate Gravatar URL from email."""
    if not email:
        return None
    email_hash = hashlib.md5(email.strip().lower().encode("utf-8")).hexdigest()
    return f"https://www.gravatar.com/avatar/{email_hash}?s={size}&d=identicon"


def _require_user(request: Request) -> str:
    user_id = request.headers.get("X-User-Id", "").strip()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-User-Id header")
    return user_id


@router.post("/connect")
async def gmail_connect(
    request: Request,
    payload: GmailConnectPayload,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db_session),
) -> JSONResponse:
    """Initiate Gmail OAuth connection flow through Composio."""
    header_user = _require_user(request)

    # Strict: header user must match body user if provided
    if payload.user_id and payload.user_id.strip() != header_user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User mismatch")

    # Ensure payload carries the header user id
    payload.user_id = header_user

    response = initiate_connect(payload, settings)

    # Log connection initiation for debugging (but don't store pending in database)
    if response.status_code == 200:
        try:
            import json

            body_bytes = response.body if isinstance(response.body, bytes) else b"{}"
            data_str = body_bytes.decode("utf-8")
            response_data = json.loads(data_str) if data_str else {}

            conn_req_id = response_data.get("connection_request_id")
            composio_user_id = response_data.get("composio_user_id")

            if not response_data.get("ok"):
                logger.error("Composio initiate_connect returned ok=False", extra={"response": response_data})
            elif not conn_req_id:
                logger.error(
                    "Composio initiate_connect missing connection_request_id", extra={"response": response_data}
                )
            elif not composio_user_id:
                logger.error("Composio initiate_connect missing composio_user_id", extra={"response": response_data})
            elif not isinstance(conn_req_id, str):
                logger.error(
                    f"Invalid connection_request_id type: {type(conn_req_id)}", extra={"response": response_data}
                )
            else:
                # Log connection initiation (no database storage for pending connections)
                logger.info(
                    f"Initiated Gmail connection: id={conn_req_id}, composio_user_id={composio_user_id}, user_id={header_user}"
                )
        except Exception as exc:
            logger.error("Failed to parse connection response", extra={"error": str(exc)}, exc_info=True)

    return response


class GmailCallbackPayload(BaseModel):
    """Payload for Gmail OAuth callback."""

    connection_request_id: str
    success: bool


@router.get("/callback")
async def gmail_callback_get(
    connectedAccountId: str = Query(...),
    status_q: str = Query(..., alias="status"),
    db: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    """OAuth callback from Composio - process and redirect to Next.js UI page."""
    success = status_q.lower() == "success"
    frontend_callback = f"{settings.frontend_url.rstrip('/')}/gmail/callback"

    if not success:
        logger.info(f"Gmail OAuth failed for connection_request_id: {connectedAccountId}")
        return RedirectResponse(f"{frontend_callback}?gmail_status=failed")

    try:
        # Get connection details from Composio API
        from services.gmail.client import _get_composio_client, execute_gmail_tool, _extract_email

        client = _get_composio_client(settings)

        try:
            connection = client.connected_accounts.get(connectedAccountId)
        except Exception as exc:
            logger.error(f"Failed to get connection from Composio API: {exc}")
            return RedirectResponse(f"{frontend_callback}?gmail_status=error")

        # Extract composio_user_id and derive app user_id
        composio_user_id = None
        if hasattr(connection, "user_id"):
            composio_user_id = getattr(connection, "user_id", None)
        elif isinstance(connection, dict):
            composio_user_id = connection.get("user_id")

        if not composio_user_id or ":" not in composio_user_id:
            logger.error(f"Connection {connectedAccountId} missing/invalid composio_user_id: {composio_user_id}")
            return RedirectResponse(f"{frontend_callback}?gmail_status=error")

        # Derive app user_id from composio_user_id format: "user_id:uuid8"
        app_user_id = composio_user_id.split(":", 1)[0].strip()

        # Fetch Gmail profile to get email address
        email = None
        try:
            result = execute_gmail_tool("GMAIL_GET_PROFILE", composio_user_id, arguments={"user_id": "me"})
            email = _extract_email(result)
            if email:
                logger.info(f"Extracted email: {email}")
        except Exception as exc:
            logger.warning(f"Failed to fetch Gmail profile: {exc}")

        # Check if this is the first connected account for this user to set as default
        repo = ConnectionRepository(db)
        existing_connections = repo.fetch_by_user(app_user_id, "gmail")
        connected_count = sum(1 for c in existing_connections if c.status == "connected")
        is_default = connected_count == 0

        # Create new connected record in database
        connection_record = repo.insert(
            id=connectedAccountId,
            user_id=app_user_id,
            provider_id="gmail",
            auth_config_id=settings.composio_gmail_auth_config_id or "",
            connection_request_id=connectedAccountId,
            composio_user_id=composio_user_id,
            email=email,
            status="connected",
            is_default=is_default,
        )

        # Set as active connection if it's the default
        if is_default:
            set_active_for_user(app_user_id, composio_user_id)

        logger.info(f"Created connected Gmail account: {connection_record.id} for user {app_user_id}")
        return RedirectResponse(f"{frontend_callback}?gmail_status=success")

    except Exception as exc:
        logger.error(f"Gmail callback error: {exc}", exc_info=True)
        return RedirectResponse(f"{frontend_callback}?gmail_status=error")


@router.post("/disconnect")
async def gmail_disconnect(
    request: Request,
    payload: GmailDisconnectPayload,
    db: Session = Depends(get_db_session),
) -> JSONResponse:
    """Disconnect Gmail account and clear cached profile data."""
    header_user = _require_user(request)
    payload.user_id = header_user

    # Verify ownership before deletion
    if payload.connection_id or payload.connection_request_id:
        try:
            repo = ConnectionRepository(db)
            conn_id = payload.connection_id or payload.connection_request_id
            if conn_id:
                row = repo.fetch_by_id(conn_id)
                if row and row.user_id != header_user:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Failed to verify ownership", extra={"error": str(exc)})

    # Delete from Composio
    composio_response = disconnect_account(payload)

    # Delete from database
    if payload.connection_id or payload.connection_request_id:
        try:
            repo = ConnectionRepository(db)
            conn_id = payload.connection_id or payload.connection_request_id
            if conn_id:
                repo.delete(conn_id)
        except Exception as exc:
            logger.warning("Failed to delete connection from DB", extra={"error": str(exc)})

    return composio_response


class GmailActivatePayload(BaseModel):
    connection_id: str


@router.post("/activate")
async def gmail_activate(
    request: Request,
    payload: GmailActivatePayload,
    db: Session = Depends(get_db_session),
) -> JSONResponse:
    """Activate a specific Gmail connection for the current user (set default + active)."""
    header_user = _require_user(request)
    repo = ConnectionRepository(db)

    row = repo.fetch_by_id(payload.connection_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found")
    if row.user_id != header_user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # Verify connection is properly set up
    if row.status != "connected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Connection not connected (status: {row.status})"
        )

    composio_user_id = getattr(row, "composio_user_id", None)
    if not composio_user_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Connection is corrupted (missing composio_user_id). Please reconnect.",
        )

    # Set as default connection
    repo.set_default(header_user, row.id)

    # Set in-memory active connection for this user
    try:
        from services.gmail import set_active_for_user

        set_active_for_user(header_user, composio_user_id)
    except Exception as exc:
        logger.warning("Failed to set active connection", extra={"error": str(exc)})

    return JSONResponse({"ok": True, "activated": row.id})
