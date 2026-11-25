"use client";

import { AnimatePresence, motion } from "motion/react";
import type { PanelView } from "~/types";
import { ChatScreen } from "../../(protected)/chat-screen";
import { HomeScreen } from "../../(protected)/home-screen";
import { SettingsScreen } from "../../(protected)/settings-screen";

interface ProtectedRouterProps {
  view: PanelView;
}

export function ProtectedRouter({ view }: ProtectedRouterProps) {
  const renderView = () => {
    switch (view) {
      case "home":
        return <HomeScreen />;
      case "chat":
        return <ChatScreen />;
      case "settings":
        return <SettingsScreen />;
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
