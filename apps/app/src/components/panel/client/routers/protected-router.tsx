"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { useTRPC } from "~/trpc/react";
import type { AccountDetailState, PanelView } from "~/types";
import { AccountDetailScreen } from "../../(protected)/account-detail-screen";
import { ChatScreen } from "../../(protected)/chat-screen";
import { ConnectionsScreen } from "../../(protected)/connections-screen";
import { HomeScreen } from "../../(protected)/home-screen";
import { SettingsScreen } from "../../(protected)/settings-screen";

interface ProtectedRouterProps {
  view: PanelView;
  accountDetailState: AccountDetailState | null;
}

export function ProtectedRouter({
  view,
  accountDetailState,
}: ProtectedRouterProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: connections } = useQuery(
    trpc.gmail.connections.queryOptions(undefined, {
      enabled: view === "account-detail",
    })
  );

  const setPrimaryMutation = useMutation(
    trpc.gmail.setPrimary.mutationOptions({
      onMutate: async ({ connectionId }) => {
        await queryClient.cancelQueries(trpc.gmail.connections.queryOptions());
        const previous = queryClient.getQueryData(
          trpc.gmail.connections.queryOptions().queryKey
        );
        queryClient.setQueryData(
          trpc.gmail.connections.queryOptions().queryKey,
          (old) =>
            old?.map((conn) => ({
              ...conn,
              metadata: {
                ...conn.metadata,
                is_default: conn.id === connectionId,
              },
            }))
        );
        return { previous };
      },
      onError: (error, _variables, context) => {
        if (context?.previous) {
          queryClient.setQueryData(
            trpc.gmail.connections.queryOptions().queryKey,
            context.previous
          );
        }
        toast.error(`Failed to set primary account: ${error.message}`);
      },
      onSuccess: () => {
        toast.success("Primary account updated");
      },
      onSettled: () => {
        queryClient.invalidateQueries(trpc.gmail.connections.queryOptions());
      },
    })
  );

  const currentAccount = connections?.find(
    (conn) => conn.id === accountDetailState?.accountId
  );

  const renderView = () => {
    switch (view) {
      case "home":
        return <HomeScreen />;
      case "chat":
        return <ChatScreen />;
      case "settings":
        return <SettingsScreen />;
      case "connections":
        return <ConnectionsScreen />;
      case "account-detail":
        return accountDetailState ? (
          <AccountDetailScreen
            accountId={accountDetailState.accountId}
            email={accountDetailState.email}
            isDefault={Boolean(currentAccount?.metadata.is_default)}
            onMakePrimary={() =>
              setPrimaryMutation.mutate({
                connectionId: accountDetailState.accountId,
              })
            }
          />
        ) : null;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 h-full"
        exit={{ opacity: 0, scale: 0.96 }}
        initial={{ opacity: 0, scale: 0.96 }}
        key={view}
        layout
        transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
      >
        {renderView()}
      </motion.div>
    </AnimatePresence>
  );
}
