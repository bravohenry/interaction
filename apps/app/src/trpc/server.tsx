import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { TRPCQueryOptions } from "@trpc/tanstack-react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { headers } from "next/headers";
import { cache } from "react";
import type { AppRouter } from "~/lib/trpc";
import { appRouter, createTRPCContext } from "~/lib/trpc";
import { createQueryClient } from "./query-client";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () =>
  createTRPCContext({
    headers: await headers(),
  })
);

const getQueryClient = cache(createQueryClient);

export const trpc = createTRPCOptionsProxy<AppRouter>({
  router: appRouter,
  ctx: createContext,
  queryClient: getQueryClient,
});

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}
// biome-ignore lint/suspicious/noExplicitAny: it is allowing every possible type.
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptions: T
) {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === "infinite") {
    // biome-ignore lint/complexity/noVoid: for query client.
    // biome-ignore lint/suspicious/noExplicitAny: it is allowing every possible type.
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    // biome-ignore lint/complexity/noVoid: for query client.
    void queryClient.prefetchQuery(queryOptions);
  }
}
