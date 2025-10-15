from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from contextvars import ContextVar

from fastapi import status
from fastapi.responses import JSONResponse

from config import Settings, get_settings
from logging_config import logger
from models import GmailConnectPayload, GmailDisconnectPayload
from utils import error_response


_CLIENT_LOCK = threading.Lock()
_CLIENT: Optional[Any] = None

_PROFILE_CACHE: Dict[str, Dict[str, Any]] = {}
_PROFILE_CACHE_LOCK = threading.Lock()
_ACTIVE_USER_ID_LOCK = threading.Lock()
_ACTIVE_BY_APP_USER: Dict[str, str] = {}
_CURRENT_APP_USER: ContextVar[Optional[str]] = ContextVar("CURRENT_APP_USER", default=None)


def _normalized(value: Optional[str]) -> str:
    return (value or "").strip()


def _set_active_gmail_user_id(app_user_id: Optional[str], composio_user_id: Optional[str] = None) -> None:
    app_user = _normalized(app_user_id)
    composio_user = _normalized(composio_user_id)
    if not app_user:
        return
    with _ACTIVE_USER_ID_LOCK:
        if composio_user:
            _ACTIVE_BY_APP_USER[app_user] = composio_user
        else:
            _ACTIVE_BY_APP_USER.pop(app_user, None)


def set_current_app_user(app_user_id: Optional[str]) -> None:
    """Set the current app user context for tool execution (per-task)."""
    sanitized = _normalized(app_user_id)
    _CURRENT_APP_USER.set(sanitized or None)


def set_active_for_user(app_user_id: str, composio_user_id: Optional[str] = None) -> None:
    """
    Set the active Gmail connection for a user.
    If composio_user_id is None, attempts to use the default connection.
    Ownership verification should be done by the caller (via repository).
    """
    _set_active_gmail_user_id(app_user_id, composio_user_id)


def get_active_gmail_user_id() -> Optional[str]:
    """Return active composio user id for the current app user context."""
    app_user = _CURRENT_APP_USER.get()
    if not app_user:
        return None
    with _ACTIVE_USER_ID_LOCK:
        active_id = _ACTIVE_BY_APP_USER.get(app_user)

    if not active_id:
        resolve_and_set_active(None)
        with _ACTIVE_USER_ID_LOCK:
            active_id = _ACTIVE_BY_APP_USER.get(app_user)

    return active_id


def resolve_and_set_active(target_email_or_id: Optional[str]) -> Optional[str]:
    """
    Resolve and set the active Gmail connection for the current app user.

    If target_email_or_id is provided, searches for that specific account by email or composio_user_id.
    Otherwise, falls back to the user's default connection.

    Returns the composio_user_id of the selected connection, or None if not found.
    """
    from persistence import get_db_session, ConnectionRepository

    app_user = _CURRENT_APP_USER.get()
    if not app_user:
        logger.warning("[resolve_and_set_active] No app user in context")
        return None

    db = next(get_db_session())
    try:
        repo = ConnectionRepository(db)

        connection = None
        if target_email_or_id:
            # Check if it's an email or composio_user_id
            if "@" in target_email_or_id:
                # Try email lookup
                connection = repo.fetch_by_email(app_user, target_email_or_id.strip().lower(), "gmail")
                logger.info(f"[resolve_and_set_active] Looked up by email: {connection is not None}")
            else:
                # Treat as composio_user_id
                all_conns = repo.fetch_by_user(app_user, "gmail")
                connection = next((c for c in all_conns if c.composio_user_id == target_email_or_id), None)
                logger.info(f"[resolve_and_set_active] Looked up by composio_user_id: {connection is not None}")

        if not connection:
            connection = repo.fetch_default(app_user, "gmail")
            logger.info(f"[resolve_and_set_active] Using default connection: {connection is not None}")

        if connection and connection.composio_user_id:
            set_active_for_user(app_user, connection.composio_user_id)
            logger.info(f"[resolve_and_set_active] Set active: {connection.composio_user_id}")
            return connection.composio_user_id

        logger.warning(f"[resolve_and_set_active] No connection found for {target_email_or_id}")
        return None
    finally:
        db.close()


def _gmail_import_client() -> type:
    from composio import Composio

    return Composio


# Get or create a singleton Composio client instance with thread-safe initialization
def _get_composio_client(settings: Optional[Settings] = None) -> Any:
    global _CLIENT
    if _CLIENT is not None:
        return _CLIENT

    with _CLIENT_LOCK:
        if _CLIENT is None:
            resolved_settings = settings or get_settings()
            Composio = _gmail_import_client()
            api_key = resolved_settings.composio_api_key
            try:
                _CLIENT = Composio(api_key=api_key) if api_key else Composio()
            except TypeError as exc:
                if api_key:
                    raise RuntimeError(
                        "Installed Composio SDK does not accept the api_key argument; upgrade the SDK or remove COMPOSIO_API_KEY."
                    ) from exc
                _CLIENT = Composio()
    return _CLIENT


def _extract_email(obj: Any) -> Optional[str]:
    if obj is None:
        return None
    direct_keys = (
        "email",
        "email_address",
        "emailAddress",
        "user_email",
        "provider_email",
        "account_email",
    )
    for key in direct_keys:
        try:
            val = getattr(obj, key)
            if isinstance(val, str) and "@" in val:
                return val
        except Exception:
            pass
        if isinstance(obj, dict):
            val = obj.get(key)
            if isinstance(val, str) and "@" in val:
                return val
    if isinstance(obj, dict):
        email_addresses = obj.get("emailAddresses")
        if isinstance(email_addresses, (list, tuple)):
            for entry in email_addresses:
                if isinstance(entry, dict):
                    candidate = entry.get("value") or entry.get("email") or entry.get("emailAddress")
                    if isinstance(candidate, str) and "@" in candidate:
                        return candidate
                elif isinstance(entry, str) and "@" in entry:
                    return entry
    if isinstance(obj, dict):
        nested_paths = (
            ("data", "response_data", "emailAddress"),  # Composio GMAIL_GET_PROFILE format
            ("response_data", "emailAddress"),  # Composio variant
            ("response", "emailAddress"),  # Composio variant
            ("data", "emailAddress"),
            ("profile", "email"),
            ("profile", "emailAddress"),
            ("user", "email"),
            ("data", "email"),
            ("data", "user", "email"),
            ("provider_profile", "email"),
        )
        for path in nested_paths:
            current: Any = obj
            for segment in path:
                if isinstance(current, dict) and segment in current:
                    current = current[segment]
                else:
                    current = None
                    break
            if isinstance(current, str) and "@" in current:
                return current
    return None


def _cache_profile(user_id: str, profile: Dict[str, Any]) -> None:
    sanitized = _normalized(user_id)
    if not sanitized or not isinstance(profile, dict):
        return
    with _PROFILE_CACHE_LOCK:
        _PROFILE_CACHE[sanitized] = {
            "profile": profile,
            "cached_at": datetime.now(timezone.utc).isoformat(),
        }


def _get_cached_profile(user_id: Optional[str]) -> dict[str, Any] | None:
    sanitized = _normalized(user_id)
    if not sanitized:
        return None
    with _PROFILE_CACHE_LOCK:
        payload = _PROFILE_CACHE.get(sanitized)
        if payload and isinstance(payload.get("profile"), dict):
            profile: dict[str, Any] = payload["profile"]
            return profile
    return None


def _clear_cached_profile(user_id: Optional[str] = None) -> None:
    with _PROFILE_CACHE_LOCK:
        if user_id:
            _PROFILE_CACHE.pop(_normalized(user_id), None)
        else:
            _PROFILE_CACHE.clear()


def _fetch_profile_from_composio(user_id: Optional[str]) -> Optional[Dict[str, Any]]:
    sanitized = _normalized(user_id)
    if not sanitized:
        return None
    try:
        result = execute_gmail_tool("GMAIL_GET_PROFILE", sanitized, arguments={"user_id": "me"})
    except RuntimeError as exc:
        logger.warning("GMAIL_GET_PROFILE invocation failed: %s", exc)
        return None
    except Exception:  # pragma: no cover - defensive
        logger.exception("Unexpected error fetching Gmail profile", extra={"user_id": sanitized})
        return None

    profile: Optional[Dict[str, Any]] = None
    if isinstance(result, dict):
        if isinstance(result.get("data"), dict):
            profile = result["data"]
        elif isinstance(result.get("profile"), dict):
            profile = result["profile"]
        elif isinstance(result.get("response_data"), dict):
            profile = result["response_data"]
        elif isinstance(result.get("items"), list):
            for item in result["items"]:
                if not isinstance(item, dict):
                    continue
                data_dict = item.get("data")
                if isinstance(data_dict, dict):
                    if isinstance(data_dict.get("response_data"), dict):
                        profile = data_dict["response_data"]
                    elif isinstance(data_dict.get("profile"), dict):
                        profile = data_dict["profile"]
                    else:
                        profile = data_dict
                elif isinstance(item.get("response_data"), dict):
                    profile = item["response_data"]
                elif isinstance(item.get("profile"), dict):
                    profile = item["profile"]
                if isinstance(profile, dict):
                    break
        elif result.get("successful") is True and isinstance(result.get("result"), dict):
            profile = result.get("result")
        elif all(not isinstance(result.get(key), dict) for key in ("data", "profile", "result")):
            profile = result if result else None

    if isinstance(profile, dict):
        _cache_profile(sanitized, profile)
        return profile

    logger.warning("Received unexpected Gmail profile payload", extra={"user_id": sanitized, "raw": result})
    return None


# Start Gmail OAuth connection process and return redirect URL
def initiate_connect(payload: GmailConnectPayload, settings: Settings) -> JSONResponse:
    auth_config_id = payload.auth_config_id or settings.composio_gmail_auth_config_id or ""
    if not auth_config_id:
        return error_response(
            "Missing auth_config_id. Set COMPOSIO_GMAIL_AUTH_CONFIG_ID or pass auth_config_id.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    user_id = payload.user_id or f"web-{os.getpid()}"
    # create a unique composio user id bound to app user
    import uuid

    composio_user_id = f"{user_id}:{uuid.uuid4().hex[:8]}"
    _clear_cached_profile(user_id)

    # Build callback URL for OAuth redirect - use Python backend
    backend_url = settings.next_public_py_backend_url.rstrip("/")
    callback_url = f"{backend_url}/api/v1/gmail/callback"

    try:
        client = _get_composio_client(settings)
        req = client.connected_accounts.initiate(
            user_id=composio_user_id, auth_config_id=auth_config_id, callback_url=callback_url
        )
        data = {
            "ok": True,
            "redirect_url": getattr(req, "redirect_url", None) or getattr(req, "redirectUrl", None),
            "connection_request_id": getattr(req, "id", None),
            "user_id": user_id,
            "composio_user_id": composio_user_id,
        }
        return JSONResponse(data)
    except Exception as exc:
        logger.exception("gmail connect failed", extra={"user_id": user_id})
        return error_response(
            "Failed to initiate Gmail connect",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


def disconnect_account(payload: GmailDisconnectPayload) -> JSONResponse:
    connection_id = _normalized(payload.connection_id) or _normalized(payload.connection_request_id)
    user_id = _normalized(payload.user_id)

    if not connection_id and not user_id:
        return error_response(
            "Missing connection_id or user_id",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    try:
        client = _get_composio_client()
    except Exception as exc:
        logger.exception("gmail disconnect failed: client init", extra={"user_id": user_id})
        return error_response(
            "Failed to disconnect Gmail",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )

    removed_ids: list[str] = []
    errors: list[str] = []
    affected_user_ids: set[str] = set()

    def _delete_connection(identifier: str) -> None:
        sanitized_id = _normalized(identifier)
        if not sanitized_id:
            return
        try:
            connection = client.connected_accounts.get(sanitized_id)
        except Exception:
            connection = None
        try:
            client.connected_accounts.delete(sanitized_id)
            removed_ids.append(sanitized_id)
            if connection is not None:
                if hasattr(connection, "user_id"):
                    affected_user_ids.add(_normalized(getattr(connection, "user_id", None)))
                elif isinstance(connection, dict):
                    affected_user_ids.add(_normalized(connection.get("user_id")))
        except Exception as exc:  # pragma: no cover - depends on remote state
            logger.exception("Failed to remove Gmail connection", extra={"connection_id": sanitized_id})
            errors.append(str(exc))

    if connection_id:
        _delete_connection(connection_id)
    else:
        try:
            items = client.connected_accounts.list(user_ids=[user_id], toolkit_slugs=["GMAIL"])
            data = getattr(items, "data", None)
            if data is None and isinstance(items, dict):
                data = items.get("data")
        except Exception as exc:  # pragma: no cover - dependent on SDK
            logger.exception("Failed to list Gmail connections", extra={"user_id": user_id})
            return error_response(
                "Failed to disconnect Gmail",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            )

        if data:
            for entry in data:
                candidate = None
                candidate_user_id = None
                if hasattr(entry, "id"):
                    candidate = getattr(entry, "id", None)
                    candidate_user_id = getattr(entry, "user_id", None)
                if candidate is None and isinstance(entry, dict):
                    candidate = entry.get("id")
                    candidate_user_id = entry.get("user_id")
                if candidate:
                    if candidate_user_id:
                        affected_user_ids.add(_normalized(candidate_user_id))
                    _delete_connection(candidate)

    if user_id:
        affected_user_ids.add(user_id)

    for uid in list(affected_user_ids):
        if uid:
            _clear_cached_profile(uid)
            with _ACTIVE_USER_ID_LOCK:
                _ACTIVE_BY_APP_USER.pop(uid, None)

    if errors and not removed_ids:
        return error_response(
            "Failed to disconnect Gmail",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="; ".join(errors),
        )

    response_payload: dict[str, Any] = {
        "ok": True,
        "disconnected": bool(removed_ids),
        "removed_connection_ids": removed_ids,
    }
    if not removed_ids:
        response_payload["message"] = "No Gmail connection found"

    if errors:
        response_payload["warnings"] = errors
    return JSONResponse(response_payload)


def _normalize_tool_response(result: Any) -> Dict[str, Any]:
    payload_dict: Optional[Dict[str, Any]] = None
    try:
        if hasattr(result, "model_dump"):
            payload_dict = result.model_dump()
        elif hasattr(result, "dict"):
            payload_dict = result.dict()
    except Exception:
        payload_dict = None

    if payload_dict is None:
        try:
            if hasattr(result, "model_dump_json"):
                payload_dict = json.loads(result.model_dump_json())
        except Exception:
            payload_dict = None

    if payload_dict is None:
        if isinstance(result, dict):
            payload_dict = result
        elif isinstance(result, list):
            payload_dict = {"items": result}
        else:
            payload_dict = {"repr": str(result)}

    return payload_dict


# Execute Gmail operations through Composio SDK with error handling
def execute_gmail_tool(
    tool_name: str,
    composio_user_id: str,
    *,
    arguments: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    prepared_arguments: Dict[str, Any] = {}
    if isinstance(arguments, dict):
        for key, value in arguments.items():
            if value is not None:
                prepared_arguments[key] = value

    prepared_arguments.setdefault("user_id", "me")

    try:
        client = _get_composio_client()
        result = client.client.tools.execute(
            tool_name,
            user_id=composio_user_id,
            arguments=prepared_arguments,
        )
        return _normalize_tool_response(result)
    except Exception as exc:
        logger.exception(
            "gmail tool execution failed",
            extra={"tool": tool_name, "user_id": composio_user_id},
        )
        raise RuntimeError(f"{tool_name} invocation failed: {exc}") from exc
