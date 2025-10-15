"use client";

import { Palmtree } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { useSession } from "~/lib/auth-client";
import { SettingsButton } from "./settings-button";

export function HomeHeader() {
  const { data: session } = useSession();

  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-3">
      <button
        aria-label="Menu"
        className="flex size-9 items-center justify-center text-gray-600 transition-colors hover:text-gray-900"
        type="button"
      >
        <Palmtree className="size-5" strokeWidth={2} />
      </button>

      <p
        className="font-medium text-gray-400 text-sm tracking-tight"
        suppressHydrationWarning
      >
        {new Date().toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </p>

      <SettingsButton>
        <Avatar className="size-9 ring-2 ring-white/60" size="sm">
          <AvatarImage
            alt={session?.user?.name || "User"}
            src={session?.user?.image || undefined}
          />
          <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-600 font-medium text-white text-xs">
            {session?.user?.name?.[0]?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
      </SettingsButton>
    </div>
  );
}
