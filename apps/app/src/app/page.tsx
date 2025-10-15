import { headers } from "next/headers";
import { PanelShell } from "~/components/panel";
import { auth } from "~/server/lib/auth";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Prefetch Gmail connections to avoid loading skeleton
  if (session?.user) {
    prefetch(trpc.chat.updates.queryOptions());
    prefetch(trpc.gmail.connections.queryOptions());
  }

  return (
    <HydrateClient>
      <PanelShell />
    </HydrateClient>
  );
}

export default HomePage;
