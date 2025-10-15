"""LLM-based Gmail account resolver with deterministic-first fallback."""

import json
from typing import Optional
from dataclasses import dataclass

from config import get_settings
from logging_config import logger
from openrouter_client import request_chat_completion
from persistence import get_db_session, ConnectionRepository


@dataclass
class EmailResolution:
    """Result of email account resolution."""

    selected_email: Optional[str]
    source: str
    confidence: str
    needs_clarification: bool = False
    clarification_question: Optional[str] = None


def _fuzzy_score(local_part: str, token: str) -> float:
    """Compute fuzzy match score between local part and token using simple metrics."""
    local_lower = local_part.lower()
    token_lower = token.lower()

    if local_lower == token_lower:
        return 1.0

    jaro_sim = _jaro_winkler(local_lower, token_lower)

    local_digits = "".join(c for c in local_lower if c.isdigit())
    token_digits = "".join(c for c in token_lower if c.isdigit())
    if local_digits and token_digits:
        digit_overlap = len(set(local_digits) & set(token_digits)) / max(len(local_digits), len(token_digits))
    else:
        digit_overlap = 0.0

    return 0.7 * jaro_sim + 0.3 * digit_overlap


def _jaro_winkler(s1: str, s2: str, scaling: float = 0.1) -> float:
    """Simple Jaro-Winkler similarity."""
    if s1 == s2:
        return 1.0

    len1, len2 = len(s1), len(s2)
    if len1 == 0 or len2 == 0:
        return 0.0

    match_distance = max(len1, len2) // 2 - 1
    if match_distance < 0:
        match_distance = 0

    s1_matches = [False] * len1
    s2_matches = [False] * len2
    matches = 0

    for i in range(len1):
        start = max(0, i - match_distance)
        end = min(i + match_distance + 1, len2)
        for j in range(start, end):
            if s2_matches[j] or s1[i] != s2[j]:
                continue
            s1_matches[i] = True
            s2_matches[j] = True
            matches += 1
            break

    if matches == 0:
        return 0.0

    transpositions = 0
    k = 0
    for i in range(len1):
        if not s1_matches[i]:
            continue
        while not s2_matches[k]:
            k += 1
        if s1[i] != s2[k]:
            transpositions += 1
        k += 1

    jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3.0

    prefix = 0
    for i in range(min(4, min(len1, len2))):
        if s1[i] == s2[i]:
            prefix += 1
        else:
            break

    return jaro + prefix * scaling * (1 - jaro)


async def _llm_resolve(
    query: str, accounts: list[dict[str, str | None]], default_email: Optional[str], model: str, api_key: str
) -> EmailResolution:
    """Use LLM to resolve ambiguous email account selection."""
    free_domains = ["gmail.com", "outlook.com", "yahoo.com", "icloud.com", "hotmail.com"]

    prompt = {
        "utterance": query,
        "connected_accounts": accounts,
        "default_email": default_email,
        "free_domains": free_domains,
    }

    system_message = """You resolve which Gmail account a user intends to use. Choose a single connected account email or return default.

Rules:
- If the user specified a type (e.g., "work", "personal") but multiple accounts match, set needs_clarification to true
- If the query is generic (e.g., "check my email"), return the default
- Use fuzzy matching for typos/shorthand in email addresses
- Use domain heuristics: non-free domains = work, free domains = personal

Return JSON only:
{
  "selected_email": "email@domain.com",
  "decision": "fuzzy|label|inferred_work|default",
  "confidence": "high|med|low",
  "needs_clarification": false,
  "clarification_question": "optional question if needs_clarification is true"
}"""

    messages = [{"role": "user", "content": json.dumps(prompt, indent=2)}]

    try:
        response = await request_chat_completion(api_key=api_key, model=model, messages=messages, system=system_message)

        content = response.get("choices", [{}])[0].get("message", {}).get("content", "{}")
        result = json.loads(content)

        return EmailResolution(
            selected_email=result.get("selected_email"),
            source=f"llm:{result.get('decision', 'unknown')}",
            confidence=result.get("confidence", "low"),
            needs_clarification=result.get("needs_clarification", False),
            clarification_question=result.get("clarification_question"),
        )
    except Exception:
        logger.exception("LLM email resolution failed")
        return EmailResolution(
            selected_email=default_email, source="llm_fallback_to_default", confidence="low", needs_clarification=False
        )


async def resolve_gmail_account(user_id: str, query: str) -> EmailResolution:
    """
    Resolve which Gmail account to use for the current execution.

    Uses deterministic-first strategy, then LLM fallback for ambiguous cases.
    """
    from logging_config import logger

    settings = get_settings()

    db = next(get_db_session())
    try:
        repo = ConnectionRepository(db)
        connections = repo.fetch_by_user(user_id, "gmail")

        logger.info(f"[GMAIL_RESOLVER] Found {len(connections)} total connections for user {user_id}")

        connected = [c for c in connections if c.status == "connected"]
        logger.info(f"[GMAIL_RESOLVER] {len(connected)} connected accounts")

        if not connected:
            logger.warning("[GMAIL_RESOLVER] No connected accounts found")
            return EmailResolution(
                selected_email=None, source="no_accounts", confidence="high", needs_clarification=False
            )

        if len(connected) == 1:
            account = connected[0]
            logger.info(
                f"[GMAIL_RESOLVER] Single account: email={account.email}, composio_id={account.composio_user_id}"
            )
            return EmailResolution(
                selected_email=account.email or account.composio_user_id,
                source="single",
                confidence="high",
                needs_clarification=False,
            )

        default_account = next((c for c in connected if c.is_default), connected[0])
        default_email = default_account.email or default_account.composio_user_id

        logger.info(
            f"[GMAIL_RESOLVER] Default account: email={default_account.email}, "
            f"composio_id={default_account.composio_user_id}, is_default={default_account.is_default}"
        )

        query_lower = query.lower()

        for conn in connected:
            if conn.email and conn.email.lower() in query_lower:
                return EmailResolution(
                    selected_email=conn.email, source="exact", confidence="high", needs_clarification=False
                )

        tokens = [t for t in query_lower.split() if len(t) > 3 and not t.isalpha()]
        if tokens:
            scores = []
            for conn in connected:
                if not conn.email:
                    continue
                local_part = conn.email.split("@")[0]
                for token in tokens:
                    score = _fuzzy_score(local_part, token)
                    scores.append((score, conn.email))

            if scores:
                scores.sort(reverse=True, key=lambda x: x[0])
                top_score, top_email = scores[0]
                runner_up_score = scores[1][0] if len(scores) > 1 else 0.0

                if top_score >= 0.88 and (top_score - runner_up_score) >= 0.08:
                    return EmailResolution(
                        selected_email=top_email, source="fuzzy", confidence="high", needs_clarification=False
                    )

        if any(keyword in query_lower for keyword in ["work", "personal", "school"]):
            accounts_data = [
                {
                    "email": c.email or c.composio_user_id,
                    "domain": c.email.split("@")[1] if c.email and "@" in c.email else "",
                }
                for c in connected
            ]

            api_key = settings.openrouter_api_key
            model = settings.execution_agent_model

            if api_key and model:
                llm_result = await _llm_resolve(query, accounts_data, default_email, model, api_key)

                # Validate LLM result
                valid_identifiers = {c.email for c in connected if c.email} | {c.composio_user_id for c in connected}
                if llm_result.selected_email and llm_result.selected_email in valid_identifiers:
                    logger.info(f"[GMAIL_RESOLVER] LLM selected valid account: {llm_result.selected_email}")
                    return llm_result
                else:
                    logger.warning(
                        f"[GMAIL_RESOLVER] LLM returned invalid/null selection: {llm_result.selected_email}, "
                        f"falling back to default: {default_email}"
                    )

        result_email = default_email
        logger.info(f"[GMAIL_RESOLVER] Returning default: {result_email}")

        return EmailResolution(
            selected_email=result_email, source="default", confidence="high", needs_clarification=False
        )

    finally:
        db.close()
