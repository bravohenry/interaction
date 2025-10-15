# OpenPoke Development Guide

**Multi-agent orchestration system** inspired by Interaction Company's Poke assistant - handles email triage, reminders, and persistent task delegation via AI agents.

**Stack**: Turborepo + pnpm | Next.js 15 (React 19 + Turbopack) + FastAPI (Python) | MySQL + Drizzle | Custom agent framework + OpenRouter + Composio (Gmail)

**Hosting**: Vercel for frontend (Next.js) Railway for backend (Python)

## **NEVER USE EMOJIS IN YOUR REPLIES**

## 🚀 Quick Commands

### Development

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

### Testing

- **Frontend**: Vitest (not yet configured)
- **Backend**: pytest (not yet configured)

> **Note**: All commands run from project root

---

## 🏗️ Architecture

### Project Structure

**apps/app** - Next.js 15 frontend (:3000)

- `src/app/` - App Router pages + API routes
- `src/components/` - React UI components
- `src/server/` - Server-side TypeScript
  - `db/` - Drizzle ORM schema (shared with backend)
  - `lib/` - Better Auth, logger, response types
- `src/lib/` - Client utilities + hooks (TanStack Query, tRPC)
- `src/trpc/` - tRPC client setup + query client

**apps/server** - FastAPI backend (:8001)

- `agents/` - Custom agent implementations
  - `interaction_agent/` - InteractionAgent (main orchestrator, handles user messages)
  - `execution_agent/` - ExecutionAgent (task execution: email, reminders, search)
- `openrouter_client/` - Custom OpenRouter API client
- `routes/` - FastAPI routes (chat, gmail, meta)
- `services/` - Business logic (conversation, gmail, triggers)
- `persistence/` - MySQL (models, repositories via SQLAlchemy)
- `models/` - Pydantic API models

**Root**

- `.env` - Shared config (API keys: OpenAI, Anthropic, Composio; DB creds; Auth tokens)

### Internal APIs

**tRPC** - `/api/trpc` with `httpBatchStreamLink` + superjson

- Next.js proxies requests to FastAPI backend
- Use `getBaseUrl()` in `apps/app/src/trpc/react.tsx` for port resolution

### Database

**MySQL (remote only)** - MUST set in `.env`:

- `DATABASE_HOST`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`
- `DATABASE_NAME` (defaults to "openpoke")

⚠️ **NEVER use local databases** (no SQLite, no local MySQL)

### Agent Framework

**Custom-built orchestration** (no LangChain/LangGraph):

- Two-tier system: InteractionAgent → ExecutionAgent
- Direct OpenRouter API integration (custom client)
- Composio for Gmail tools & OAuth
- Custom tool registry + async batch execution
- Max 8 tool iterations, 90s timeout per agent

### Background Services

**EmailWatchCoordinator** - Multi-tenant email monitoring:

- Polls all active users with connected Gmail accounts every 60s
- Queries database for users with `is_default=true` Gmail connections
- Uses `processedEmails` table to track seen messages (no local files)
- Per-user timezone support from `user.timezone` field
- Bounded concurrency (10 users at a time) to respect Gmail API limits
- Routes important emails to each user's InteractionAgent with user context
- Lifecycle managed by FastAPI lifespan (starts/stops with app)

**TriggerScheduler** - Scheduled task execution:

- Checks database every minute for due triggers
- Reactivates original ExecutionAgent when trigger fires
- Per-agent trigger scoping (isolation between agents)

### Authentication

- **Frontend**: Better Auth
- **Backend**: OpenRouter API keys + Composio Gmail OAuth
- **OAuth flow**: Composio callbacks redirect to `/api/gmail/callback` (Next.js route) which proxies to Python backend, then redirects to `/`

### Panel Architecture

**Folder-based organization** - Auth-required components in `(protected)`, public in `(public)`

```
components/panel/
├─ panel-shell.tsx           # Server component, Suspense boundary
├─ client/
│  ├─ panel-client.tsx       # Session gating + routing
│  └─ routers/
│     ├─ public-router.tsx   # Sign-in screen
│     └─ protected-router.tsx # Authed screens (home, chat, settings, etc.)
├─ (public)/
│  └─ sign-in-screen.tsx
├─ (protected)/              # All auth-required screens
│  ├─ home-screen.tsx
│  ├─ chat-screen.tsx
│  ├─ settings-screen.tsx
│  ├─ connections-screen.tsx
│  └─ account-detail-screen.tsx
└─ skeletons/
   └─ panel-skeleton.tsx
```

**Session Management**:

- TanStack Query `useSuspenseQuery` for session state (`lib/hooks/use-session.ts`)
- Sign-in/out mutations invalidate `["session"]` query key → automatic UI flip
- NO `router.refresh()` - query invalidation handles all state updates
- NO `force-dynamic` - relies on API-level auth checks

**Flow**:

1. Panel shell wraps client in Suspense with skeleton fallback
2. Panel client queries session via TanStack Query
3. Conditional render: `session ? <ProtectedRouter /> : <PublicRouter />`
4. Sign-in mutation → invalidate session query → UI switches to protected screens
5. Sign-out mutation → invalidate session query → UI switches to sign-in

---

## 🎨 Code Style

### TypeScript

```ts
// ✅ Use import type
import type { User } from "./types";

// ✅ Prefer interface over type
interface Props {
  name: string;
}

// ✅ Arrow functions, const, ===
const greet = (name: string): string => {
  return `Hello ${name}`;
};

// ❌ NEVER use any, enums, namespaces
```

### React & Next.js

```tsx
// ✅ Hooks at top level
const Component = () => {
  const [state, setState] = useState();

  // ✅ Use <> not <Fragment>
  return <>content</>;
};

// ✅ Use Next.js <Image>, not <img>
import Image from "next/image";

// ✅ Import builtins with node: protocol
import { readFile } from "node:fs/promises";

// ✅ Prefer primitive components without conditional logic
// Let parent/server components handle auth/routing decisions
const Panel = () => {
  const { view } = useNavigation();
  return <div>{renderView(view)}</div>;
};

// ❌ No Array index keys
// ❌ No nested component definitions
// ❌ Avoid conditional auth logic in UI components
```

### tRPC + TanStack Query Integration

**IMPORTANT**: We use `@trpc/tanstack-react-query` with `createTRPCContext`

```ts
// Setup (utils/trpc.ts)
import { createTRPCContext } from "@trpc/tanstack-react-query";
export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();

// ✅ Queries: use queryOptions(input, tanstackOptions)
const trpc = useTRPC();
const query = useQuery(
  trpc.greeting.queryOptions({ name: "Jerry" }, { staleTime: 1000 })
);

// ✅ Suspense queries
const suspenseQuery = useSuspenseQuery(
  trpc.greeting.queryOptions({ name: "Jerry" }, { refetchInterval: 2000 })
);

// ✅ Mutations: use mutationOptions({ callbacks })
const mutation = useMutation(
  trpc.createUser.mutationOptions({
    onSuccess: (data) => {
      /* ... */
    },
    onMutate: async (vars) => {
      /* optimistic update */
    },
  })
);

// ✅ Get query key for invalidation
const queryKey = trpc.greeting.queryKey();
queryClient.invalidateQueries({ queryKey });

// ❌ NEVER use trpc.greeting.useQuery() - old API
// ❌ NEVER spread ...trpc.greeting.queryOptions() and add callbacks separately
```

**Custom Hooks**: Return hook directly, don't destructure

```ts
// ✅ Good - preserves all TanStack Query functionality
export function useUser() {
  return useQuery({ queryKey: ["user"], queryFn: fetchUser });
}

// ❌ Bad - loses refetch, fetchStatus, etc.
export function useUser() {
  const query = useQuery({ queryKey: ["user"], queryFn: fetchUser });
  return { data: query.data, isLoading: query.isLoading };
}
```

### General Style

- `const` for immutables, `===` not `==`
- Template literals over concatenation
- `for-of` not `.forEach()`
- Run `pnpm run lint` to auto-fix (Biome via Ultracite)

### Python

- **Formatter**: Ruff (120-char line length, double quotes)
- **Type checking**: mypy strict mode
- **Python version**: 3.12+ features
- **Type hints**: Required on all functions
- **Runner**: Use `uv` for all Python commands

---

## ⚠️ Error Handling

- **Validation**: Use Zod schemas
- **Auth errors**: Throw `TRPCError`
- **Don't swallow errors** - always log or propagate

---

## 🎯 React useEffect Guidelines

**Read first**: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

**Don't use `useEffect` for**:

- Transforming data for rendering → use variables or `useMemo`
- Handling user events → use event handlers
- Resetting state when props change → use `key` prop or calculate during render
- Updating state based on props/state → calculate during render

**Only use `useEffect` for**:

- Synchronizing with external systems (APIs, DOM, third-party libraries)
- Cleanup that must happen when component unmounts

---

## 🔧 Configuration Notes

- **Formatting**: Biome via Ultracite for TS; Ruff for Python
- **CSS**: Tailwind v4
- **Port resolution**: Use `getBaseUrl()` - don't hardcode ports
- **Package updates**: For latest docs on AI SDK, Composio, Pydantic → use Context7 MCP or web fetch

---

## 📁 File System Navigation (eza)

```bash
# Tree view
eza --tree

# List all with metadata
eza -la

# Tree 3 levels, ignore cruft
eza --tree -L 3 -I 'node_modules|.git'
```

Use eza to understand directory structure before reading/editing files.
