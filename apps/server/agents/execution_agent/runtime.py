"""Simplified Execution Agent Runtime."""

import inspect
import json
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

from .agent import ExecutionAgent
from .tools import get_tool_schemas, get_tool_registry
from .gmail_resolver import resolve_gmail_account
from config import get_settings
from openrouter_client import request_chat_completion
from logging_config import logger
from services.gmail.client import set_current_app_user, resolve_and_set_active


@dataclass
class ExecutionResult:
    """Result from an execution agent."""

    agent_name: str
    success: bool
    response: str
    error: Optional[str] = None
    tools_executed: list[str] | None = None


@dataclass
class ExecutionContext:
    """Context for the current execution."""

    gmail_account_email: Optional[str] = None
    gmail_resolution_source: Optional[str] = None


class ExecutionAgentRuntime:
    """Manages the execution of a single agent request."""

    MAX_TOOL_ITERATIONS = 8

    # Initialize execution agent runtime with settings, tools, and agent instance
    def __init__(self, agent_name: str, user_id: Optional[str] = None):
        settings = get_settings()
        self.user_id = user_id
        self.execution_context = ExecutionContext()

        # Set user context for log store
        if user_id:
            from services.execution import set_execution_log_user, set_roster_user

            set_execution_log_user(user_id)
            set_roster_user(user_id)

        self.agent = ExecutionAgent(agent_name)
        self.api_key = settings.openrouter_api_key
        self.model = settings.execution_agent_model
        self.tool_registry = get_tool_registry(agent_name=agent_name)
        self.tool_schemas = get_tool_schemas()

        if not self.api_key:
            raise ValueError("OpenRouter API key not configured. Set OPENROUTER_API_KEY environment variable.")

    # Check if Gmail tools are in the toolkit
    def _uses_gmail_tools(self) -> bool:
        """Check if any Gmail tools are registered."""
        gmail_tool_prefixes = ["gmail_", "create_draft", "send_draft", "send_reply", "delete_draft", "search_email"]
        for tool_name in self.tool_registry.keys():
            if any(tool_name.lower().startswith(prefix) for prefix in gmail_tool_prefixes):
                return True
        return False

    # Main execution loop for running agent with LLM calls and tool execution
    async def execute(self, instructions: str) -> ExecutionResult:
        """Execute the agent with given instructions."""
        try:
            # Set Gmail user context for this execution
            if self.user_id:
                set_current_app_user(self.user_id)

            # Pre-execution: resolve Gmail account if needed
            if self.user_id and self._uses_gmail_tools():
                logger.info(f"[{self.agent.name}] Resolving Gmail account for user {self.user_id}")
                resolution = await resolve_gmail_account(self.user_id, instructions)

                logger.info(
                    f"[{self.agent.name}] Resolution result: email={resolution.selected_email}, "
                    f"source={resolution.source}, needs_clarification={resolution.needs_clarification}"
                )

                if resolution.needs_clarification:
                    return ExecutionResult(
                        agent_name=self.agent.name,
                        success=False,
                        response=resolution.clarification_question
                        or "Multiple Gmail accounts found. Please specify which account to use.",
                        error="needs_clarification",
                    )

                if resolution.selected_email:
                    self.execution_context.gmail_account_email = resolution.selected_email
                    self.execution_context.gmail_resolution_source = resolution.source
                    resolve_and_set_active(resolution.selected_email)
                    logger.info(
                        f"[{self.agent.name}] Resolved Gmail account: {resolution.selected_email} (source: {resolution.source})"
                    )
                else:
                    logger.warning(
                        f"[{self.agent.name}] No Gmail account resolved - continuing without account selection"
                    )

            # Build system prompt with history
            system_prompt = self.agent.build_system_prompt_with_history()

            # Start conversation with the instruction
            messages = [{"role": "user", "content": instructions}]
            tools_executed: List[str] = []
            final_response: Optional[str] = None

            for iteration in range(self.MAX_TOOL_ITERATIONS):
                logger.info(f"[{self.agent.name}] Requesting plan (iteration {iteration + 1})")
                response = await self._make_llm_call(system_prompt, messages, with_tools=True)
                assistant_message = response.get("choices", [{}])[0].get("message", {})

                if not assistant_message:
                    raise RuntimeError("LLM response did not include an assistant message")

                raw_tool_calls = assistant_message.get("tool_calls", []) or []
                parsed_tool_calls = self._extract_tool_calls(raw_tool_calls)

                assistant_entry: Dict[str, Any] = {
                    "role": "assistant",
                    "content": assistant_message.get("content", "") or "",
                }
                if raw_tool_calls:
                    assistant_entry["tool_calls"] = raw_tool_calls
                messages.append(assistant_entry)

                if not parsed_tool_calls:
                    final_response = assistant_entry["content"] or "No action required."
                    break

                for tool_call in parsed_tool_calls:
                    tool_name = tool_call.get("name", "")
                    tool_args = tool_call.get("arguments", {})
                    call_id = tool_call.get("id")

                    if not tool_name:
                        logger.warning("Tool call missing name: %s", tool_call)
                        failure = {"error": "Tool call missing name; unable to execute."}
                        tool_message = {
                            "role": "tool",
                            "tool_call_id": call_id or "unknown_tool",
                            "content": self._format_tool_result(tool_name or "<unknown>", False, failure, tool_args),
                        }
                        messages.append(tool_message)
                        continue

                    tools_executed.append(tool_name)
                    logger.info(f"[{self.agent.name}] Executing tool: {tool_name}")

                    success, result = await self._execute_tool(tool_name, tool_args)

                    if success:
                        logger.info(f"[{self.agent.name}] Tool {tool_name} completed successfully")
                        record_payload = self._safe_json_dump(result)
                    else:
                        error_detail = str(result.get("error")) if isinstance(result, dict) else str(result)
                        logger.warning(f"[{self.agent.name}] Tool {tool_name} failed: {error_detail}")
                        record_payload = error_detail

                    self.agent.record_tool_execution(tool_name, self._safe_json_dump(tool_args), record_payload)

                    tool_message = {
                        "role": "tool",
                        "tool_call_id": call_id or tool_name,
                        "content": self._format_tool_result(tool_name, success, result, tool_args),
                    }
                    messages.append(tool_message)

            else:
                raise RuntimeError("Reached tool iteration limit without final response")

            if final_response is None:
                raise RuntimeError("LLM did not return a final response")

            self.agent.record_response(final_response)

            return ExecutionResult(
                agent_name=self.agent.name,
                success=True,
                response=final_response,
                tools_executed=tools_executed,
            )

        except Exception as e:
            logger.error(f"[{self.agent.name}] Execution failed: {e}")
            error_msg = str(e)
            failure_text = f"Failed to complete task: {error_msg}"
            self.agent.record_response(f"Error: {error_msg}")

            return ExecutionResult(agent_name=self.agent.name, success=False, response=failure_text, error=error_msg)

    # Execute OpenRouter API call with system prompt, messages, and optional tool schemas
    async def _make_llm_call(
        self, system_prompt: str, messages: list[dict[str, Any]], with_tools: bool
    ) -> dict[str, Any]:
        """Make an LLM call."""
        tools_to_send = self.tool_schemas if with_tools else None
        logger.info(
            f"[{self.agent.name}] Calling LLM with model: {self.model}, tools: {len(tools_to_send) if tools_to_send else 0}"
        )
        return await request_chat_completion(
            model=self.model,
            messages=messages,
            system=system_prompt,
            api_key=self.api_key,
            tools=tools_to_send,
        )

    # Parse and validate tool calls from LLM response into structured format
    def _extract_tool_calls(self, raw_tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract tool calls from an assistant message."""
        tool_calls: List[Dict[str, Any]] = []

        for tool in raw_tools:
            function = tool.get("function", {})
            name = function.get("name", "")
            args = function.get("arguments", "")

            if isinstance(args, str):
                try:
                    args = json.loads(args) if args else {}
                except json.JSONDecodeError:
                    args = {}

            if name:
                tool_calls.append(
                    {
                        "id": tool.get("id"),
                        "name": name,
                        "arguments": args,
                    }
                )

        return tool_calls

    # Safely convert objects to JSON with fallback to string representation
    def _safe_json_dump(self, payload: Any) -> str:
        """Serialize payload to JSON, falling back to string representation."""
        try:
            return json.dumps(payload, default=str)
        except TypeError:
            return str(payload)

    # Format tool execution results into JSON structure for LLM consumption
    def _format_tool_result(
        self,
        tool_name: str,
        success: bool,
        result: Any,
        arguments: Dict[str, Any],
    ) -> str:
        """Build a structured string for tool responses."""
        if success:
            payload: Dict[str, Any] = {
                "tool": tool_name,
                "status": "success",
                "arguments": arguments,
                "result": result,
            }
        else:
            error_detail = result.get("error") if isinstance(result, dict) else str(result)
            payload = {
                "tool": tool_name,
                "status": "error",
                "arguments": arguments,
                "error": error_detail,
            }
        return self._safe_json_dump(payload)

    # Execute tool function from registry with error handling and async support
    async def _execute_tool(self, tool_name: str, arguments: dict[str, Any]) -> tuple[bool, Any]:
        """Execute a tool. Returns (success, result)."""
        tool_func = self.tool_registry.get(tool_name)
        if not tool_func:
            return False, {"error": f"Unknown tool: {tool_name}"}

        try:
            result = tool_func(**arguments)
            if inspect.isawaitable(result):
                result = await result
            return True, result
        except Exception as e:
            return False, {"error": str(e)}
