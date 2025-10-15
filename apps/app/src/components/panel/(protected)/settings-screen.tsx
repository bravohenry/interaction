"use client";

import { useMutation } from "@tanstack/react-query";
import { BadgeCheck, ChevronRight, LogOut, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Screen } from "~/components/screen";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
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
import { authClient, useSession } from "~/lib/auth-client";
import { useTRPC } from "~/trpc/react";

export function SettingsScreen() {
  const { data: session } = useSession();
  const { setView } = useNavigation();
  const trpc = useTRPC();

  const clearHistoryMutation = useMutation(
    trpc.chat.clearHistory.mutationOptions({
      onSuccess: () => {
        toast.success("Chat history cleared");
      },
      onError: (error) => {
        toast.error(`Failed to clear history: ${error.message}`);
      },
    })
  );

  const { mutate: signOut } = useMutation({
    mutationKey: ["signOut"],
    mutationFn: async () => await authClient.signOut(),
  });

  if (!session?.user) {
    return null;
  }

  return (
    <Screen title="Settings">
      <div className="flex flex-col gap-4">
        {/* Profile Section */}
        <div className="flex w-full flex-col items-center gap-4 px-4 pt-4">
          <div
            className="relative flex items-center justify-center overflow-hidden rounded-full"
            style={{ width: "64px", height: "64px" }}
          >
            <div className="absolute inset-0">
              <Avatar className="h-full w-full">
                <AvatarImage
                  alt={session.user.name}
                  className="h-full w-full select-none object-cover opacity-100"
                  draggable="false"
                  src={session.user.image || undefined}
                  style={{ visibility: "visible" }}
                />
                <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-600 font-semibold text-white text-xl">
                  {session.user.name?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="relative flex items-center gap-1">
              <span
                className="font-exposure font-normal text-black text-xl"
                style={{ fontVariationSettings: '"EXPO" -10' }}
              >
                {session.user.name}
              </span>
              <span className="-right-6 absolute h-5 w-5">
                <BadgeCheck className="h-5 w-5 text-gray-400" />
              </span>
            </div>
            <span
              className="font-exposure font-medium text-gray-400 text-sm"
              style={{ fontVariationSettings: '"EXPO" -10' }}
            >
              @{session.user.email?.split("@")[0]}
            </span>
          </div>
        </div>

        {/* Settings Content */}
        <div className="w-full">
          <div className="flex flex-col items-start justify-start gap-9 px-4 py-6">
            {/* Main Settings Group */}
            <ItemGroup>
              <Item asChild>
                <button onClick={() => setView("connections")} type="button">
                  <ItemMedia>
                    <User className="text-gray-600" strokeWidth={2} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="text-gray-900">Connections</ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <ChevronRight
                      className="size-4 text-gray-400"
                      strokeWidth={2}
                    />
                  </ItemActions>
                </button>
              </Item>
              <ItemSeparator />
              <Item asChild variant="destructive">
                <button
                  disabled={clearHistoryMutation.isPending}
                  onClick={() => clearHistoryMutation.mutate()}
                  type="button"
                >
                  <ItemMedia>
                    <Trash2 className="text-destructive" strokeWidth={2} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {clearHistoryMutation.isPending
                        ? "Clearing..."
                        : "Clear History"}
                    </ItemTitle>
                  </ItemContent>
                </button>
              </Item>
              <ItemSeparator />
              <Item asChild>
                <button onClick={() => signOut()} type="button">
                  <ItemMedia>
                    <LogOut className="text-gray-600" strokeWidth={2} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="text-gray-900">Log out</ItemTitle>
                  </ItemContent>
                </button>
              </Item>
            </ItemGroup>
          </div>
        </div>
      </div>
    </Screen>
  );
}
