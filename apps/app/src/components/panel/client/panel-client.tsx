"use client";

import { AnimatePresence, motion } from "motion/react";
import { useNavigation } from "~/lib/atoms/navigation";
import { useSession } from "~/lib/hooks/use-session";
import { SignInScreen } from "../(public)/sign-in-screen";
import { ProtectedRouter } from "./routers/protected-router";

export function PanelClient() {
  const { data: session, isPending } = useSession();
  const { view } = useNavigation();

  if (isPending) {
    return null;
  }

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="relative h-dvh w-full transform-gpu overflow-hidden bg-card/95 text-foreground backdrop-blur-2xl md:h-[750px] md:max-w-md md:rounded-3xl md:border md:border-border/40 md:shadow-lg md:shadow-primary/5"
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      layout
      transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {session ? (
          <ProtectedRouter
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
