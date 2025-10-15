# OpenPoke

**Multi-agent orchestration system** inspired by Interaction Company's Poke assistant - handles email triage, reminders, and persistent task delegation via AI agents.

**Stack**: Turborepo + pnpm | Next.js 15 (React 19 + Turbopack) + FastAPI (Python) | Postgres + Drizzle | Custom agent framework + OpenRouter + Composio (Gmail)

## What This Actually Does

Think of OpenPoke as your personal AI assistant that actually gets things done. Instead of just chatting, it:

- **Triages your emails** - Automatically identifies important messages and surfaces them
- **Sets reminders** - Creates persistent reminders that actually work
- **Delegates tasks** - Uses specialized agents to handle different types of work
- **Learns your patterns** - Adapts to how you actually work, not how you think you work

The magic happens through a two-tier agent system: an **InteractionAgent** that understands what you want, and an **ExecutionAgent** that actually does the work. No LangChain complexity, just custom-built orchestration that actually works.

## Architecture Deep Dive

### The Agent Framework

**Custom-built orchestration** (no LangChain/LangGraph):

- **InteractionAgent** → Main orchestrator, handles user messages and decides what needs to be done
- **ExecutionAgent** → Task execution specialist (email, reminders, search)
- **Direct OpenRouter API integration** → Custom client for maximum control
- **Composio for Gmail tools** → OAuth and email operations
- **Custom tool registry** → Async batch execution with 8 tool iterations max, 90s timeout

### The Stack

**Frontend (apps/app)** - Next.js 15 with React 19 + Turbopack

- App Router with API routes
- tRPC for type-safe API calls
- TanStack Query for data fetching
- Better Auth for authentication
- Tailwind v4 for styling

**Backend (apps/server)** - FastAPI with Python 3.12+

- Custom agent implementations
- OpenRouter client for AI model access
- Postgres with SQLAlchemy for persistence
- Composio integration for Gmail
- Background services for triggers and monitoring

**Database** - Postgres (remote only, no local databases)

- Drizzle ORM schema shared between frontend and backend
- Must configure `DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` in `.env`

## Requirements

- Node.js 18+, pnpm 9+
- uv (auto-manages Python and virtualenv)
- Remote Postgres database (no local databases allowed)

## Quickstart

1. **Clone and enter the repo**

   ```bash
   git clone https://github.com/shlokkhemani/OpenPoke
   cd OpenPoke
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Fill in the required API keys and database credentials (see API Keys Setup below).

3. **Install dependencies**

   ```bash
   pnpm install
   pnpm run server:sync   # optional; uv will sync on first run if you skip
   ```

4. **Run development servers**

   ```bash
   pnpm run dev
   ```

   - Web: http://localhost:3000
   - API: http://localhost:8001

5. **Connect Gmail for email workflows**

   With both services running, open http://localhost:3000, head to _Settings → Gmail_, and complete the Composio OAuth flow. This enables email drafting, replies, and the important-email monitor.

## Development Commands

### Full Stack Development

- **Both services**: `pnpm run dev` (web :3000 + API :8001)
- **Frontend only**: `cd apps/app && pnpm run dev` (Next.js at :3000)
- **Backend only**: `cd apps/server && pnpm run dev` (FastAPI at :8001)

### Validation & Build

- **Typecheck**: `pnpm run typecheck`
- **Lint**: `pnpm run lint` (Ultracite/Biome for TS, Ruff for Python)
- **Build**: `pnpm run build`
- **Start**: `pnpm run start`

### Backend Python

- **Format**: `cd apps/server && pnpm run format` (Ruff)
- **Lint**: `cd apps/server && pnpm run lint` (Ruff check + fix)
- **Type check**: `cd apps/server && pnpm run typecheck` (mypy strict)

### Database (Drizzle)

- **Push schema**: `pnpm run db:push`
- **Studio**: `pnpm run db:studio`
- **Generate**: `pnpm run db:generate`

> **Note**: All commands run from project root

## API Keys Setup

### OpenRouter (Required)

OpenRouter provides access to multiple AI models through a single API:

1. Create an account at [openrouter.ai](https://openrouter.ai/)
2. Generate an API key
3. Replace `your_openrouter_api_key_here` with your actual key in `.env`

### Composio (Required for Gmail)

Composio handles Gmail OAuth and provides email tools:

1. Sign in at [composio.dev](https://composio.dev/)
2. Create an API key
3. Set up Gmail integration and get your auth config ID
4. Replace `your_composio_api_key_here` and `your_gmail_auth_config_id_here` in `.env`

### Database (Required)

You need a remote Postgres database. No local databases are allowed:

1. Set up a Postgres database (Railway, Supabase, etc.)
2. Configure `DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` in `.env`

## Project Structure

```
openpoke/
├── apps/
│   ├── app/          # Next.js 15 frontend (:3000)
│   │   ├── src/app/          # App Router pages + API routes
│   │   ├── src/components/   # React UI components
│   │   ├── src/server/       # Server-side TypeScript
│   │   │   ├── db/           # Drizzle ORM schema (shared)
│   │   │   └── lib/          # Better Auth, logger, response types
│   │   ├── src/lib/          # Client utilities + hooks
│   │   └── src/trpc/         # tRPC client setup
│   └── server/       # FastAPI backend (:8001)
│       ├── agents/           # Custom agent implementations
│       │   ├── interaction_agent/  # Main orchestrator
│       │   └── execution_agent/     # Task execution specialist
│       ├── openrouter_client/ # Custom OpenRouter API client
│       ├── routes/           # FastAPI routes
│       ├── services/         # Business logic
│       ├── persistence/     # Postgres models & repositories
│       └── models/          # Pydantic API models
├── rules/            # Development guidelines
└── .env              # Shared configuration
```

## Internal APIs

### tRPC Integration

The frontend uses tRPC for type-safe API calls:

- `/api/trpc` with `httpBatchStreamLink` + superjson
- Next.js proxies requests to FastAPI backend
- Use `getBaseUrl()` for port resolution
- TanStack Query integration with `createTRPCContext`

### Authentication

- **Frontend**: Better Auth
- **Backend**: OpenRouter API keys + Composio Gmail OAuth

## Code Style

### TypeScript

- Use `import type` for type-only imports
- Prefer `interface` over `type`
- Arrow functions, `const`, strict equality
- Never use `any`, `enums`, or `namespaces`

### React & Next.js

- Hooks at top level
- Use `<>` not `<Fragment>`
- Use Next.js `<Image>`, not `<img>`
- Import builtins with `node:` protocol
- No Array index keys or nested component definitions

### Python

- Ruff formatter (120-char line length, double quotes)
- mypy strict mode type checking
- Python 3.12+ features
- Type hints required on all functions
- Use `uv` for all Python commands

## Error Handling

- **Validation**: Zod schemas
- **Auth errors**: Throw `TRPCError`
- **Don't swallow errors** - always log or propagate
- **Follow**: `rules/logging.md` for logging patterns

## Testing

- **Frontend**: Vitest (not yet configured)
- **Backend**: pytest (not yet configured)

## License

MIT — see [LICENSE](LICENSE).
