"use client";

import { useSession } from "~/lib/auth-client";
import { getGreeting, getUserDisplayName } from "~/server/utils/time";

export function HomeGreeting() {
  const { data: session } = useSession();
  const greeting = getGreeting();
  const userName = getUserDisplayName(session?.user?.name);

  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-8">
      <div className="w-full text-center">
        <h1 className="mb-1 font-semibold text-3xl/9 text-gray-800 tracking-tight">
          {greeting}, {userName}
        </h1>
        <p className="text-gray-400 text-sm/6">30°C and clear sky</p>
      </div>
    </div>
  );
}
