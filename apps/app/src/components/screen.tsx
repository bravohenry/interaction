"use client";

import { ChevronLeft } from "lucide-react";
import type * as React from "react";
import { CloseButton } from "~/components/ui/close-button";
import { useNavigation } from "~/lib/atoms/navigation";
import { cn } from "~/lib/utils";

interface ScreenProps {
  title: string;
  headerType?: "close" | "back";
  headerVariant?: "blur" | "solid";
  children: React.ReactNode;
}

export function Screen({
  title,
  headerType = "close",
  headerVariant = "blur",
  children,
}: ScreenProps) {
  const { goBack } = useNavigation();

  return (
    <div className="flex h-full w-full flex-grow flex-col">
      {/* Header */}
      <div
          className={cn(
          "relative sticky top-0 z-10 mx-auto flex h-12 w-full shrink-0 items-center overflow-hidden border-b p-4",
          "border-border/30",
          headerVariant === "solid"
            ? "bg-card/95 backdrop-blur-sm"
            : "bg-linear-to-b from-card/95 via-card/80 to-transparent backdrop-blur-md backdrop-saturate-110 dark:from-card/90 dark:via-card/70 dark:to-transparent"
        )}
      >
        <div className="w-10 flex-shrink-0">
          {headerType === "back" && (
            <button
              className="flex size-8 items-center justify-center rounded-full text-gray-700 transition-transform hover:bg-white/40 focus:scale-95 active:scale-75"
              onClick={goBack}
              type="button"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <div className="truncate font-medium text-black text-sm">{title}</div>
        </div>
        <div className="flex w-10 flex-shrink-0 items-center justify-end">
          {headerType === "close" && <CloseButton onClick={goBack} />}
        </div>
      </div>

      {/* Content */}
      <div className="flex h-full w-full flex-grow flex-col">
        <div className="relative h-full flex-1 overflow-visible">
          <div className="scrollbar-hide absolute inset-0 h-full w-full overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
