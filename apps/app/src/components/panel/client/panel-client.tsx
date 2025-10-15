"use client";

import { AnimatePresence, motion } from "motion/react";
import { useAccountDetail, useNavigation } from "~/lib/atoms/navigation";
import { authClient } from "~/lib/auth-client";
import { SignInScreen } from "../(public)/sign-in-screen";
import { ProtectedRouter } from "./routers/protected-router";

export function PanelClient() {
  const { data: session, isPending } = authClient.useSession();
  const { view } = useNavigation();
  const accountDetailState = useAccountDetail();

  if (isPending) {
    return null;
  }

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="relative h-dvh w-full transform-gpu overflow-hidden bg-card/90 text-foreground backdrop-blur-xl md:h-[750px] md:max-w-md md:rounded-3xl md:border md:border-border/60 md:shadow-xs md:ring-3 md:ring-black/5"
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      layout
      transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {session ? (
          <ProtectedRouter
            accountDetailState={accountDetailState}
            key="protected"
            view={view}
          />
        ) : (
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 h-full"
            exit={{ opacity: 0, scale: 0.96 }}
            initial={{ opacity: 0, scale: 0.96 }}
            key="public"
            layout
            transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <SignInScreen />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
