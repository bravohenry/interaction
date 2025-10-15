"use client";

import { ChevronRight, MessageCircle } from "lucide-react";
import { useNavigation } from "~/lib/atoms/navigation";

export function TextPokeButton() {
  const { setView } = useNavigation();

  return (
    <div className="flex w-full flex-col gap-6 px-4 pb-8">
      <div className="flex w-full flex-col gap-0 overflow-hidden rounded-2xl border border-white/40 bg-white/30 backdrop-blur-xl">
        <button
          className="group w-full"
          onClick={() => setView("chat")}
          type="button"
        >
          <div className="flex w-full items-center justify-between px-4 py-4 transition-colors group-focus-visible:bg-white/50 md:hover:bg-white/40">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="">
                <MessageCircle
                  className="h-5 w-5 text-gray-700"
                  strokeWidth={2}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="break-words text-left font-medium text-gray-800 text-sm">
                  Text Poke
                </span>
              </div>
            </div>
            <ChevronRight
              className="ml-2 h-4 w-4 flex-shrink-0 text-gray-600"
              strokeWidth={2}
            />
          </div>
        </button>
      </div>
    </div>
  );
}
