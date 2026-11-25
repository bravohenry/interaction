import Image from "next/image";
import { Suspense } from "react";
import { PanelClient } from "./client/panel-client";
import { PanelSkeleton } from "./skeletons/panel-skeleton";

export function PanelShell() {
  return (
    <div className="relative z-20 min-h-dvh w-full">
      <div className="-z-10 fixed inset-0">
        <Image
          alt="Background"
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src="/evening.png"
        />
        <div className="absolute inset-0 bg-linear-to-b from-black/5 via-black/10 to-black/20" />
      </div>

      <div className="relative flex min-h-dvh w-full items-center justify-center px-0 md:px-4">
        <Suspense fallback={<PanelSkeleton />}>
          <PanelClient />
        </Suspense>
      </div>
    </div>
  );
}
