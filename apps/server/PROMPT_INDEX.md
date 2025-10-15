# OpenPoke Agent Prompts Index

Quick reference for all AI prompts used in the OpenPoke system.

---

## Core Agents

### 1. Interaction Agent (Main Orchestrator)

**Path**: [`agents/interaction_agent/system_prompt.md`](file:///Users/workgyver/Developer/openpoke/apps/server/agents/interaction_agent/system_prompt.md)  
**Agent**: InteractionAgent  
**Purpose**: Primary user-facing agent that orchestrates all tasks, manages conversation flow, and delegates to execution agents

**Context**: This is the "personality" of OpenPoke. Handles:

- User message parsing and response generation
- Multi-agent task delegation and parallel execution
- Email draft review/confirmation before sending
- Conversation history and context management
- Witty, warm, concise texting-style responses (à la Donna/Harvey dynamic)

**Key Behaviors**:

- Always confirms before sending emails
- Resolves multi-account Gmail references automatically
- Uses execution agents for task completion
- Avoids technical jargon with users

---

### 2. Execution Agent (Task Executor)

**Path**: [`agents/execution_agent/system_prompt.md`](file:///Users/workgyver/Developer/openpoke/apps/server/agents/execution_agent/system_prompt.md)  
**Agent**: ExecutionAgent  
**Purpose**: Backend worker that executes specific tasks (email, reminders, search) without direct user interaction

**Context**: The "execution engine" of OpenPoke. Handles:

- Gmail operations (create/send drafts, forward, reply)
- Trigger/reminder management (create/update/list via iCalendar RRULE)
- Tool execution with context from conversation history
- Reports results back to InteractionAgent

**Key Behaviors**:

- Never sends emails without explicit confirmation
- Provides verbose context to InteractionAgent (not user-friendly formatting)
- Uses timezone-aware scheduling
- Template format: `{agent_name}` and `{agent_purpose}` placeholders

---

## Specialized Prompts

### 3. Gmail Search Assistant

**Path**: [`agents/execution_agent/tasks/search_email/system_prompt.py`](file:///Users/workgyver/Developer/openpoke/apps/server/agents/execution_agent/tasks/search_email/system_prompt.py)  
**Function**: `get_system_prompt()`  
**Agent**: ExecutionAgent (search_email task)  
**Purpose**: Expert Gmail search using advanced operators and content analysis

**Context**: Dynamic prompt (includes current date) for intelligent email retrieval. Features:

- Gmail search operator expertise (from:, subject:, after:, has:attachment, etc.)
- Parallel search strategy for efficiency
- Content analysis via `clean_text` field
- Strategic use of `max_results` (default 10, up to 100 when needed)

**Key Behaviors**:

- Runs multiple targeted searches in parallel
- Reviews email content before returning results
- Uses date-aware queries (e.g., "today", "this week")
- Returns message IDs via `return_search_results` tool

---

### 4. Email Importance Classifier

**Path**: [`services/gmail/importance_classifier.py`](file:///Users/workgyver/Developer/openpoke/apps/server/services/gmail/importance_classifier.py)  
**Constant**: `_SYSTEM_PROMPT` (line 47)  
**Agent**: Background watcher (standalone)  
**Purpose**: Filters incoming Gmail messages to identify emails needing proactive user notification

**Context**: Runs in background Gmail watcher service. Determines if emails warrant immediate alerts. Criteria:

- Material impact on plans (interviews, meeting changes)
- Security-sensitive (OTP, login notices)
- Requires prompt action/decision

**Ignores**: Marketing, newsletters, order confirmations, receipts, low-priority updates

**Output**: Brief summary explaining why email matters (forwarded to InteractionAgent)

---

### 5. Conversation Summarizer

**Path**: [`services/conversation/summarization/prompt_builder.py`](file:///Users/workgyver/Developer/openpoke/apps/server/services/conversation/summarization/prompt_builder.py)  
**Constant**: `_SYSTEM_PROMPT` (line 16)  
**Agent**: Summarization service (periodic background task)  
**Purpose**: Generates working-memory briefings from conversation history

**Context**: "Chief-of-staff memory curator" that produces structured summaries for the assistant. Format includes:

- Timeline & Commitments (chronological events/meetings)
- Pending & Follow-ups (open tasks with owners/status)
- Routines & Recurring (habits, standing orders)
- Preferences & Profile (user personalization)
- Context & Notes (strategic insights)

**Key Behaviors**:

- Rebuilds entire briefing from scratch each run
- Merges new info with still-relevant facts
- Removes completed/obsolete items
- Strict structured output format

---

## Editing Workflow

1. **Interaction/Execution agents**: Edit `.md` files directly
2. **Search/Classifier/Summarizer**: Edit Python constants/functions
3. **Test changes**: Restart relevant service (`pnpm run dev`)
4. **Validate**: Run `pnpm run typecheck` and `pnpm run lint`

---

## Related Files

- **Agent implementations**: `agents/interaction_agent/agent.py`, `agents/execution_agent/agent.py`
- **Runtime logic**: `agents/*/runtime.py`
- **Tool registry**: `agents/execution_agent/tasks/`
- **OpenRouter client**: `openrouter_client/client.py`
