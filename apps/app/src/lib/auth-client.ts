import { jwtClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "~/env";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_SERVER_URL,
  plugins: [jwtClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
