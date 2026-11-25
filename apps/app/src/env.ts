import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

export const env = createEnv({
  extends: [vercel()],
  server: {
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.url(),

    DATABASE_HOST: z.string().min(1),
    DATABASE_USERNAME: z.string().min(1),
    DATABASE_PASSWORD: z.string().min(1),

    GEMINI_API_KEY: z.string().min(1).optional(),

    OPENROUTER_API_KEY: z.string().min(1).optional(),
    COMPOSIO_API_KEY: z.string().min(1).optional(),
    COMPOSIO_GMAIL_AUTH_CONFIG_ID: z.string().min(1).optional(),

    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),

    PY_SERVICE_TOKEN: z.string().min(1).optional(),

    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_SERVER_URL: z.url(),
    NEXT_PUBLIC_PY_BACKEND_URL: z.url().optional(),
  },
  experimental__runtimeEnv: {
    // Client variables from process.env (Next.js)
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
    NEXT_PUBLIC_PY_BACKEND_URL: process.env.NEXT_PUBLIC_PY_BACKEND_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
