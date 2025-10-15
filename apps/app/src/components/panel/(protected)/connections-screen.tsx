"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Screen } from "~/components/screen";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "~/components/ui/item";
import { useNavigation } from "~/lib/atoms/navigation";
import { useTRPC } from "~/trpc/react";

export function ConnectionsScreen() {
  const { navigateToAccountDetail } = useNavigation();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(
    trpc.gmail.connections.queryOptions(undefined, {
      staleTime: 120_000,
      refetchOnWindowFocus: false,
    })
  );

  const connectGmail = async (): Promise<void> => {
    const res = await fetch("/api/gmail/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return;
    const json = await res.json();
    if (json.redirect_url) {
      window.open(
        json.redirect_url,
        "gmail-oauth",
        "width=500,height=600,scrollbars=yes,resizable=yes"
      );
    }
  };

  const { mutate: handleConnect } = useMutation({
    mutationFn: connectGmail,
  });

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

  // data is directly the connections array from tRPC
  const accounts =
    data
      ?.filter((c) => c.status === "connected")
      .map((c) => ({
        id: c.id,
        email: c.email || "",
        avatarUrl: c.metadata.avatar_url,
        isDefault: Boolean(c.metadata.is_default),
      })) ?? [];

  const handleMakePrimary = (connectionId: string) => {
    setPrimaryMutation.mutate({ connectionId });
  };

  return (
    <Screen headerType="back" title="Connections">
      <div className="flex h-full flex-col overflow-y-auto px-4 py-6">
        {/* Email Accounts Section */}
        <div className="flex flex-col gap-4">
          <h2 className="px-1 font-semibold text-black text-sm uppercase tracking-wide">
            Email Accounts
          </h2>

          {accounts.length > 0 && (
            <ItemGroup>
              {accounts.map((account, index) => (
                <>
                  <Item
                    asChild
                    key={account.id}
                    onClick={() =>
                      navigateToAccountDetail(account.id, account.email)
                    }
                  >
                    <button type="button">
                      <ItemMedia variant="image">
                        <Avatar className="size-full rounded-sm">
                          <AvatarImage
                            alt={account.email}
                            src={account.avatarUrl}
                          />
                          <AvatarFallback>
                            {account.email?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>
                          <span className="truncate text-sm">
                            {account.email}
                          </span>
                          {account.isDefault && (
                            <Badge
                              className="h-5 rounded-full px-2 text-foreground"
                              variant="secondary"
                            >
                              Primary
                            </Badge>
                          )}
                        </ItemTitle>
                      </ItemContent>
                      <ItemActions>
                        <span aria-hidden className="text-muted-foreground">
                          ›
                        </span>
                      </ItemActions>
                    </button>
                  </Item>
                  {index < accounts.length - 1 && <ItemSeparator />}
                </>
              ))}
            </ItemGroup>
          )}

          {!isLoading && accounts.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-muted-foreground text-sm">
                No connected accounts
              </p>
            </div>
          )}

          {/* Hide Add Account button if there are pending connections */}
          {isLoading ? null : (
            <Button
              className="w-full rounded-xl"
              onClick={() => handleConnect()}
              variant="outline"
            >
              Add Account
            </Button>
          )}
        </div>
      </div>
    </Screen>
  );
}
